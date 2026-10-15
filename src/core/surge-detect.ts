/** Works out whether an item (power, surge action, talent action) creates an infusion. */
import { FLAGS, MODULE_ID } from '@/constants';
import { SURGE_KEYS, type Cadence, type InfusionKind, type InfusionSurge, type SurgeKey, type UpkeepTiming } from '@/data/infusion';
import { SURGE_PRESETS } from '@/data/presets';
import { getMapping } from '@/core/mapping';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Per-item configuration stored in `flags.sargas-cosmere-infusion.config`. */
export interface ItemInfusionConfig {
    /** auto = use detection; on = always offer an infusion; off = never. */
    mode: 'auto' | 'on' | 'off';
    surge?: InfusionSurge;
    kind?: InfusionKind;
    cadence?: Cadence;
    reclaimable?: boolean;
}

export interface DetectedInfusion {
    surge: InfusionSurge;
    kind?: InfusionKind;
    cadence?: Cadence;
    hint?: string;
    /** Forced by the item configuration. */
    reclaimable?: boolean;
    /** Upkeep effects are created directly, without the dialog. */
    upkeep: boolean;
    timing?: UpkeepTiming;
}

export const itemConfig = (item: any): ItemInfusionConfig =>
    ({ mode: 'auto', ...(item?.getFlag?.(MODULE_ID, FLAGS.itemConfig) ?? {}) }) as ItemInfusionConfig;

const isSurge = (v: unknown): v is SurgeKey => SURGE_KEYS.includes(v as SurgeKey);

/** Surge key for a surge power, or an action embedded in one. */
function surgeOf(item: any): SurgeKey | null {
    const id = item?.system?.id;
    if (item?.type === 'power' && item.system?.type === 'surge' && isSurge(id)) return id;
    if (item?.type === 'action') {
        const mapped = getMapping().surgeActions[id];
        if (mapped) return mapped;
        if (isSurge(id)) return id;
    }
    const parent = item?.parent;
    if (parent?.documentName === 'Item') return surgeOf(parent);
    return null;
}

/** True for talent actions that only trigger a surge through the item event system (Binding Strike). */
export function triggersOtherItem(item: any): boolean {
    return Object.values(item?.system?.events ?? {}).some((e: any) => e?.event === 'use' && e?.handler?.type === 'use-item');
}

export function detectInfusion(item: any, { ignoreConfig = false } = {}): DetectedInfusion | null {
    if (!item) return null;
    const config: ItemInfusionConfig = ignoreConfig ? { mode: 'auto' } : itemConfig(item);
    if (config.mode === 'off') return null;
    if (config.mode === 'on') {
        const surge = config.surge ?? surgeOf(item) ?? 'custom';
        return { surge, kind: config.kind, cadence: config.cadence, reclaimable: config.reclaimable, upkeep: config.kind === 'upkeep' };
    }

    const preset = getMapping().actionPresets[item.system?.id];
    if (preset) {
        return { surge: preset.surge, kind: preset.kind, hint: preset.hint, upkeep: preset.kind === 'upkeep', timing: preset.timing };
    }

    const surge = surgeOf(item);
    if (!surge || !SURGE_PRESETS[surge].infuses) return null;
    return { surge, upkeep: false };
}

/** Investiture actually spent by the system for this use (from the consume dialog). */
export function investitureSpent(options: any): number {
    const responses: any[] = options?.consumeResponse ?? [];
    return responses
        .filter((r) => r?.type === 'resource' && r?.resource === 'inv')
        .reduce((sum, r) => sum + (Number(r?.value?.actual) || 0), 0);
}
