import './styles/module.css';
import { HANDBOOK_ID, MODULE_ID, SYSTEM_ID } from '@/constants';
import { registerSettings } from '@/settings';
import { initRelay } from '@/core/relay';
import { initMarkers } from '@/core/markers';
import { initSubEffects } from '@/core/sub-effects';
import { initStore } from '@/core/store';
import { initTurns } from '@/core/turn';
import { verifyMapping } from '@/core/mapping';
import { MappingConfig } from '@/apps/mapping-config';
import { initActorPanel } from '@/apps/actor-panel';
import { initTracker } from '@/apps/tracker';
import { initItemConfig } from '@/apps/item-config';
import { initSheet } from '@/integrations/sheet';
import { initUseItem } from '@/integrations/use-item';
import { initHudAndChat } from '@/integrations/hud-and-chat';
import { buildApi } from '@/api';
import { log } from '@/utils';

Hooks.once('init', () => {
    if (game.system.id !== SYSTEM_ID) {
        console.warn(`${MODULE_ID} | requires the ${SYSTEM_ID} system; module disabled.`);
        return;
    }
    registerSettings(MappingConfig);
    initTracker();
    initSheet();
    initUseItem();
    initHudAndChat();
    initItemConfig();
    initActorPanel();
    initTurns();
    game.modules.get(MODULE_ID).api = buildApi();
    log('initialized');
});

Hooks.once('ready', () => {
    if (game.system.id !== SYSTEM_ID) return;
    initRelay();
    initMarkers();
    initSubEffects();
    initStore();
    if (game.user.isGM && game.modules.get(HANDBOOK_ID)?.active) void verifyMapping();
});
