/**
 * Sub-effects: ActiveEffects an infusion puts on the characters it infuses (Skate, Basic Lashing,
 * Hardened Defense...), shown under the infusion in the Active Infusions section. They are created and
 * removed with the infusion, like markers; the effect's `disabled` state is left to the user.
 */
import { FLAGS, MARKER_ICON, MODULE_ID, SYSTEM_ID } from '@/constants';
import { parseInfusions, surgeScaling, type Infusion } from '@/data/infusion';
import { HEALING_BONUS_TALENTS, SKATE_TALENTS, type EffectChange } from '@/data/presets';
import { actorTalents, infusionIcon, isSquire, preferredRunner, surgeRanks } from '@/core/actor-data';
import { getMapping } from '@/core/mapping';
import { targetActor } from '@/core/markers';
import { regrowthFormula, subEffectsFor } from '@/core/modifiers';
import { asGM, asUser, registerHandler } from '@/core/relay';
import { getSetting } from '@/settings';
import { esc, t, warn } from '@/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface SubEffectFlag {
    infusionId: string;
    casterUuid: string;
    key: string;
}

/** Desired sub-effects of one infusion on one character; an empty list removes them all. */
interface SubOp {
    targetUuid: string;
    infusionId: string;
    casterUuid: string;
    effects: Record<string, any>[];
}

export const subFlag = (effect: any): SubEffectFlag | undefined => effect?.getFlag?.(MODULE_ID, FLAGS.sub);

/** The sub-effects of `infusionId` on `actor`. */
export const findSubEffects = (actor: any, infusionId: string): any[] =>
    (actor?.effects ?? []).filter((e: any) => subFlag(e)?.infusionId === infusionId);

/** Characters an infusion infuses: the caster for self infusions, otherwise the targeted characters. */
export function infusedActors(caster: any, inf: Infusion): any[] {
    if (inf.kind === 'self') return [caster];
    if (inf.kind === 'upkeep') return [];
    const actors = inf.targets.map((tg) => targetActor(tg.uuid)).filter((a) => !!a);
    return [...new Set(actors)];
}

const statusIcon = (id: string): string | undefined => CONFIG.statusEffects?.find?.((s: any) => s.id === id)?.img;

/** The caster's roll data plus `sci.prgDie` (Progression surge die from the Surge Scaling table). */
function casterRollData(caster: any): any {
    const die = surgeScaling(surgeRanks(caster).prg ?? 1)?.die ?? 'd4';
    return { ...(caster.getRollData?.() ?? {}), sci: { prgDie: die } };
}

/** Resolves `@` references in change values with the caster's roll data (e.g. `@skills.prg.mod`). */
function resolveChanges(changes: EffectChange[], data: any): EffectChange[] {
    return changes.map((change) => {
        if (!String(change.value).includes('@')) return change;
        const formula = Roll.replaceFormulaData(String(change.value), data, { missing: '0' });
        let value: number;
        try {
            value = Number(Roll.safeEval(formula));
        } catch {
            value = Number.NaN;
        }
        return { ...change, value: String(Number.isFinite(value) ? value : 0) };
    });
}

/** Description placeholders for effects whose text depends on the caster's talents. */
function describe(key: string, talents: string[], changes: EffectChange[]): Record<string, unknown> {
    if (key === 'skate') {
        return {
            cost: talents.includes(SKATE_TALENTS.cheaper) ? 1 : 2,
            path: t(talents.includes(SKATE_TALENTS.anyPath) ? 'SCI.EffectDesc.AnyPath' : 'SCI.EffectDesc.StraightLine'),
        };
    }
    return { value: changes[0]?.value ?? '' };
}

function effectData(caster: any, inf: Infusion): Record<string, any>[] {
    const talents = isSquire(caster) ? [] : actorTalents(caster).map((tl) => tl.id);
    const rollData = casterRollData(caster);
    return subEffectsFor(inf, talents, getMapping().subEffects).map(({ key, preset, changes: raw }) => {
        const changes = resolveChanges(raw, rollData);
        return {
            name: (preset as { name?: string }).name ?? t(`SCI.Effect.${key}`),
            img: (preset.status && statusIcon(preset.status)) || preset.img || MARKER_ICON,
            origin: caster.uuid,
            description: t(`SCI.EffectDesc.${key}`, describe(key, talents, changes)),
            changes,
            statuses: preset.status ? [preset.status] : [],
            flags: { [MODULE_ID]: { [FLAGS.sub]: { infusionId: inf.id, casterUuid: caster.uuid, key } } },
        };
    });
}

const isExclusive = (key: string) => !!getMapping().subEffects[key]?.exclusive;

/** Another enabled effect with this key from a different infusion is already on the actor. */
const otherActive = (actor: any, key: string, infusionId: string) =>
    (actor?.effects ?? []).some(
        (e: any) => !e.disabled && subFlag(e)?.key === key && subFlag(e)?.infusionId !== infusionId,
    );

const sameChanges = (a: any[], b: any[]) =>
    JSON.stringify((a ?? []).map((c) => [c.key, Number(c.mode), String(c.value)])) ===
    JSON.stringify((b ?? []).map((c) => [c.key, Number(c.mode), String(c.value)]));

function upToDate(actor: any, op: SubOp): boolean {
    const existing = findSubEffects(actor, op.infusionId);
    if (existing.length !== op.effects.length) return false;
    return op.effects.every((data) => {
        const effect = existing.find((e) => subFlag(e)!.key === data.flags[MODULE_ID][FLAGS.sub].key);
        return !!effect && effect.name === data.name && sameChanges(effect.changes, data.changes);
    });
}

async function applyOp(op: SubOp) {
    const actor = targetActor(op.targetUuid);
    if (!actor) return;
    const existing = findSubEffects(actor, op.infusionId);
    const wanted = new Map(op.effects.map((e) => [e.flags[MODULE_ID][FLAGS.sub].key as string, e]));
    const removed = existing.filter((e) => !wanted.has(subFlag(e)!.key));
    if (removed.length)
        await actor.deleteEmbeddedDocuments(
            'ActiveEffect',
            removed.map((e) => e.id),
        );
    // A removed exclusive effect (Hardened Defense) lets a waiting copy from another infusion take over.
    for (const key of new Set(removed.filter((e) => !e.disabled).map((e) => subFlag(e)!.key))) {
        if (!isExclusive(key) || otherActive(actor, key, op.infusionId)) continue;
        const waiting = actor.effects.find(
            (e: any) => e.disabled && subFlag(e)?.key === key && subFlag(e)?.infusionId !== op.infusionId,
        );
        if (waiting) await waiting.update({ disabled: false });
    }
    const create: Record<string, any>[] = [];
    for (const [key, data] of wanted) {
        const effect = existing.find((e) => subFlag(e)!.key === key);
        if (!effect)
            create.push(
                isExclusive(key) && otherActive(actor, key, op.infusionId) ? { ...data, disabled: true } : data,
            );
        else if (effect.name !== data.name || !sameChanges(effect.changes, data.changes)) {
            await effect.update({ name: data.name, changes: data.changes, description: data.description });
        }
    }
    if (create.length) await actor.createEmbeddedDocuments('ActiveEffect', create);
}

/** Creates, updates or removes sub-effects so they match the infusions before/after a change. */
export async function syncSubEffects(caster: any, before: Infusion[], after: Infusion[]) {
    if (!getSetting('subEffects')) return;
    const ops = new Map<string, SubOp>();
    const op = (actor: any, infusionId: string) => {
        const id = `${actor.uuid}|${infusionId}`;
        if (!ops.has(id)) ops.set(id, { targetUuid: actor.uuid, infusionId, casterUuid: caster.uuid, effects: [] });
        return ops.get(id)!;
    };
    for (const inf of before) for (const actor of infusedActors(caster, inf)) op(actor, inf.id);
    for (const inf of after) {
        const data = effectData(caster, inf);
        for (const actor of infusedActors(caster, inf)) op(actor, inf.id).effects = data;
    }
    const local: SubOp[] = [];
    const remote: SubOp[] = [];
    for (const o of ops.values()) {
        const actor = targetActor(o.targetUuid);
        // Already up to date: skip the writes (and the GM round trip).
        if (!actor || upToDate(actor, o)) continue;
        (actor.isOwner ? local : remote).push(o);
    }
    for (const o of local) await applyOp(o);
    if (remote.length) await asGM('subEffects', remote);
}

/** Asks the user who runs `actor`'s turns to roll its Regrowth healing. */
export async function requestRegrowth(actor: any) {
    if (!actor?.effects?.some((e: any) => subFlag(e)?.key === 'regrowth' && !e.disabled)) return;
    const runner = preferredRunner(actor);
    if (runner?.active) await asUser(runner.id, 'regrowth', { actorUuid: actor.uuid });
}

function regrowthRoll(caster: any, inf: { sourceItemUuid: string | null }): { formula: string; data: any } {
    const formulas = getMapping().formulas;
    const item = inf.sourceItemUuid ? fromUuidSync(inf.sourceItemUuid, { strict: false }) : null;
    const own = item?.system?.damage?.type === 'heal' ? item.system.damage.formula : null;
    const talents = isSquire(caster) ? [] : actorTalents(caster).map((tl) => tl.id);
    const data = { ...((own && item.getRollData?.()) || {}), ...casterRollData(caster) };
    return { formula: regrowthFormula(own || formulas.regrowth, talents, HEALING_BONUS_TALENTS, formulas), data };
}

/** The card's top section, like an item's: the infusion art, Progression, and who keeps it up. */
function regrowthHeader(caster: any, inf: Infusion): string {
    return `<section class="chat-card-section description"><header class="summary"><img src="${esc(infusionIcon(caster, inf))}" alt="">
        <div class="name-stacked"><span class="title">${esc(t('SCI.Surge.prg'))}</span>
        <span class="subtitle">${esc(t('SCI.Chat.Regrowth', { caster: caster.name }))}</span></div></header></section>`;
}

async function rollRegrowth(actor: any) {
    for (const effect of actor.effects.filter((e: any) => subFlag(e)?.key === 'regrowth' && !e.disabled)) {
        const flag = subFlag(effect)!;
        const caster = fromUuidSync(flag.casterUuid, { strict: false });
        const inf = parseInfusions(caster?.getFlag?.(MODULE_ID, FLAGS.infusions)).find((i) => i.id === flag.infusionId);
        if (!inf) continue;
        const { formula, data } = regrowthRoll(caster, inf);
        try {
            // The system's healing roll, so the card matches its own (Healing section, apply buttons).
            const DamageRoll = CONFIG.Dice.rolls.find((R: any) => R.name === 'DamageRoll');
            const roll = await (DamageRoll ? new DamageRoll(formula, data, { damageType: 'heal' }) : new Roll(formula, data)).evaluate();
            const speaker = ChatMessage.getSpeaker({ actor });
            // The system card replaces the message content, so only use it when it can show the roll.
            if (DamageRoll) await roll.toMessage({ speaker, flags: { [SYSTEM_ID]: { message: { type: 'action', description: regrowthHeader(caster, inf) } } } });
            else await roll.toMessage({ speaker, flavor: `${t('SCI.Surge.prg')}: ${t('SCI.Chat.Regrowth', { caster: caster.name })}` });
            if (typeof actor.applyHealing === 'function') await actor.applyHealing(roll.total);
        } catch (err) {
            warn(`Regrowth formula "${formula}" failed`, err);
            ui.notifications.warn(t('SCI.Notify.RegrowthFailed', { formula }));
        }
    }
}

export function initSubEffects() {
    registerHandler('subEffects', async (ops: SubOp[], from: string) => {
        const sender = game.users.get(from);
        if (!sender) return;
        for (const o of ops) {
            const caster = fromUuidSync(o.casterUuid, { strict: false });
            // Only the caster's owners (or a GM) may put or remove effects from their infusion.
            if (!caster || (!sender.isGM && !caster.testUserPermission?.(sender, 'OWNER'))) continue;
            // Rebuild the effects from the saved infusion instead of trusting the payload.
            const inf = parseInfusions(caster.getFlag(MODULE_ID, FLAGS.infusions)).find((i) => i.id === o.infusionId);
            const target = targetActor(o.targetUuid);
            const infused = !!inf && infusedActors(caster, inf).includes(target);
            await applyOp({ ...o, effects: infused ? effectData(caster, inf!) : [] });
        }
    });
    registerHandler('regrowth', async (payload: { actorUuid: string }) => {
        const actor = await fromUuid(payload.actorUuid);
        if (actor?.isOwner) await rollRegrowth(actor);
    });
}
