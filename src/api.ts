/**
 * Public API: `game.modules.get('sargas-cosmere-infusion').api`.
 *
 * @example
 * const api = game.modules.get('sargas-cosmere-infusion').api;
 * await api.createInfusion(actor, { surge: 'grv', kind: 'object', label: 'Lashed crate', pool: 3 }, 3);
 * api.getInfusions(actor);
 */
import { normalizeInfusion, surgeScaling, type InfusionInit } from '@/data/infusion';
import * as engine from '@/core/engine';
import { casterState } from '@/core/actor-data';
import { commit, createInfusion, getInfusions } from '@/core/store';
import { advanceRoundForAll, runTurnEnd, runTurnStart } from '@/core/turn';
import { verifyMapping } from '@/core/mapping';
import { ActorPanel } from '@/apps/actor-panel';
import { InfusionDialog } from '@/apps/infusion-dialog';
import { InfusionTracker } from '@/apps/tracker';
import { highstorm } from '@/integrations/spheres';

/* eslint-disable @typescript-eslint/no-explicit-any */

export function buildApi() {
    return {
        getInfusions,
        /** Creates an infusion; `charge` Investiture is taken from the caster. */
        createInfusion: (actor: any, data: InfusionInit, charge = 0) => createInfusion(actor, normalizeInfusion(data), charge),
        addInvestiture: (actor: any, id: string, amount: number) =>
            commit(actor, engine.addInvestiture(casterState(actor), getInfusions(actor), id, amount)),
        endInfusion: (actor: any, id: string, { refund = false } = {}) =>
            commit(actor, engine.endInfusion(casterState(actor), getInfusions(actor), id, { refund })),
        /** Removes Investiture from an infusion from outside (larkin Drain Light). Resolves to the amount drained. */
        drainInfusion: async (actor: any, id: string, amount: number) => {
            const result = engine.drainExternal(casterState(actor), getInfusions(actor), id, amount);
            await commit(actor, result);
            return result.drained;
        },
        damageInfusion: (actor: any, id: string, amount: number) =>
            commit(actor, engine.damageInfusion(casterState(actor), getInfusions(actor), id, amount)),
        runTurnStart: (actor: any, prompt = true) => runTurnStart(actor, { prompt }),
        /** End-of-turn upkeep (Enhance). */
        runTurnEnd: (actor: any, prompt = true) => runTurnEnd(actor, { prompt }),
        advanceRound: advanceRoundForAll,
        highstorm,
        verifyMapping,
        surgeScaling,
        openDialog: (actor: any, init = {}) => InfusionDialog.open(actor, init),
        openPanel: (actor: any) => ActorPanel.show(actor),
        openTracker: () => InfusionTracker.show(),
        /** The pure rules engine, for macros that want to simulate. */
        engine,
    };
}
