/**
 * "Infusions" section at the top of the Actions tab on character and adversary sheets.
 *
 * The system's action-list section API lists items, and infusions live in actor flags, so the section is
 * injected on render instead. The sheet re-renders whenever the actor (and so its flags) changes.
 */
import { MODULE_ID } from '@/constants';
import { InfusionDialog, userTargets } from '@/apps/infusion-dialog';
import { bindListActions, renderInfusionRows } from '@/apps/infusion-list';
import { ActorPanel } from '@/apps/actor-panel';
import { actorSurges, casterState } from '@/core/actor-data';
import { getInfusions } from '@/core/store';
import { esc, t } from '@/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

function shouldShow(actor: any): boolean {
    return getInfusions(actor).length > 0 || actorSurges(actor).length > 0 || casterState(actor).max > 0;
}

function inject(app: any) {
    const actor = app.document;
    const root: HTMLElement | null = app.element;
    if (!actor || actor.documentName !== 'Actor' || !root || !shouldShow(actor)) return;
    const tab = root.querySelector<HTMLElement>('.tab[data-tab="actions"]');
    if (!tab) return;
    tab.querySelector(`.${MODULE_ID}-section`)?.remove();

    const section = document.createElement('section');
    section.className = `${MODULE_ID}-section sci-section`;
    const infusions = getInfusions(actor);
    section.innerHTML = `
        <header class="sci-section-header">
            <h3><i class="fa-solid fa-sun"></i> ${esc(t('SCI.Section.Title'))} <small>(${infusions.length})</small></h3>
            <div class="sci-controls">
                ${actor.isOwner ? `<a class="sci-btn" data-sci-section="new" title="${esc(t('SCI.Panel.New'))}"><i class="fa-solid fa-plus"></i></a>` : ''}
                <a class="sci-btn" data-sci-section="panel" title="${esc(t('SCI.Panel.Title'))}"><i class="fa-solid fa-up-right-from-square"></i></a>
            </div>
        </header>
        <ul class="sci-list">${renderInfusionRows(actor, infusions, { gm: game.user.isGM })}</ul>`;

    bindListActions(section);
    section.addEventListener('click', (event) => {
        const el = (event.target as HTMLElement).closest<HTMLElement>('[data-sci-section]');
        if (!el) return;
        event.preventDefault();
        if (el.dataset.sciSection === 'new') void InfusionDialog.open(actor, { targets: userTargets() });
        if (el.dataset.sciSection === 'panel') ActorPanel.show(actor);
    });

    // Place it after the search bar so it sits above the action list.
    const search = tab.querySelector('app-actor-search-bar, .search-bar, [id*="search"]');
    const anchor = search?.closest('.tab > *') ?? null;
    if (anchor && anchor.parentElement === tab) anchor.after(section);
    else tab.prepend(section);
}

export function initSheet() {
    Hooks.on('renderActorSheetV2', (app: any) => inject(app));
}
