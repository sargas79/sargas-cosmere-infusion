import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REGENERATE_COST } from '@/core/engine';
import { isHurt, offersRegenerate, regenerateCost, useRegenerate } from '@/core/regenerate';

/* eslint-disable @typescript-eslint/no-explicit-any */

const regenerate = (consumption?: any[]) => ({
    type: 'action',
    system: { id: 'regenerate', activation: { consumption } },
    use: vi.fn(async () => [{ damageType: 'heal', total: 5 }]),
});

const actor = (health: number, inv: number, items: any[] = [regenerate([{ resource: 'inv', value: { min: 1, max: 1 } }])]) => ({
    id: 'a1',
    items,
    system: { resources: { hea: { value: health, max: { value: 10 } }, inv: { value: inv, max: { value: 5 } } } },
    update: vi.fn(async () => {}),
    applyHealing: vi.fn(async () => {}),
});

describe('offering Regenerate (#52)', () => {
    it('is offered only to hurt characters with the action', () => {
        expect(offersRegenerate(actor(6, 3))).toBe(true);
        // Full health: no row, so no window every turn for every Radiant.
        expect(offersRegenerate(actor(10, 3))).toBe(false);
        expect(offersRegenerate(actor(6, 3, []))).toBe(false);
        expect(isHurt(actor(0, 3))).toBe(true);
    });

    it('costs what the action consumes, else the Handbook\'s 1', () => {
        expect(regenerateCost(regenerate([{ resource: 'inv', value: { min: 2, max: 2 } }]))).toBe(2);
        expect(regenerateCost(regenerate([]))).toBe(REGENERATE_COST);
        expect(regenerateCost(regenerate())).toBe(REGENERATE_COST);
    });
});

describe('useRegenerate', () => {
    const warn = vi.fn();
    beforeEach(() => {
        (globalThis as any).Hooks = { on: vi.fn(() => 1), off: vi.fn() };
        (globalThis as any).ui = { notifications: { warn } };
    });
    afterEach(() => {
        delete (globalThis as any).Hooks;
        delete (globalThis as any).ui;
        warn.mockReset();
    });

    it('skips the system consume dialog, pays the Investiture and heals the rolled amount', async () => {
        const a = actor(4, 3);
        await useRegenerate(a);
        expect(a.items[0].use).toHaveBeenCalledWith({ configurable: false, shouldConsume: false });
        expect(a.update).toHaveBeenCalledWith({ 'system.resources.inv.value': 2 });
        expect(a.applyHealing).toHaveBeenCalledWith(5);
    });

    it('does nothing but warn when the upkeep left too little Investiture', async () => {
        const a = actor(4, 0);
        await useRegenerate(a);
        expect(a.items[0].use).not.toHaveBeenCalled();
        expect(a.update).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalledOnce();
    });

    it('charges nothing when the use is cancelled', async () => {
        const a = actor(4, 3);
        a.items[0].use.mockResolvedValueOnce(null as any);
        await useRegenerate(a);
        expect(a.update).not.toHaveBeenCalled();
        expect(a.applyHealing).not.toHaveBeenCalled();
    });
});
