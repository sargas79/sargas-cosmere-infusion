/**
 * Regenerate from the start-of-turn window: uses the character's own Regenerate action (so the system
 * posts its card and rolls its healing), charges its Investiture, then applies the healing it rolled.
 */
import { REGENERATE_COST } from '@/core/engine';
import { STORMLIGHT_ACTIONS } from '@/data/presets';
import { t, warn } from '@/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** The actor's Regenerate action, if it has one. */
export function regenerateItem(actor: any): any {
    return actor?.items?.find?.((i: any) => i.type === 'action' && i.system?.id === STORMLIGHT_ACTIONS.regenerate) ?? null;
}

/** True when the character has lost health. */
export function isHurt(actor: any): boolean {
    const health = actor?.system?.resources?.hea;
    return Number(health?.value) < Number(health?.max?.value);
}

/** The start-of-turn window offers Regenerate to hurt characters that have the action. */
export const offersRegenerate = (actor: any): boolean => !!regenerateItem(actor) && isHurt(actor);

/** Investiture the action consumes: its own consumption entry, else the Handbook's 1. */
export function regenerateCost(item: any): number {
    const entry = (item?.system?.activation?.consumption ?? []).find((c: any) => c?.resource === 'inv');
    const cost = Number(entry?.value?.min ?? entry?.value?.max);
    return Number.isFinite(cost) && cost >= 0 ? cost : REGENERATE_COST;
}

const isHealing = (roll: any) => roll?.damageType === 'heal' || roll?.options?.damageType === 'heal';

/** Healing rolled by an item use: from its return value, else from the chat messages it posted. */
function healingTotal(result: unknown, messages: any[]): number {
    const fromResult = (Array.isArray(result) ? result.flat(2) : [result]).filter(isHealing);
    const rolls = fromResult.length ? fromResult : messages.flatMap((m) => m.rolls ?? []).filter(isHealing);
    return rolls.reduce((sum: number, roll: any) => sum + (Number(roll.total) || 0), 0);
}

async function heal(actor: any, amount: number) {
    if (amount <= 0) return;
    if (typeof actor.applyHealing === 'function') return actor.applyHealing(amount);
    const health = actor.system?.resources?.hea;
    const max = Number(health?.max?.value) || 0;
    await actor.update({ 'system.resources.hea.value': Math.min(max, (Number(health?.value) || 0) + amount) });
}

/**
 * Uses Regenerate, pays its Investiture and heals the character with its roll. The choice was made in
 * the turn-start window, so the system's consume dialog is skipped and the cost is paid here. Spending
 * the last Investiture is an ordinary update, so sustained infusions end as for any other spend.
 */
export async function useRegenerate(actor: any) {
    const item = regenerateItem(actor);
    if (!item || typeof item.use !== 'function') return;
    const cost = regenerateCost(item);
    const inv = Number(actor.system?.resources?.inv?.value) || 0;
    if (inv < cost) {
        ui.notifications.warn(t('SCI.Notify.RegenerateNoInvestiture'));
        return;
    }
    const messages: any[] = [];
    const collect = (message: any) => {
        if (message.speaker?.actor === actor.id) messages.push(message);
    };
    const hook = Hooks.on('createChatMessage', collect);
    let result: unknown;
    try {
        result = await item.use({ configurable: false, shouldConsume: false });
    } catch (err) {
        warn('Regenerate failed', err);
        ui.notifications.warn(t('SCI.Notify.RegenerateFailed'));
        return;
    } finally {
        Hooks.off('createChatMessage', hook);
    }
    if (result === null || result === false) return;
    if (cost > 0) await actor.update({ 'system.resources.inv.value': inv - cost });
    await heal(actor, healingTotal(result, messages));
}
