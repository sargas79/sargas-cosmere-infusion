/**
 * Turns the caster's talents into infusion settings. Pure: callers pass the talents and surge ranks
 * read from the actor.
 */
import type { Infusion, InfusionKind, SurgeKey } from '@/data/infusion';
import type { EffectChange, SubEffectPreset, TalentEffect } from '@/data/presets';

export interface OwnedTalent {
    /** Talent `system.power` (surge key) or null. */
    power: string | null;
    /** Talent `system.id`. */
    id: string;
    name: string;
}

export interface ModifierContext {
    surge: SurgeKey;
    kind: InfusionKind;
    talents: OwnedTalent[];
    ranks: Partial<Record<SurgeKey, number>>;
    /** Lookup table `power/id` -> effects. */
    effects: Record<string, TalentEffect[]>;
    /** Squires use base surges only: talents never apply. */
    squire?: boolean;
    /** Tension infusion on an object the caster holds or wears. */
    heldOrWorn?: boolean;
    /** Illumination stored in a gem (Lingering Lightweavings). */
    storedInGem?: boolean;
    /** Tension infusion using Fine Control (object gains health). */
    fineControl?: boolean;
    /** Lightweaver Physical Illusion (illusion gains health). */
    physicalIllusion?: boolean;
}

export interface ModifierResult {
    everyNRounds: number;
    freeWhileInvested: boolean;
    reclaimable: boolean;
    /** Range override in feet, or null to keep the preset. */
    range: number | null;
    /** Maximum health, or null for infusions without health. */
    health: number | null;
    /** Max number of linked targets (0 = only one target). */
    maxTargets: number;
    /** Max Investiture for an unwilling target, or null when not limited by a talent. */
    unwillingCap: number | null;
    /** Talent names that changed something, for display. */
    applied: string[];
}

export function talentEffectsFor(talent: OwnedTalent, effects: Record<string, TalentEffect[]>): TalentEffect[] {
    return effects[`${talent.power ?? 'null'}/${talent.id}`] ?? effects[`*/${talent.id}`] ?? [];
}

export function computeModifiers(ctx: ModifierContext): ModifierResult {
    const out: ModifierResult = {
        everyNRounds: 1,
        freeWhileInvested: false,
        reclaimable: false,
        range: null,
        health: null,
        maxTargets: 0,
        unwillingCap: null,
        applied: [],
    };
    if (ctx.squire) return out;

    const rank = (key: SurgeKey) => Math.max(0, ctx.ranks[key] ?? 0);

    for (const talent of ctx.talents) {
        let used = false;
        for (const effect of talentEffectsFor(talent, ctx.effects)) {
            if (effect.surge !== ctx.surge) continue;
            switch (effect.type) {
                case 'everyNRanks': {
                    if (effect.when === 'gem' && !ctx.storedInGem) break;
                    const n = Math.max(1, rank(effect.surge));
                    if (n > out.everyNRounds) {
                        out.everyNRounds = n;
                        used = true;
                    }
                    break;
                }
                case 'freeWhileInvested':
                    if (
                        effect.when === 'always' ||
                        (effect.when === 'self' && ctx.kind === 'self') ||
                        (effect.when === 'heldOrWorn' && ctx.heldOrWorn)
                    ) {
                        out.freeWhileInvested = true;
                        used = true;
                    }
                    break;
                case 'reclaimable':
                    if (ctx.kind !== 'self' && ctx.kind !== 'upkeep') {
                        out.reclaimable = true;
                        used = true;
                    }
                    break;
                case 'range':
                    if (ctx.kind !== 'self' && effect.feet > (out.range ?? 0)) {
                        out.range = effect.feet;
                        used = true;
                    }
                    break;
                case 'health':
                    if (
                        (effect.when === 'fineControl' && ctx.fineControl) ||
                        (effect.when === 'physicalIllusion' && ctx.physicalIllusion)
                    ) {
                        out.health = Math.max(1, 5 * rank(effect.perRankOf));
                        used = true;
                    }
                    break;
                case 'linkedTargets': {
                    const extra = effect.extra === 'ranksPlusOne' ? rank(effect.surge) + 1 : rank(effect.surge);
                    if (extra > out.maxTargets) {
                        out.maxTargets = extra;
                        used = true;
                    }
                    break;
                }
                case 'unwillingCap':
                    out.unwillingCap = Math.max(1, rank(effect.surge));
                    used = true;
                    break;
            }
        }
        if (used && !out.applied.includes(talent.name)) out.applied.push(talent.name);
    }
    return out;
}

export interface ResolvedSubEffect {
    key: string;
    preset: SubEffectPreset;
    changes: EffectChange[];
    /** The upgrade talent applied (Flying Ace, Clothsmith). */
    upgraded: boolean;
}

/** Sub-effects an infusion gives the characters it infuses. Squires pass no talents. */
export function subEffectsFor(
    inf: Pick<Infusion, 'surge' | 'kind'>,
    talentIds: readonly string[],
    presets: Record<string, SubEffectPreset>,
): ResolvedSubEffect[] {
    const has = (id: string) => talentIds.includes(id);
    return Object.entries(presets)
        .filter(([, p]) => p.surge === inf.surge && p.kinds.includes(inf.kind) && (!p.requires || has(p.requires)))
        .map(([key, preset]) => {
            const upgraded = !!preset.upgrade && has(preset.upgrade.talent);
            return { key, preset, changes: upgraded ? preset.upgrade!.changes : (preset.changes ?? []), upgraded };
        });
}

/**
 * Regrowth healing formula: `base` (1d4 + Progression modifier, the die growing with ranks) plus the
 * healing bonuses of the caster's talents (Swift Healer: Medicine ranks; Applied Medicine: Lore ranks).
 */
export function regrowthFormula(
    base: string,
    talentIds: readonly string[],
    bonusTalents: Record<string, string>,
    formulas: Record<string, string>,
): string {
    const bonuses = Object.entries(bonusTalents)
        .filter(([id, key]) => talentIds.includes(id) && formulas[key])
        .map(([, key]) => `(${formulas[key]})`);
    return bonuses.length ? `(${base}) + ${bonuses.join(' + ')}` : base;
}
