/**
 * Settings menu: shows the effective surge/talent identifier mapping, lets the GM override it as JSON,
 * and checks it against the installed Stormlight Handbook compendium.
 */
import { HtmlApp } from '@/apps/base';
import { getMapping, verifyMapping, type VerifyReport } from '@/core/mapping';
import { getSetting, setSetting, type MappingOverrides } from '@/settings';
import { esc, t } from '@/utils';

export class MappingConfig extends HtmlApp {
    static DEFAULT_OPTIONS = {
        id: 'sci-mapping-config',
        window: { title: 'SCI.Mapping.Title', icon: 'fa-solid fa-table-list' },
        position: { width: 640 },
    };

    private report: VerifyReport | null = null;
    private error = '';

    protected renderBody(): string {
        const overrides = JSON.stringify(getSetting('mapping') ?? {}, null, 2);
        const effective = JSON.stringify(getMapping(), null, 2);
        const report = this.report
            ? this.report.available
                ? `<p>${t('SCI.Mapping.Surges', { surges: esc(this.report.surgesFound.join(', ')) })}</p>
                   <p>${
                       this.report.missingTalents.length
                           ? t('SCI.Mapping.MissingTalents', { talents: esc(this.report.missingTalents.join(', ')) })
                           : t('SCI.Mapping.AllTalentsFound')
                   }</p>`
                : `<p class="sci-warning">${t('SCI.Mapping.NoHandbook')}</p>`
            : '';
        return `
        <form class="sci-form">
            <p class="hint">${t('SCI.Mapping.Intro')}</p>
            <div class="form-group stacked"><label>${t('SCI.Mapping.Overrides')}</label>
                <textarea name="overrides" rows="10" class="sci-code">${esc(overrides)}</textarea></div>
            ${this.error ? `<p class="sci-warning">${esc(this.error)}</p>` : ''}
            <details><summary>${t('SCI.Mapping.Effective')}</summary><pre class="sci-code">${esc(effective)}</pre></details>
            ${report}
            <footer class="sci-footer">
                <button type="button" data-sci-action="verify"><i class="fa-solid fa-magnifying-glass"></i> ${t('SCI.Mapping.Verify')}</button>
                <button type="button" data-sci-action="save"><i class="fa-solid fa-check"></i> ${t('SCI.Common.Save')}</button>
            </footer>
        </form>`;
    }

    protected async onAction(action: string) {
        if (action === 'verify') {
            this.report = await verifyMapping();
            return void this.render();
        }
        if (action !== 'save') return;
        const raw = String(this.readForm().overrides ?? '').trim() || '{}';
        try {
            const parsed = JSON.parse(raw) as MappingOverrides;
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(t('SCI.Mapping.NotObject'));
            await setSetting('mapping', parsed);
            this.error = '';
            ui.notifications.info('SCI.Mapping.Saved', { localize: true });
        } catch (err) {
            this.error = (err as Error).message;
        }
        void this.render();
    }
}
