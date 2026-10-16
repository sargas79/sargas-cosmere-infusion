/** Create or edit an infusion. Talent modifiers are applied automatically and can be overridden. */
import { HtmlApp } from '@/apps/base';
import {
    CADENCES,
    LIGHTS,
    SURGE_KEYS,
    drawsFromCaster,
    normalizeInfusion,
    surgeScaling,
    type Cadence,
    type Infusion,
    type InfusionKind,
    type InfusionSurge,
    type InfusionTarget,
    type Light,
    type SurgeKey,
} from '@/data/infusion';
import { SURGE_PRESETS } from '@/data/presets';
import { actorSurges, actorTalents, casterState, isSquire, surgeRanks } from '@/core/actor-data';
import { getMapping } from '@/core/mapping';
import { computeModifiers, type ModifierResult } from '@/core/modifiers';
import { createInfusion, updateInfusion } from '@/core/store';
import { checked, esc, intValue, options, t } from '@/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface DialogInit {
    surge?: InfusionSurge;
    kind?: InfusionKind;
    label?: string;
    pool?: number;
    /** Investiture the system already charged when the item was used. */
    alreadyPaid?: number;
    targets?: InfusionTarget[];
    sourceItemUuid?: string | null;
    hint?: string;
    cadence?: Cadence;
    source?: 'caster' | 'gem';
    /** Force Stormlight Reclamation on (item configuration). */
    reclaimable?: boolean;
}

type Overridable = 'everyNRounds' | 'freeWhileInvested' | 'reclaimable' | 'range' | 'health' | 'maxTargets';

const ALL_KINDS: InfusionKind[] = ['object', 'character', 'area', 'self', 'upkeep'];

const isSurgeKey = (s: InfusionSurge): s is SurgeKey => (SURGE_KEYS as readonly string[]).includes(s);

/** Targets from the user's targeted tokens. */
export function userTargets(): InfusionTarget[] {
    return [...(game.user.targets ?? [])].map((token: any) => ({
        uuid: token.document.uuid,
        name: token.name,
        img: token.document.texture?.src,
    }));
}

export class InfusionDialog extends HtmlApp {
    static DEFAULT_OPTIONS = {
        id: 'sci-infusion-dialog-{id}',
        window: { title: 'SCI.Dialog.Title', icon: 'fa-solid fa-sun' },
        position: { width: 560 },
    };

    private readonly actor: any;
    private readonly editing: Infusion | null;
    private readonly hint: string | undefined;
    /** The surge came from the action used, so the new-infusion window doesn't ask for it. */
    private readonly surgeFromAction: boolean;
    private draft: {
        surge: InfusionSurge;
        label: string;
        kind: InfusionKind;
        targets: InfusionTarget[];
        pool: number;
        alreadyPaid: number;
        source: 'caster' | 'gem';
        light: Light;
        cadence: Cadence;
        heldOrWorn: boolean;
        storedInGem: boolean;
        fineControl: boolean;
        physicalIllusion: boolean;
        notes: string;
        sourceItemUuid: string | null;
        everyNRounds: number;
        freeWhileInvested: boolean;
        reclaimable: boolean;
        range: number;
        health: number;
        maxTargets: number;
    };
    private readonly touched = new Set<Overridable>();
    private resolve: ((value: Infusion | null) => void) | null = null;

    constructor(actor: any, init: DialogInit = {}, editing: Infusion | null = null) {
        super();
        this.actor = actor;
        this.editing = editing;
        this.hint = init.hint;
        this.surgeFromAction = !editing && !!init.surge;

        const surges = actorSurges(actor);
        const surge: InfusionSurge = editing?.surge ?? init.surge ?? surges[0] ?? 'custom';
        const preset = isSurgeKey(surge) ? SURGE_PRESETS[surge] : null;

        this.draft = {
            surge,
            label: editing?.label ?? init.label ?? '',
            kind: editing?.kind ?? init.kind ?? preset?.defaultKind ?? 'object',
            targets: editing?.targets ?? init.targets ?? [],
            pool: editing?.pool ?? Math.max(1, init.pool ?? 1),
            alreadyPaid: editing ? 0 : Math.max(0, init.alreadyPaid ?? 0),
            source: editing?.source ?? init.source ?? 'caster',
            light: editing?.light ?? 'stormlight',
            cadence: editing?.drain.cadence ?? init.cadence ?? preset?.cadence ?? 'round',
            heldOrWorn: false,
            storedInGem: false,
            fineControl: false,
            physicalIllusion: false,
            notes: editing?.notes ?? '',
            sourceItemUuid: editing?.sourceItemUuid ?? init.sourceItemUuid ?? null,
            everyNRounds: editing?.drain.everyNRounds ?? 1,
            freeWhileInvested: editing?.freeWhileInvested ?? false,
            reclaimable: editing?.reclaimable ?? false,
            range: editing?.range.value ?? preset?.range ?? 5,
            health: editing?.health?.max ?? 0,
            maxTargets: editing?.maxTargets ?? 0,
        };
        if (!editing && init.reclaimable) {
            this.draft.reclaimable = true;
            this.touched.add('reclaimable');
        }
        if (editing) {
            (['everyNRounds', 'freeWhileInvested', 'reclaimable', 'range', 'health', 'maxTargets'] as Overridable[]).forEach((k) =>
                this.touched.add(k),
            );
        }
    }

    /** Opens the dialog; resolves with the saved infusion, or null when closed. */
    static open(actor: any, init: DialogInit = {}): Promise<Infusion | null> {
        const app = new InfusionDialog(actor, init);
        return app.wait();
    }

    static edit(actor: any, infusion: Infusion): Promise<Infusion | null> {
        return new InfusionDialog(actor, {}, infusion).wait();
    }

    wait(): Promise<Infusion | null> {
        return new Promise((resolve) => {
            this.resolve = resolve;
            void this.render({ force: true });
        });
    }

    get title() {
        return this.editing ? t('SCI.Dialog.EditTitle', { name: this.actor.name }) : t('SCI.Dialog.NewTitle', { name: this.actor.name });
    }

    async close(options?: any) {
        this.resolve?.(null);
        this.resolve = null;
        return super.close(options);
    }

    private modifiers(): ModifierResult | null {
        const { surge, kind } = this.draft;
        if (!isSurgeKey(surge)) return null;
        return computeModifiers({
            surge,
            kind,
            talents: actorTalents(this.actor),
            ranks: surgeRanks(this.actor),
            effects: getMapping().talentEffects,
            squire: isSquire(this.actor),
            heldOrWorn: this.draft.heldOrWorn,
            storedInGem: this.draft.storedInGem,
            fineControl: this.draft.fineControl,
            physicalIllusion: this.draft.physicalIllusion,
        });
    }

    /** Applies computed talent modifiers to every field the user hasn't overridden. */
    private applyModifiers(mods: ModifierResult | null) {
        const s = this.draft;
        const preset = isSurgeKey(s.surge) ? SURGE_PRESETS[s.surge] : null;
        if (!this.touched.has('everyNRounds')) s.everyNRounds = mods?.everyNRounds ?? 1;
        if (!this.touched.has('freeWhileInvested')) s.freeWhileInvested = mods?.freeWhileInvested ?? false;
        if (!this.touched.has('reclaimable')) s.reclaimable = mods?.reclaimable ?? false;
        if (!this.touched.has('range')) s.range = mods?.range ?? preset?.range ?? 5;
        if (!this.touched.has('health')) s.health = mods?.health ?? 0;
        if (!this.touched.has('maxTargets')) s.maxTargets = mods?.maxTargets ?? 0;
    }

    protected renderBody(): string {
        const s = this.draft;
        const mods = this.modifiers();
        if (!this.editing || mods) this.applyModifiers(mods);

        const ranks = surgeRanks(this.actor);
        const surgeKeys = [...new Set([...actorSurges(this.actor), ...(isSurgeKey(s.surge) ? [s.surge] : [])])];
        const surgeChoices: [string, string][] = [
            ...surgeKeys.map((k): [string, string] => [k, t(`SCI.Surge.${k}`)]),
            ...SURGE_KEYS.filter((k) => !surgeKeys.includes(k)).map((k): [string, string] => [k, `${t(`SCI.Surge.${k}`)} *`]),
            ['custom', t('SCI.Surge.custom')],
            ['bead', t('SCI.Surge.bead')],
            ['upkeep', t('SCI.Surge.upkeep')],
        ];
        const preset = isSurgeKey(s.surge) ? SURGE_PRESETS[s.surge] : null;
        const kinds = preset?.kinds ?? ALL_KINDS;
        const usesPool = !drawsFromCaster({ kind: s.kind });
        // Areas and surfaces are described in the description field instead of picking targets.
        const hasTargets = usesPool && s.kind !== 'area';
        const scaling = isSurgeKey(s.surge) ? surgeScaling(ranks[s.surge] ?? 0) : null;

        const rows: string[] = [];
        if (this.hint) rows.push(`<p class="sci-hint"><i class="fa-solid fa-circle-info"></i> ${esc(t(this.hint))}</p>`);
        if (preset && !preset.infuses) rows.push(`<p class="sci-warning">${t('SCI.Dialog.InstantSurge')}</p>`);
        if (scaling) {
            rows.push(
                `<p class="sci-hint">${t('SCI.Dialog.Scaling', {
                    rank: ranks[s.surge as SurgeKey],
                    die: scaling.die,
                    size: t(`SCI.Size.${scaling.size}`),
                    feet: scaling.feet,
                })}</p>`,
            );
        }
        if (mods?.applied.length) rows.push(`<p class="sci-talents">${t('SCI.Dialog.TalentsApplied', { talents: esc(mods.applied.join(', ')) })}</p>`);
        if (mods?.unwillingCap) rows.push(`<p class="sci-hint">${t('SCI.Dialog.UnwillingCap', { cap: mods.unwillingCap })}</p>`);

        const targetList = s.targets.length
            ? s.targets
                  .map(
                      (tg, i) =>
                          `<li>${tg.img ? `<img src="${esc(tg.img)}" alt="">` : ''}<span>${esc(tg.name || tg.uuid)}</span>
                           <a data-sci-action="removeTarget" data-index="${i}" title="${t('SCI.Common.Remove')}"><i class="fa-solid fa-xmark"></i></a></li>`,
                  )
                  .join('')
            : `<li class="sci-empty">${t('SCI.Dialog.NoTargets')}</li>`;
        // Surge size: tokens larger than the surge's maximum size can't normally be infused.
        const tooLarge =
            scaling && hasTargets
                ? s.targets.filter((tg) => {
                      const doc = tg.uuid ? fromUuidSync(tg.uuid, { strict: false }) : null;
                      if (doc?.documentName !== 'Token') return false;
                      const feet = Math.max(doc.width ?? 1, doc.height ?? 1) * (doc.parent?.grid?.distance ?? 5);
                      return feet > scaling.feet;
                  })
                : [];
        const tooMany = hasTargets && (s.maxTargets > 0 ? s.targets.length > s.maxTargets : s.targets.length > 1);

        const optionRows: string[] = [];
        if (s.surge === 'tsn') {
            optionRows.push(this.checkbox('heldOrWorn', 'SCI.Dialog.HeldOrWorn', s.heldOrWorn));
            optionRows.push(this.checkbox('fineControl', 'SCI.Dialog.FineControl', s.fineControl));
        }
        if (s.surge === 'ill') {
            optionRows.push(this.checkbox('simpleIllusion', 'SCI.Dialog.SimpleIllusion', s.cadence === '10min'));
            optionRows.push(this.checkbox('storedInGem', 'SCI.Dialog.StoredInGem', s.storedInGem));
            optionRows.push(this.checkbox('physicalIllusion', 'SCI.Dialog.PhysicalIllusion', s.physicalIllusion));
        }

        return `
        <form class="sci-form">
            ${rows.join('')}
            ${
                this.surgeFromAction
                    ? ''
                    : `<div class="form-group"><label>${t('SCI.Field.Surge')}</label>
                <select name="surge">${options(surgeChoices, s.surge)}</select></div>`
            }
            <div class="form-group"><label>${t('SCI.Field.Kind')}</label>
                <select name="kind">${options(kinds.map((k) => [k, t(`SCI.Kind.${k}`)]), s.kind)}</select></div>
            <div class="form-group"><label>${t('SCI.Field.Label')}</label>
                <input type="text" name="label" value="${esc(s.label)}" placeholder="${esc(t('SCI.Dialog.LabelPlaceholder'))}"></div>
            <p class="hint">${t(s.kind === 'area' ? 'SCI.Dialog.LabelHintArea' : 'SCI.Dialog.LabelHint')}</p>
            ${
                hasTargets
                    ? `<fieldset><legend>${t('SCI.Field.Targets')}</legend>
                <ul class="sci-targets">${targetList}</ul>
                ${tooLarge.length ? `<p class="sci-warning">${t('SCI.Dialog.TooLarge', { names: esc(tooLarge.map((tg) => tg.name).join(', ')), size: t(`SCI.Size.${scaling!.size}`) })}</p>` : ''}
                ${tooMany ? `<p class="sci-warning">${t('SCI.Dialog.TooManyTargets', { max: Math.max(1, s.maxTargets) })}</p>` : ''}
                <div class="sci-buttons"><button type="button" data-sci-action="useTargets"><i class="fa-solid fa-bullseye"></i> ${t('SCI.Dialog.UseTargets')}</button>
                <button type="button" data-sci-action="addTextTarget"><i class="fa-solid fa-font"></i> ${t('SCI.Dialog.AddTextTarget')}</button></div>
            </fieldset>`
                    : ''
            }
            ${
                usesPool
                    ? `<div class="form-group sci-pool-group"><label>${t('SCI.Field.Pool')}</label>
                <span class="sci-stepper"><input type="number" name="pool" min="1" value="${s.pool}"><span class="sci-stepper-buttons">
                    <a data-sci-action="poolStep" data-step="1" title="${esc(t('SCI.Dialog.PoolUp'))}"><i class="fa-solid fa-caret-up"></i></a>
                    <a data-sci-action="poolStep" data-step="-1" title="${esc(t('SCI.Dialog.PoolDown'))}"><i class="fa-solid fa-caret-down"></i></a></span></span>
                ${this.editing ? `<p class="hint">${t('SCI.Dialog.EditPoolHint')}</p>` : `<p class="hint sci-charge">${this.chargeText()}</p>`}</div>
            <div class="form-group"><label>${t('SCI.Field.Source')}</label>
                <select name="source">${options(
                    [
                        ['caster', t('SCI.Source.caster')],
                        ['gem', t('SCI.Source.gem')],
                    ],
                    s.source,
                )}</select></div>`
                    : `<p class="hint">${t(s.kind === 'upkeep' ? 'SCI.Dialog.UpkeepHint' : 'SCI.Dialog.SelfHint')}</p>`
            }
            ${optionRows.length ? `<fieldset><legend>${t('SCI.Dialog.Options')}</legend>${optionRows.join('')}</fieldset>` : ''}
            ${this.editing ? this.drainFields(usesPool) : ''}
            <footer class="sci-footer">
                <button type="button" data-sci-action="save"><i class="fa-solid fa-check"></i> ${t(this.editing ? 'SCI.Common.Save' : 'SCI.Dialog.Create')}</button>
                <button type="button" data-sci-action="cancel"><i class="fa-solid fa-xmark"></i> ${t('SCI.Common.Cancel')}</button>
            </footer>
        </form>`;
    }

    /** Drain settings and notes; only shown when editing (new infusions use the talent defaults). */
    private drainFields(usesPool: boolean): string {
        const s = this.draft;
        return `
            <fieldset><legend>${t('SCI.Dialog.Drain')}</legend>
                <div class="form-group"><label>${t('SCI.Field.Cadence')}</label>
                    <select name="cadence">${options(CADENCES.map((c) => [c, t(`SCI.Cadence.${c}`)]), s.cadence)}</select></div>
                <div class="form-group"><label>${t('SCI.Field.EveryNRounds')}</label>
                    <input type="number" name="everyNRounds" min="1" value="${s.everyNRounds}"></div>
                ${this.checkbox('freeWhileInvested', 'SCI.Field.FreeWhileInvested', s.freeWhileInvested)}
                ${usesPool ? this.checkbox('reclaimable', 'SCI.Field.Reclaimable', s.reclaimable) : ''}
                <div class="form-group"><label>${t('SCI.Field.Range')}</label>
                    <input type="number" name="range" min="0" value="${s.range}"></div>
                ${usesPool ? `<div class="form-group"><label>${t('SCI.Field.Health')}</label>
                    <input type="number" name="health" min="0" value="${s.health}"><p class="hint">${t('SCI.Dialog.HealthHint')}</p></div>
                <div class="form-group"><label>${t('SCI.Field.MaxTargets')}</label>
                    <input type="number" name="maxTargets" min="0" value="${s.maxTargets}"></div>` : ''}
                <div class="form-group"><label>${t('SCI.Field.Light')}</label>
                    <select name="light">${options(LIGHTS.map((l) => [l, t(`SCI.Light.${l}`)]), s.light)}</select></div>
            </fieldset>
            <div class="form-group stacked"><label>${t('SCI.Field.Notes')}</label>
                <textarea name="notes" rows="2">${esc(s.notes)}</textarea></div>`;
    }

    private checkbox(name: string, label: string, value: boolean) {
        return `<div class="form-group"><label>${t(label)}</label><input type="checkbox" name="${name}"${checked(value)}></div>`;
    }

    /** Pulls the form into the state, marking manually edited modifier fields as overridden. */
    private syncState(changed?: string) {
        const f = this.readForm();
        const s = this.draft;
        const prevSurge = s.surge;
        s.surge = (f.surge as InfusionSurge) ?? s.surge;
        s.label = String(f.label ?? s.label);
        s.kind = (f.kind as InfusionKind) ?? s.kind;
        if ('pool' in f) s.pool = Math.max(1, intValue(f.pool, s.pool));
        if ('alreadyPaid' in f) s.alreadyPaid = Math.max(0, intValue(f.alreadyPaid, s.alreadyPaid));
        if ('source' in f) s.source = f.source === 'gem' ? 'gem' : 'caster';
        s.light = (f.light as Light) ?? s.light;
        s.cadence = (f.cadence as Cadence) ?? s.cadence;
        if ('simpleIllusion' in f && changed === 'simpleIllusion') s.cadence = f.simpleIllusion ? '10min' : 'round';
        for (const key of ['heldOrWorn', 'storedInGem', 'fineControl', 'physicalIllusion'] as const) {
            if (key in f) s[key] = !!f[key];
        }
        s.notes = String(f.notes ?? s.notes);
        s.everyNRounds = Math.max(1, intValue(f.everyNRounds, s.everyNRounds));
        if ('freeWhileInvested' in f) s.freeWhileInvested = !!f.freeWhileInvested;
        if ('reclaimable' in f) s.reclaimable = !!f.reclaimable;
        s.range = Math.max(0, intValue(f.range, s.range));
        if ('health' in f) s.health = Math.max(0, intValue(f.health, s.health));
        if ('maxTargets' in f) s.maxTargets = Math.max(0, intValue(f.maxTargets, s.maxTargets));

        if (changed && (['everyNRounds', 'freeWhileInvested', 'reclaimable', 'range', 'health', 'maxTargets'] as string[]).includes(changed)) {
            this.touched.add(changed as Overridable);
        }
        if (s.surge !== prevSurge && isSurgeKey(s.surge)) {
            const preset = SURGE_PRESETS[s.surge];
            if (!preset.kinds.includes(s.kind)) s.kind = preset.defaultKind;
            s.cadence = preset.cadence;
        }
        if (s.surge === 'bead' && changed === 'surge') s.cadence = 'day';
        if (s.surge === 'upkeep' && changed === 'surge') s.kind = 'upkeep';
    }

    /** Selects and checkboxes that change the layout or the talent modifiers. Text inputs only update the draft. */
    private static readonly RERENDER = new Set([
        'surge',
        'kind',
        'source',
        'simpleIllusion',
        'heldOrWorn',
        'storedInGem',
        'fineControl',
        'physicalIllusion',
    ]);

    protected async onInputChange(target: HTMLElement) {
        const name = (target as HTMLInputElement).name;
        if (!name) return;
        this.syncState(name);
        // Re-rendering replaces the buttons, so a click right after typing would be lost: only re-render for
        // selects/checkboxes, and update the charge hint in place.
        if (InfusionDialog.RERENDER.has(name)) return void this.render();
        const hint = this.element.querySelector('.sci-charge');
        if (hint) hint.textContent = this.chargeText();
    }

    private charge(): number {
        const s = this.draft;
        return !drawsFromCaster({ kind: s.kind }) && s.source === 'caster' && !this.editing ? Math.max(0, s.pool - s.alreadyPaid) : 0;
    }

    private chargeText(): string {
        return t('SCI.Dialog.ChargeHint', { charge: this.charge(), inv: casterState(this.actor).inv });
    }

    protected async onAction(action: string, target: HTMLElement) {
        if (action === 'cancel') return void this.close();
        this.syncState();
        switch (action) {
            case 'useTargets':
                this.draft.targets = userTargets();
                if (!this.draft.targets.length) ui.notifications.warn('SCI.Notify.NoTargets', { localize: true });
                return void this.render();
            case 'addTextTarget': {
                const name = await foundry.applications.api.DialogV2.prompt({
                    window: { title: 'SCI.Dialog.AddTextTarget' },
                    content: `<input type="text" name="name" autofocus>`,
                    ok: { callback: (_e: Event, button: any) => button.form.elements.name.value },
                    rejectClose: false,
                });
                if (name) this.draft.targets.push({ uuid: '', name: String(name) });
                return void this.render();
            }
            case 'poolStep': {
                // In place, like typing: a re-render would lose a click that follows.
                this.draft.pool = Math.max(1, this.draft.pool + Number(target.dataset.step));
                const input = this.element.querySelector<HTMLInputElement>('input[name="pool"]');
                if (input) input.value = String(this.draft.pool);
                const hint = this.element.querySelector('.sci-charge');
                if (hint) hint.textContent = this.chargeText();
                return;
            }
            case 'removeTarget':
                this.draft.targets.splice(Number(target.dataset.index), 1);
                return void this.render();
            case 'save':
                return this.save();
        }
    }

    private async save() {
        const s = this.draft;
        const usesPool = !drawsFromCaster({ kind: s.kind });
        const charge = this.charge();
        if (charge > casterState(this.actor).inv) {
            ui.notifications.warn('SCI.Notify.NotEnoughInvestiture', { localize: true });
            return;
        }
        const data = {
            ...(this.editing ?? {}),
            surge: s.surge,
            label: s.label.trim(),
            kind: s.kind,
            targets: usesPool && s.kind !== 'area' ? s.targets : [],
            pool: s.pool,
            source: s.source,
            light: s.light,
            drain: { ...(this.editing?.drain ?? {}), cadence: s.cadence, everyNRounds: s.everyNRounds },
            freeWhileInvested: s.freeWhileInvested,
            reclaimable: usesPool && s.reclaimable,
            range: { value: s.range, basis: isSurgeKey(s.surge) ? SURGE_PRESETS[s.surge].rangeBasis : 'custom' },
            health: usesPool && s.health > 0 ? { value: this.editing?.health?.value ?? s.health, max: s.health } : null,
            maxTargets: s.maxTargets,
            talents: this.modifiers()?.applied ?? this.editing?.talents ?? [],
            sourceItemUuid: s.sourceItemUuid,
            notes: s.notes,
        };
        let saved: Infusion;
        if (this.editing) {
            saved = normalizeInfusion(data);
            await updateInfusion(this.actor, saved);
        } else {
            saved = await createInfusion(this.actor, data, charge);
        }
        const resolve = this.resolve;
        this.resolve = null;
        resolve?.(saved);
        await this.close();
    }
}
