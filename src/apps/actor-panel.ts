/** Per-actor infusion panel (opened from the token HUD, the sheet section or the API). */
import { FLAGS, MODULE_HOOKS, MODULE_ID } from '@/constants';
import { HtmlApp } from '@/apps/base';
import { InfusionDialog, userTargets } from '@/apps/infusion-dialog';
import { bindListActions, renderInfusionRows } from '@/apps/infusion-list';
import { casterState, isSquire } from '@/core/actor-data';
import { getInfusions } from '@/core/store';
import { runTurnStart } from '@/core/turn';
import { checked, t } from '@/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

const open = new Map<string, ActorPanel>();

export class ActorPanel extends HtmlApp {
    static DEFAULT_OPTIONS = {
        id: 'sci-actor-panel-{id}',
        window: { title: 'SCI.Panel.Title', icon: 'fa-solid fa-sun' },
        position: { width: 520 },
    };

    constructor(private readonly actor: any) {
        super();
    }

    static show(actor: any) {
        const existing = open.get(actor.uuid);
        if (existing) return void existing.render({ force: true });
        const app = new ActorPanel(actor);
        open.set(actor.uuid, app);
        void app.render({ force: true });
    }

    static refresh(actor: any) {
        void open.get(actor.uuid)?.render();
    }

    get title() {
        return t('SCI.Panel.TitleFor', { name: this.actor.name });
    }

    async close(options?: any) {
        open.delete(this.actor.uuid);
        return super.close(options);
    }

    _onFirstRender(context: any, options: any) {
        super._onFirstRender(context, options);
        bindListActions(this.element, () => void this.render());
    }

    protected renderBody(): string {
        const state = casterState(this.actor);
        const infusions = getInfusions(this.actor);
        return `
        <div class="sci-panel">
            <p class="sci-inv"><i class="fa-solid fa-sun"></i> ${t('SCI.Panel.Investiture', { inv: state.inv, max: state.max })}
            ${state.empowered ? `<span class="sci-tag">${t('SCI.Panel.Empowered')}</span>` : ''}</p>
            <ul class="sci-list">${renderInfusionRows(this.actor, infusions, { gm: game.user.isGM })}</ul>
            ${
                this.actor.isOwner
                    ? `<footer class="sci-footer">
                <button type="button" data-sci-action="new"><i class="fa-solid fa-plus"></i> ${t('SCI.Panel.New')}</button>
                <button type="button" data-sci-action="turn"><i class="fa-solid fa-hourglass-start"></i> ${t('SCI.Panel.RunTurn')}</button>
            </footer>
            <label class="sci-squire"><input type="checkbox" data-sci-squire${checked(isSquire(this.actor))}> ${t('SCI.Panel.Squire')}</label>`
                    : ''
            }
        </div>`;
    }

    protected async onAction(action: string) {
        if (action === 'new') await InfusionDialog.open(this.actor, { targets: userTargets() });
        if (action === 'turn') await runTurnStart(this.actor, { prompt: true });
        void this.render();
    }

    protected async onInputChange(target: HTMLElement) {
        if (!target.hasAttribute('data-sci-squire')) return;
        await this.actor.setFlag(MODULE_ID, FLAGS.squire, (target as HTMLInputElement).checked);
    }
}

export function initActorPanel() {
    Hooks.on(MODULE_HOOKS.changed, (actor: any) => ActorPanel.refresh(actor));
    Hooks.on('updateActor', (actor: any) => ActorPanel.refresh(actor));
}
