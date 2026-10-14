/**
 * Start-of-turn window: add Investiture, end, reclaim, or pay upkeep, then continue to the drain.
 * Closing the window counts as Continue: the drain always happens.
 */
import { HtmlApp } from '@/apps/base';
import { drawsFromCaster, type Infusion } from '@/data/infusion';
import type { CasterState, TurnDecisions } from '@/core/engine';
import { checked, esc, intValue, t } from '@/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

export class TurnPrompt extends HtmlApp {
    static DEFAULT_OPTIONS = {
        id: 'sci-turn-prompt-{id}',
        window: { title: 'SCI.Prompt.Title', icon: 'fa-solid fa-hourglass-start' },
        position: { width: 560 },
    };

    private resolve: ((d: TurnDecisions) => void) | null = null;
    private decisions: TurnDecisions = {};

    constructor(
        private readonly actor: any,
        private readonly infusions: Infusion[],
        private readonly caster: CasterState,
    ) {
        super();
    }

    static ask(actor: any, infusions: Infusion[], caster: CasterState): Promise<TurnDecisions> {
        const app = new TurnPrompt(actor, infusions, caster);
        return new Promise((resolve) => {
            app.resolve = resolve;
            void app.render({ force: true });
        });
    }

    get title() {
        return t('SCI.Prompt.TitleFor', { name: this.actor.name });
    }

    async close(options?: any) {
        this.resolve?.(this.decisions);
        this.resolve = null;
        return super.close(options);
    }

    protected renderBody(): string {
        const rows = this.infusions
            .map((inf) => {
                const pool = drawsFromCaster(inf);
                const amount = pool ? t(`SCI.Kind.${inf.kind}`) : t('SCI.Prompt.PoolValue', { pool: inf.pool });
                const cells = [
                    `<td class="sci-label"><strong>${esc(inf.label)}</strong><br><small>${esc(t(`SCI.Surge.${inf.surge}`))} · ${esc(amount)}${
                        inf.drain.everyNRounds > 1 ? ` · ${t('SCI.Prompt.EveryN', { n: inf.drain.everyNRounds, counter: inf.drain.counter })}` : ''
                    }${inf.freeWhileInvested ? ` · ${t('SCI.Prompt.Free')}` : ''}</small></td>`,
                    `<td>${pool ? '' : `<input type="number" name="add-${inf.id}" min="0" max="${this.caster.inv}" value="0">`}</td>`,
                    `<td>${inf.kind === 'upkeep' ? `<input type="checkbox" name="pay-${inf.id}" checked>` : ''}</td>`,
                    `<td>${inf.reclaimable && !pool ? `<input type="checkbox" name="reclaim-${inf.id}">` : ''}</td>`,
                    `<td><input type="checkbox" name="end-${inf.id}"${checked(false)}></td>`,
                ];
                return `<tr>${cells.join('')}</tr>`;
            })
            .join('');

        return `
        <form class="sci-form sci-prompt">
            <p>${t('SCI.Prompt.Intro', { inv: this.caster.inv, max: this.caster.max })}</p>
            ${this.caster.empowered ? `<p class="sci-hint">${t('SCI.Prompt.Empowered')}</p>` : ''}
            <table class="sci-table">
                <thead><tr><th>${t('SCI.Prompt.Infusion')}</th><th>${t('SCI.Prompt.Add')}</th><th>${t('SCI.Prompt.Pay')}</th>
                <th>${t('SCI.Prompt.Reclaim')}</th><th>${t('SCI.Prompt.End')}</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
            <p class="hint">${t('SCI.Prompt.Order')}</p>
            <footer class="sci-footer">
                <button type="button" data-sci-action="continue"><i class="fa-solid fa-forward"></i> ${t('SCI.Prompt.Continue')}</button>
            </footer>
        </form>`;
    }

    protected async onAction(action: string) {
        if (action !== 'continue') return;
        const form = this.readForm();
        const decisions: Required<TurnDecisions> = { add: {}, end: [], reclaim: [], skipUpkeep: [] };
        let total = 0;
        for (const inf of this.infusions) {
            const add = Math.max(0, intValue(form[`add-${inf.id}`], 0));
            if (add > 0) {
                decisions.add[inf.id] = add;
                total += add;
            }
            if (form[`end-${inf.id}`] === true) decisions.end.push(inf.id);
            if (form[`reclaim-${inf.id}`] === true) decisions.reclaim.push(inf.id);
            if (inf.kind === 'upkeep' && form[`pay-${inf.id}`] === false) decisions.skipUpkeep.push(inf.id);
        }
        const available = this.caster.empowered ? this.caster.max : this.caster.inv;
        if (total > available) {
            ui.notifications.warn('SCI.Notify.NotEnoughInvestiture', { localize: true });
            return;
        }
        this.decisions = decisions;
        await this.close();
    }
}
