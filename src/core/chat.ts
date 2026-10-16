/** The Triggers chat card: what happened to an actor's infusions, one row per infusion. */
import { MARKER_ICON, MODULE_ID } from '@/constants';
import { SURGE_KEYS, drawsFromCaster, type Infusion } from '@/data/infusion';
import type { LogEntry } from '@/core/engine';
import { infusionIcon, whisperRecipients } from '@/core/actor-data';
import { getSetting } from '@/settings';
import { esc, t } from '@/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

const isSurge = (surge: string) => (SURGE_KEYS as readonly string[]).includes(surge);

/** Whether the infusion is named by its surge (the label is then an optional description). */
const namedBySurge = (inf: Infusion) => inf.kind !== 'upkeep' && (SURGE_KEYS as readonly string[]).includes(inf.surge);

/** Main name: the surge, or the label for upkeep effects and custom infusions. */
export function infusionTitle(inf: Infusion): string {
    const surge = t(`SCI.Surge.${inf.surge}`);
    return namedBySurge(inf) ? surge : inf.label || surge;
}

/** The user's optional description, shown in gray under the surge name. */
export function infusionDescription(inf: Infusion): string {
    return namedBySurge(inf) ? inf.label : '';
}

/** "<b>Tension</b> on <b>Selaneth</b>", or the label alone for upkeep and custom infusions. */
export function infusionSubject(inf: Infusion, casterName: string): string {
    if (inf.kind === 'upkeep' || !isSurge(inf.surge)) return `<strong>${esc(inf.label || t(`SCI.Surge.${inf.surge}`))}</strong>`;
    const surge = t(`SCI.Surge.${inf.surge}`);
    const on = inf.targets.length
        ? inf.targets.map((tg) => tg.name).join(', ')
        : inf.kind === 'self'
          ? casterName
          : inf.label !== surge
            ? inf.label
            : '';
    const bold = (text: string) => `<strong>${esc(text)}</strong>`;
    return on ? t('SCI.Log.On', { surge: bold(surge), target: bold(on) }) : bold(surge);
}

/** One row of the Triggers card: who it is about, and what happened in a few words. */
export interface SummaryRow {
    /** Infusion id, or null for caster-wide lines (Empowered). */
    id: string | null;
    /** HTML: "<b>Tension</b> on <b>Selaneth</b>". */
    subject: string;
    /** Plain text: "Drained 1 · 2 left". */
    update: string;
}

/** Infusions the caster pays for each turn: they are Maintained rather than drained. */
const paidByCaster = (inf: Infusion | undefined) => !!inf && drawsFromCaster(inf);

function detail(entry: Exclude<LogEntry, { type: 'refilled' | 'ended' }>, maintained: boolean): string {
    switch (entry.type) {
        case 'added':
            return t('SCI.Log.Added', { amount: entry.amount });
        case 'drained':
            if (maintained || entry.fromCaster) return t('SCI.Log.Maintained');
            return t('SCI.Log.Drained', { amount: entry.amount, remaining: entry.remaining ?? 0 });
        case 'free':
            return t(maintained ? 'SCI.Log.Maintained' : 'SCI.Log.Free');
        case 'waiting':
            return t('SCI.Log.Waiting', { rounds: entry.roundsLeft });
        case 'reclaimed':
            return t('SCI.Log.Reclaimed', { amount: entry.amount });
        case 'multiplier-reset':
            return t('SCI.Log.MultiplierReset');
    }
}

/** The end of an infusion replaces what happened before it: "Ended: out of Investiture", "Reclaimed 2". */
function endText(entry: Extract<LogEntry, { type: 'ended' }>, reclaimed: string | null): string {
    if (entry.reason === 'reclaimed' && reclaimed) return reclaimed;
    if (entry.reason === 'manual' || entry.reason === 'upkeep-declined') return t('SCI.Log.Ended');
    return t('SCI.Log.EndedReason', { reason: t(`SCI.EndReason.${entry.reason}`) });
}

interface Group {
    row: SummaryRow;
    details: string[];
    reclaimed: string | null;
    ended: string | null;
}

/** One row per infusion the log mentions. `infusions` must contain every infusion the log mentions. */
export function summaryRows(log: LogEntry[], infusions: Infusion[], casterName: string): SummaryRow[] {
    const byId = new Map(infusions.map((i) => [i.id, i]));
    const groups = new Map<string, Group>();
    const order: Group[] = [];
    const group = (id: string | null, subject: string): Group => {
        const g: Group = { row: { id, subject, update: '' }, details: [], reclaimed: null, ended: null };
        order.push(g);
        if (id) groups.set(id, g);
        return g;
    };

    for (const entry of log) {
        if (entry.type === 'refilled') {
            group(null, `<strong>${esc(t('SCI.Log.Empowered'))}</strong>`).details.push(t('SCI.Log.Refilled', { amount: entry.amount }));
            continue;
        }
        const inf = byId.get(entry.id);
        const g = groups.get(entry.id) ?? group(entry.id, inf ? infusionSubject(inf, casterName) : `<strong>${esc(entry.label)}</strong>`);
        if (entry.type === 'ended') {
            g.ended = endText(entry, g.reclaimed);
            continue;
        }
        const text = detail(entry, paidByCaster(inf));
        if (entry.type === 'reclaimed') g.reclaimed = text;
        if (!g.details.includes(text)) g.details.push(text);
    }

    return order.map((g) => ({ ...g.row, update: g.ended ?? g.details.join(' · ') }));
}

/** A card section with the system's markup, so it picks up the Skill Test header style. */
export function cardSection(title: string, icon: string, body: string): string {
    return `<section class="chat-card-section"><div class="section-header"><span class="title"><i class="${icon}"></i>${esc(title)}</span></div>${body}</section>`;
}

/** The Triggers card: one row per infusion with its art, "Surge on target" and a short update in gray. */
export function summaryCard(rows: SummaryRow[], icon: (id: string | null) => string): string {
    const items = rows
        .map(
            (row) => `<li class="sci-trigger"><img src="${esc(icon(row.id))}" alt="">
            <div class="sci-trigger-text"><span class="sci-trigger-subject">${row.subject}</span>${
                row.update ? `<span class="sci-trigger-update">${esc(row.update)}</span>` : ''
            }</div></li>`,
        )
        .join('');
    return `<div class="chat-card sci-chat">${cardSection(t('SCI.Chat.Triggers'), 'fa-solid fa-bolt', `<ul class="sci-triggers">${items}</ul>`)}</div>`;
}

export async function postSummary(actor: any, log: LogEntry[], infusions: Infusion[]) {
    const rows = summaryRows(log, infusions, actor.name);
    if (!rows.length) return;
    const byId = new Map(infusions.map((i) => [i.id, i]));
    const content = summaryCard(rows, (id) => {
        const inf = id ? byId.get(id) : undefined;
        return inf ? infusionIcon(actor, inf) : actor.img || MARKER_ICON;
    });
    await ChatMessage.create({
        content,
        speaker: ChatMessage.getSpeaker({ actor }),
        whisper: getSetting('whisperChat') ? whisperRecipients(actor) : [],
        flags: { [MODULE_ID]: { summary: true } },
    });
}
