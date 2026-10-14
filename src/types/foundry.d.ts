/**
 * Minimal ambient declarations for the Foundry VTT v13 globals this module touches.
 *
 * Foundry ships no first-party typings; community typings for v13 are still in beta and very
 * heavy. The module keeps every Foundry/system touchpoint in `src/integrations`, `src/apps` and
 * `src/core/foundry-*.ts`, so loose typing here is contained. The rules engine (`src/core/engine.ts`)
 * is fully typed and has no Foundry dependency.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

declare const game: any;
declare const Hooks: any;
declare const foundry: any;
declare const CONFIG: any;
declare const ui: any;
declare const canvas: any;
declare const ChatMessage: any;
declare const Roll: any;
declare function fromUuid(uuid: string): Promise<any>;
declare function fromUuidSync(uuid: string, options?: Record<string, unknown>): any;

/** cosmere-rpg exposes its API on this global (system/index.ts). */
declare const cosmereRPG: any;
