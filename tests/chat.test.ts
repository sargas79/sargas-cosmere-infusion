import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { normalizeInfusion } from '@/data/infusion';
import { resolveTurnEnd, resolveTurnStart } from '@/core/engine';
import { infusionDescription, infusionTitle, summaryRows } from '@/core/chat';

const lang = JSON.parse(readFileSync(join(__dirname, '..', 'lang', 'en.json'), 'utf8'));
const lookup = (key: string): string => key.split('.').reduce((node, part) => node?.[part], lang) ?? key;

beforeAll(() => {
    (globalThis as Record<string, unknown>).game = {
        i18n: {
            localize: lookup,
            format: (key: string, data: Record<string, unknown>) => lookup(key).replace(/\{(\w+)\}/g, (_, k) => String(data[k])),
        },
    };
});

const tension = (id: string, target: string, pool: number) =>
    normalizeInfusion({ id, surge: 'tsn', kind: 'object', label: target, pool, targets: [{ uuid: '', name: target }] });

describe('summaryRows (#51)', () => {
    const updates = (rows: { subject: string; update: string }[]) => rows.map((r) => [r.subject, r.update]);

    it('lists "Surge on Target" with a short update; an end replaces the drain', () => {
        const infusions = [tension('a', 'Selaneth', 4), tension('b', 'Radahn', 1)];
        const result = resolveTurnStart({ inv: 3, max: 5 }, infusions);
        expect(updates(summaryRows(result.log, infusions, 'Kal'))).toEqual([
            ['<strong>Tension</strong> on <strong>Selaneth</strong>', 'Drained 1 · 3 left'],
            ['<strong>Tension</strong> on <strong>Radahn</strong>', 'Ended: out of Investiture'],
        ]);
    });

    it('shows upkeep as Maintained or Ended', () => {
        const enhance = normalizeInfusion({ id: 'e', surge: 'upkeep', kind: 'upkeep', label: 'Enhance', timing: 'end' });
        expect(updates(summaryRows(resolveTurnEnd({ inv: 2, max: 5 }, [enhance]).log, [enhance], 'Kal'))).toEqual([['<strong>Enhance</strong>', 'Maintained']]);
        const declined = resolveTurnEnd({ inv: 2, max: 5 }, [enhance], { skipUpkeep: ['e'] });
        expect(updates(summaryRows(declined.log, [enhance], 'Kal'))).toEqual([['<strong>Enhance</strong>', 'Ended']]);
    });

    it('names the caster for sustained self infusions, which are Maintained', () => {
        const lash = normalizeInfusion({ id: 's', surge: 'grv', kind: 'self', label: 'Gravitation' });
        expect(updates(summaryRows(resolveTurnStart({ inv: 3, max: 5 }, [lash]).log, [lash], 'Kal'))).toEqual([
            ['<strong>Gravitation</strong> on <strong>Kal</strong>', 'Maintained'],
        ]);
    });

    it('shows only the amount when reclaimed', () => {
        const crate = normalizeInfusion({ ...tension('r', 'crate', 4), reclaimable: true });
        const result = resolveTurnStart({ inv: 1, max: 5 }, [crate], { reclaim: ['r'] });
        expect(summaryRows(result.log, [crate], 'Kal').map((r) => r.update)).toEqual(['Reclaimed 3']);
    });
});

describe('infusion names (#41)', () => {
    it('uses the surge as the name and the label as an optional description', () => {
        const lashed = normalizeInfusion({ surge: 'grv', kind: 'object', label: 'the crate by the door' });
        expect(infusionTitle(lashed)).toBe('Gravitation');
        expect(infusionDescription(lashed)).toBe('the crate by the door');
        expect(infusionDescription(normalizeInfusion({ surge: 'grv', kind: 'object' }))).toBe('');
    });

    it('keeps the label as the name for upkeep effects', () => {
        const enhance = normalizeInfusion({ surge: 'upkeep', kind: 'upkeep', label: 'Enhance' });
        expect(infusionTitle(enhance)).toBe('Enhance');
        expect(infusionDescription(enhance)).toBe('');
    });
});
