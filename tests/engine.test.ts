import { describe, expect, it } from 'vitest';
import { normalizeInfusion, type InfusionInit } from '@/data/infusion';
import {
    addInvestiture,
    advanceTime,
    damageInfusion,
    drainExternal,
    endInfusion,
    onInvestitureChanged,
    durationLeft,
    resolveTurnEnd,
    resolveTurnStart,
} from '@/core/engine';

const inf = (data: InfusionInit) => normalizeInfusion({ id: data.label, ...data });
const caster = (inv: number, max = 5, empowered = false) => ({ inv, max, empowered });

describe('resolveTurnStart: drain', () => {
    it('drains 1 from an object pool and keeps it alive', () => {
        const r = resolveTurnStart(caster(3), [inf({ label: 'crate', pool: 2 })]);
        expect(r.infusions[0].pool).toBe(1);
        expect(r.inv).toBe(3);
        expect(r.ended).toHaveLength(0);
    });

    it('ends an object infusion when its pool reaches 0 (1 Investiture lasts one round)', () => {
        const r = resolveTurnStart(caster(3), [inf({ label: 'crate', pool: 1 })]);
        expect(r.infusions).toHaveLength(0);
        expect(r.log).toContainEqual({ type: 'ended', id: 'crate', label: 'crate', reason: 'pool-empty' });
    });

    it('self infusions draw from the caster', () => {
        const r = resolveTurnStart(caster(3), [inf({ label: 'flight', kind: 'self' })]);
        expect(r.inv).toBe(2);
        expect(r.infusions).toHaveLength(1);
    });

    it('self infusions end when the caster cannot pay (non-Invested)', () => {
        const r = resolveTurnStart(caster(0), [inf({ label: 'flight', kind: 'self' }), inf({ label: 'crate', pool: 3 })]);
        expect(r.infusions.map((i) => i.label)).toEqual(['crate']);
        expect(r.ended[0].label).toBe('flight');
    });

    it('self infusions end when the drain leaves the caster at 0', () => {
        const r = resolveTurnStart(caster(1), [inf({ label: 'flight', kind: 'self' })]);
        expect(r.inv).toBe(0);
        expect(r.infusions).toHaveLength(0);
    });

    it('pools keep draining while the caster is at 0', () => {
        const r = resolveTurnStart(caster(0), [inf({ label: 'crate', pool: 3 })]);
        expect(r.infusions[0].pool).toBe(2);
    });

    it('everyNRounds waits before draining (Extended talents)', () => {
        let list = [inf({ label: 'lash', pool: 2, drain: { everyNRounds: 3 } })];
        for (let round = 1; round <= 2; round++) {
            const r = resolveTurnStart(caster(5), list);
            expect(r.infusions[0].pool).toBe(2);
            list = r.infusions;
        }
        const r = resolveTurnStart(caster(5), list);
        expect(r.infusions[0].pool).toBe(1);
        expect(r.infusions[0].drain.counter).toBe(0);
    });

    it('freeWhileInvested skips the drain while the caster has Investiture', () => {
        const r = resolveTurnStart(caster(1), [inf({ label: 'flight', kind: 'self', freeWhileInvested: true })]);
        expect(r.inv).toBe(1);
        expect(r.infusions).toHaveLength(1);
        expect(r.log).toContainEqual({ type: 'free', id: 'flight', label: 'flight' });
    });

    it('freeWhileInvested self infusions end at 0 Investiture', () => {
        const r = resolveTurnStart(caster(0), [inf({ label: 'flight', kind: 'self', freeWhileInvested: true })]);
        expect(r.infusions).toHaveLength(0);
    });

    it('applies the drain multiplier and expires it after its round', () => {
        const list = [inf({ label: 'wall', pool: 5, drain: { multiplier: 2, multiplierUntilRound: 3 } })];
        const r1 = resolveTurnStart(caster(5), list, {}, { round: 3 });
        expect(r1.infusions[0].pool).toBe(3);
        const r2 = resolveTurnStart(caster(5), r1.infusions, {}, { round: 4 });
        expect(r2.infusions[0].pool).toBe(2);
        expect(r2.infusions[0].drain.multiplier).toBe(1);
    });

    it('ignores time-based cadences on turn start', () => {
        const r = resolveTurnStart(caster(5), [inf({ label: 'bead', pool: 2, drain: { cadence: 'day' } })]);
        expect(r.infusions[0].pool).toBe(2);
    });
});

describe('resolveTurnStart: decisions', () => {
    it('adds Investiture before the drain', () => {
        const r = resolveTurnStart(caster(3), [inf({ label: 'crate', pool: 1 })], { add: { crate: 2 } });
        expect(r.inv).toBe(1);
        expect(r.infusions[0].pool).toBe(2);
    });

    it('cannot add more Investiture than the caster has', () => {
        const r = resolveTurnStart(caster(1), [inf({ label: 'crate', pool: 1 })], { add: { crate: 5 } });
        expect(r.inv).toBe(0);
        expect(r.infusions[0].pool).toBe(1);
    });

    it('ends infusions on request without refund', () => {
        const r = resolveTurnStart(caster(2), [inf({ label: 'crate', pool: 4 })], { end: ['crate'] });
        expect(r.infusions).toHaveLength(0);
        expect(r.inv).toBe(2);
    });

    it('reclaims after the drain, capped at max', () => {
        const r = resolveTurnStart(caster(3), [inf({ label: 'crate', pool: 4, reclaimable: true })], { reclaim: ['crate'] });
        // pool 4 -> drain to 3 -> reclaim 2 (max 5, inv 3)
        expect(r.inv).toBe(5);
        expect(r.infusions).toHaveLength(0);
        expect(r.log).toContainEqual({ type: 'reclaimed', id: 'crate', label: 'crate', amount: 2 });
    });

    it('does not reclaim infusions without Stormlight Reclamation', () => {
        const r = resolveTurnStart(caster(1), [inf({ label: 'crate', pool: 4 })], { reclaim: ['crate'] });
        expect(r.infusions[0].pool).toBe(3);
        expect(r.inv).toBe(1);
    });

    it('upkeep effects cost 1 or end when declined', () => {
        const list = [inf({ label: 'enhance', kind: 'upkeep' }), inf({ label: 'tunnel', kind: 'upkeep' })];
        const r = resolveTurnStart(caster(3), list, { skipUpkeep: ['tunnel'] });
        expect(r.inv).toBe(2);
        expect(r.infusions.map((i) => i.label)).toEqual(['enhance']);
    });

    it('Empowered refills Investiture before the drain', () => {
        const r = resolveTurnStart(caster(1, 6, true), [inf({ label: 'flight', kind: 'self' })]);
        expect(r.inv).toBe(5);
        expect(r.log[0]).toEqual({ type: 'refilled', amount: 5 });
    });

    it('does not mutate its inputs', () => {
        const list = [inf({ label: 'crate', pool: 2 })];
        resolveTurnStart(caster(3), list, { add: { crate: 1 } });
        expect(list[0].pool).toBe(2);
    });
});

describe('advanceTime', () => {
    it('drains 10-minute infusions once per 600 s', () => {
        const r = advanceTime(caster(5), [inf({ label: 'illusion', pool: 10, drain: { cadence: '10min' } })], 3600);
        expect(r.infusions[0].pool).toBe(4);
    });

    it('keeps leftover seconds between calls', () => {
        const r1 = advanceTime(caster(5), [inf({ label: 'illusion', pool: 3, drain: { cadence: '10min' } })], 400);
        expect(r1.infusions[0].pool).toBe(3);
        const r2 = advanceTime(caster(5), r1.infusions, 300);
        expect(r2.infusions[0].pool).toBe(2);
        expect(r2.infusions[0].drain.elapsed).toBe(100);
    });

    it('drains daily infusions (Shadesmar beads)', () => {
        const r = advanceTime(caster(5), [inf({ label: 'bead', pool: 2, drain: { cadence: 'day' } })], 2 * 86_400);
        expect(r.infusions).toHaveLength(0);
    });

    it('drains round-cadence infusions only when roundSeconds is given', () => {
        const list = [inf({ label: 'crate', pool: 5 })];
        expect(advanceTime(caster(5), list, 1200).infusions[0].pool).toBe(5);
        expect(advanceTime(caster(5), list, 1200, { roundSeconds: 600 }).infusions[0].pool).toBe(3);
    });
});

describe('single-infusion operations', () => {
    it('addInvestiture moves Investiture from caster to pool', () => {
        const r = addInvestiture(caster(3), [inf({ label: 'crate', pool: 1 })], 'crate', 2);
        expect(r.inv).toBe(1);
        expect(r.infusions[0].pool).toBe(3);
    });

    it('endInfusion with refund recovers the pool', () => {
        const r = endInfusion(caster(1), [inf({ label: 'crate', pool: 3 })], 'crate', { refund: true });
        expect(r.inv).toBe(4);
        expect(r.infusions).toHaveLength(0);
    });

    it('drainExternal removes up to the pool and reports it', () => {
        const r = drainExternal(caster(5), [inf({ label: 'crate', pool: 2 })], 'crate', 3);
        expect(r.drained).toBe(2);
        expect(r.infusions).toHaveLength(0);
        expect(r.ended[0].label).toBe('crate');
    });

    it('damageInfusion ends health-bearing infusions at 0 health', () => {
        const list = [inf({ label: 'cloth', pool: 3, health: { value: 10, max: 10 } })];
        const r1 = damageInfusion(caster(5), list, 'cloth', 4);
        expect(r1.infusions[0].health?.value).toBe(6);
        const r2 = damageInfusion(caster(5), r1.infusions, 'cloth', 6);
        expect(r2.infusions).toHaveLength(0);
        expect(r2.log).toContainEqual({ type: 'ended', id: 'cloth', label: 'cloth', reason: 'health' });
    });

    it('onInvestitureChanged ends self infusions at 0', () => {
        const r = onInvestitureChanged(caster(0), [inf({ label: 'flight', kind: 'self' }), inf({ label: 'crate', pool: 1 })]);
        expect(r.infusions.map((i) => i.label)).toEqual(['crate']);
    });
});

describe('end-of-turn upkeep (Enhance)', () => {
    const enhance = () => inf({ label: 'Enhance', surge: 'upkeep', kind: 'upkeep', timing: 'end' });

    it('is not paid at the start of the turn', () => {
        const r = resolveTurnStart(caster(3), [enhance()]);
        expect(r.inv).toBe(3);
        expect(r.log).toEqual([]);
    });

    it('is paid at the end of the turn', () => {
        const r = resolveTurnEnd(caster(3), [enhance(), inf({ label: 'crate', pool: 2 })]);
        expect(r.inv).toBe(2);
        expect(r.infusions.find((i) => i.label === 'crate')!.pool).toBe(2);
        expect(r.log).toContainEqual({ type: 'drained', id: 'Enhance', label: 'Enhance', amount: 1, remaining: null, fromCaster: true });
    });

    it('is free with the Second Ideal', () => {
        const r = resolveTurnEnd(caster(3), [enhance()], {}, { free: true });
        expect(r.inv).toBe(3);
        expect(r.infusions).toHaveLength(1);
    });

    it('ends when declined or when the caster has no Investiture', () => {
        expect(resolveTurnEnd(caster(3), [enhance()], { skipUpkeep: ['Enhance'] }).ended[0].label).toBe('Enhance');
        const r = resolveTurnEnd(caster(0), [enhance()]);
        expect(r.log).toContainEqual({ type: 'ended', id: 'Enhance', label: 'Enhance', reason: 'non-invested' });
    });
});

describe('durationLeft', () => {
    it('counts pool drains, every-N cadence and the counter', () => {
        expect(durationLeft(inf({ label: 'a', pool: 3 }), 0)).toBe(3);
        expect(durationLeft(inf({ label: 'b', pool: 2, drain: { everyNRounds: 3, counter: 1 } }), 0)).toBe(5);
        expect(durationLeft(inf({ label: 'c', pool: 4, drain: { multiplier: 2 } }), 0)).toBe(2);
    });

    it('uses the caster for self infusions and is unlimited when free', () => {
        expect(durationLeft(inf({ label: 'd', kind: 'self' }), 4)).toBe(4);
        expect(durationLeft(inf({ label: 'e', kind: 'self', freeWhileInvested: true }), 4)).toBeNull();
    });
});
