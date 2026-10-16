/**
 * Upkeep window: Maintain or End each sustained infusion and upkeep effect, at the start of the caster's
 * turn (or at its end, for Enhance). At the start of the turn it also offers to reclaim infusions
 * (Stormlight Reclamation) and to use Regenerate. Closing the window keeps the defaults.
 */
import { HtmlApp } from '@/apps/base';
import { drawsFromCaster, type Infusion } from '@/data/infusion';
import { upkeepCost, type CasterState, type TurnDecisions } from '@/core/engine';
import { infusionDescription, infusionTitle } from '@/core/chat';
import { esc, t } from '@/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

export type PromptPhase = 'start' | 'end';

export interface PromptExtras {
    /** Infusions with a pool the caster may reclaim (Stormlight Reclamation). */
    reclaim?: Infusion[];
    /** Offer the Regenerate action; `damaged` makes Use the default. */
    regenerate?: { damaged: boolean } | null;
}

export interface PromptResult extends TurnDecisions {
    /** Use the Regenerate action after the upkeep. */
    regenerate?: boolean;
}

/** Upkeep windows open on this client. */
const openPrompts = new Set<TurnPrompt>();

/** Closes every open upkeep window on this client (each continues with what was chosen so far). */
export function forceContinueAll() {
    for (const prompt of [...openPrompts]) void prompt.close();
}

/** Infusions the start-of-turn window asks about: your sustained infusions and start-of-turn upkeeps. */
export const promptsAtStart = (inf: Infusion) => drawsFromCaster(inf) && inf.timing !== 'end';

interface Choice {
    value: string;
    label: string;
    checked: boolean;
    disabled?: boolean;
}

export class TurnPrompt extends HtmlApp {
    static DEFAULT_OPTIONS = {
        id: 'sci-turn-prompt-{id}',
        window: { title: 'SCI.Prompt.Title', icon: 'fa-solid fa-hourglass-start' },
        position: { width: 440 },
    };

    private resolve: ((d: PromptResult) => void) | null = null;
    private decisions: PromptResult;

    constructor(
        private readonly actor: any,
        private readonly infusions: Infusion[],
        private readonly caster: CasterState,
        private readonly phase: PromptPhase,
        private readonly extras: PromptExtras = {},
    ) {
        super();
        // Closing the window keeps the defaults: what can't be paid ends, Regenerate is used when hurt.
        this.decisions = this.defaults();
    }

    static ask(
        actor: any,
        infusions: Infusion[],
        caster: CasterState,
        phase: PromptPhase = 'start',
        extras: PromptExtras = {},
    ): Promise<PromptResult> {
        const app = new TurnPrompt(actor, infusions, caster, phase, extras);
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

    /** Investiture available at the drain: Empowered refills first. */
    private get available(): number {
        return this.caster.empowered && this.phase === 'start' ? Math.max(this.caster.inv, this.caster.max) : this.caster.inv;
    }

    private canMaintain(inf: Infusion): boolean {
        return upkeepCost(inf, this.available) <= this.available;
    }

    private canRegenerate(): boolean {
        return this.available >= 1;
    }

    private defaults(): PromptResult {
        const result: PromptResult = { end: [], skipUpkeep: [], reclaim: [] };
        for (const inf of this.infusions) {
            if (!this.canMaintain(inf)) (inf.kind === 'upkeep' ? result.skipUpkeep! : result.end!).push(inf.id);
        }
        result.regenerate = !!this.extras.regenerate?.damaged && this.canRegenerate();
        return result;
    }

    private row(title: string, description: string, name: string, choices: Choice[]): string {
        const toggles = choices
            .map(
                (c) =>
                    `<label class="sci-toggle${c.disabled ? ' sci-disabled' : ''}"><input type="radio" name="${name}" value="${c.value}"${c.checked ? ' checked' : ''}${c.disabled ? ' disabled' : ''}><span>${esc(c.label)}</span></label>`,
            )
            .join('');
        const small = description ? `<br><small>${esc(description)}</small>` : '';
        return `<tr><td class="sci-label"><strong>${esc(title)}</strong>${small}</td><td><div class="sci-toggles">${toggles}</div></td></tr>`;
    }

    protected renderBody(): string {
        const d = this.decisions;
        const rows: string[] = [];
        for (const inf of this.infusions) {
            const affordable = this.canMaintain(inf);
            const ended = d.end!.includes(inf.id) || d.skipUpkeep!.includes(inf.id);
            const cost = upkeepCost(inf, this.available);
            const description = [infusionDescription(inf), cost > 0 ? t('SCI.Prompt.Cost', { cost }) : ''].filter(Boolean).join(' · ');
            rows.push(
                this.row(infusionTitle(inf), description, `choice-${inf.id}`, [
                    { value: 'maintain', label: t('SCI.Prompt.Maintain'), checked: !ended, disabled: !affordable },
                    { value: 'end', label: t('SCI.Prompt.End'), checked: ended },
                ]),
            );
        }
        for (const inf of this.extras.reclaim ?? []) {
            const description = [infusionDescription(inf), t('SCI.Prompt.PoolLeft', { pool: inf.pool })].filter(Boolean).join(' · ');
            rows.push(
                this.row(infusionTitle(inf), description, `reclaim-${inf.id}`, [
                    { value: 'keep', label: t('SCI.Prompt.Keep'), checked: true },
                    { value: 'reclaim', label: t('SCI.Prompt.Reclaim'), checked: false },
                ]),
            );
        }
        if (this.extras.regenerate) {
            rows.push(
                this.row(t('SCI.Prompt.Regenerate'), this.canRegenerate() ? '' : t('SCI.Prompt.NoInvestiture'), 'regenerate', [
                    { value: 'use', label: t('SCI.Prompt.Use'), checked: !!d.regenerate, disabled: !this.canRegenerate() },
                    { value: 'skip', label: t('SCI.Prompt.DontUse'), checked: !d.regenerate },
                ]),
            );
        }

        return `
        <form class="sci-form sci-prompt">
            <p>${t('SCI.Prompt.Intro', { inv: this.caster.inv, max: this.caster.max })}</p>
            ${this.caster.empowered && this.phase === 'start' ? `<p class="sci-hint">${t('SCI.Prompt.Empowered')}</p>` : ''}
            <table class="sci-table">
                <thead><tr><th class="sci-label">${t('SCI.Prompt.Infusion')}</th><th>${t('SCI.Prompt.Actions')}</th></tr></thead>
                <tbody>${rows.join('')}</tbody>
            </table>
            <footer class="sci-footer">
                <button type="button" data-sci-action="continue"><i class="fa-solid fa-forward"></i> ${t('SCI.Prompt.Continue')}</button>
            </footer>
        </form>`;
    }

    protected async onAction(action: string) {
        if (action !== 'continue') return;
        const form = this.readForm();
        const decisions: PromptResult = { end: [], skipUpkeep: [], reclaim: [] };
        for (const inf of this.infusions) {
            if (form[`choice-${inf.id}`] !== 'end' && this.canMaintain(inf)) continue;
            (inf.kind === 'upkeep' ? decisions.skipUpkeep! : decisions.end!).push(inf.id);
        }
        for (const inf of this.extras.reclaim ?? []) {
            if (form[`reclaim-${inf.id}`] === 'reclaim') decisions.reclaim!.push(inf.id);
        }
        decisions.regenerate = form.regenerate === 'use' && this.canRegenerate();
        this.decisions = decisions;
        await this.close();
    }
}
