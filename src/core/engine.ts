/**
 * Rules engine for infusions. Pure functions: they take the caster's Investiture and a list of
 * infusions and return the new state plus a log. Nothing here touches Foundry documents.
 *
 * Rules implemented (Stormlight Handbook, ch. 5-6):
 * - Infusions usually drain 1 Investiture at the start of the caster's turn.
 * - Object/character infusions drain their own pool and end at 0.
 * - Self infusions draw from the caster's current Investiture; at 0 the caster becomes
 *   non-Invested and can't maintain them.
 * - At the start of the turn, before the drain, the caster may add Investiture to infusions.
 * - Stormlight Reclamation ends an infusion after the drain and recovers what is left.
 */
import { type Infusion, drawsFromCaster } from '@/data/infusion';

export interface CasterState {
    /** Current Investiture. */
    inv: number;
    /** Maximum Investiture. */
    max: number;
    /** Empowered: Investiture refills to maximum at the start of each turn. */
    empowered?: boolean;
}

export interface TurnDecisions {
    /** Investiture to add to each infusion (by id), applied before the drain. */
    add?: Record<string, number>;
    /** Infusions to end before the drain (no refund). */
    end?: string[];
    /** Reclaimable infusions to end after the drain, recovering their remaining pool. */
    reclaim?: string[];
    /** Upkeep effects the caster chooses not to pay for this turn (they end). */
    skipUpkeep?: string[];
}

export type EndReason = 'manual' | 'pool-empty' | 'non-invested' | 'reclaimed' | 'upkeep-declined' | 'health' | 'external';

export type LogEntry =
    | { type: 'refilled'; amount: number }
    | { type: 'added'; id: string; label: string; amount: number }
    | { type: 'drained'; id: string; label: string; amount: number; remaining: number | null; fromCaster: boolean }
    | { type: 'free'; id: string; label: string }
    | { type: 'waiting'; id: string; label: string; roundsLeft: number }
    | { type: 'ended'; id: string; label: string; reason: EndReason }
    | { type: 'reclaimed'; id: string; label: string; amount: number }
    | { type: 'multiplier-reset'; id: string; label: string };

export interface EngineResult {
    inv: number;
    infusions: Infusion[];
    ended: Infusion[];
    log: LogEntry[];
}

export interface TurnOptions {
    /** Current combat round, used to expire temporary drain multipliers. */
    round?: number | null;
}

const clone = (inf: Infusion): Infusion => structuredClone(inf);
const nameOf = (inf: Infusion): string => inf.label || inf.surge;

/** Mutable working state shared by the steps below. */
class Working {
    inv: number;
    readonly max: number;
    readonly alive: Map<string, Infusion>;
    readonly ended: Infusion[] = [];
    readonly log: LogEntry[] = [];

    constructor(caster: CasterState, infusions: Infusion[]) {
        this.inv = Math.max(0, Math.floor(caster.inv));
        this.max = Math.max(0, Math.floor(caster.max));
        this.alive = new Map(infusions.map((i) => [i.id, clone(i)]));
    }

    end(inf: Infusion, reason: EndReason) {
        if (!this.alive.delete(inf.id)) return;
        this.ended.push(inf);
        this.log.push({ type: 'ended', id: inf.id, label: nameOf(inf), reason });
    }

    result(): EngineResult {
        return { inv: this.inv, infusions: [...this.alive.values()], ended: this.ended, log: this.log };
    }
}

/**
 * Applies one drain tick to an infusion. Handles the every-N-rounds cadence, free-while-Invested,
 * the temporary multiplier, pool exhaustion and self infusions drawing from the caster.
 */
function drainOnce(w: Working, inf: Infusion) {
    if (!w.alive.has(inf.id)) return;

    inf.drain.counter += 1;
    if (inf.drain.counter < inf.drain.everyNRounds) {
        w.log.push({
            type: 'waiting',
            id: inf.id,
            label: nameOf(inf),
            roundsLeft: inf.drain.everyNRounds - inf.drain.counter,
        });
        return;
    }
    inf.drain.counter = 0;

    if (inf.freeWhileInvested && w.inv >= 1) {
        w.log.push({ type: 'free', id: inf.id, label: nameOf(inf) });
        return;
    }

    const amount = inf.drain.amount * inf.drain.multiplier;
    if (amount <= 0) return;

    if (drawsFromCaster(inf)) {
        if (w.inv < amount) {
            // Not enough Investiture to sustain it: the caster can't maintain the effect.
            w.inv = 0;
            w.end(inf, 'non-invested');
            return;
        }
        w.inv -= amount;
        w.log.push({ type: 'drained', id: inf.id, label: nameOf(inf), amount, remaining: null, fromCaster: true });
        return;
    }

    const drained = Math.min(amount, inf.pool);
    inf.pool -= drained;
    w.log.push({ type: 'drained', id: inf.id, label: nameOf(inf), amount: drained, remaining: inf.pool, fromCaster: false });
    if (inf.pool <= 0) w.end(inf, 'pool-empty');
}

/** At 0 Investiture the caster is non-Invested: self infusions end (pools keep running). */
function endSelfIfNonInvested(w: Working) {
    if (w.inv > 0) return;
    for (const inf of [...w.alive.values()]) {
        if (inf.kind === 'self') w.end(inf, 'non-invested');
    }
}

/**
 * Resolves the start of the caster's turn: Empowered refill, the caster's choices (end, add, skip
 * upkeep), the drain of every round-cadence infusion, then reclaims.
 */
export function resolveTurnStart(
    caster: CasterState,
    infusions: Infusion[],
    decisions: TurnDecisions = {},
    options: TurnOptions = {},
): EngineResult {
    const w = new Working(caster, infusions);

    if (caster.empowered && w.inv < w.max) {
        w.log.push({ type: 'refilled', amount: w.max - w.inv });
        w.inv = w.max;
    }

    // Expire temporary multipliers whose window has passed.
    if (options.round != null) {
        for (const inf of w.alive.values()) {
            const until = inf.drain.multiplierUntilRound;
            if (inf.drain.multiplier > 1 && until != null && options.round > until) {
                inf.drain.multiplier = 1;
                inf.drain.multiplierUntilRound = null;
                w.log.push({ type: 'multiplier-reset', id: inf.id, label: nameOf(inf) });
            }
        }
    }

    for (const id of decisions.end ?? []) {
        const inf = w.alive.get(id);
        if (inf) w.end(inf, 'manual');
    }

    for (const [id, requested] of Object.entries(decisions.add ?? {})) {
        const inf = w.alive.get(id);
        const amount = Math.min(Math.max(0, Math.floor(requested)), w.inv);
        if (!inf || amount <= 0 || drawsFromCaster(inf)) continue;
        inf.pool += amount;
        w.inv -= amount;
        w.log.push({ type: 'added', id, label: nameOf(inf), amount });
    }

    for (const id of decisions.skipUpkeep ?? []) {
        const inf = w.alive.get(id);
        if (inf?.kind === 'upkeep') w.end(inf, 'upkeep-declined');
    }

    for (const inf of [...w.alive.values()]) {
        // End-of-turn upkeeps (Enhance) are paid in resolveTurnEnd.
        if (inf.drain.cadence === 'round' && inf.timing !== 'end') drainOnce(w, inf);
    }

    endSelfIfNonInvested(w);

    for (const id of decisions.reclaim ?? []) {
        const inf = w.alive.get(id);
        if (!inf || !inf.reclaimable || drawsFromCaster(inf)) continue;
        const recovered = Math.min(inf.pool, Math.max(0, w.max - w.inv));
        w.inv += recovered;
        w.log.push({ type: 'reclaimed', id, label: nameOf(inf), amount: recovered });
        w.alive.delete(id);
        w.ended.push(inf);
        w.log.push({ type: 'ended', id, label: nameOf(inf), reason: 'reclaimed' });
    }

    return w.result();
}

export interface TurnEndOptions {
    /** Upkeep is free this turn (Speak the Second Ideal makes Enhance free). */
    free?: boolean;
}

/**
 * Resolves the end of the caster's turn: end-of-turn upkeeps (Enhance) are ended as chosen, then paid.
 * A caster without enough Investiture can't pay and the upkeep ends.
 */
export function resolveTurnEnd(
    caster: CasterState,
    infusions: Infusion[],
    decisions: Pick<TurnDecisions, 'skipUpkeep'> = {},
    options: TurnEndOptions = {},
): EngineResult {
    const w = new Working(caster, infusions);
    for (const id of decisions.skipUpkeep ?? []) {
        const inf = w.alive.get(id);
        if (inf?.timing === 'end') w.end(inf, 'upkeep-declined');
    }
    for (const inf of [...w.alive.values()]) {
        if (inf.timing !== 'end') continue;
        if (options.free) w.log.push({ type: 'free', id: inf.id, label: nameOf(inf) });
        else drainOnce(w, inf);
    }
    endSelfIfNonInvested(w);
    return w.result();
}

/**
 * How many more drains (rounds, 10-minute blocks or days, by cadence) the infusion lasts without new
 * Investiture. Pools count their own Investiture; self and upkeep infusions count the caster's.
 * Null when it doesn't run out on its own (free while Invested, or no drain).
 */
export function durationLeft(inf: Infusion, casterInv: number): number | null {
    const perDrain = inf.drain.amount * inf.drain.multiplier;
    if (perDrain <= 0 || inf.freeWhileInvested) return null;
    const available = drawsFromCaster(inf) ? Math.max(0, casterInv) : inf.pool;
    const drains = Math.ceil(available / perDrain);
    if (drains <= 0) return 0;
    return drains * inf.drain.everyNRounds - inf.drain.counter;
}

export const CADENCE_SECONDS = { '10min': 600, day: 86_400 } as const;

export interface TimeOptions {
    /**
     * Seconds that count as one round for round-cadence infusions while time passes outside combat
     * (600 = "about 10 minutes outside scenes"). Null leaves round-cadence infusions untouched.
     */
    roundSeconds?: number | null;
}

/** Advances world time: drains `10min` and `day` infusions (and optionally round-cadence ones). */
export function advanceTime(
    caster: CasterState,
    infusions: Infusion[],
    seconds: number,
    options: TimeOptions = {},
): EngineResult {
    const w = new Working(caster, infusions);
    if (!(seconds > 0)) return w.result();

    for (const inf of [...w.alive.values()]) {
        const period =
            inf.drain.cadence === 'round' ? (options.roundSeconds ?? null) : CADENCE_SECONDS[inf.drain.cadence];
        if (!period) continue;
        inf.drain.elapsed += seconds;
        let ticks = Math.floor(inf.drain.elapsed / period);
        inf.drain.elapsed -= ticks * period;
        while (ticks-- > 0 && w.alive.has(inf.id)) drainOnce(w, inf);
    }

    endSelfIfNonInvested(w);
    return w.result();
}

/** Adds Investiture from the caster to an infusion outside the turn-start flow. */
export function addInvestiture(caster: CasterState, infusions: Infusion[], id: string, amount: number): EngineResult {
    return withState(caster, infusions, (w) => {
        const inf = w.alive.get(id);
        const n = Math.min(Math.max(0, Math.floor(amount)), w.inv);
        if (!inf || n <= 0 || drawsFromCaster(inf)) return;
        inf.pool += n;
        w.inv -= n;
        w.log.push({ type: 'added', id, label: nameOf(inf), amount: n });
    });
}

/** Ends an infusion. With `refund`, the remaining pool returns to the caster (capped at max). */
export function endInfusion(
    caster: CasterState,
    infusions: Infusion[],
    id: string,
    { refund = false, reason = 'manual' as EndReason } = {},
): EngineResult {
    return withState(caster, infusions, (w) => {
        const inf = w.alive.get(id);
        if (!inf) return;
        if (refund && !drawsFromCaster(inf)) {
            const recovered = Math.min(inf.pool, Math.max(0, w.max - w.inv));
            w.inv += recovered;
            w.log.push({ type: 'reclaimed', id, label: nameOf(inf), amount: recovered });
            w.alive.delete(id);
            w.ended.push(inf);
            w.log.push({ type: 'ended', id, label: nameOf(inf), reason: 'reclaimed' });
            return;
        }
        w.end(inf, reason);
    });
}

/**
 * Removes Investiture from an infusion from outside (e.g. a larkin's Drain Light).
 * Returns the amount actually drained in `drained`.
 */
export function drainExternal(
    caster: CasterState,
    infusions: Infusion[],
    id: string,
    amount: number,
): EngineResult & { drained: number } {
    let drained = 0;
    const result = withState(caster, infusions, (w) => {
        const inf = w.alive.get(id);
        const n = Math.max(0, Math.floor(amount));
        if (!inf || n <= 0) return;
        if (drawsFromCaster(inf)) {
            drained = Math.min(n, w.inv);
            w.inv -= drained;
            w.log.push({ type: 'drained', id, label: nameOf(inf), amount: drained, remaining: null, fromCaster: true });
            endSelfIfNonInvested(w);
            return;
        }
        drained = Math.min(n, inf.pool);
        inf.pool -= drained;
        w.log.push({ type: 'drained', id, label: nameOf(inf), amount: drained, remaining: inf.pool, fromCaster: false });
        if (inf.pool <= 0) w.end(inf, 'external');
    });
    return { ...result, drained };
}

/** Damages a health-bearing infusion; at 0 health it ends and its Investiture is lost. */
export function damageInfusion(caster: CasterState, infusions: Infusion[], id: string, amount: number): EngineResult {
    return withState(caster, infusions, (w) => {
        const inf = w.alive.get(id);
        if (!inf?.health) return;
        inf.health.value = Math.max(0, Math.min(inf.health.max, inf.health.value - Math.floor(amount)));
        if (inf.health.value <= 0) w.end(inf, 'health');
    });
}

/** Called when the caster's Investiture changed outside the module (e.g. spent on another power). */
export function onInvestitureChanged(caster: CasterState, infusions: Infusion[]): EngineResult {
    return withState(caster, infusions, (w) => endSelfIfNonInvested(w));
}

function withState(caster: CasterState, infusions: Infusion[], step: (w: Working) => void): EngineResult {
    const w = new Working(caster, infusions);
    step(w);
    return w.result();
}
