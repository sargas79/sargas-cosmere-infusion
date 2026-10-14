/**
 * Socket relay. Players ask the active GM to write documents they don't own (markers on enemy tokens,
 * Investiture transfers), and anyone can ask a specific user to run an actor's turn-start flow.
 * Requests for a GM made while no GM is online are queued and sent when one connects.
 */
import { SOCKET } from '@/constants';
import { warn } from '@/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Message {
    action: string;
    /** Recipient user id; undefined = active GM. */
    to?: string;
    from: string;
    payload: any;
}

type Handler = (payload: any, from: string) => Promise<void> | void;

const handlers = new Map<string, Handler>();
const gmQueue: Message[] = [];

export function registerHandler(action: string, handler: Handler) {
    handlers.set(action, handler);
}

async function dispatch(msg: Message) {
    const handler = handlers.get(msg.action);
    if (!handler) return warn(`No relay handler for "${msg.action}"`);
    try {
        await handler(msg.payload, msg.from);
    } catch (err) {
        warn(`Relay handler "${msg.action}" failed`, err);
    }
}

export function initRelay() {
    game.socket.on(SOCKET, (msg: Message) => {
        if (msg.to) {
            if (msg.to === game.user.id) void dispatch(msg);
        } else if (game.user === game.users.activeGM) {
            void dispatch(msg);
        }
    });

    Hooks.on('userConnected', (user: any, connected: boolean) => {
        if (!connected || !user.isGM || !gmQueue.length) return;
        // Give the GM client a moment to finish loading before flushing.
        setTimeout(() => {
            while (gmQueue.length) game.socket.emit(SOCKET, gmQueue.shift());
        }, 3000);
    });
}

/**
 * Runs `action` on the active GM's client (locally when this user is that GM). With no GM online the
 * request is queued (`queue: true`) or refused with a warning. Returns false when refused.
 */
export async function asGM(action: string, payload: unknown, { queue = true } = {}): Promise<boolean | void> {
    const msg: Message = { action, from: game.user.id, payload };
    if (game.user === game.users.activeGM) return dispatch(msg);
    if (!game.users.activeGM) {
        if (!queue) {
            ui.notifications.warn('SCI.Notify.NoGMForCommit', { localize: true });
            return false;
        }
        gmQueue.push(msg);
        ui.notifications.info('SCI.Notify.QueuedForGM', { localize: true });
        return;
    }
    game.socket.emit(SOCKET, msg);
}

/** Runs `action` on a specific user's client (locally when it's this user). */
export async function asUser(userId: string, action: string, payload: unknown) {
    const msg: Message = { action, to: userId, from: game.user.id, payload };
    if (userId === game.user.id) return dispatch(msg);
    game.socket.emit(SOCKET, msg);
}
