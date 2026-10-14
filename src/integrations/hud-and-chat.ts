/** Token HUD button (opens the actor's infusion panel) and "Create infusion" buttons on item chat cards. */
import { SYSTEM_ID } from '@/constants';
import { ActorPanel } from '@/apps/actor-panel';
import { owningActor } from '@/core/actor-data';
import { detectInfusion } from '@/core/surge-detect';
import { offerInfusion } from '@/integrations/use-item';
import { esc, t } from '@/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

function onRenderTokenHUD(hud: any, html: HTMLElement) {
    const actor = hud.object?.actor ?? hud.document?.actor;
    if (!actor?.isOwner && !game.user.isGM) return;
    const column = html.querySelector('.col.left') ?? html.querySelector('.left');
    if (!column || column.querySelector('.sci-hud')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'control-icon sci-hud';
    button.dataset.tooltip = t('SCI.Panel.Title');
    button.innerHTML = '<i class="fa-solid fa-sun"></i>';
    button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        ActorPanel.show(actor);
    });
    column.append(button);
}

function onRenderChatMessage(message: any, html: HTMLElement) {
    const itemUuid = message.getFlag?.(SYSTEM_ID, 'message')?.item;
    if (!itemUuid) return;
    const item = fromUuidSync(itemUuid, { strict: false });
    const actor = owningActor(item);
    if (!item || !actor?.isOwner || !detectInfusion(item)) return;
    const content = html.querySelector('.message-content') ?? html;
    if (content.querySelector('.sci-chat-create')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sci-chat-create';
    button.innerHTML = `<i class="fa-solid fa-sun"></i> ${esc(t('SCI.Chat.CreateInfusion'))}`;
    button.addEventListener('click', (event) => {
        event.preventDefault();
        // The surge cost was already paid when the item was used; the dialog lets the user adjust it.
        void offerInfusion(item, 1);
    });
    content.append(button);
}

export function initHudAndChat() {
    Hooks.on('renderTokenHUD', onRenderTokenHUD);
    Hooks.on('renderChatMessageHTML', onRenderChatMessage);
}
