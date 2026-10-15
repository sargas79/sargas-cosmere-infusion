/** Read helpers for cosmere-rpg actors. */
import { FLAGS, MODULE_ID } from '@/constants';
import { SURGE_KEYS, type SurgeKey } from '@/data/infusion';
import { SECOND_IDEAL_GOAL } from '@/data/presets';
import type { CasterState } from '@/core/engine';
import type { OwnedTalent } from '@/core/modifiers';

/* eslint-disable @typescript-eslint/no-explicit-any */

export function casterState(actor: any): CasterState {
    const inv = actor?.system?.resources?.inv;
    return {
        inv: Number(inv?.value) || 0,
        max: Number(inv?.max?.value) || 0,
        empowered: !!actor?.statuses?.has?.('empowered'),
    };
}

export function surgeRanks(actor: any): Partial<Record<SurgeKey, number>> {
    const ranks: Partial<Record<SurgeKey, number>> = {};
    for (const key of SURGE_KEYS) {
        const rank = Number(actor?.system?.skills?.[key]?.rank);
        if (rank > 0) ranks[key] = rank;
    }
    return ranks;
}

/** Surges the actor has as `power` items with `system.type === 'surge'`. */
export function actorSurges(actor: any): SurgeKey[] {
    const found = new Set<SurgeKey>();
    for (const item of actor?.items ?? []) {
        if (item.type === 'power' && item.system?.type === 'surge' && SURGE_KEYS.includes(item.system?.id)) {
            found.add(item.system.id);
        }
    }
    // Adversaries may only have the skill ranks.
    for (const key of Object.keys(surgeRanks(actor)) as SurgeKey[]) found.add(key);
    return SURGE_KEYS.filter((k) => found.has(k));
}

export function actorTalents(actor: any): OwnedTalent[] {
    const talents: OwnedTalent[] = [];
    for (const item of actor?.items ?? []) {
        if (item.type !== 'talent' || !item.system?.id) continue;
        talents.push({ power: item.system.power ?? null, id: item.system.id, name: item.name });
    }
    return talents;
}

/** Speak the Second Ideal completed: Enhance upkeep is free. Goals are complete at level 3. */
export function freeEnhanceUpkeep(actor: any): boolean {
    return (actor?.items ?? []).some(
        (item: any) =>
            item.type === 'goal' &&
            Number(item.system?.level) >= 3 &&
            (String(item.system?.id ?? '').startsWith(SECOND_IDEAL_GOAL) || /second ideal/i.test(item.name ?? '')),
    );
}

export const isSquire = (actor: any): boolean => !!actor?.getFlag?.(MODULE_ID, FLAGS.squire);

/** Walks up embedded documents (actions embedded in powers) to the owning actor. */
export function owningActor(doc: any): any {
    let current = doc;
    while (current && current.documentName !== 'Actor') current = current.parent;
    return current ?? null;
}

/**
 * The user who should run an actor's turn-start flow: an active player who owns the actor
 * (players run their own infusions), otherwise the active GM.
 */
export function preferredRunner(actor: any): any {
    const owners = game.users.filter(
        (u: any) => u.active && !u.isGM && actor.testUserPermission(u, 'OWNER'),
    );
    if (owners.length) {
        // Prefer the user whose assigned character this is.
        return owners.find((u: any) => u.character?.id === actor.id) ?? owners[0];
    }
    return game.users.activeGM ?? null;
}

/** Users who should receive whispered infusion messages for this actor. */
export function whisperRecipients(actor: any): string[] {
    return game.users
        .filter((u: any) => u.isGM || actor.testUserPermission(u, 'OWNER'))
        .map((u: any) => u.id);
}

/**
 * All actors that may hold infusions: world actors plus unlinked token actors whose own delta stores
 * infusions. Synthetic actors otherwise inherit the base actor's flags, which would list (and drain) the
 * same infusions once per token.
 */
export function allActors(): any[] {
    const actors: any[] = [...game.actors];
    for (const scene of game.scenes ?? []) {
        for (const token of scene.tokens ?? []) {
            if (token.actorLink || !token.actor) continue;
            if (token.delta?._source?.flags?.[MODULE_ID]?.[FLAGS.infusions] !== undefined) actors.push(token.actor);
        }
    }
    return actors;
}
