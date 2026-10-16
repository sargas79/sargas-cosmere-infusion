/**
 * Effects tab sections on character and adversary sheets, below Injuries:
 * - Sustained Infusions: the infusions this actor keeps up (it is the caster).
 * - Active Infusions: the infusions on this actor (it is a target, or the caster of a self infusion), with
 *   their sub-effects (Basic Lashing, Hardened Defense...) listed under them.
 *
 * Both read the caster's flags, so the same infusion shows in both places and stays in sync. The markup
 * reuses the system's item-list classes so the tables look like the system's own, but uses its own
 * `data-sci-*` attributes: the system's `data-action` handlers belong to its sheet components.
 */
import { MODULE_ID } from '@/constants';
import { drawsFromCaster, type Infusion } from '@/data/infusion';
import { InfusionDialog, userTargets } from '@/apps/infusion-dialog';
import { badge, runListAction } from '@/apps/infusion-list';
import { infusionDescription, infusionTitle } from '@/core/chat';
import { actorSurges, allActors, casterState, infusionIcon } from '@/core/actor-data';
import { addInvestiture, durationLeft } from '@/core/engine';
import { targetActor } from '@/core/markers';
import { commit, getInfusions } from '@/core/store';
import { findSubEffects } from '@/core/sub-effects';
import { esc, t } from '@/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

type SectionKind = 'sustained' | 'active';

/** Collapsed sections (`actorUuid|section`) and expanded rows (`actorUuid|rowKey`), kept across re-renders. */
const collapsed = new Set<string>();
const expanded = new Set<string>();

function shouldShowSustained(actor: any): boolean {
    return getInfusions(actor).length > 0 || actorSurges(actor).length > 0 || casterState(actor).max > 0;
}

/** Infusions on `actor`: targeting it, or self infusions it keeps up. Upkeep effects show their own effects. */
export function activeInfusionsOn(actor: any): { caster: any; inf: Infusion }[] {
    const found: { caster: any; inf: Infusion }[] = [];
    for (const caster of allActors()) {
        for (const inf of getInfusions(caster)) {
            if (inf.kind === 'upkeep') continue;
            const on =
                inf.kind === 'self'
                    ? caster.uuid === actor.uuid
                    : inf.targets.some((tg) => targetActor(tg.uuid)?.uuid === actor.uuid);
            if (on) found.push({ caster, inf });
        }
    }
    return found;
}

/** A character with its portrait in a bordered box, or a plain name for objects and text targets. */
function entity(name: string, img?: string | null): string {
    return `<span class="sci-entity">${img ? `<span class="img sci-portrait"><img src="${esc(img)}" alt=""></span>` : ''}<span class="sci-entity-name">${esc(name)}</span></span>`;
}

function targetCell(caster: any, inf: Infusion): string {
    if (drawsFromCaster(inf)) return entity(caster.name, caster.img);
    if (!inf.targets.length) return `<span class="none">—</span>`;
    return inf.targets
        .map((tg) => {
            const actor = targetActor(tg.uuid);
            return entity(tg.name || actor?.name || '', actor ? (tg.img ?? actor.img) : null);
        })
        .join('');
}

function durationCell(caster: any, inf: Infusion): string {
    // Self infusions and upkeep effects last as long as the caster keeps paying for them.
    if (drawsFromCaster(inf)) return `<span>${esc(t('SCI.Duration.Sustained'))}</span>`;
    const left = durationLeft(inf, casterState(caster).inv);
    if (left == null) return `<span data-tooltip="${esc(t('SCI.Prompt.Free'))}">∞</span>`;
    const one = left === 1;
    const key = {
        round: one ? 'SCI.Duration.Round' : 'SCI.Duration.Rounds',
        '10min': 'SCI.Duration.Minutes',
        day: one ? 'SCI.Duration.Day' : 'SCI.Duration.Days',
    }[inf.drain.cadence];
    return `<span>${esc(t(key, { n: inf.drain.cadence === '10min' ? left * 10 : left }))}</span>`;
}

/** Surge name, with the optional description in gray under it. */
function nameCell(inf: Infusion): string {
    const description = infusionDescription(inf);
    return `<div class="name" data-sci-act="details"><span class="sci-name"><span>${esc(infusionTitle(inf))}</span>${description ? `<span class="sci-description">${esc(description)}</span>` : ''}</span></div>`;
}

function detailsHtml(caster: any, inf: Infusion, withCaster: boolean): string {
    const rows: [string, string][] = [];
    if (withCaster) rows.push([t('SCI.Section.Source'), esc(caster.name)]);
    rows.push([t('SCI.Field.Surge'), esc(t(`SCI.Surge.${inf.surge}`))]);
    rows.push([t('SCI.Field.Kind'), esc(t(`SCI.Kind.${inf.kind}`))]);
    if (!drawsFromCaster(inf)) rows.push([t('SCI.Field.Pool'), String(inf.pool)]);
    if (inf.targets.length) rows.push([t('SCI.Field.Targets'), esc(inf.targets.map((tg) => tg.name).join(', '))]);
    if (inf.health) rows.push([t('SCI.Field.Health'), `${inf.health.value}/${inf.health.max}`]);
    if (inf.talents.length) rows.push([t('SCI.Section.Talents'), esc(inf.talents.join(', '))]);
    if (infusionDescription(inf)) rows.push([t('SCI.Field.Label'), esc(infusionDescription(inf))]);
    if (inf.notes) rows.push([t('SCI.Field.Notes'), esc(inf.notes)]);
    const tags = badge(inf);
    return `<dl class="sci-details">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>${tags ? `<p class="sci-badges">${tags}</p>` : ''}`;
}

const icon = (act: string, fa: string, tooltip: string) =>
    `<a role="button" data-sci-act="${act}" data-tooltip="${esc(tooltip)}"><i class="fa-solid ${fa}"></i></a>`;

const detailsToggle = (open: boolean) => icon('details', open ? 'fa-compress' : 'fa-expand', open ? 'GENERIC.HideDetails' : 'GENERIC.ViewDetails');

const canManage = (caster: any) => caster.isOwner || game.user.isGM;

function sustainedRow(actor: any, inf: Infusion): string {
    const open = expanded.has(`${actor.uuid}|${inf.id}`);
    const add = actor.isOwner && !drawsFromCaster(inf) ? icon('add', 'fa-plus', t('SCI.Section.AddOne')) : '<span class="sci-spacer"></span>';
    return `<li class="item effect collapsible ${open ? 'expanded' : ''}" data-sci-row="${inf.id}" data-sci-caster="${esc(actor.uuid)}" data-sci-id="${inf.id}">
        <section class="details">
            <div class="img"><img src="${esc(infusionIcon(actor, inf))}" alt=""></div>
            ${nameCell(inf)}
            <div class="detail extrawide sci-target">${targetCell(actor, inf)}</div>
            <div class="detail wide">${durationCell(actor, inf)}</div>
            <div class="controls icon faded sci-controls-3">${add}${detailsToggle(open)}${canManage(actor) ? icon('menu', 'fa-ellipsis-vertical', 'APPLICATION.TOOLS.ToggleControls') : ''}</div>
        </section>
        <section class="description collapsible-content"><div class="wrapper">${detailsHtml(actor, inf, false)}</div></section>
    </li>`;
}

function activeRows(actor: any, caster: any, inf: Infusion): string {
    const open = expanded.has(`${actor.uuid}|${inf.id}`);
    const parent = `<li class="item effect collapsible ${open ? 'expanded' : ''}" data-sci-row="${inf.id}" data-sci-caster="${esc(caster.uuid)}" data-sci-id="${inf.id}">
        <section class="details">
            <div class="img"><img src="${esc(infusionIcon(caster, inf))}" alt=""></div>
            ${nameCell(inf)}
            <div class="detail extrawide sci-target">${entity(caster.name, caster.img)}</div>
            <div class="detail wide">${durationCell(caster, inf)}</div>
            <div class="detail thin action"></div>
            <div class="controls icon faded">${detailsToggle(open)}${canManage(caster) ? icon('menu', 'fa-ellipsis-vertical', 'APPLICATION.TOOLS.ToggleControls') : ''}</div>
        </section>
        <section class="description collapsible-content"><div class="wrapper">${detailsHtml(caster, inf, true)}</div></section>
    </li>`;
    const children = findSubEffects(actor, inf.id)
        .map((effect: any) => {
            const childOpen = expanded.has(`${actor.uuid}|${effect.id}`);
            const toggle = actor.isOwner
                ? `<a class="icon ${effect.disabled ? 'faded' : 'active'}" data-sci-act="toggle-effect" data-tooltip="${effect.disabled ? 'COSMERE.Sheet.Effects.Enable' : 'COSMERE.Sheet.Effects.Disable'}"><i class="fa-solid ${effect.disabled ? 'fa-toggle-off' : 'fa-toggle-on'}"></i></a>`
                : '';
            return `<li class="item effect collapsible indent ${effect.disabled ? '' : 'active'} ${childOpen ? 'expanded' : ''}" data-sci-row="${effect.id}" data-sci-effect="${esc(effect.uuid)}">
                <section class="details">
                    <div class="img"><img src="${esc(effect.img)}" alt=""></div>
                    <div class="name" data-sci-act="details"><span>${esc(effect.name)}</span></div>
                    <div class="detail extrawide"></div>
                    <div class="detail wide"></div>
                    <div class="detail thin action">${toggle}</div>
                    <div class="controls icon faded">${detailsToggle(childOpen)}</div>
                </section>
                <section class="description collapsible-content"><div class="wrapper"><p>${esc(effect.description || '—')}</p></div></section>
            </li>`;
        })
        .join('');
    return parent + children;
}

function section(actor: any, kind: SectionKind, header: string, rows: string): HTMLElement {
    const el = document.createElement('ul');
    const isCollapsed = collapsed.has(`${actor.uuid}|${kind}`);
    el.className = `item-list effect-list collapsible ${MODULE_ID}-section sci-sheet-section sci-${kind} ${isCollapsed ? '' : 'expanded'}`;
    el.dataset.sciSection = kind;
    el.innerHTML = `${header}<section class="collapsible-content"><div class="wrapper">${rows}</div></section>`;
    return el;
}

function sustainedSection(actor: any): HTMLElement {
    const infusions = getInfusions(actor);
    const header = `<li class="item header" data-sci-act="collapse">
        <section class="details">
            <span class="title">${esc(t('SCI.Section.Sustained'))}</span>
            <span class="subtitle extrawide">${esc(t('SCI.Section.Target'))}</span>
            <span class="subtitle wide">${esc(t('SCI.Section.Duration'))}</span>
            <div class="controls icon active sci-controls-3">${actor.isOwner ? icon('new', 'fa-plus', t('SCI.Panel.New')) : '<div></div>'}</div>
        </section>
    </li>`;
    return section(actor, 'sustained', header, infusions.map((inf) => sustainedRow(actor, inf)).join(''));
}

function activeSection(actor: any, active: { caster: any; inf: Infusion }[]): HTMLElement {
    const header = `<li class="item header" data-sci-act="collapse">
        <section class="details">
            <span class="title">${esc(t('SCI.Section.Active'))}</span>
            <span class="subtitle extrawide">${esc(t('SCI.Section.Source'))}</span>
            <span class="subtitle wide">${esc(t('SCI.Section.Duration'))}</span>
            <div class="subtitle thin"></div>
            <div class="controls icon active"><div></div></div>
        </section>
    </li>`;
    return section(actor, 'active', header, active.map(({ caster, inf }) => activeRows(actor, caster, inf)).join(''));
}

/* --- "More" dropdown, with the system's dropdown markup --- */

interface MenuItem {
    label: string;
    icon: string;
    run: () => unknown;
}

let openMenu: { el: HTMLElement; anchor: HTMLElement; off: () => void } | null = null;

function closeMenu() {
    openMenu?.off();
    openMenu?.el.remove();
    openMenu = null;
}

function showMenu(root: HTMLElement, anchor: HTMLElement, items: MenuItem[]) {
    const reopen = openMenu?.anchor === anchor;
    closeMenu();
    if (reopen || !items.length) return;
    const menu = document.createElement('menu');
    menu.className = 'controls-dropdown sci-dropdown expanded';
    menu.innerHTML = items
        .map((item, i) => `<li class="header-control"><button type="button" class="control" data-sci-item="${i}"><i class="${item.icon}"></i><span>${esc(item.label)}</span></button></li>`)
        .join('');
    root.append(menu);
    const a = anchor.getBoundingClientRect();
    const r = root.getBoundingClientRect();
    menu.style.top = `${a.top - r.top}px`;
    menu.style.right = `${r.right - a.right + a.width}px`;
    menu.addEventListener('click', (event) => {
        const button = (event.target as HTMLElement).closest<HTMLElement>('[data-sci-item]');
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        const item = items[Number(button.dataset.sciItem)];
        closeMenu();
        void item?.run();
    });
    const outside = (event: Event) => {
        if (!menu.contains(event.target as Node) && !anchor.contains(event.target as Node)) closeMenu();
    };
    setTimeout(() => document.addEventListener('pointerdown', outside, true));
    openMenu = { el: menu, anchor, off: () => document.removeEventListener('pointerdown', outside, true) };
}

function menuItems(caster: any, inf: Infusion, kind: SectionKind): MenuItem[] {
    const run = (action: string) => () => runListAction(action, caster, inf.id);
    const owner = caster.isOwner;
    const gm = game.user.isGM;
    const items: MenuItem[] = [];
    if (owner) items.push({ label: t('SCI.Common.Edit'), icon: 'fa-solid fa-pen-to-square', run: run('edit') });
    if (kind === 'sustained') {
        if (owner && !drawsFromCaster(inf) && inf.reclaimable) items.push({ label: t('SCI.List.Reclaim'), icon: 'fa-solid fa-rotate-left', run: run('reclaim') });
        if ((owner || gm) && inf.health) items.push({ label: t('SCI.List.Damage'), icon: 'fa-solid fa-burst', run: run('damage') });
    }
    if (owner || gm) items.push({ label: t('SCI.Common.Remove'), icon: 'fa-solid fa-trash', run: run('end') });
    return items;
}

/* --- Events --- */

async function onClick(app: any, actor: any, event: Event) {
    const el = (event.target as HTMLElement).closest<HTMLElement>('[data-sci-act]');
    const sectionEl = el?.closest<HTMLElement>('[data-sci-section]');
    if (!el || !sectionEl) return;
    event.preventDefault();
    event.stopPropagation();
    const kind = sectionEl.dataset.sciSection as SectionKind;
    const row = el.closest<HTMLElement>('[data-sci-row]');
    const act = el.dataset.sciAct;

    if (act === 'collapse') {
        const key = `${actor.uuid}|${kind}`;
        if (collapsed.has(key)) collapsed.delete(key);
        else collapsed.add(key);
        sectionEl.classList.toggle('expanded', !collapsed.has(key));
        return;
    }
    if (act === 'new') return void InfusionDialog.open(actor, { targets: userTargets() });
    if (!row) return;
    if (act === 'details') {
        const key = `${actor.uuid}|${row.dataset.sciRow}`;
        const open = !expanded.has(key);
        if (open) expanded.add(key);
        else expanded.delete(key);
        row.classList.toggle('expanded', open);
        const toggle = row.querySelector<HTMLElement>(':scope > .details a[data-sci-act="details"]');
        if (toggle) toggle.outerHTML = detailsToggle(open);
        return;
    }
    if (act === 'toggle-effect') {
        const effect = fromUuidSync(row.dataset.sciEffect ?? '', { strict: false });
        if (effect?.isOwner) await effect.update({ disabled: !effect.disabled });
        return;
    }

    const caster = row.dataset.sciCaster ? fromUuidSync(row.dataset.sciCaster, { strict: false }) : null;
    const inf = caster ? getInfusions(caster).find((i) => i.id === row.dataset.sciId) : null;
    if (!caster || !inf) return;
    if (act === 'add') {
        // One Investiture from the caster, one more round: no window.
        const state = casterState(caster);
        if (state.inv < 1) return void ui.notifications.warn('SCI.Notify.NotEnoughInvestiture', { localize: true });
        await commit(caster, addInvestiture(state, getInfusions(caster), inf.id, 1));
        return;
    }
    if (act === 'menu') showMenu(app.element, el, menuItems(caster, inf, kind));
}

/** Places the sections in the Effects tab, below Injuries. */
function inject(app: any) {
    const actor = app.document;
    const root: HTMLElement | null = app.element;
    if (!actor || actor.documentName !== 'Actor' || !root) return;
    const tab = root.querySelector<HTMLElement>('.tab[data-tab="effects"]');
    if (!tab) return;
    tab.querySelectorAll('.sci-sheet-section').forEach((el) => el.remove());

    const sections: HTMLElement[] = [];
    if (shouldShowSustained(actor)) sections.push(sustainedSection(actor));
    const active = activeInfusionsOn(actor);
    if (active.length) sections.push(activeSection(actor, active));
    if (!sections.length) return;

    for (const el of sections) {
        el.classList.add('list-component');
        el.addEventListener('click', (event) => void onClick(app, actor, event));
    }

    // Top-level child of the tab that holds the injuries list (fallbacks: conditions, search bar).
    const topLevel = (selector: string) => {
        let el = tab.querySelector<HTMLElement>(selector);
        while (el && el.parentElement !== tab) el = el.parentElement;
        return el;
    };
    const anchor = topLevel('app-actor-injuries-list, .injury-list') ?? topLevel('app-actor-conditions') ?? topLevel('app-actor-search-bar');
    if (anchor) anchor.after(...sections);
    else tab.prepend(...sections);
}

/** Re-renders the sections in every open actor sheet (a caster's change shows on its targets' sheets). */
function refreshOpenSheets() {
    for (const app of foundry.applications.instances?.values?.() ?? []) {
        if (app.document?.documentName === 'Actor' && app.rendered) inject(app);
    }
}

export function initSheet() {
    Hooks.on('renderActorSheetV2', (app: any) => inject(app));
    Hooks.on('updateActor', (_actor: any, changes: any) => {
        if (changes?.flags?.[MODULE_ID] !== undefined || changes?.system?.resources?.inv !== undefined) refreshOpenSheets();
    });
    Hooks.on('closeActorSheetV2', () => closeMenu());
}
