/**
 * Effective identifier mapping: the built-in defaults merged with the GM's overrides from settings,
 * plus a check against the installed Stormlight Handbook compendium.
 */
import { HANDBOOK_ID } from '@/constants';
import { SURGE_KEYS, type SurgeKey } from '@/data/infusion';
import {
    DEFAULT_ACTION_PRESETS,
    DEFAULT_FORMULAS,
    DEFAULT_SUB_EFFECTS,
    DEFAULT_SURGE_ACTION_IDS,
    DEFAULT_TALENT_EFFECTS,
    type ActionInfusionPreset,
    type SubEffectPreset,
    type TalentEffect,
} from '@/data/presets';
import { getSetting } from '@/settings';
import { warn } from '@/utils';

export interface Mapping {
    surgeActions: Record<string, SurgeKey>;
    actionPresets: Record<string, ActionInfusionPreset>;
    talentEffects: Record<string, TalentEffect[]>;
    subEffects: Record<string, SubEffectPreset>;
    formulas: typeof DEFAULT_FORMULAS;
}

const isSurge = (v: unknown): v is SurgeKey => SURGE_KEYS.includes(v as SurgeKey);

export function getMapping(): Mapping {
    const overrides = (getSetting('mapping') ?? {}) as Record<string, Record<string, unknown>>;
    const surgeActions: Record<string, SurgeKey> = { ...DEFAULT_SURGE_ACTION_IDS };
    for (const [id, key] of Object.entries(overrides.surgeActions ?? {})) {
        if (key === null) delete surgeActions[id];
        else if (isSurge(key)) surgeActions[id] = key;
    }
    const actionPresets: Record<string, ActionInfusionPreset> = { ...DEFAULT_ACTION_PRESETS };
    for (const [id, preset] of Object.entries(overrides.actionPresets ?? {})) {
        if (preset === null) delete actionPresets[id];
        else if (preset && typeof preset === 'object') actionPresets[id] = preset as ActionInfusionPreset;
    }
    const talentEffects: Record<string, TalentEffect[]> = { ...DEFAULT_TALENT_EFFECTS };
    for (const [id, effects] of Object.entries(overrides.talentEffects ?? {})) {
        if (effects === null) delete talentEffects[id];
        else if (Array.isArray(effects)) talentEffects[id] = effects as TalentEffect[];
    }
    const subEffects: Record<string, SubEffectPreset> = { ...DEFAULT_SUB_EFFECTS };
    for (const [id, preset] of Object.entries(overrides.subEffects ?? {})) {
        if (preset === null) delete subEffects[id];
        else if (preset && typeof preset === 'object') subEffects[id] = preset as SubEffectPreset;
    }
    const formulas = { ...DEFAULT_FORMULAS };
    for (const [id, formula] of Object.entries(overrides.formulas ?? {})) {
        if (id in formulas && typeof formula === 'string' && formula.trim()) formulas[id as keyof typeof formulas] = formula;
    }
    return { surgeActions, actionPresets, talentEffects, subEffects, formulas };
}

export interface VerifyReport {
    available: boolean;
    surgesFound: string[];
    missingTalents: string[];
    missingActions: string[];
}

/** Compares the mapping with the installed Handbook compendium (read-only). */
export async function verifyMapping(): Promise<VerifyReport> {
    const pack = game.packs.get(`${HANDBOOK_ID}.surges`);
    const report: VerifyReport = { available: !!pack, surgesFound: [], missingTalents: [], missingActions: [] };
    if (!pack) return report;

    const index = await pack.getIndex({ fields: ['system.id', 'system.power', 'system.type'] });
    const talentKeys = new Set<string>();
    const ids = new Set<string>();
    for (const entry of index) {
        const id = entry.system?.id;
        if (!id) continue;
        ids.add(id);
        if (entry.type === 'power' && entry.system?.type === 'surge') report.surgesFound.push(id);
        if (entry.type === 'talent') talentKeys.add(`${entry.system?.power ?? 'null'}/${id}`);
    }

    const mapping = getMapping();
    for (const key of Object.keys(mapping.talentEffects)) {
        const [power, id] = key.split('/');
        // Talents from other compendiums (e.g. Ideals in radiant-paths) can't be checked here.
        if (power === '*') continue;
        if (!talentKeys.has(key) && !ids.has(id)) report.missingTalents.push(key);
    }
    for (const id of Object.keys(mapping.actionPresets)) {
        if (!ids.has(id) && !['enhance', 'gravitational-support', 'hardened-defense'].includes(id)) {
            report.missingActions.push(id);
        }
    }
    if (report.missingTalents.length) warn('Talents not found in the Handbook compendium:', report.missingTalents);
    return report;
}
