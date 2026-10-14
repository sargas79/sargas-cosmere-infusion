/** GM overview of every active infusion, with scene mode, round advance and table tools. */
import { MODULE_HOOKS } from '@/constants';
import { HtmlApp } from '@/apps/base';
import { bindListActions, renderInfusionRows } from '@/apps/infusion-list';
import { allActors, casterState } from '@/core/actor-data';
import { commit, getInfusions } from '@/core/store';
import { advanceRoundForAll } from '@/core/turn';
import { highstorm } from '@/integrations/spheres';
import { getSetting, setSetting, type SceneMode } from '@/settings';
import { esc, options, t } from '@/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

let instance: InfusionTracker | null = null;

export class InfusionTracker extends HtmlApp {
    static DEFAULT_OPTIONS = {
        id: 'sci-tracker',
        window: { title: 'SCI.Tracker.Title', icon: 'fa-solid fa-sun' },
        position: { width: 640, height: 600 },
    };

    private surgeFilter = '';

    static show() {
        instance ??= new InfusionTracker();
        void instance.render({ force: true });
    }

    static refresh() {
        if (instance?.rendered) void instance.render();
    }

    declare rendered: boolean;

    _onFirstRender(context: any, opts: any) {
        super._onFirstRender(context, opts);
        bindListActions(this.element, () => void this.render());
    }

    protected renderBody(): string {
        const mode = getSetting('sceneMode');
        const groups = allActors()
            .map((actor) => ({ actor, infusions: getInfusions(actor).filter((i) => !this.surgeFilter || i.surge === this.surgeFilter) }))
            .filter((g) => g.infusions.length);
        const surges = [...new Set(allActors().flatMap((a) => getInfusions(a).map((i) => i.surge)))];

        const body = groups.length
            ? groups
                  .map(({ actor, infusions }) => {
                      const state = casterState(actor);
                      return `<section class="sci-group">
                    <h3>${esc(actor.name)} <small>${t('SCI.Panel.Investiture', { inv: state.inv, max: state.max })}</small></h3>
                    <ul class="sci-list">${renderInfusionRows(actor, infusions, { gm: true })}</ul></section>`;
                  })
                  .join('')
            : `<p class="sci-empty">${t('SCI.Tracker.Empty')}</p>`;

        return `
        <div class="sci-tracker">
            <div class="sci-toolbar">
                <label>${t('SCI.Tracker.SceneMode')}
                    <select name="sceneMode">${options(
                        (['combat', 'conversation', 'endeavor', 'free'] as SceneMode[]).map((m) => [m, t(`SCI.SceneMode.${m}`)]),
                        mode,
                    )}</select></label>
                <label>${t('SCI.Field.Surge')}
                    <select name="surgeFilter">${options(
                        [['', t('SCI.Tracker.All')], ...surges.map((s): [string, string] => [s, t(`SCI.Surge.${s}`)])],
                        this.surgeFilter,
                    )}</select></label>
            </div>
            <p class="hint">${t(`SCI.SceneMode.${mode}Hint`)}</p>
            <div class="sci-buttons">
                <button type="button" data-sci-action="advance"><i class="fa-solid fa-forward-step"></i> ${t('SCI.Tracker.Advance')}</button>
                <button type="button" data-sci-action="endAll"><i class="fa-solid fa-power-off"></i> ${t('SCI.Tracker.EndAll')}</button>
                ${getSetting('sphereTracking') ? `<button type="button" data-sci-action="highstorm"><i class="fa-solid fa-cloud-bolt"></i> ${t('SCI.Tracker.Highstorm')}</button>` : ''}
            </div>
            <p class="hint">${t('SCI.Tracker.DrainHint')}</p>
            ${body}
        </div>`;
    }

    protected async onInputChange(target: HTMLElement) {
        const el = target as HTMLSelectElement;
        if (el.name === 'sceneMode') await setSetting('sceneMode', el.value as SceneMode);
        if (el.name === 'surgeFilter') this.surgeFilter = el.value;
        void this.render();
    }

    protected async onAction(action: string) {
        switch (action) {
            case 'advance':
                await advanceRoundForAll();
                break;
            case 'endAll': {
                const ok = await foundry.applications.api.DialogV2.confirm({
                    window: { title: t('SCI.Tracker.EndAll') },
                    content: `<p>${t('SCI.Tracker.EndAllConfirm')}</p>`,
                    rejectClose: false,
                });
                if (!ok) return;
                for (const actor of allActors()) {
                    const infusions = getInfusions(actor);
                    if (!infusions.length) continue;
                    const log = infusions.map((i) => ({ type: 'ended' as const, id: i.id, label: i.label, reason: 'manual' as const }));
                    await commit(actor, { inv: casterState(actor).inv, infusions: [], ended: infusions, log }, { chat: t('SCI.Chat.SceneEnd') });
                }
                break;
            }
            case 'highstorm':
                await highstorm();
                break;
        }
        void this.render();
    }
}

export function initTracker() {
    Hooks.on(MODULE_HOOKS.changed, () => InfusionTracker.refresh());
    Hooks.on('getSceneControlButtons', (controls: any) => {
        if (!game.user.isGM) return;
        const tokens = controls.tokens ?? controls.token;
        if (!tokens?.tools) return;
        tokens.tools.sciTracker = {
            name: 'sciTracker',
            title: 'SCI.Tracker.Title',
            icon: 'fa-solid fa-sun',
            order: Object.keys(tokens.tools).length,
            button: true,
            visible: true,
            onChange: () => InfusionTracker.show(),
        };
    });
}
