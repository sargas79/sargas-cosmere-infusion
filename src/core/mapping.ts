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
    HEALING_BONUS_TALENTS,
    SKATE_TALENTS,
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

/** Talent ids used outside `talentEffects`: sub-effect requirements and upgrades, healing and Skate talents. */
function otherTalentIds(mapping: Mapping): string[] {
    const ids = new Set<string>([...Object.keys(HEALING_BONUS_TALENTS), ...Object.values(SKATE_TALENTS)]);
    for (const preset of Object.values(mapping.subEffects)) {
        if (preset.requires) ids.add(preset.requires);
        if (preset.upgrade?.talent) ids.add(preset.upgrade.talent);
    }
    return [...ids];
}

/** Compares the mapping with the installed Handbook compendiums (read-only). */
export async function verifyMapping(): Promise<VerifyReport> {
    const pack = game.packs.get(`${HANDBOOK_ID}.surges`);
    const report: VerifyReport = { available: !!pack, surgesFound: [], missingTalents: [], missingActions: [] };
    if (!pack) return report;

    const talentKeys = new Set<string>();
    const ids = new Set<string>();
    // Surges hold the surge talents; heroic and radiant paths hold the others (Swift Healer, Ideals...).
    const itemPacks = game.packs.filter((p: { metadata?: { packageName?: string }; documentName?: string }) => p.metadata?.packageName === HANDBOOK_ID && p.documentName === 'Item');
    for (const itemPack of itemPacks) {
        const index = await itemPack.getIndex({ fields: ['system.id', 'system.power', 'system.type'] });
        for (const entry of index) {
            const id = entry.system?.id;
            if (!id) continue;
            ids.add(id);
            if (itemPack === pack && entry.type === 'power' && entry.system?.type === 'surge') report.surgesFound.push(id);
            if (entry.type === 'talent') talentKeys.add(`${entry.system?.power ?? 'null'}/${id}`);
        }
    }

    const mapping = getMapping();
    for (const key of Object.keys(mapping.talentEffects)) {
        const id = key.split('/')[1];
        if (!talentKeys.has(key) && !ids.has(id)) report.missingTalents.push(key);
    }
    for (const id of otherTalentIds(mapping)) {
        if (!ids.has(id)) report.missingTalents.push(`*/${id}`);
    }
    report.missingTalents = [...new Set(report.missingTalents)];
    for (const id of Object.keys(mapping.actionPresets)) {
        if (!ids.has(id) && !['enhance', 'gravitational-support', 'hardened-defense'].includes(id)) {
            report.missingActions.push(id);
        }
    }
    if (report.missingTalents.length) warn('Talents not found in the Handbook compendiums:', report.missingTalents);
    return report;
}
