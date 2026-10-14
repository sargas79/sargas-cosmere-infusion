/**
 * Turn-start orchestration.
 *
 * cosmere-rpg has no initiative order: a combatant starts their (fast or slow) turn when someone clicks
 * "activate" in the tracker, which sets `flags.cosmere-rpg.activated` (or `bossFastActivated` for a
 * boss's fast turn). The client that made that update decides who runs the turn-start flow: an active
 * player who owns the actor, otherwise the GM. Exactly one client runs it, so the drain happens once.
 */
import { MODULE_HOOKS, SYSTEM_ID } from '@/constants';
import { TurnPrompt, forceContinueAll } from '@/apps/turn-prompt';
import { allActors, casterState, preferredRunner } from '@/core/actor-data';
import { advanceTime, onInvestitureChanged, resolveTurnStart, type TurnDecisions } from '@/core/engine';
import { asUser, registerHandler } from '@/core/relay';
import { UPDATE_OPTION, commit, getInfusions } from '@/core/store';
import { getSetting } from '@/settings';
import { t } from '@/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

const running = new Set<string>();
/** Turn starts requested while one was already running for the same actor; run right after it. */
const pending = new Map<string, number>();

/** True when the actor has anything to resolve at the start of its turn. */
function needsTurnStart(actor: any): boolean {
    const state = casterState(actor);
    return getInfusions(actor).length > 0 || (!!state.empowered && state.inv < state.max);
}

/**
 * Runs the turn-start flow for an actor on this client: prompt (optional), then add/end/reclaim and
 * the drain, then commit and chat.
 */
export async function runTurnStart(actor: any, { prompt = getSetting('promptOnTurn') } = {}): Promise<void> {
    if (!actor) return;
    if (running.has(actor.uuid)) {
        pending.set(actor.uuid, (pending.get(actor.uuid) ?? 0) + 1);
        return;
    }
    if (!needsTurnStart(actor)) return;
    running.add(actor.uuid);
    try {
        const infusions = getInfusions(actor);
        let decisions: TurnDecisions = {};
        if (prompt && infusions.length) decisions = await TurnPrompt.ask(actor, infusions, casterState(actor));

        // Re-read: Investiture or infusions may have changed while the prompt was open.
        const round = game.combat?.started ? game.combat.round : null;
        const result = resolveTurnStart(casterState(actor), getInfusions(actor), decisions, { round });
        await commit(actor, result, { chat: t('SCI.Chat.TurnStart') });
        Hooks.callAll(MODULE_HOOKS.turnResolved, actor, result);
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

/** Sends the turn-start flow to the right user (player owner, else GM). */
export async function requestTurnStart(actor: any) {
    const runner = preferredRunner(actor) ?? game.users.activeGM;
    if (!runner?.active) return;
    await asUser(runner.id, 'turnStart', { actorUuid: actor.uuid });
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
    if (userId !== game.user.id || getSetting('triggerMode') !== 'turn') return;
    const flags = changes?.flags?.[SYSTEM_ID];
    if (!flags) return;
    const slowStarted = flags.activated === true;
    const fastStarted = flags.bossFastActivated === true;
    if (!slowStarted && !fastStarted) return;

    if (!combatant.actor) return;
    // Bosses take two turns per round; by default only the first one drains.
    if (combatant.isBoss && getSetting('bossDrain') === 'first') {
        const otherAlreadyActed = slowStarted ? combatant.bossFastActivated : combatant.activated;
        if (otherAlreadyActed) return;
    }
    void requestTurnStart(combatant.actor);
}

/** Round mode: the client that advanced the round requests every combatant's turn start. */
function onUpdateCombat(combat: any, changes: any, _options: any, userId: string) {
    if (getSetting('triggerMode') !== 'round' || userId !== game.user.id) return;
    if (!('round' in (changes ?? {})) || !(combat.round > 0)) return;
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
        if (result.log.length) await commit(actor, result, { chat: t('SCI.Chat.TimePassed') });
    }
}

/** Spending Investiture elsewhere down to 0 makes the caster non-Invested: self infusions end. */
function onUpdateActor(actor: any, changes: any, options: any, userId: string) {
    if (userId !== game.user.id || options?.[UPDATE_OPTION]) return;
    if (changes?.system?.resources?.inv?.value === undefined) return;
    const infusions = getInfusions(actor);
    if (!infusions.some((i) => i.kind === 'self')) return;
    const result = onInvestitureChanged(casterState(actor), infusions);
    if (result.ended.length) void commit(actor, result, { chat: t('SCI.Chat.NonInvested') });
}

export function initTurns() {
    registerHandler('forceContinue', () => forceContinueAll());
    registerHandler('turnStart', async (payload: { actorUuid: string }) => {
        const actor = await fromUuid(payload.actorUuid);
        if (actor) await runTurnStart(actor);
    });
    Hooks.on('updateCombatant', onUpdateCombatant);
    Hooks.on('updateCombat', onUpdateCombat);
    Hooks.on('updateWorldTime', onUpdateWorldTime);
    Hooks.on('updateActor', onUpdateActor);
}
