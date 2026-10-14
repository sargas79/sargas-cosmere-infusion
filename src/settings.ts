import { MODULE_ID } from '@/constants';

export type TriggerMode = 'turn' | 'round' | 'manual';
export type BossDrain = 'first' | 'every';
export type SceneMode = 'combat' | 'conversation' | 'endeavor' | 'free';

export interface MappingOverrides {
    /** Surge action `system.id` -> surge key. */
    surgeActions?: Record<string, string>;
    /** Talent/action `system.id` -> action infusion preset. */
    actionPresets?: Record<string, unknown>;
    /** `power/id` -> talent effects. */
    talentEffects?: Record<string, unknown>;
}

export interface SettingTypes {
    triggerMode: TriggerMode;
    bossDrain: BossDrain;
    promptOnTurn: boolean;
    autoPromptOnUse: boolean;
    whisperChat: boolean;
    tokenMarkers: boolean;
    worldTimeDrain: boolean;
    sceneMode: SceneMode;
    sphereTracking: boolean;
    breatheRefill: boolean;
    endEnhancedEffects: boolean;
    mapping: MappingOverrides;
}

export function getSetting<K extends keyof SettingTypes>(key: K): SettingTypes[K] {
    return game.settings.get(MODULE_ID, key);
}

export function setSetting<K extends keyof SettingTypes>(key: K, value: SettingTypes[K]): Promise<unknown> {
    return game.settings.set(MODULE_ID, key, value);
}

/** Registers all settings. `mappingMenu` is the settings-menu application class. */
export function registerSettings(mappingMenu: unknown) {
    const s = (key: keyof SettingTypes, data: Record<string, unknown>) =>
        game.settings.register(MODULE_ID, key, {
            name: `SCI.Settings.${key}.Name`,
            hint: `SCI.Settings.${key}.Hint`,
            ...data,
        });

    s('triggerMode', {
        scope: 'world',
        config: true,
        type: String,
        default: 'turn',
        choices: {
            turn: 'SCI.Settings.triggerMode.Turn',
            round: 'SCI.Settings.triggerMode.Round',
            manual: 'SCI.Settings.triggerMode.Manual',
        },
    });
    s('bossDrain', {
        scope: 'world',
        config: true,
        type: String,
        default: 'first',
        choices: { first: 'SCI.Settings.bossDrain.First', every: 'SCI.Settings.bossDrain.Every' },
    });
    s('promptOnTurn', { scope: 'world', config: true, type: Boolean, default: true });
    s('autoPromptOnUse', { scope: 'client', config: true, type: Boolean, default: true });
    s('whisperChat', { scope: 'world', config: true, type: Boolean, default: true });
    s('tokenMarkers', { scope: 'world', config: true, type: Boolean, default: true });
    s('worldTimeDrain', { scope: 'world', config: true, type: Boolean, default: true });
    s('sphereTracking', { scope: 'world', config: true, type: Boolean, default: false });
    s('breatheRefill', { scope: 'world', config: true, type: Boolean, default: false });
    s('endEnhancedEffects', { scope: 'world', config: true, type: Boolean, default: true });
    s('sceneMode', { scope: 'world', config: false, type: String, default: 'combat' });
    s('mapping', { scope: 'world', config: false, type: Object, default: {} });

    game.settings.registerMenu(MODULE_ID, 'mappingMenu', {
        name: 'SCI.Settings.mappingMenu.Name',
        label: 'SCI.Settings.mappingMenu.Label',
        hint: 'SCI.Settings.mappingMenu.Hint',
        icon: 'fa-solid fa-table-list',
        type: mappingMenu,
        restricted: true,
    });
}
