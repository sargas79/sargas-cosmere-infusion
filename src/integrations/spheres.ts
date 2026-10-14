/**
 * Sphere tracking (optional). The Stormlight Handbook stores spheres as money `loot` items priced in
 * the `spheres` currency, and dun ones in the `dun` currency. Breathe Stormlight drains one infused
 * mark or broam per Investiture recovered (turning it dun); a highstorm re-infuses everything.
 */
import { MODULE_ID } from '@/constants';
import { STORMLIGHT_ACTIONS } from '@/data/presets';
import { allActors, casterState, owningActor } from '@/core/actor-data';
import { UPDATE_OPTION } from '@/core/store';
import { getSetting } from '@/settings';
import { t } from '@/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Denominations that hold enough Stormlight to drain (chips don't count). */
const DRAINABLE = ['mark', 'broam'];

const denomination = (item: any): string => item.system?.price?.denomination?.primary ?? '';
const currency = (item: any): string => item.system?.price?.currency ?? '';
const isSphere = (item: any) => item.type === 'loot' && item.system?.isMoney;

const dunName = (name: string) => `${name} (Dun)`;
const infusedName = (name: string) => name.replace(/\s*\(Dun\)\s*$/i, '');

function infusedSpheres(actor: any): any[] {
    return actor.items
        .filter((i: any) => isSphere(i) && currency(i) === 'spheres' && DRAINABLE.includes(denomination(i)) && i.system.quantity > 0)
        .sort((a: any, b: any) => DRAINABLE.indexOf(denomination(a)) - DRAINABLE.indexOf(denomination(b)));
}

/** Finds (or prepares data for) the dun counterpart of an infused sphere item. */
function dunCounterpart(actor: any, sphere: any): any {
    return actor.items.find((i: any) => isSphere(i) && currency(i) === 'dun' && i.name === dunName(sphere.name)) ?? null;
}

/** Converts `count` spheres of `sphere` into dun ones. */
async function moveToDun(actor: any, sphere: any, count: number) {
    await sphere.update({ 'system.quantity': sphere.system.quantity - count });
    const dun = dunCounterpart(actor, sphere);
    if (dun) {
        await dun.update({ 'system.quantity': dun.system.quantity + count });
        return;
    }
    const data = sphere.toObject();
    delete data._id;
    data.name = dunName(sphere.name);
    data.system.quantity = count;
    data.system.price.currency = 'dun';
    data.system.price.unit = `dun.${denomination(sphere)}`;
    await actor.createEmbeddedDocuments('Item', [data]);
}

export async function onBreatheStormlight(item: any) {
    if (item?.system?.id !== STORMLIGHT_ACTIONS.breathe) return;
    const actor = owningActor(item);
    if (!actor?.isOwner) return;
    const state = casterState(actor);
    const missing = Math.max(0, state.max - state.inv);
    if (!missing) return;

    if (!getSetting('sphereTracking')) {
        if (getSetting('breatheRefill')) await actor.update({ 'system.resources.inv.value': state.max }, { [UPDATE_OPTION]: true });
        return;
    }

    let recovered = 0;
    for (const sphere of infusedSpheres(actor)) {
        if (recovered >= missing) break;
        const take = Math.min(sphere.system.quantity, missing - recovered);
        await moveToDun(actor, sphere, take);
        recovered += take;
    }
    if (recovered) await actor.update({ 'system.resources.inv.value': state.inv + recovered }, { [UPDATE_OPTION]: true });
    if (recovered < missing) ui.notifications.warn(t('SCI.Notify.NotEnoughSpheres', { name: actor.name, recovered, missing }));
}

/** GM: a highstorm re-infuses every dun sphere carried by every actor. */
export async function highstorm() {
    let total = 0;
    for (const actor of allActors()) {
        for (const dun of actor.items.filter((i: any) => isSphere(i) && currency(i) === 'dun' && i.system.quantity > 0)) {
            const target = actor.items.find(
                (i: any) => isSphere(i) && currency(i) === 'spheres' && i.name === infusedName(dun.name),
            );
            if (!target) continue;
            const count = dun.system.quantity;
            await target.update({ 'system.quantity': target.system.quantity + count });
            await dun.update({ 'system.quantity': 0 });
            total += count;
        }
    }
    ui.notifications.info(t('SCI.Notify.Highstorm', { count: total }));
    await ChatMessage.create({ content: `<div class="sci-chat"><h4>${t('SCI.Chat.Highstorm')}</h4></div>`, flags: { [MODULE_ID]: { summary: true } } });
}
