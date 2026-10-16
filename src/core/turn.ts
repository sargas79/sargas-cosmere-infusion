/**
 * Turn-start orchestration.
 *
 * cosmere-rpg has no initiative order: a combatant starts their (fast or slow) turn when someone clicks
 * "activate" in the tracker, which sets `flags.cosmere-rpg.activated` (or `bossFastActivated` for a
 * boss's fast turn). The client that made that update decides who runs the turn-start flow: an active
 * player who owns the actor, otherwise the GM. Exactly one client runs it, so the drain happens once.
 */
import { MODULE_HOOKS, SYSTEM_ID } from '@/constants';
import { TurnPrompt, forceContinueAll, promptsAtStart, type PromptResult } from '@/apps/turn-prompt';
import { drawsFromCaster, type Infusion } from '@/data/infusion';
import { actorTalents, allActors, casterState, freeEnhanceUpkeep, isSquire, preferredRunner } from '@/core/actor-data';
import { advanceTime, onInvestitureChanged, resolveTurnEnd, resolveTurnStart, type TurnDecisions } from '@/core/engine';
import { getMapping } from '@/core/mapping';
import { talentEffectsFor } from '@/core/modifiers';
import { offersRegenerate, regenerateCost, regenerateItem, useRegenerate } from '@/core/regenerate';
import { requestRegrowth } from '@/core/sub-effects';
import { asUser, registerHandler } from '@/core/relay';
import { UPDATE_OPTION, commit, getInfusions } from '@/core/store';
import { getSetting } from '@/settings';

/* eslint-disable @typescript-eslint/no-explicit-any */

const running = new Set<string>();
/** Turn starts requested while one was already running for the same actor; run right after it. */
const pending = new Map<string, number>();

/** True when the actor has anything to resolve at the start of its turn. */
function needsTurnStart(actor: any, prompt: boolean): boolean {
    const state = casterState(actor);
    return getInfusions(actor).length > 0 || (!!state.empowered && state.inv < state.max) || (prompt && offersRegenerate(actor));
}

/**
 * Whether the caster may reclaim this infusion at the start of the turn: it has a pool and either was
 * created reclaimable or the caster has Stormlight Reclamation for its surge.
 */
export function canReclaim(actor: any, inf: Infusion): boolean {
    if (drawsFromCaster(inf)) return false;
    if (inf.reclaimable) return true;
    if (isSquire(actor)) return false;
    const effects = getMapping().talentEffects;
    return actorTalents(actor).some((talent) =>
        talentEffectsFor(talent, effects).some((e) => e.type === 'reclaimable' && e.surge === inf.surge),
    );
}

/**
 * Runs the turn-start flow for an actor on this client: prompt (optional), then add/end/reclaim and
 * the drain, then commit and chat, then Regenerate if chosen.
 */
export async function runTurnStart(actor: any, { prompt = getSetting('promptOnTurn') } = {}): Promise<void> {
    if (!actor) return;
    if (running.has(actor.uuid)) {
        pending.set(actor.uuid, (pending.get(actor.uuid) ?? 0) + 1);
        return;
    }
    if (!needsTurnStart(actor, prompt)) return;
    running.add(actor.uuid);
    try {
        // Sustained infusions and upkeep are maintained or ended; infusions with a pool just drain, unless reclaimed.
        const infusions = getInfusions(actor);
        const asked = infusions.filter(promptsAtStart);
        const reclaim = infusions.filter((inf) => canReclaim(actor, inf));
        const round = game.combat?.started ? game.combat.round : null;
        // Regenerate is paid after the drain; what a reclaim recovers counts toward it.
        const budgeted = infusions.map((inf) => (reclaim.includes(inf) ? { ...inf, reclaimable: true } : inf));
        const regenerate = offersRegenerate(actor) ? { infusions: budgeted, round, cost: regenerateCost(regenerateItem(actor)) } : null;
        let decisions: PromptResult = {};
        if (prompt && (asked.length || reclaim.length || regenerate)) {
            decisions = await TurnPrompt.ask(actor, asked, casterState(actor), 'start', { reclaim, regenerate });
        }

        // Re-read: Investiture or infusions may have changed while the prompt was open.
        const current = getInfusions(actor);
        if (current.length || casterState(actor).empowered) {
            // Stormlight Reclamation from a talent the caster gained after creating the infusion.
            const chosen = new Set(decisions.reclaim ?? []);
            const withReclaim = current.map((inf) => (chosen.has(inf.id) && canReclaim(actor, inf) ? { ...inf, reclaimable: true } : inf));
            const result = resolveTurnStart(casterState(actor), withReclaim, decisions, { round });
            if (current.length || result.log.length) {
                await commit(actor, result, { chat: true });
                Hooks.callAll(MODULE_HOOKS.turnResolved, actor, result);
            }
        }
        if (decisions.regenerate) await useRegenerate(actor);
    } finally {
        running.delete(actor.uuid);
    }
    const queued = pending.get(actor.uuid) ?? 0;
    if (queued > 0) {
        if (queued > 1) pending.set(actor.uuid, queued - 1);
        else pending.delete(actor.uuid);
        await runTurnStart(actor, { prompt });
    }
}

/**
 * Runs the end-of-turn flow on this client: end-of-turn upkeeps (Enhance) are maintained or ended.
 * No window when the upkeep is free (Speak the Second Ideal) or can't be paid (it ends).
 */
export async function runTurnEnd(
    actor: any,
    { prompt = getSetting('promptOnTurn'), round = null as number | null } = {},
): Promise<void> {
    const key = `${actor?.uuid}:end`;
    if (!actor || running.has(key)) return;
    // Enhance lasts until the end of your next turn: the turn it was used in doesn't ask for upkeep.
    const asked = getInfusions(actor).filter((i) => i.timing === 'end' && !(round != null && i.createdAt.round === round));
    if (!asked.length) return;
    running.add(key);
    try {
        const state = casterState(actor);
        const free = freeEnhanceUpkeep(actor);
        let decisions: TurnDecisions = {};
        if (prompt && !free && state.inv >= 1) decisions = await TurnPrompt.ask(actor, asked, state, 'end');
        const result = resolveTurnEnd(casterState(actor), getInfusions(actor), decisions, { free, graceRound: round });
        await commit(actor, result, { chat: true });
    } finally {
        running.delete(key);
    }
}

/** Sends the turn-start flow to the right user (player owner, else GM). */
export async function requestTurnStart(actor: any) {
    const runner = preferredRunner(actor) ?? game.users.activeGM;
    if (!runner?.active) return;
    await asUser(runner.id, 'turnStart', { actorUuid: actor.uuid });
}

/** Sends the end-of-turn flow to the right user, if the actor has end-of-turn upkeep. */
async function requestTurnEnd(actor: any, round: number | null) {
    if (!actor || !getInfusions(actor).some((i) => i.timing === 'end')) return;
    const runner = preferredRunner(actor) ?? game.users.activeGM;
    if (!runner?.active) return;
    await asUser(runner.id, 'turnEnd', { actorUuid: actor.uuid, round });
}

/**
 * Combatant whose turn is under way, per combat. cosmere-rpg has no current turn: a turn ends when
 * another combatant is activated or the round ends. Every client tracks it from the activation updates.
 */
const currentTurn = new Map<string, { combatantId: string; round: number | null }>();

/** Ends the turn of the combatant that was acting in `combat` (this client made the change). */
function endCurrentTurn(combat: any, notify: boolean) {
    const turn = currentTurn.get(combat.id);
    const previous = combat.combatants.get(turn?.combatantId ?? '');
    currentTurn.delete(combat.id);
    if (notify && previous?.actor && getSetting('triggerMode') !== 'manual') void requestTurnEnd(previous.actor, turn?.round ?? null);
}

/** GM: closes every open turn-start window on every client, so a player who stepped away doesn't block the drain. */
export async function forceContinueEveryone() {
    for (const user of game.users) {
        if (user.active) await asUser(user.id, 'forceContinue', {});
    }
}

/** Out of combat: one round passes for every actor with infusions. */
export async function advanceRoundForAll() {
    for (const actor of allActors()) {
        if (getInfusions(actor).length) await requestTurnStart(actor);
    }
}

function onUpdateCombatant(combatant: any, changes: any, _options: any, userId: string) {
    const flags = changes?.flags?.[SYSTEM_ID];
    if (!flags) return;
    const slowStarted = flags.activated === true;
    const fastStarted = flags.bossFastActivated === true;
    if (!slowStarted && !fastStarted) return;

    const mine = userId === game.user.id;
    const combat = combatant.parent;
    if (combat && currentTurn.get(combat.id)?.combatantId !== combatant.id) endCurrentTurn(combat, mine);
    if (combat) currentTurn.set(combat.id, { combatantId: combatant.id, round: combat.round ?? null });

    const mode = getSetting('triggerMode');
    if (!mine || mode === 'manual' || !combatant.actor) return;
    // Bosses take two turns per round; by default only the first one drains.
    if (combatant.isBoss && getSetting('bossDrain') === 'first') {
        const otherAlreadyActed = slowStarted ? combatant.bossFastActivated : combatant.activated;
        if (otherAlreadyActed) return;
    }
    void requestRegrowth(combatant.actor);
    if (mode === 'turn') void requestTurnStart(combatant.actor);
}

/** A new round ends the last turn; in round mode, the client that advanced it requests every turn start. */
function onUpdateCombat(combat: any, changes: any, _options: any, userId: string) {
    if (!('round' in (changes ?? {}))) return;
    endCurrentTurn(combat, userId === game.user.id);
    if (getSetting('triggerMode') !== 'round' || userId !== game.user.id) return;
    if (!(combat.round > 0)) return;
    const seen = new Set<string>();
    for (const combatant of combat.combatants) {
        const actor = combatant.actor;
        if (!actor || seen.has(actor.uuid)) continue;
        seen.add(actor.uuid);
        void requestTurnStart(actor);
    }
}

/** World time passing drains 10-minute and daily infusions (GM client only). */
async function onUpdateWorldTime(_worldTime: number, delta: number) {
    if (!getSetting('worldTimeDrain') || game.user !== game.users.activeGM || !(delta > 0)) return;
    const freeTime = getSetting('sceneMode') === 'free' && !game.combat?.started;
    for (const actor of allActors()) {
        const infusions = getInfusions(actor);
        if (!infusions.length) continue;
        const result = advanceTime(casterState(actor), infusions, delta, { roundSeconds: freeTime ? 600 : null });
        if (result.log.length) await commit(actor, result, { chat: true });
    }
}

/** Spending Investiture elsewhere down to 0 makes the caster non-Invested: sustained infusions end. */
function onUpdateActor(actor: any, changes: any, options: any, userId: string) {
    if (userId !== game.user.id || options?.[UPDATE_OPTION]) return;
    if (changes?.system?.resources?.inv?.value === undefined) return;
    const infusions = getInfusions(actor);
    if (!infusions.some((i) => i.kind === 'self' && i.sustained)) return;
    const result = onInvestitureChanged(casterState(actor), infusions);
    if (result.ended.length) void commit(actor, result, { chat: true });
}

export function initTurns() {
    registerHandler('forceContinue', () => forceContinueAll());
    registerHandler('turnStart', async (payload: { actorUuid: string }) => {
        const actor = await fromUuid(payload.actorUuid);
        if (actor) await runTurnStart(actor);
    });
    registerHandler('turnEnd', async (payload: { actorUuid: string; round?: number | null }) => {
        const actor = await fromUuid(payload.actorUuid);
        if (actor) await runTurnEnd(actor, { round: payload.round ?? null });
    });
    Hooks.on('updateCombatant', onUpdateCombatant);
    Hooks.on('updateCombat', onUpdateCombat);
    Hooks.on('deleteCombat', (combat: any, _options: any, userId: string) => endCurrentTurn(combat, userId === game.user.id));
    Hooks.on('updateWorldTime', onUpdateWorldTime);
    Hooks.on('updateActor', onUpdateActor);
}
