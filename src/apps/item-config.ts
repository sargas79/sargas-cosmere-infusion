/** Per-item infusion settings (stored in item flags); overrides auto-detection. */
import { FLAGS, MODULE_ID } from '@/constants';
import { HtmlApp } from '@/apps/base';
import { CADENCES, INFUSION_KINDS, SURGE_KEYS } from '@/data/infusion';
import { detectInfusion, itemConfig, type ItemInfusionConfig } from '@/core/surge-detect';
import { checked, esc, options, t } from '@/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

export class ItemConfigApp extends HtmlApp {
    static DEFAULT_OPTIONS = {
        id: 'sci-item-config-{id}',
        window: { title: 'SCI.ItemConfig.Title', icon: 'fa-solid fa-sun' },
        position: { width: 440 },
    };

    constructor(private readonly item: any) {
        super();
    }

    get title() {
        return t('SCI.ItemConfig.TitleFor', { name: this.item.name });
    }

    protected renderBody(): string {
        const c = itemConfig(this.item);
        const detected = detectInfusion(this.item, { ignoreConfig: true });
        const detectedText = detected ? t('SCI.ItemConfig.Detected', { surge: t(`SCI.Surge.${detected.surge}`) }) : t('SCI.ItemConfig.NotDetected');
        const surgeChoices: [string, string][] = [
            ['', t('SCI.ItemConfig.Automatic')],
            ...[...SURGE_KEYS, 'custom', 'bead', 'upkeep'].map((k): [string, string] => [k, t(`SCI.Surge.${k}`)]),
        ];
        return `
        <form class="sci-form">
            <p class="hint">${esc(detectedText)}</p>
            <div class="form-group"><label>${t('SCI.ItemConfig.Mode')}</label>
                <select name="mode">${options(
                    [
                        ['auto', t('SCI.ItemConfig.ModeAuto')],
                        ['on', t('SCI.ItemConfig.ModeOn')],
                        ['off', t('SCI.ItemConfig.ModeOff')],
                    ],
                    c.mode,
                )}</select></div>
            <div class="form-group"><label>${t('SCI.Field.Surge')}</label><select name="surge">${options(surgeChoices, c.surge ?? '')}</select></div>
            <div class="form-group"><label>${t('SCI.Field.Kind')}</label><select name="kind">${options(
                [['', t('SCI.ItemConfig.Automatic')], ...INFUSION_KINDS.map((k): [string, string] => [k, t(`SCI.Kind.${k}`)])],
                c.kind ?? '',
            )}</select></div>
            <div class="form-group"><label>${t('SCI.Field.Cadence')}</label><select name="cadence">${options(
                [['', t('SCI.ItemConfig.Automatic')], ...CADENCES.map((k): [string, string] => [k, t(`SCI.Cadence.${k}`)])],
                c.cadence ?? '',
            )}</select></div>
            <div class="form-group"><label>${t('SCI.Field.Reclaimable')}</label><input type="checkbox" name="reclaimable"${checked(!!c.reclaimable)}></div>
            <footer class="sci-footer">
                <button type="button" data-sci-action="save"><i class="fa-solid fa-check"></i> ${t('SCI.Common.Save')}</button>
            </footer>
        </form>`;
    }

    protected async onAction(action: string) {
        if (action !== 'save') return;
        const f = this.readForm();
        const config: ItemInfusionConfig = {
            mode: (f.mode as ItemInfusionConfig['mode']) ?? 'auto',
            ...(f.surge ? { surge: f.surge as ItemInfusionConfig['surge'] } : {}),
            ...(f.kind ? { kind: f.kind as ItemInfusionConfig['kind'] } : {}),
            ...(f.cadence ? { cadence: f.cadence as ItemInfusionConfig['cadence'] } : {}),
            reclaimable: !!f.reclaimable,
        };
        await this.item.unsetFlag(MODULE_ID, FLAGS.itemConfig);
        await this.item.setFlag(MODULE_ID, FLAGS.itemConfig, config);
        await this.close();
    }
}

/** Adds an "Infusion" button to the header of item sheets the user can edit. */
export function initItemConfig() {
    Hooks.on('renderDocumentSheetV2', (app: any, html: HTMLElement) => {
        const item = app.document;
        if (item?.documentName !== 'Item' || !item.isOwner) return;
        if (!['power', 'talent', 'action'].includes(item.type)) return;
        const header = app.element?.querySelector('.window-header');
        if (!header || header.querySelector('.sci-item-config')) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'header-control icon fa-solid fa-sun sci-item-config';
        button.dataset.tooltip = t('SCI.ItemConfig.Title');
        button.setAttribute('aria-label', t('SCI.ItemConfig.Title'));
        button.addEventListener('click', (event) => {
            event.preventDefault();
            void new ItemConfigApp(item).render({ force: true });
        });
        const close = header.querySelector('[data-action="close"]');
        header.insertBefore(button, close ?? null);
        void html;
    });
}
