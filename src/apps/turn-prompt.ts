/**
 * Upkeep window: Maintain or End each self infusion and upkeep effect, at the start of the caster's turn
 * (or at its end, for Enhance). Closing the window counts as Maintain for everything.
 */
import { HtmlApp } from '@/apps/base';
import type { Infusion } from '@/data/infusion';
import type { CasterState, TurnDecisions } from '@/core/engine';
import { esc, t } from '@/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

export type PromptPhase = 'start' | 'end';

/** Upkeep windows open on this client. */
const openPrompts = new Set<TurnPrompt>();

/** Closes every open upkeep window on this client (each continues with what was chosen so far). */
export function forceContinueAll() {
    for (const prompt of [...openPrompts]) void prompt.close();
}

/** Infusions the start-of-turn window asks about: your own self infusions and start-of-turn upkeeps. */
export const promptsAtStart = (inf: Infusion) => (inf.kind === 'self' || inf.kind === 'upkeep') && inf.timing !== 'end';

export class TurnPrompt extends HtmlApp {
    static DEFAULT_OPTIONS = {
        id: 'sci-turn-prompt-{id}',
        window: { title: 'SCI.Prompt.Title', icon: 'fa-solid fa-hourglass-start' },
        position: { width: 420 },
    };

    private resolve: ((d: TurnDecisions) => void) | null = null;
    private decisions: TurnDecisions = {};

    constructor(
        private readonly actor: any,
        private readonly infusions: Infusion[],
        private readonly caster: CasterState,
        private readonly phase: PromptPhase,
    ) {
        super();
    }

    static ask(actor: any, infusions: Infusion[], caster: CasterState, phase: PromptPhase = 'start'): Promise<TurnDecisions> {
        const app = new TurnPrompt(actor, infusions, caster, phase);
        return new Promise((resolve) => {
            app.resolve = resolve;
            openPrompts.add(app);
            void app.render({ force: true });
        });
    }

    get title() {
        return t(this.phase === 'end' ? 'SCI.Prompt.EndTitleFor' : 'SCI.Prompt.TitleFor', { name: this.actor.name });
    }

    async close(options?: any) {
        openPrompts.delete(this);
        this.resolve?.(this.decisions);
        this.resolve = null;
        return super.close(options);
    }

    protected renderBody(): string {
        const toggle = (inf: Infusion, choice: 'maintain' | 'end', label: string) =>
            `<label class="sci-toggle"><input type="radio" name="choice-${inf.id}" value="${choice}"${choice === 'maintain' ? ' checked' : ''}><span>${t(label)}</span></label>`;
        const rows = this.infusions
            .map((inf) => {
                const surge = inf.kind === 'upkeep' ? '' : `<br><small>${esc(t(`SCI.Surge.${inf.surge}`))}</small>`;
                return `<tr>
                    <td class="sci-label"><strong>${esc(inf.label)}</strong>${surge}</td>
                    <td><div class="sci-toggles">${toggle(inf, 'maintain', 'SCI.Prompt.Maintain')}${toggle(inf, 'end', 'SCI.Prompt.End')}</div></td>
                </tr>`;
            })
            .join('');

        return `
        <form class="sci-form sci-prompt">
            <p>${t('SCI.Prompt.Intro', { inv: this.caster.inv, max: this.caster.max })}</p>
            ${this.caster.empowered && this.phase === 'start' ? `<p class="sci-hint">${t('SCI.Prompt.Empowered')}</p>` : ''}
            <table class="sci-table">
                <thead><tr><th class="sci-label">${t('SCI.Prompt.Infusion')}</th><th>${t('SCI.Prompt.Actions')}</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
            <footer class="sci-footer">
                <button type="button" data-sci-action="continue"><i class="fa-solid fa-forward"></i> ${t('SCI.Prompt.Continue')}</button>
            </footer>
        </form>`;
    }

    protected async onAction(action: string) {
        if (action !== 'continue') return;
        const form = this.readForm();
        const decisions: Required<Pick<TurnDecisions, 'end' | 'skipUpkeep'>> = { end: [], skipUpkeep: [] };
        for (const inf of this.infusions) {
            if (form[`choice-${inf.id}`] !== 'end') continue;
            (inf.kind === 'upkeep' ? decisions.skipUpkeep : decisions.end).push(inf.id);
        }
        this.decisions = decisions;
        await this.close();
    }
}
