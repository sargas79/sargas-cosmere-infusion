/**
 * "Infused" markers: an ActiveEffect on each target actor (token or world actor) pointing back to the
 * infusion, so everyone sees what is infused and how much Investiture is left.
 */
import { FLAGS, MARKER_ICON, MODULE_ID } from '@/constants';
import { drawsFromCaster, type Infusion } from '@/data/infusion';
import { getSetting } from '@/settings';
import { asGM, registerHandler } from '@/core/relay';
import { t } from '@/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface MarkerOp {
    targetUuid: string;
    infusionId: string;
    /** Effect data to create/update, or null to remove the marker. */
    data: Record<string, unknown> | null;
}

/** Actor behind a target uuid (token or actor), or null for objects and free-text targets. */
export function targetActor(uuid: string): any {
    if (!uuid) return null;
    const doc = fromUuidSync(uuid, { strict: false });
    if (!doc) return null;
    if (doc.documentName === 'Actor') return doc;
    if (doc.documentName === 'Token') return doc.actor;
    return null;
}

function markerData(caster: any, inf: Infusion): Record<string, unknown> {
    const surge = t(`SCI.Surge.${inf.surge}`);
    const amount = drawsFromCaster(inf) ? '' : ` (${inf.pool})`;
    return {
        name: `${t('SCI.Marker.Name', { label: inf.label || surge })}${amount}`,
        img: MARKER_ICON,
        origin: caster.uuid,
        description: t('SCI.Marker.Description', { caster: caster.name, surge }),
        flags: { [MODULE_ID]: { [FLAGS.marker]: { infusionId: inf.id, casterUuid: caster.uuid } } },
    };
}

const findMarker = (actor: any, infusionId: string) =>
    actor.effects.find((e: any) => e.getFlag(MODULE_ID, FLAGS.marker)?.infusionId === infusionId);

async function applyOp(op: MarkerOp) {
    const actor = targetActor(op.targetUuid);
    if (!actor) return;
    const existing = findMarker(actor, op.infusionId);
    if (!op.data) {
        if (existing) await existing.delete();
    } else if (existing) {
        if (existing.name !== op.data.name) await existing.update({ name: op.data.name });
    } else {
        await actor.createEmbeddedDocuments('ActiveEffect', [op.data]);
    }
}

async function applyOps(ops: MarkerOp[]) {
    for (const op of ops) await applyOp(op);
}

export function initMarkers() {
    registerHandler('markers', async (ops: MarkerOp[], from: string) => {
        const sender = game.users.get(from);
        if (!sender) return;
        // Markers point back to a caster: only that caster's owners (or a GM) may create or remove them.
        const allowed: MarkerOp[] = [];
        for (const op of ops) {
            const origin = op.data?.origin ?? findMarker(targetActor(op.targetUuid) ?? { effects: [] }, op.infusionId)?.origin;
            const caster = typeof origin === 'string' ? fromUuidSync(origin, { strict: false }) : null;
            if (sender.isGM || caster?.testUserPermission?.(sender, 'OWNER')) allowed.push(op);
        }
        await applyOps(allowed);
    });
}

/** Creates, updates or removes markers so they match the infusions before/after a change. */
export async function syncMarkers(caster: any, before: Infusion[], after: Infusion[]) {
    if (!getSetting('tokenMarkers')) return;
    const ops: MarkerOp[] = [];
    const afterById = new Map(after.map((i) => [i.id, i]));

    for (const inf of before) {
        const next = afterById.get(inf.id);
        const keep = new Set(next?.targets.map((t) => t.uuid) ?? []);
        for (const target of inf.targets) {
            if (target.uuid && !keep.has(target.uuid)) ops.push({ targetUuid: target.uuid, infusionId: inf.id, data: null });
        }
    }
    for (const inf of after) {
        if (inf.kind === 'self' || inf.kind === 'upkeep') continue;
        for (const target of inf.targets) {
            if (!target.uuid || targetActor(target.uuid) === caster) continue;
            ops.push({ targetUuid: target.uuid, infusionId: inf.id, data: markerData(caster, inf) });
        }
    }
    if (!ops.length) return;

    const local: MarkerOp[] = [];
    const remote: MarkerOp[] = [];
    for (const op of ops) {
        const actor = targetActor(op.targetUuid);
        if (!actor) continue;
        (actor.isOwner ? local : remote).push(op);
    }
    await applyOps(local);
    if (remote.length) await asGM('markers', remote);
}
