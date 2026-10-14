import { MODULE_ID } from '@/constants';

/** Escapes text for safe insertion into HTML. */
export function esc(value: unknown): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Localizes `key`; with `data`, formats `{placeholders}`. */
export function t(key: string, data?: Record<string, unknown>): string {
    if (typeof game === 'undefined' || !game.i18n) return key;
    return data ? game.i18n.format(key, data) : game.i18n.localize(key);
}

export function log(...args: unknown[]) {
    console.log(`${MODULE_ID} |`, ...args);
}

export function warn(...args: unknown[]) {
    console.warn(`${MODULE_ID} |`, ...args);
}

/** `<option>` list helper. */
export function options(entries: [string, string][], selected: string): string {
    return entries
        .map(([value, label]) => `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(label)}</option>`)
        .join('');
}

export const checked = (value: boolean) => (value ? ' checked' : '');

/** Parses an integer form value, falling back when empty or invalid. */
export function intValue(value: unknown, fallback = 0): number {
    const n = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(n) ? n : fallback;
}
