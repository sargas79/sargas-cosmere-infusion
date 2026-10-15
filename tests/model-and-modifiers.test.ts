import { describe, expect, it } from 'vitest';
import { normalizeInfusion, parseInfusions, surgeScaling } from '@/data/infusion';
import { DEFAULT_SUB_EFFECTS, DEFAULT_TALENT_EFFECTS } from '@/data/presets';
import { computeModifiers, subEffectsFor, type OwnedTalent } from '@/core/modifiers';

describe('normalizeInfusion', () => {
    it('fills defaults', () => {
        const i = normalizeInfusion({});
        expect(i.id).toHaveLength(16);
        expect(i.kind).toBe('object');
        expect(i.pool).toBe(1);
        expect(i.drain).toMatchObject({ amount: 1, everyNRounds: 1, counter: 0, cadence: 'round', multiplier: 1 });
        expect(i.light).toBe('stormlight');
        expect(i.source).toBe('caster');
        expect(i.health).toBeNull();
    });

    it('rejects invalid values', () => {
        const i = normalizeInfusion({
            kind: 'nope' as never,
            surge: 'xyz' as never,
            pool: -4,
            drain: { everyNRounds: 0, cadence: 'hour' as never },
            light: 'darklight' as never,
        });
        expect(i.kind).toBe('object');
        expect(i.surge).toBe('custom');
        expect(i.pool).toBe(0);
        expect(i.drain.everyNRounds).toBe(1);
        expect(i.drain.cadence).toBe('round');
        expect(i.light).toBe('stormlight');
    });

    it('self and upkeep infusions have no pool', () => {
        expect(normalizeInfusion({ kind: 'self', pool: 5 }).pool).toBe(0);
        expect(normalizeInfusion({ kind: 'upkeep', pool: 5 }).pool).toBe(0);
    });

    it('clamps health to max', () => {
        expect(normalizeInfusion({ health: { value: 50, max: 10 } }).health).toEqual({ value: 10, max: 10 });
    });

    it('parseInfusions ignores garbage', () => {
        expect(parseInfusions(null)).toEqual([]);
        expect(parseInfusions([null, 3, { label: 'a' }])).toHaveLength(1);
    });
});

describe('surgeScaling', () => {
    it('maps ranks to die and size', () => {
        expect(surgeScaling(0)).toBeNull();
        expect(surgeScaling(1)).toMatchObject({ die: 'd4', size: 'small' });
        expect(surgeScaling(3)).toMatchObject({ die: 'd8', size: 'large' });
        expect(surgeScaling(7)).toMatchObject({ die: 'd12', size: 'gargantuan' });
    });
});

describe('computeModifiers', () => {
    const t = (power: string | null, id: string, name = id): OwnedTalent => ({ power, id, name });
    const base = { effects: DEFAULT_TALENT_EFFECTS, ranks: { adh: 2, grv: 3, ill: 2, tsn: 4, trs: 2, prg: 1, abr: 1 } };

    it('Extended Adhesion drains every N rounds (N = ranks)', () => {
        const m = computeModifiers({ ...base, surge: 'adh', kind: 'object', talents: [t('adh', 'extended-adhesion', 'Extended Adhesion')] });
        expect(m.everyNRounds).toBe(2);
        expect(m.applied).toEqual(['Extended Adhesion']);
    });

    it('matches talents by power and id (Stormlight Reclamation is per surge)', () => {
        const talents = [t('adh', 'stormlight-reclamation')];
        expect(computeModifiers({ ...base, surge: 'adh', kind: 'object', talents }).reclaimable).toBe(true);
        expect(computeModifiers({ ...base, surge: 'tsn', kind: 'object', talents }).reclaimable).toBe(false);
    });

    it('Master of the Skies is free only for self Lashings', () => {
        const talents = [t('grv', 'master-of-the-skies')];
        expect(computeModifiers({ ...base, surge: 'grv', kind: 'self', talents }).freeWhileInvested).toBe(true);
        expect(computeModifiers({ ...base, surge: 'grv', kind: 'character', talents }).freeWhileInvested).toBe(false);
    });

    it('Extended Tension is free for held or worn objects', () => {
        const talents = [t('tsn', 'extended-tension')];
        const held = computeModifiers({ ...base, surge: 'tsn', kind: 'object', talents, heldOrWorn: true });
        expect(held).toMatchObject({ freeWhileInvested: true, everyNRounds: 4 });
        expect(computeModifiers({ ...base, surge: 'tsn', kind: 'object', talents }).freeWhileInvested).toBe(false);
    });

    it('Lingering Lightweavings applies only when stored in a gem (power null)', () => {
        const talents = [t(null, 'lingering-lightweavings')];
        expect(computeModifiers({ ...base, surge: 'ill', kind: 'area', talents }).everyNRounds).toBe(1);
        expect(computeModifiers({ ...base, surge: 'ill', kind: 'area', talents, storedInGem: true }).everyNRounds).toBe(2);
    });

    it('Fine Control and Physical Illusion give health', () => {
        expect(
            computeModifiers({ ...base, surge: 'tsn', kind: 'object', talents: [t('tsn', 'fine-control')], fineControl: true }).health,
        ).toBe(20);
        expect(
            computeModifiers({
                ...base,
                surge: 'ill',
                kind: 'area',
                talents: [t('ill', 'fourth-ideal-lightweaver')],
                physicalIllusion: true,
            }).health,
        ).toBe(10);
    });

    it('Group Flight allows ranks + 1 linked targets; Distant Surgebinding sets range', () => {
        expect(computeModifiers({ ...base, surge: 'grv', kind: 'character', talents: [t('grv', 'group-flight')] }).maxTargets).toBe(4);
        expect(computeModifiers({ ...base, surge: 'adh', kind: 'object', talents: [t('adh', 'distant-surgebinding')] }).range).toBe(20);
    });

    it('squires never get talent modifiers', () => {
        const m = computeModifiers({ ...base, surge: 'adh', kind: 'object', talents: [t('adh', 'extended-adhesion')], squire: true });
        expect(m.everyNRounds).toBe(1);
        expect(m.applied).toEqual([]);
    });
});

describe('subEffectsFor', () => {
    const keys = (surge: string, kind: string, talents: string[] = []) =>
        subEffectsFor({ surge: surge as never, kind: kind as never }, talents, DEFAULT_SUB_EFFECTS).map((e) => e.key);

    it('gives each surge its effects', () => {
        expect(keys('abr', 'self')).toEqual(['skate']);
        expect(keys('abr', 'self', ['frictionless-motion'])).toEqual(['skate', 'frictionless-motion']);
        expect(keys('adh', 'character')).toEqual([]);
        expect(keys('adh', 'character', ['living-adhesion'])).toEqual(['restrained']);
        expect(keys('grv', 'character')).toEqual(['basic-lashing']);
        expect(keys('grv', 'object')).toEqual([]);
        expect(keys('prg', 'character')).toEqual(['regrowth']);
        expect(keys('tsn', 'object')).toEqual(['hardened-defense']);
    });

    it('applies upgrade talents', () => {
        const [lashing] = subEffectsFor({ surge: 'grv', kind: 'self' }, ['flying-ace'], DEFAULT_SUB_EFFECTS);
        expect(lashing.upgraded).toBe(true);
        expect(lashing.changes[0].value).toBe('40');
        const [defense] = subEffectsFor({ surge: 'tsn', kind: 'object' }, [], DEFAULT_SUB_EFFECTS);
        expect(defense.changes[0]).toMatchObject({ key: 'system.defenses.phy.bonus', value: '2' });
    });
});
