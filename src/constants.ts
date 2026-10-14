export const MODULE_ID = 'sargas-cosmere-infusion';
export const SYSTEM_ID = 'cosmere-rpg';
export const HANDBOOK_ID = 'cosmere-rpg-stormlight-handbook';

/** Socket channel used by the GM relay. */
export const SOCKET = `module.${MODULE_ID}`;

/** Flag keys stored under `flags.sargas-cosmere-infusion`. */
export const FLAGS = {
    /** Actor: list of infusions created by this actor (the caster). */
    infusions: 'infusions',
    /** Actor: this character is a squire (base surges only, no talent modifiers). */
    squire: 'squire',
    /** Item: per-item infusion configuration that overrides auto-detection. */
    itemConfig: 'config',
    /** ActiveEffect: marks an effect as an infusion marker on a target. */
    marker: 'marker',
} as const;

/** Hooks fired by this module. */
export const MODULE_HOOKS = {
    /** (actor, infusions) after an actor's infusions were saved. */
    changed: `${MODULE_ID}.changed`,
    /** (actor, result) after a turn-start resolution (add/reclaim/end + drain). */
    turnResolved: `${MODULE_ID}.turnResolved`,
} as const;

/** System hooks this module listens to. */
export const SYSTEM_HOOKS = {
    useItem: `${SYSTEM_ID}.useItem`,
    rest: `${SYSTEM_ID}.rest`,
} as const;

export const ASSET_PATH = `modules/${MODULE_ID}/assets`;
export const MARKER_ICON = `${ASSET_PATH}/infused.svg`;
