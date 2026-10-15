/**
 * Shared infusion list (rows + actions) used by the sheet section, the actor panel and the GM tracker.
 */
import { drawsFromCaster, type Infusion } from '@/data/infusion';
import { InfusionDialog } from '@/apps/infusion-dialog';
import { casterState } from '@/core/actor-data';
import { addInvestiture, damageInfusion, drainExternal, endInfusion } from '@/core/engine';
import { commit, getInfusions, updateInfusion } from '@/core/store';
import { esc, t } from '@/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ListOptions {
    /** GM-only actions (external drain, multiplier, damage). */
    gm?: boolean;
}

export function badge(inf: Infusion): string {
    const parts: string[] = [];
    if (inf.drain.cadence !== 'round') parts.push(t(`SCI.Cadence.${inf.drain.cadence}`));
    if (inf.drain.everyNRounds > 1) parts.push(t('SCI.List.EveryN', { n: inf.drain.everyNRounds }));
    if (inf.freeWhileInvested) parts.push(t('SCI.Prompt.Free'));
    if (inf.drain.multiplier > 1) parts.push(`×${inf.drain.multiplier}`);
    if (inf.light !== 'stormlight') parts.push(t(`SCI.Light.${inf.light}`));
    if (inf.source === 'gem') parts.push(t('SCI.Source.gem'));
    return parts.map((p) => `<span class="sci-tag">${esc(p)}</span>`).join('');
}

export function renderInfusionRows(actor: any, infusions: Infusion[], opts: ListOptions = {}): string {
    if (!infusions.length) return `<li class="sci-empty">${t('SCI.List.Empty')}</li>`;
    const canEdit = actor.isOwner;
    return infusions
        .map((inf) => {
            const pool = !drawsFromCaster(inf);
            const amount = pool ? `<span class="sci-pool" title="${t('SCI.Field.Pool')}">${inf.pool}</span>` : `<span class="sci-pool sci-self">${t(`SCI.Kind.${inf.kind}`)}</span>`;
            const health = inf.health ? `<span class="sci-health" title="${t('SCI.Field.Health')}"><i class="fa-solid fa-heart"></i> ${inf.health.value}/${inf.health.max}</span>` : '';
            const targets = inf.targets.length ? `<small>→ ${esc(inf.targets.map((tg) => tg.name).join(', '))}</small>` : '';
            const btn = (action: string, icon: string, title: string) =>
                `<a class="sci-btn" data-sci-list="${action}" data-actor="${esc(actor.uuid)}" data-id="${inf.id}" title="${esc(t(title))}"><i class="fa-solid ${icon}"></i></a>`;
            const buttons = [
                canEdit && pool ? btn('add', 'fa-plus', 'SCI.List.Add') : '',
                canEdit && pool && inf.reclaimable ? btn('reclaim', 'fa-rotate-left', 'SCI.List.Reclaim') : '',
                (canEdit || opts.gm) && inf.health ? btn('damage', 'fa-burst', 'SCI.List.Damage') : '',
                opts.gm ? btn('drain', 'fa-feather', 'SCI.List.DrainExternal') : '',
                opts.gm ? btn('multiplier', 'fa-fire', 'SCI.List.Multiplier') : '',
                canEdit ? btn('edit', 'fa-pen', 'SCI.Common.Edit') : '',
                canEdit || opts.gm ? btn('end', 'fa-power-off', 'SCI.List.End') : '',
            ].join('');
            return `<li class="sci-row" data-id="${inf.id}">
                ${amount}
                <div class="sci-main"><strong>${esc(inf.label)}</strong> <small class="sci-surge">${esc(t(`SCI.Surge.${inf.surge}`))}</small> ${badge(inf)}<br>${targets} ${health}</div>
                <div class="sci-controls">${buttons}</div>
            </li>`;
        })
        .join('');
}

async function askNumber(title: string, label: string, value = 1): Promise<number | null> {
    const result = await foundry.applications.api.DialogV2.prompt({
        window: { title },
        content: `<div class="form-group"><label>${esc(label)}</label><input type="number" name="n" min="0" value="${value}" autofocus></div>`,
        ok: { callback: (_e: Event, button: any) => Number(button.form.elements.n.value) },
        rejectClose: false,
    });
    return typeof result === 'number' && Number.isFinite(result) ? result : null;
}

/** Actor (by name) to receive drained Investiture, e.g. the larkin. Uses the user's first target. */
function transferTarget(): any {
    const token = [...(game.user.targets ?? [])][0];
    return token?.actor ?? null;
}

/** Handles a click on a `[data-sci-list]` button. Returns true when it was handled. */
export async function handleListAction(el: HTMLElement): Promise<boolean> {
    const action = el.dataset.sciList;
    const actor = el.dataset.actor ? await fromUuid(el.dataset.actor) : null;
    const id = el.dataset.id;
    if (!action || !actor || !id) return false;
    return runListAction(action, actor, id);
}

/**
 * Runs an infusion action (add, reclaim, end, damage, drain, multiplier, edit) on the caster's infusion
 * `id`. Returns false for unknown actions.
 */
export async function runListAction(action: string, actor: any, id: string): Promise<boolean> {
    const inf = getInfusions(actor).find((i) => i.id === id);
    if (!inf) return true;
    const state = casterState(actor);

    switch (action) {
        case 'add': {
            const n = await askNumber(t('SCI.List.Add'), t('SCI.List.AddHow', { inv: state.inv }), 1);
            if (n) await commit(actor, addInvestiture(state, getInfusions(actor), id, n), { chat: t('SCI.Chat.Changed') });
            break;
        }
        case 'reclaim':
            await commit(actor, endInfusion(state, getInfusions(actor), id, { refund: true }), { chat: t('SCI.Chat.Changed') });
            break;
        case 'end': {
            const ok = await foundry.applications.api.DialogV2.confirm({
                window: { title: t('SCI.List.End') },
                content: `<p>${t('SCI.List.EndConfirm', { label: esc(inf.label) })}</p>`,
                rejectClose: false,
            });
            if (ok) await commit(actor, endInfusion(state, getInfusions(actor), id), { chat: t('SCI.Chat.Changed') });
            break;
        }
        case 'damage': {
            const n = await askNumber(t('SCI.List.Damage'), t('SCI.List.DamageHow'), 1);
            if (n) await commit(actor, damageInfusion(state, getInfusions(actor), id, n), { chat: t('SCI.Chat.Changed') });
            break;
        }
        case 'drain': {
            const n = await askNumber(t('SCI.List.DrainExternal'), t('SCI.List.DrainHow'), 1);
            if (!n) break;
            const result = drainExternal(state, getInfusions(actor), id, n);
            await commit(actor, result, { chat: t('SCI.Chat.DrainedExternal') });
            const receiver = transferTarget();
            if (receiver && result.drained > 0) {
                const rs = casterState(receiver);
                const gained = Math.min(result.drained, Math.max(0, rs.max - rs.inv));
                await receiver.update({ 'system.resources.inv.value': rs.inv + gained });
                ui.notifications.info(t('SCI.Notify.Transferred', { name: receiver.name, amount: gained }));
            }
            break;
        }
        case 'multiplier': {
            const active = inf.drain.multiplier > 1;
            const round = game.combat?.started ? game.combat.round : null;
            inf.drain.multiplier = active ? 1 : 2;
            // "Until the end of the caster's next turn": expires after the next round's drain.
            inf.drain.multiplierUntilRound = active || round == null ? null : round + 1;
            await updateInfusion(actor, inf);
            break;
        }
        case 'edit':
            await InfusionDialog.edit(actor, inf);
            break;
        default:
            return false;
    }
    return true;
}

/** Wires `[data-sci-list]` clicks inside `root`. */
export function bindListActions(root: HTMLElement, after?: () => void) {
    root.addEventListener('click', (event) => {
        const el = (event.target as HTMLElement).closest<HTMLElement>('[data-sci-list]');
        if (!el || !root.contains(el)) return;
        event.preventDefault();
        event.stopPropagation();
        void handleListAction(el).then(() => after?.());
    });
}
