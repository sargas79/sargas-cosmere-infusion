import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CADENCES, INFUSION_KINDS, LIGHTS, SURGE_KEYS, SURGE_SCALING } from '@/data/infusion';
import type { EndReason } from '@/core/engine';
import { DEFAULT_SUB_EFFECTS } from '@/data/presets';

const lang = JSON.parse(readFileSync(join(__dirname, '..', 'lang', 'en.json'), 'utf8'));

function has(key: string): boolean {
    let node: unknown = lang;
    for (const part of key.split('.')) {
        if (!node || typeof node !== 'object' || !(part in node)) return false;
        node = (node as Record<string, unknown>)[part];
    }
    return typeof node === 'string';
}

function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith('.ts') ? [path] : [];
    });
}

describe('lang/en.json', () => {
    it('contains every literal key used in the source', () => {
        const missing = new Set<string>();
        for (const file of sourceFiles(join(__dirname, '..', 'src'))) {
            const text = readFileSync(file, 'utf8');
            for (const match of text.matchAll(/['"](SCI\.[A-Za-z0-9_.-]+)['"]/g)) {
                if (!has(match[1])) missing.add(`${match[1]} (${file})`);
            }
        }
        expect([...missing]).toEqual([]);
    });

    it('contains every dynamic key', () => {
        const reasons: EndReason[] = ['manual', 'pool-empty', 'non-invested', 'reclaimed', 'upkeep-declined', 'health', 'external'];
        const keys = [
            ...[...SURGE_KEYS, 'custom', 'bead', 'upkeep'].map((k) => `SCI.Surge.${k}`),
            ...INFUSION_KINDS.map((k) => `SCI.Kind.${k}`),
            ...CADENCES.map((k) => `SCI.Cadence.${k}`),
            ...LIGHTS.map((k) => `SCI.Light.${k}`),
            ...reasons.map((k) => `SCI.EndReason.${k}`),
            ...SURGE_SCALING.map((s) => `SCI.Size.${s.size}`),
            ...Object.keys(DEFAULT_SUB_EFFECTS).flatMap((k) => [`SCI.Effect.${k}`, `SCI.EffectDesc.${k}`]),
            ...['combat', 'conversation', 'endeavor', 'free'].flatMap((m) => [`SCI.SceneMode.${m}`, `SCI.SceneMode.${m}Hint`]),
            ...[
                'triggerMode',
                'bossDrain',
                'promptOnTurn',
                'autoPromptOnUse',
                'whisperChat',
                'tokenMarkers',
                'subEffects',
                'worldTimeDrain',
                'sphereTracking',
                'breatheRefill',
                'endEnhancedEffects',
                'sceneMode',
                'mapping',
            ].flatMap((k) => [`SCI.Settings.${k}.Name`, `SCI.Settings.${k}.Hint`]),
        ];
        expect(keys.filter((k) => !has(k))).toEqual([]);
    });
});
