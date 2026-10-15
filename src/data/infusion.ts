/**
 * Infusion data model. Pure TypeScript: no Foundry imports, so it can be unit-tested.
 *
 * Infusions are stored on the caster actor at `flags.sargas-cosmere-infusion.infusions`.
 */

export const SCHEMA_VERSION = 1;

/** Surge skill keys registered by the Stormlight Handbook module. */
export const SURGE_KEYS = ['abr', 'adh', 'chs', 'dvs', 'grv', 'ill', 'prg', 'tsn', 'trs', 'trp'] as const;
export type SurgeKey = (typeof SURGE_KEYS)[number];

/** Non-surge sources that still behave like infusions. */
export type OtherSource = 'custom' | 'bead' | 'upkeep';
export type InfusionSurge = SurgeKey | OtherSource;

/**
 * - `object` / `character` / `area`: Investiture is infused into the target and drains from the infusion's pool.
 * - `self`: no pool; drains from the caster's current Investiture each round.
 * - `upkeep`: explicit-upkeep effect (Enhance, Tunneling, Gravitational Support): pay 1 at turn start or it ends.
 */
export const INFUSION_KINDS = ['object', 'character', 'area', 'self', 'upkeep'] as const;
export type InfusionKind = (typeof INFUSION_KINDS)[number];

/** How often the infusion drains. `round` follows turns; the others follow world time. */
export const CADENCES = ['round', '10min', 'day'] as const;
export type Cadence = (typeof CADENCES)[number];

export const LIGHTS = ['stormlight', 'voidlight', 'lifelight', 'towerlight', 'warlight'] as const;
export type Light = (typeof LIGHTS)[number];

export type InvestitureSource = 'caster' | 'gem';
/** When an upkeep is paid: at the start of the caster's turn, or at its end (Enhance). */
export type UpkeepTiming = 'start' | 'end';
export type RangeBasis = 'reach' | 'bond' | 'custom';

export interface InfusionTarget {
    /** Token, actor, item or other document UUID; empty for free-text targets. */
    uuid: string;
    name: string;
    img?: string;
}

export interface DrainSettings {
    /** Investiture drained each time the infusion drains (usually 1). */
    amount: number;
    /** Drain only every N rounds (Extended talents, Lingering Lightweavings). */
    everyNRounds: number;
    /** Rounds counted since the last drain. */
    counter: number;
    cadence: Cadence;
    /** Temporary multiplier (e.g. an Opportunity that burns Stormlight too quickly). */
    multiplier: number;
    /** Combat round after which the multiplier resets to 1; null = until removed manually. */
    multiplierUntilRound: number | null;
    /** Seconds of world time accumulated toward the next time-based drain. */
    elapsed: number;
}

export interface InfusionHealth {
    value: number;
    max: number;
}

export interface Infusion {
    id: string;
    v: number;
    surge: InfusionSurge;
    label: string;
    kind: InfusionKind;
    targets: InfusionTarget[];
    /** Investiture held by the infusion. Unused for `self` and `upkeep`. */
    pool: number;
    drain: DrainSettings;
    timing: UpkeepTiming;
    light: Light;
    source: InvestitureSource;
    /** No drain while the caster has at least 1 Investiture (Master of the Skies, Endless Illusions...). */
    freeWhileInvested: boolean;
    /** Can be ended after the drain to recover the remaining pool (Stormlight Reclamation). */
    reclaimable: boolean;
    range: { value: number; basis: RangeBasis };
    /** Infusions with health (Fine Control, Physical Illusion) end at 0 health. */
    health: InfusionHealth | null;
    /** Upper limit for linked targets (Group Flight, Multiplicative Lightweaving); 0 = unlimited. */
    maxTargets: number;
    /** Names of the talents that modified this infusion, shown in the UI. */
    talents: string[];
    sourceItemUuid: string | null;
    createdAt: { round: number | null; worldTime: number };
    notes: string;
}

export type InfusionInit = Partial<Omit<Infusion, 'drain' | 'range'>> & {
    drain?: Partial<DrainSettings>;
    range?: Partial<Infusion['range']>;
};

const clampInt = (value: unknown, min: number, fallback: number): number => {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.floor(n));
};

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
    allowed.includes(value as T) ? (value as T) : fallback;

const SURGE_OR_OTHER: readonly InfusionSurge[] = [...SURGE_KEYS, 'custom', 'bead', 'upkeep'];

/** Random 16-character id in the same alphabet as Foundry's `randomID`. */
export function makeId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = '';
    for (let i = 0; i < 16; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
}

/** True when the infusion consumes the caster's own Investiture instead of a pool. */
export const drawsFromCaster = (inf: Pick<Infusion, 'kind'>): boolean =>
    inf.kind === 'self' || inf.kind === 'upkeep';

/**
 * Builds a complete, valid infusion from partial data. Unknown or invalid values fall back to defaults,
 * so data written by older versions or edited by hand is always normalized.
 */
export function normalizeInfusion(data: InfusionInit): Infusion {
    const kind = oneOf(data.kind, INFUSION_KINDS, 'object');
    const health =
        data.health && typeof data.health === 'object'
            ? {
                  max: clampInt(data.health.max, 1, 1),
                  value: Math.min(clampInt(data.health.value, 0, 0), clampInt(data.health.max, 1, 1)),
              }
            : null;

    return {
        id: typeof data.id === 'string' && data.id.length > 0 ? data.id : makeId(),
        v: SCHEMA_VERSION,
        surge: oneOf(data.surge, SURGE_OR_OTHER, 'custom'),
        label: typeof data.label === 'string' ? data.label.trim() : '',
        kind,
        targets: Array.isArray(data.targets)
            ? data.targets
                  .filter((t) => t && typeof t === 'object')
                  .map((t) => ({
                      uuid: typeof t.uuid === 'string' ? t.uuid : '',
                      name: typeof t.name === 'string' ? t.name : '',
                      ...(typeof t.img === 'string' ? { img: t.img } : {}),
                  }))
            : [],
        pool: drawsFromCaster({ kind }) ? 0 : clampInt(data.pool, 0, 1),
        drain: {
            amount: clampInt(data.drain?.amount, 0, 1),
            everyNRounds: clampInt(data.drain?.everyNRounds, 1, 1),
            counter: clampInt(data.drain?.counter, 0, 0),
            cadence: oneOf(data.drain?.cadence, CADENCES, 'round'),
            multiplier: clampInt(data.drain?.multiplier, 1, 1),
            multiplierUntilRound:
                data.drain?.multiplierUntilRound == null ? null : clampInt(data.drain.multiplierUntilRound, 0, 0),
            elapsed: Math.max(0, Number(data.drain?.elapsed) || 0),
        },
        timing: data.timing === 'end' ? 'end' : 'start',
        light: oneOf(data.light, LIGHTS, 'stormlight'),
        source: data.source === 'gem' ? 'gem' : 'caster',
        freeWhileInvested: !!data.freeWhileInvested,
        reclaimable: !!data.reclaimable,
        range: {
            value: clampInt(data.range?.value, 0, 5),
            basis: oneOf(data.range?.basis, ['reach', 'bond', 'custom'] as const, 'reach'),
        },
        health,
        maxTargets: clampInt(data.maxTargets, 0, 0),
        talents: Array.isArray(data.talents) ? data.talents.filter((t) => typeof t === 'string') : [],
        sourceItemUuid: typeof data.sourceItemUuid === 'string' ? data.sourceItemUuid : null,
        createdAt: {
            round: data.createdAt?.round ?? null,
            worldTime: Number(data.createdAt?.worldTime) || 0,
        },
        notes: typeof data.notes === 'string' ? data.notes : '',
    };
}

/** Reads a stored flag value (possibly malformed) into a list of valid infusions. */
export function parseInfusions(raw: unknown): Infusion[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter((r) => r && typeof r === 'object').map((r) => normalizeInfusion(r as InfusionInit));
}

/** Surge Scaling table: ranks -> surge die and maximum size. */
export const SURGE_SCALING = [
    { rank: 1, die: 'd4', size: 'small', feet: 2.5 },
    { rank: 2, die: 'd6', size: 'medium', feet: 5 },
    { rank: 3, die: 'd8', size: 'large', feet: 10 },
    { rank: 4, die: 'd10', size: 'huge', feet: 15 },
    { rank: 5, die: 'd12', size: 'gargantuan', feet: 20 },
] as const;

export function surgeScaling(rank: number) {
    if (rank < 1) return null;
    return SURGE_SCALING[Math.min(rank, 5) - 1];
}
