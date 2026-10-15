/**
 * cosmere-rpg.useItem: using a surge (or a talent that infuses) offers to create an infusion,
 * prefilled with the Investiture actually spent and the user's targets.
 */
import { SYSTEM_HOOKS } from '@/constants';
import { normalizeInfusion } from '@/data/infusion';
import { InfusionDialog, userTargets } from '@/apps/infusion-dialog';
import { owningActor } from '@/core/actor-data';
import { createInfusion, getInfusions } from '@/core/store';
import { detectInfusion, investitureSpent, triggersOtherItem } from '@/core/surge-detect';
import { getSetting } from '@/settings';
import { t } from '@/utils';
import { onBreatheStormlight } from '@/integrations/spheres';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Opens the creation flow for an item use. Exported for the chat-card button. */
export async function offerInfusion(item: any, spent: number) {
    const actor = owningActor(item);
    const detected = detectInfusion(item);
    if (!actor?.isOwner || !detected) return;

    if (detected.upkeep) {
        // One upkeep entry per source item: using Enhance again doesn't stack.
        const existing = getInfusions(actor).find((i) => i.kind === 'upkeep' && i.sourceItemUuid === item.uuid);
        if (existing) return;
        const inf = normalizeInfusion({ surge: 'upkeep', kind: 'upkeep', label: item.name, sourceItemUuid: item.uuid, timing: detected.timing });
        await createInfusion(actor, inf, 0);
        ui.notifications.info(t('SCI.Notify.UpkeepTracked', { name: item.name }));
        return;
    }

    await InfusionDialog.open(actor, {
        surge: detected.surge,
        kind: detected.kind,
        cadence: detected.cadence,
        hint: detected.hint,
        reclaimable: detected.reclaimable,
        pool: Math.max(1, spent),
        alreadyPaid: spent,
        targets: userTargets(),
        sourceItemUuid: item.uuid,
    });
}

function onUseItem(item: any, options: any) {
    void onBreatheStormlight(item);
    if (!getSetting('autoPromptOnUse')) return;
    // Talents like Binding Strike use the surge item through an item event; that use prompts instead.
    if (triggersOtherItem(item)) return;
    void offerInfusion(item, investitureSpent(options));
}

export function initUseItem() {
    Hooks.on(SYSTEM_HOOKS.useItem, onUseItem);
}
