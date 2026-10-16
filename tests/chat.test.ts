import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { normalizeInfusion } from '@/data/infusion';
import { resolveTurnEnd, resolveTurnStart } from '@/core/engine';
import { infusionDescription, infusionTitle, summaryLines } from '@/core/chat';

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

describe('summaryLines', () => {
    it('lists the surge and target, with the end reason nested (#31)', () => {
        const infusions = [tension('a', 'Selaneth', 4), tension('b', 'Radahn', 1)];
        const result = resolveTurnStart({ inv: 3, max: 5 }, infusions);
        expect(summaryLines(result.log, infusions, 'Kal')).toEqual([
            '<strong>Tension</strong> on <strong>Selaneth</strong>: drained 1, 3 left.',
            '<strong>Tension</strong> on <strong>Radahn</strong>: drained 1, 0 left.<ul><li>Ended. Out of Investiture.</li></ul>',
        ]);
    });

    it('shows upkeep as Maintained or Ended (#32)', () => {
        const enhance = normalizeInfusion({ id: 'e', surge: 'upkeep', kind: 'upkeep', label: 'Enhance', timing: 'end' });
        expect(summaryLines(resolveTurnEnd({ inv: 2, max: 5 }, [enhance]).log, [enhance], 'Kal')).toEqual(['<strong>Enhance</strong>: Maintained.']);
        const declined = resolveTurnEnd({ inv: 2, max: 5 }, [enhance], { skipUpkeep: ['e'] });
        expect(summaryLines(declined.log, [enhance], 'Kal')).toEqual(['<strong>Enhance</strong>: Ended.']);
    });

    it('names the caster for self infusions', () => {
        const lash = normalizeInfusion({ id: 's', surge: 'grv', kind: 'self', label: 'Gravitation' });
        expect(summaryLines(resolveTurnStart({ inv: 3, max: 5 }, [lash]).log, [lash], 'Kal')).toEqual([
            '<strong>Gravitation</strong> on <strong>Kal</strong>: 1 from the caster.',
        ]);
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
