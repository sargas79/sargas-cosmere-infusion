/**
 * Single source of truth for infusions: reads them from the caster's flags and commits engine results
 * (flags + current Investiture in one update, then markers, chat and hooks).
 */
import { FLAGS, MODULE_HOOKS, MODULE_ID } from '@/constants';
import { normalizeInfusion, parseInfusions, type Infusion, type InfusionInit } from '@/data/infusion';
import { STORMLIGHT_ACTIONS } from '@/data/presets';
import { casterState } from '@/core/actor-data';
import type { EngineResult, LogEntry } from '@/core/engine';
import { postSummary } from '@/core/chat';
import { syncMarkers } from '@/core/markers';
import { syncSubEffects } from '@/core/sub-effects';
import { asGM, registerHandler } from '@/core/relay';
import { getSetting } from '@/settings';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Update option that tells our own `updateActor` listener to ignore this update. */
export const UPDATE_OPTION = 'sciInternal';

export function getInfusions(actor: any): Infusion[] {
    return parseInfusions(actor?.getFlag?.(MODULE_ID, FLAGS.infusions));
}

export interface CommitOptions {
    /** Post the Triggers chat card for the result's log. */
    chat?: boolean;
}

/** Writes an engine result to the actor (or asks the GM to, if this user doesn't own it). */
export async function commit(actor: any, result: Pick<EngineResult, 'inv' | 'infusions' | 'log'> & { ended?: Infusion[] }, options: CommitOptions = {}) {
    if (!actor.isOwner) {
        await asGM('commit', {
            actorUuid: actor.uuid,
            inv: result.inv,
            infusions: result.infusions,
            ended: result.ended ?? [],
            log: result.log,
            chat: options.chat,
        }, { queue: false });
        return;
    }

    const before = getInfusions(actor);
    const update: Record<string, unknown> = {
        [`flags.${MODULE_ID}.${FLAGS.infusions}`]: result.infusions,
    };
    if (result.inv !== casterState(actor).inv) update['system.resources.inv.value'] = result.inv;
    await actor.update(update, { [UPDATE_OPTION]: true });

    await syncMarkers(actor, before, result.infusions);
    await syncSubEffects(actor, before, result.infusions);
    await endUpkeepSideEffects(actor, result.ended ?? []);
    if (options.chat) await postSummary(actor, result.log, [...before, ...result.infusions]);
    Hooks.callAll(MODULE_HOOKS.changed, actor, result.infusions);
}

export function initStore() {
    registerHandler('commit', async (payload: any, from: string) => {
        const actor = await fromUuid(payload.actorUuid);
        const sender = game.users.get(from);
        // Only accept changes the sender could make themselves (owners) or that come from a GM.
        if (!actor || !sender || !(sender.isGM || actor.testUserPermission(sender, 'OWNER'))) return;
        await commit(
            actor,
            { inv: payload.inv, infusions: parseInfusions(payload.infusions), ended: parseInfusions(payload.ended), log: payload.log as LogEntry[] },
            { chat: !!payload.chat },
        );
    });
}

/** Saves a new infusion and charges the caster. `charge` is Investiture not yet paid by the system. */
export async function createInfusion(actor: any, data: InfusionInit, charge = 0): Promise<Infusion> {
    const infusion = normalizeInfusion({
        ...data,
        id: foundry.utils.randomID(16),
        createdAt: { round: game.combat?.started ? game.combat.round : null, worldTime: game.time.worldTime },
    });
    const state = casterState(actor);
    const inv = infusion.source === 'gem' ? state.inv : Math.max(0, state.inv - Math.max(0, charge));
    await commit(actor, { inv, infusions: [...getInfusions(actor), infusion], log: [] });
    return infusion;
}

/** Replaces one infusion (edits from the dialog) without touching Investiture. */
export async function updateInfusion(actor: any, infusion: Infusion) {
    const list = getInfusions(actor).map((i) => (i.id === infusion.id ? normalizeInfusion(infusion) : i));
    await commit(actor, { inv: casterState(actor).inv, infusions: list, log: [] });
}

/** Ending Enhance turns its Enhanced effects off (setting). */
async function endUpkeepSideEffects(actor: any, ended: Infusion[]) {
    if (!getSetting('endEnhancedEffects')) return;
    for (const inf of ended) {
        if (inf.kind !== 'upkeep' || !inf.sourceItemUuid) continue;
        const item = fromUuidSync(inf.sourceItemUuid, { strict: false });
        if (item?.system?.id !== STORMLIGHT_ACTIONS.enhance) continue;
        const toDisable = (item.effects ?? []).filter((e: any) => !e.disabled).map((e: any) => ({ _id: e.id, disabled: true }));
        if (toDisable.length) await item.updateEmbeddedDocuments('ActiveEffect', toDisable);
        const applied = actor.effects.filter((e: any) => e.statuses?.has?.('enhanced') || e.origin === item.uuid);
        if (applied.length) await actor.deleteEmbeddedDocuments('ActiveEffect', applied.map((e: any) => e.id));
    }
}
