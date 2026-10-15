/** Compact chat summaries of what happened to an actor's infusions, one line per infusion. */
import { MODULE_ID } from '@/constants';
import { SURGE_KEYS, type Infusion } from '@/data/infusion';
import type { LogEntry } from '@/core/engine';
import { whisperRecipients } from '@/core/actor-data';
import { getSetting } from '@/settings';
import { esc, t } from '@/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

const isSurge = (surge: string) => (SURGE_KEYS as readonly string[]).includes(surge);

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

interface Group {
    subject: string;
    details: string[];
    sub: string[];
}

function detail(entry: Exclude<LogEntry, { type: 'refilled' | 'ended' }>, upkeep: boolean): string {
    switch (entry.type) {
        case 'added':
            return t('SCI.Log.Added', { amount: entry.amount });
        case 'drained':
            if (upkeep) return t('SCI.Log.Maintained');
            return entry.fromCaster
                ? t('SCI.Log.DrainedCaster', { amount: entry.amount })
                : t('SCI.Log.Drained', { amount: entry.amount, remaining: entry.remaining ?? 0 });
        case 'free':
            return t(upkeep ? 'SCI.Log.Maintained' : 'SCI.Log.Free');
        case 'waiting':
            return t('SCI.Log.Waiting', { rounds: entry.roundsLeft });
        case 'reclaimed':
            return t('SCI.Log.Reclaimed', { amount: entry.amount });
        case 'multiplier-reset':
            return t('SCI.Log.MultiplierReset');
    }
}

/** Builds the summary list items. `infusions` must contain every infusion the log mentions. */
export function summaryLines(log: LogEntry[], infusions: Infusion[], casterName: string): string[] {
    const byId = new Map(infusions.map((i) => [i.id, i]));
    const lines: (string | Group)[] = [];
    const groups = new Map<string, Group>();

    for (const entry of log) {
        if (entry.type === 'refilled') {
            lines.push(t('SCI.Log.Refilled', { amount: entry.amount }));
            continue;
        }
        const inf = byId.get(entry.id);
        const upkeep = inf?.kind === 'upkeep';
        let group = groups.get(entry.id);
        if (!group) {
            group = { subject: inf ? infusionSubject(inf, casterName) : `<strong>${esc(entry.label)}</strong>`, details: [], sub: [] };
            groups.set(entry.id, group);
            lines.push(group);
        }
        if (entry.type !== 'ended') {
            const text = detail(entry, upkeep);
            if (!group.details.includes(text)) group.details.push(text);
            continue;
        }
        const quiet = entry.reason === 'manual' || entry.reason === 'upkeep-declined';
        if (upkeep) {
            group.details = [t('SCI.Log.UpkeepEnded')];
            if (!quiet) group.sub.push(t('SCI.Log.EndedReason', { reason: t(`SCI.EndReason.${entry.reason}`) }));
        } else {
            group.sub.push(entry.reason === 'manual' ? t('SCI.Log.EndedPlain') : t('SCI.Log.EndedReason', { reason: t(`SCI.EndReason.${entry.reason}`) }));
        }
    }

    return lines.map((line) => {
        if (typeof line === 'string') return line;
        const main = line.details.length ? `${line.subject}: ${line.details.join('; ')}.` : line.subject;
        return line.sub.length ? `${main}<ul>${line.sub.map((s) => `<li>${s}</li>`).join('')}</ul>` : main;
    });
}

export async function postSummary(actor: any, title: string, log: LogEntry[], infusions: Infusion[], inv?: number) {
    const lines = summaryLines(log, infusions, actor.name);
    if (!lines.length) return;
    const footer = inv == null ? '' : `<p class="sci-chat-inv">${t('SCI.Log.InvLeft', { inv })}</p>`;
    const content = `<div class="sci-chat"><h4>${esc(title)}</h4><ul>${lines
        .map((l) => `<li>${l}</li>`)
        .join('')}</ul>${footer}</div>`;
    await ChatMessage.create({
        content,
        speaker: ChatMessage.getSpeaker({ actor }),
        whisper: getSetting('whisperChat') ? whisperRecipients(actor) : [],
        flags: { [MODULE_ID]: { summary: true } },
    });
}
