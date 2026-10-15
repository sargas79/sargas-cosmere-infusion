/**
 * Surge presets and talent modifiers. Mechanics only (numbers and identifiers), no rules text.
 *
 * Identifiers were confirmed against the Stormlight Handbook module's `surges` compendium.
 * Talents are matched by `(system.power, system.id)` because some ids repeat across surges.
 * Everything here can be overridden from the module settings (see `core/mapping.ts`).
 */
import type { Cadence, InfusionKind, RangeBasis, SurgeKey, UpkeepTiming } from './infusion';

export interface SurgePreset {
    key: SurgeKey;
    /** Localization key of the surge name. */
    label: string;
    /** Whether the surge creates ongoing infusions (Division, Transformation, Transportation don't). */
    infuses: boolean;
    defaultKind: InfusionKind;
    /** Kinds offered in the dialog. */
    kinds: InfusionKind[];
    rangeBasis: RangeBasis;
    /** Default range in feet (reach = 5, spren bond range = 30). */
    range: number;
    cadence: Cadence;
}

const preset = (p: Omit<SurgePreset, 'label'>): SurgePreset => ({ ...p, label: `SCI.Surge.${p.key}` });

export const SURGE_PRESETS: Record<SurgeKey, SurgePreset> = {
    abr: preset({ key: 'abr', infuses: true, defaultKind: 'object', kinds: ['object', 'area', 'self'], rangeBasis: 'reach', range: 5, cadence: 'round' }),
    adh: preset({ key: 'adh', infuses: true, defaultKind: 'object', kinds: ['object', 'area', 'character'], rangeBasis: 'reach', range: 5, cadence: 'round' }),
    chs: preset({ key: 'chs', infuses: true, defaultKind: 'object', kinds: ['object', 'area', 'upkeep'], rangeBasis: 'reach', range: 5, cadence: 'round' }),
    dvs: preset({ key: 'dvs', infuses: false, defaultKind: 'object', kinds: ['object', 'area', 'character'], rangeBasis: 'reach', range: 5, cadence: 'round' }),
    grv: preset({ key: 'grv', infuses: true, defaultKind: 'self', kinds: ['self', 'character', 'object', 'upkeep'], rangeBasis: 'reach', range: 5, cadence: 'round' }),
    ill: preset({ key: 'ill', infuses: true, defaultKind: 'area', kinds: ['area', 'self'], rangeBasis: 'bond', range: 30, cadence: 'round' }),
    prg: preset({ key: 'prg', infuses: true, defaultKind: 'character', kinds: ['character'], rangeBasis: 'reach', range: 5, cadence: 'round' }),
    tsn: preset({ key: 'tsn', infuses: true, defaultKind: 'object', kinds: ['object', 'area'], rangeBasis: 'reach', range: 5, cadence: 'round' }),
    trs: preset({ key: 'trs', infuses: false, defaultKind: 'object', kinds: ['object'], rangeBasis: 'reach', range: 5, cadence: 'round' }),
    trp: preset({ key: 'trp', infuses: false, defaultKind: 'self', kinds: ['self'], rangeBasis: 'bond', range: 30, cadence: 'round' }),
};

/**
 * Ids of the actions embedded in surge powers. Compendium copies use the long name; some actor copies
 * (older imports) use the skill key itself, so both are accepted.
 */
export const DEFAULT_SURGE_ACTION_IDS: Record<string, SurgeKey> = {
    abrasion: 'abr',
    adhesion: 'adh',
    cohesion: 'chs',
    'division-attack': 'dvs',
    division: 'dvs',
    gravitation: 'grv',
    illumination: 'ill',
    progression: 'prg',
    tension: 'tsn',
    transformation: 'trs',
    transportation: 'trp',
};

/** Goal `system.id` that makes Enhance upkeep free once completed (matched by name as well). */
export const SECOND_IDEAL_GOAL = 'speak-the-second-ideal';

/** Talent and action ids that create an infusion themselves (not through a surge action). */
export interface ActionInfusionPreset {
    surge: SurgeKey | 'upkeep';
    kind: InfusionKind;
    /** Localization key of a short hint shown in the dialog. */
    hint?: string;
    /** Upkeep paid at the end of the turn instead of the start (Enhance). */
    timing?: UpkeepTiming;
}

export const DEFAULT_ACTION_PRESETS: Record<string, ActionInfusionPreset> = {
    'binding-strike': { surge: 'adh', kind: 'object', hint: 'SCI.Hint.AutoSuccessHeld' },
    'binding-shot': { surge: 'adh', kind: 'object', hint: 'SCI.Hint.AutoSuccessHeld' },
    'adhesive-trap': { surge: 'adh', kind: 'area' },
    'rigged-weaponry': { surge: 'tsn', kind: 'object', hint: 'SCI.Hint.AutoSuccessHeld' },
    'tension-parry': { surge: 'tsn', kind: 'object', hint: 'SCI.Hint.HardenedDefense' },
    'hardened-defense': { surge: 'tsn', kind: 'object', hint: 'SCI.Hint.HardenedDefense' },
    tunneling: { surge: 'upkeep', kind: 'upkeep' },
    enhance: { surge: 'upkeep', kind: 'upkeep', timing: 'end' },
    'gravitational-support': { surge: 'upkeep', kind: 'upkeep' },
};

/** Ids of the Stormlight actions granted by First Ideal talents. */
export const STORMLIGHT_ACTIONS = {
    breathe: 'breathe-stormlight',
    enhance: 'enhance',
    regenerate: 'regenerate',
} as const;

/** Talent effects on infusions. Keys are `power/id` (`*` = any power, `null` = no power). */
export type TalentEffect =
    | { type: 'everyNRanks'; surge: SurgeKey; when?: 'always' | 'gem' }
    | { type: 'freeWhileInvested'; surge: SurgeKey; when: 'always' | 'self' | 'heldOrWorn' }
    | { type: 'reclaimable'; surge: SurgeKey }
    | { type: 'range'; surge: SurgeKey; feet: number }
    | { type: 'health'; surge: SurgeKey; perRankOf: SurgeKey; when: 'fineControl' | 'physicalIllusion' }
    | { type: 'linkedTargets'; surge: SurgeKey; extra: 'ranks' | 'ranksPlusOne' }
    | { type: 'unwillingCap'; surge: SurgeKey };

export const DEFAULT_TALENT_EFFECTS: Record<string, TalentEffect[]> = {
    'adh/extended-adhesion': [{ type: 'everyNRanks', surge: 'adh' }],
    'prg/extended-regrowth': [{ type: 'everyNRanks', surge: 'prg' }],
    'tsn/extended-tension': [
        { type: 'everyNRanks', surge: 'tsn' },
        { type: 'freeWhileInvested', surge: 'tsn', when: 'heldOrWorn' },
    ],
    'null/lingering-lightweavings': [{ type: 'everyNRanks', surge: 'ill', when: 'gem' }],
    '*/lingering-lightweavings': [{ type: 'everyNRanks', surge: 'ill', when: 'gem' }],
    'grv/master-of-the-skies': [{ type: 'freeWhileInvested', surge: 'grv', when: 'self' }],
    'abr/smooth-operator': [{ type: 'freeWhileInvested', surge: 'abr', when: 'self' }],
    'ill/endless-illusions': [{ type: 'freeWhileInvested', surge: 'ill', when: 'always' }],
    'abr/stormlight-reclamation': [{ type: 'reclaimable', surge: 'abr' }],
    'adh/stormlight-reclamation': [{ type: 'reclaimable', surge: 'adh' }],
    'ill/stormlight-reclamation': [{ type: 'reclaimable', surge: 'ill' }],
    'tsn/stormlight-reclamation': [{ type: 'reclaimable', surge: 'tsn' }],
    'abr/distant-abrasion': [{ type: 'range', surge: 'abr', feet: 20 }],
    'adh/distant-surgebinding': [{ type: 'range', surge: 'adh', feet: 20 }],
    'tsn/distant-surgebinding': [{ type: 'range', surge: 'tsn', feet: 20 }],
    'chs/distant-cohesion': [{ type: 'range', surge: 'chs', feet: 20 }],
    'tsn/fine-control': [{ type: 'health', surge: 'tsn', perRankOf: 'tsn', when: 'fineControl' }],
    '*/fourth-ideal-lightweaver': [{ type: 'health', surge: 'ill', perRankOf: 'trs', when: 'physicalIllusion' }],
    'grv/group-flight': [{ type: 'linkedTargets', surge: 'grv', extra: 'ranksPlusOne' }],
    'grv/aerial-squadron': [{ type: 'linkedTargets', surge: 'grv', extra: 'ranksPlusOne' }],
    'ill/multiplicative-lightweaving': [{ type: 'linkedTargets', surge: 'ill', extra: 'ranksPlusOne' }],
    'grv/multiple-lashings': [{ type: 'unwillingCap', surge: 'grv' }],
};

/** ActiveEffect change modes (CONST.ACTIVE_EFFECT_MODES). */
export const EFFECT_MODES = { add: 2, override: 5 } as const;

export interface EffectChange {
    key: string;
    mode: number;
    value: string;
}

/**
 * Effects an infusion puts on the character it infuses (the caster for self infusions, otherwise the
 * targeted characters), shown under the infusion like Enhanced effects under Enhance.
 */
export interface SubEffectPreset {
    surge: SurgeKey;
    /** Infusion kinds that give the effect. */
    kinds: InfusionKind[];
    /** Talent `system.id` the caster needs (any power). */
    requires?: string;
    /** Icon; `status` effects use the status icon. */
    img?: string;
    /** Status id applied by the effect (e.g. restrained). */
    status?: string;
    changes?: EffectChange[];
    /** Caster talent that replaces `changes` (Flying Ace, Clothsmith). */
    upgrade?: { talent: string; changes: EffectChange[] };
    /** Rolls the caster's Regrowth healing when the infused character is activated in combat. */
    regrowth?: boolean;
}

const walkBonus = (feet: number): EffectChange[] => [{ key: 'system.movement.walk.rate.bonus', mode: EFFECT_MODES.add, value: String(feet) }];
const fly = (feet: number): EffectChange[] => [{ key: 'system.movement.fly.rate.override', mode: EFFECT_MODES.override, value: String(feet) }];
const physicalDefense = (bonus: number): EffectChange[] => [{ key: 'system.defenses.phy.bonus', mode: EFFECT_MODES.add, value: String(bonus) }];

/** Keys are effect ids; names are localized from `SCI.Effect.<id>`. */
export const DEFAULT_SUB_EFFECTS: Record<string, SubEffectPreset> = {
    skate: { surge: 'abr', kinds: ['self', 'character'], img: 'icons/svg/ice-aura.svg' },
    'frictionless-motion': {
        surge: 'abr',
        kinds: ['self', 'character'],
        requires: 'frictionless-motion',
        img: 'icons/svg/upgrade.svg',
        changes: walkBonus(10),
    },
    restrained: { surge: 'adh', kinds: ['character', 'object', 'area'], requires: 'living-adhesion', status: 'restrained', img: 'icons/svg/net.svg' },
    'basic-lashing': {
        surge: 'grv',
        kinds: ['self', 'character'],
        img: 'icons/svg/wing.svg',
        changes: fly(25),
        upgrade: { talent: 'flying-ace', changes: fly(40) },
    },
    regrowth: { surge: 'prg', kinds: ['self', 'character'], img: 'icons/svg/regen.svg', regrowth: true },
    'hardened-defense': {
        surge: 'tsn',
        kinds: ['object', 'character', 'area'],
        img: 'icons/svg/shield.svg',
        changes: physicalDefense(2),
        upgrade: { talent: 'clothsmith', changes: physicalDefense(4) },
    },
};

/** Roll formulas, evaluated with the caster's roll data. */
export const DEFAULT_FORMULAS = {
    /** Regrowth healing, used when the Progression action has no healing formula of its own. */
    regrowth: '@scalar.power.prg.die + @skills.prg.mod',
    /** Added to Regrowth healing when the caster has Swift Healer. */
    swiftHealer: '@skills.med.rank',
};

/** Talent `system.id` that adds `DEFAULT_FORMULAS.swiftHealer` to Regrowth. */
export const SWIFT_HEALER = 'swift-healer';
