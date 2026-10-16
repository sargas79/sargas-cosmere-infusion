/**
 * Regenerate from the start-of-turn window: uses the character's own Regenerate action (so the system
 * charges its Investiture and posts its card), then applies the healing it rolled.
 */
import { STORMLIGHT_ACTIONS } from '@/data/presets';
import { t, warn } from '@/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** The actor's Regenerate action, if it has one. */
export function regenerateItem(actor: any): any {
    return actor?.items?.find?.((i: any) => i.type === 'action' && i.system?.id === STORMLIGHT_ACTIONS.regenerate) ?? null;
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

/** Uses Regenerate and heals the character with its roll. Does nothing if the use is cancelled. */
export async function useRegenerate(actor: any) {
    const item = regenerateItem(actor);
    if (!item || typeof item.use !== 'function') return;
    const messages: any[] = [];
    const collect = (message: any) => {
        if (message.speaker?.actor === actor.id) messages.push(message);
    };
    const hook = Hooks.on('createChatMessage', collect);
    let result: unknown;
    try {
        result = await item.use({ configurable: false });
    } catch (err) {
        warn('Regenerate failed', err);
        ui.notifications.warn(t('SCI.Notify.RegenerateFailed'));
        return;
    } finally {
        Hooks.off('createChatMessage', hook);
    }
    if (result === null || result === false) return;
    await heal(actor, healingTotal(result, messages));
}
