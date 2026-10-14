/** Compact chat summaries of what happened to an actor's infusions. */
import { MODULE_ID } from '@/constants';
import type { LogEntry } from '@/core/engine';
import { whisperRecipients } from '@/core/actor-data';
import { getSetting } from '@/settings';
import { esc, t } from '@/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

function line(entry: LogEntry): string | null {
    switch (entry.type) {
        case 'refilled':
            return t('SCI.Log.Refilled', { amount: entry.amount });
        case 'added':
            return t('SCI.Log.Added', { label: esc(entry.label), amount: entry.amount });
        case 'drained':
            return entry.fromCaster
                ? t('SCI.Log.DrainedCaster', { label: esc(entry.label), amount: entry.amount })
                : t('SCI.Log.Drained', { label: esc(entry.label), amount: entry.amount, remaining: entry.remaining ?? 0 });
        case 'free':
            return t('SCI.Log.Free', { label: esc(entry.label) });
        case 'waiting':
            return t('SCI.Log.Waiting', { label: esc(entry.label), rounds: entry.roundsLeft });
        case 'ended':
            return t('SCI.Log.Ended', { label: esc(entry.label), reason: t(`SCI.EndReason.${entry.reason}`) });
        case 'reclaimed':
            return t('SCI.Log.Reclaimed', { label: esc(entry.label), amount: entry.amount });
        case 'multiplier-reset':
            return t('SCI.Log.MultiplierReset', { label: esc(entry.label) });
    }
}

export async function postSummary(actor: any, title: string, log: LogEntry[], inv?: number) {
    const lines = log.map(line).filter((l): l is string => !!l);
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
