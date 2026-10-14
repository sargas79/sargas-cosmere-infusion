# Cosmere Infusions — Add-on Plan (Draft for review)

Foundry VTT **v13** module for the **Cosmere RPG** system (`cosmere-rpg`, v3.1.x, The Metalworks) that tracks
Radiant **infusions**: Investiture placed into objects, characters or yourself by surges, drained each round,
topped up, reclaimed and ended.

> Status: **plan only — nothing implemented.** Waiting for your review and the open questions at the end.
> The third-party system repo is used read-only as a reference. No issues, PRs or contact with it.

---

## 1. What I learned

### 1.1 Rules (Stormlight Handbook, ch. 5 and 6)

The book is used only as a reference. The module encodes mechanics (numbers, timing) and ships no rules text.

| Rule | Mechanic the module must model |
|---|---|
| Infusing an object or character | Spend X Investiture from the caster's pool. That X becomes the **infusion's own pool**. |
| Infusing yourself | No upfront pool. The cost is drawn from the caster's **current Investiture** each round until the caster ends it. |
| Drain | Usually **1 per round at the start of the caster's turn**. Continues while the caster is Unconscious. |
| Extra spends | Some effects spend extra from the pool or the caster, so the infusion ends sooner. |
| Adding to an infusion | At the **start of the caster's turn, before the drain**, add any amount. The caster must be within the infusion's creation range. |
| Ending | Pool reaches 0, or (for self-infusions) the caster chooses to end it. Some effects end on special conditions: an opposed Athletics break, or reaching 0 health (Physical Illusion, Fine Control). |
| Investiture 0 | The caster becomes temporarily non-Invested. Self-infusions end. Object infusions run out their own pools. |
| Death | Effects without per-round cost end. Infused pools continue until empty. |
| Multiple infusions | Allowed, each tracked separately. An object that is already infused or Invested can't be infused again. |
| Scene start | Full Investiture, unless Surprised (then 1). |
| Out of combat | "1 round" means 1 conversation or endeavor round, or about 10 minutes outside scenes. The GM can set the rate. |
| Surge Scaling | Ranks 1–5 give die d4–d12 and size Small through Gargantuan. Shown as info and used as a size check hint. |

**Surges that create persistent infusions:** Abrasion, Adhesion, Cohesion, Gravitation, Illumination, Progression (Regrowth), Tension.
**Instant (no tracking):** Division, Transformation, Transportation. A few talents attached to them create a *duration* (Igniting Division, Searing Dust Storm). Those are counted in rounds, not drained from a pool.

**Talents that change infusion behaviour.** Each one maps to a small set of modifiers:

| Modifier | Talents |
|---|---|
| `drainEveryNRounds = surgeRanks` | Extended Adhesion, Extended Regrowth, Extended Tension, Lingering Lightweaving |
| `freeWhileInvested` (no drain while the caster has ≥1 Investiture) | Master of the Skies (self Gravitation), Smooth Operator (self Abrasion), Endless Illusions (within bond range), Extended Tension (held or worn objects) |
| `reclaimable` (end and refund the remaining pool after the drain) | Stormlight Reclamation (Abrasion, Adhesion, Illumination, Tension) |
| `rangeOverride` | Distant Surgebinding (20 ft), Through the Stone |
| `hasHealth` (the infusion has HP and ends at 0) | Fine Control (5 × Tension ranks), Physical Illusion (5 × Transformation ranks) |
| `linkedTargets` (several targets share one pool) | Group Flight / Aerial Squadron, Multiplicative Lightweaving |
| `maxPoolOnUnwilling = ranks` | Multiple Lashings |
| Illumination drain cadence | A simple illusion drains 1 per 10 min; a complex one drains 1 per round. |
| Explicit-upkeep self effects | Tunneling, Enhance: pay 1 at turn start or end, otherwise it ends. Optional, see Q5. |

⚠ The PDF text extraction loses the action-cost icons. Action costs (for example, the cost to add to an infusion) must be checked against the book.

### 1.2 Other books (World Guide, GM Tools, adventures)

| Source | Impact on the module |
|---|---|
| World Guide, Shadesmar: **manifesting a bead** | Infuse 1+ Investiture into a bead and it becomes an object. It drains **1 per day**, then reverts. You can infuse from an unencased gem instead of yourself. Needs a `day` drain cadence and a `source: 'gem'` option, which takes nothing from the caster. |
| World Guide, Shadesmar: **bead structures** | Infuse 1+ Investiture and the structure drains 1 per round, then collapses. This is a normal pool infusion. Size is based on Crafting ranks, not surge ranks. |
| World Guide: **Larkin "Drain Light"** | An outside effect removes 1d4 or 1d6 from an infusion's pool, and the larkin gains that much. The module needs a GM **"Drain infusion by N"** action that targets any infusion and can refund another actor. |
| World Guide: Fused, Radiant/squire **adversaries** | NPC adversaries create infusions too, often worded "for rounds equal to Investiture spent" (the same pool model) and fuelled by **Voidlight**. **Adversary actors must be supported**, and each infusion records its **Light type** (Stormlight, Voidlight, Lifelight, Towerlight, Warlight). |
| World Guide: Gravitational Support, Skybreakers | Self-flight that is maintained by paying 1 at the start of the turn. This is the same "explicit upkeep" pattern as Tunneling and Enhance. |
| GM Tools / Stonewalkers: Ylt, Opportunity "burns Stormlight too quickly" | Doubles Investiture costs until the end of the next turn. Handled with a temporary drain multiplier on the caster's infusions (M3). |
| Adventures (First Step, Bridge Nine, Welcome to Roshar) | Narrative mentions only, no new mechanics. |

### 1.3 The `cosmere-rpg` system (v3.1.2, Foundry 13.346–13.351)

- **No surges or Radiant content in the base system.** They come from the premium *Stormlight Handbook* module, which I can't see. The add-on must not hard-depend on it. It should match surges by configurable `system.id` / skill IDs, with a fully manual fallback.
- **Investiture:** `actor.system.resources.inv.value` / `.max.value`. Write with `actor.update({'system.resources.inv.value': n})`. There is no built-in "Invested" flag, so the add-on derives it.
- **Surge ranks:** surges are probably non-core skills (same pattern as Allomancy). Ranks are read at `actor.system.skills[<id>].rank`.
- **Item use hook:** `cosmere-rpg.useItem(item, options)`. `options.consumeResponse` reports the Investiture actually spent. This is the ideal "create infusion?" trigger. `cosmere-rpg.preUseItem` is also available.
- **Combat:** there is no initiative order. Fast/slow turns are chosen by clicking "activate" in the tracker, which sets `flags['cosmere-rpg'].activated` (bosses also get `bossFastActivated`). **"Start of turn" = `updateCombatant` where that flag flips to true.** The system also fires `cosmere-rpg.combatRoundStart` / `combatRoundEnd`.
- **Rest:** `cosmere-rpg.rest(actor, type)`. Scene ends and rests can clean up stale infusions.
- **Sheets** are ApplicationV2 with hard-coded tab bodies. The supported extension point is `cosmereRPG.api.registerActionListDynamicSectionGenerator`, which adds a section to the Actions tab. DOM injection on `renderCharacterSheet` is the fallback.
- **Statuses:** `CONFIG.COSMERE.statuses` supports `stackable` effects, so an "Infused (N)" token marker can show the pool as stacks.
- **Chat:** `renderChatMessageHTML` adds buttons to item cards (`message.itemSource`, `actorSource`).

### 1.4 What your character export shows (Luraneth, system 3.1.0, Foundry 13.348)

This confirms how the **Stormlight Handbook module** (`cosmere-rpg-stormlight-handbook`, compendia `surges`, `radiant-paths`, `actions`) stores Radiant data:

| Thing | Where it lives | How the add-on uses it |
|---|---|---|
| Surge | `power` item, `system.type: 'surge'`, `system.id` = **3-letter skill key** (`adh` Adhesion, `grv` Gravitation) | Surge matching by `system.id`. No name matching needed. |
| Surge ranks | `actor.system.skills.<key>.rank` (`adh: 2`, `grv: 2`) | Surge Scaling die and size, and Extended N |
| Surge activation | An **embedded `action`** with the same `system.id`, 1 action, **consumes exactly 1 `inv`** (min = max = 1) | `useItem` fires with the surge's action. The system only ever charges 1, so the add-on's dialog asks for the **real pool (1+)** and charges the difference. |
| Surge talents | `talent` item, `system.type: 'power'`, `system.power: 'grv'`, `system.id` slug (`flying-ace`, `binding-strike`) | Talent modifiers detected by `system.id`, e.g. `master-of-the-skies`, `extended-adhesion`, `stormlight-reclamation` |
| Talents that trigger a surge | Binding Strike's action has a `use` event (`use-item` handler) that **uses the Adhesion surge item** | A single `useItem` hook catches both direct and talent-triggered surges. The dialog shows the triggering talent (for example "Binding Strike: auto-success on held object"). |
| Max Investiture | Active effect "Radiant Investiture" on First Ideal: `inv.max.override = 2 + max(awa, pre)` | Read `inv.max.value`; never write max. "Invested" = max > 0 and value > 0. |
| Stormlight actions | `action` items `breathe-stormlight`, `enhance` (consumes 1 inv, applies Enhanced effects), `regenerate` | Hooks for the M4 Breathe helper and Enhance upkeep (matched by `system.id`) |
| Spheres | `loot` items such as "Diamond Mark" / "Diamond Mark (Dun)" | M4 sphere tracking can read and convert the existing loot items instead of using a separate counter. |

**Surge skill keys, confirmed** from the module's own `index.js` and `lang/en.json` on your server (read-only):

| Key | Surge | Attribute | Infusion? |
|---|---|---|---|
| `abr` | Abrasion | spd | yes |
| `adh` | Adhesion | pre | yes |
| `chs` | Cohesion | wil | yes |
| `dvs` | Division | int | no (instant) |
| `grv` | Gravitation | awa | yes |
| `ill` | Illumination | pre | yes |
| `prg` | Progression | awa | yes (Regrowth) |
| `tsn` | Tension | str | yes |
| `trs` | Transformation | wil | no (instant) |
| `trp` | Transportation | int | no (instant) |

The module also registers the `dun` currency (dun spheres), which M4 sphere tracking can use.

**Compendium check** (read-only, from your open game tab: system 3.1.0, Foundry 13.348, compendium `cosmere-rpg-stormlight-handbook.surges` with 101 entries):

- **Surge actions in the compendium use variable cost.** Each surge's embedded action (`abrasion`, `adhesion`, `gravitation`…) costs `inv` with **min 1, max -1 (no upper limit)**. The system already lets the player choose how much Investiture to spend, so the infusion pool comes straight from `useItem`'s `consumeResponse`, and the add-on doesn't need to charge anything extra.
  - **Exception:** Luraneth's copies are fixed at 1/1 (probably an older import). In that case the dialog offers to charge the extra.
- Action costs: 1 action for abr, adh, chs, grv, ill, tsn, trp; 2 actions for dvs, prg, trs.
- **Talents are identified by `(system.power, system.id)`.** Some IDs repeat across surges:
  - `stormlight-reclamation` exists for abr, adh, ill and tsn.
  - `distant-surgebinding` exists for adh, tsn and trs (Abrasion uses `distant-abrasion`).

| Modifier | Talent (power / id) |
|---|---|
| drain every N rounds (N = ranks) | adh/`extended-adhesion`, prg/`extended-regrowth`, tsn/`extended-tension`, `lingering-lightweavings` (power null) |
| free while Invested | grv/`master-of-the-skies` (self), abr/`smooth-operator` (self), ill/`endless-illusions`, tsn/`extended-tension` (held/worn) |
| reclaimable | `stormlight-reclamation` (abr, adh, ill, tsn) |
| range override | abr/`distant-abrasion`, adh, tsn, trs/`distant-surgebinding`, chs/`distant-cohesion` (Through the Stone) |
| has health | tsn/`fine-control`; Physical Illusion = Lightweaver Fourth Ideal (radiant-paths) |
| linked targets | grv/`group-flight`, grv/`aerial-squadron`, ill/`multiplicative-lightweaving` |
| unwilling pool cap | grv/`multiple-lashings` |
| infusion created by a talent action | adh/`binding-strike`, `binding-shot`, `adhesive-trap`; tsn/`rigged-weaponry`, `tension-parry`; `hardened-defense` action |
| explicit upkeep | chs/`tunneling` (inv 1/1), `enhance` action |
| timed (not pool) | dvs/`igniting-division` (inv 1/-1) |

---

## 2. Architecture

```
sargas-cosmere-infusion/
  package.json            scripts: dev (watch), build, test, lint, release
  tsconfig.json           strict, ES2022, types: fvtt-types (v13)
  vite.config.ts          library build -> dist/main.js (+ css), copies module.json/lang/templates
  module.json             id, v13 compat, relationships.systems: cosmere-rpg >= 3.1, socket: true
  src/
    main.ts               init/setup/ready wiring
    constants.ts          MODULE_ID, flag keys, enums
    settings.ts
    types/                Infusion types + minimal typings for the cosmere-rpg pieces we use
    data/
      infusion.ts         Infusion model (typed plain object + validation)
      presets.ts          Surge presets + talent modifiers (mechanics only)
    core/
      store.ts            CRUD on actor flags (single source of truth)
      engine.ts           pure rules: drain, top-up, reclaim, end checks (unit-tested, no Foundry imports)
      turn-detector.ts    detects caster turn start (activated flag) / round / out-of-combat ticks
      gm-executor.ts      socket relay: GM client performs writes on documents players don't own
      surge-detect.ts     match items/talents to presets (system.id, skill id, user mapping)
    integrations/
      use-item.ts         cosmere-rpg.useItem -> "Create infusion" dialog
      chat.ts             buttons on item chat cards, drain/end log messages
      sheet.ts            "Infusions" section on Actions tab (+ fallback injection)
      token-status.ts     stackable "Infused" status on target tokens
    apps/
      infusion-dialog.ts      ApplicationV2 create/edit infusion
      turn-start-prompt.ts    add / reclaim / end, then drain
      infusion-tracker.ts     GM overview of all active infusions in the scene/world
  templates/  styles/ (SCSS)  lang/en.json
  tests/      vitest unit tests for core/engine.ts
```

### 2.1 Infusion data model (stored on the **caster** actor: `flags.sargas-cosmere-infusion.infusions`)

```js
{
  id, surge: 'gravitation', label: 'Lashed crate',
  kind: 'object' | 'character' | 'self' | 'area',
  targets: [ { uuid, name, img } ],        // token/actor/item/tile/region or free-text
  pool: 3,                                 // ignored for kind 'self' (drains caster)
  drain: { amount: 1, everyNRounds: 1, counter: 0, cadence: 'round' | '10min' | 'day', multiplier: 1 },
  light: 'stormlight' | 'voidlight' | 'lifelight' | 'towerlight' | 'warlight',
  source: 'caster' | 'gem',                // gem = paid from an unencased gem (Shadesmar beads)
  freeWhileInvested: false,
  reclaimable: false,
  range: { value: 5, units: 'ft', basis: 'reach' | 'bondRange' | 'custom' },
  health: { value, max } | null,           // Fine Control / Physical Illusion
  sourceItemUuid, createdAt: { round, worldTime }, notes
}
```

Infusions are stored on the caster because drain timing, top-ups, reclamation and "Investiture 0" all follow the caster.
Targets get only a visual status (optional) that points back to the infusion.

### 2.2 Turn and drain flow

```
caster turn starts (activated flag -> true)  |  manual "Advance round"  |  out-of-combat tick
        |
        v
Turn-start prompt, ALWAYS shown before the drain, on ONE client:
   the active player who owns the caster (the one who activated the turn first),
   else the GM (adversaries, or owner offline)
   [Add Investiture to infusion X]  [Reclaim X (refund pool)]  [End X]  [Continue]
   Closing the window = Continue. The drain is mandatory and can't be skipped.
        |
        v
Engine.drain(caster): for each infusion
   - freeWhileInvested && caster.inv >= 1 -> no drain
   - counter++ ; if counter % everyNRounds -> skip
   - self: caster.inv -= amount (if caster.inv hits 0 -> self-infusions end)
   - else: pool -= amount (pool 0 -> end)
        |
        v
Chat summary (whisper caster + GM): drained / ended / remaining
```

Adding Investiture must happen before the drain, but Stormlight Reclamation happens after it. So the prompt queues reclaims and applies them once the drain has resolved. Only one client opens the prompt (the owner who activated the turn, chosen by a deterministic rule), so the drain is never applied twice. The GM can force "Continue" from the tracker if a player walks away.

### 2.3 Out-of-combat

A scene mode selector in the tracker (Combat, Conversation, Endeavor, Free time) with an **"Advance round"** button.
An optional setting drains on `updateWorldTime` every 600 s for infusions with `cadence: '10min'` (simple illusions) or for free time.

### 2.4 Permissions

Players run everything for actors they own: create, add, reclaim, end, and the turn-start prompt with its drain. All of these write to their own actor's flags and Investiture. Writes to documents they don't own (target token statuses, a target actor's effects, larkin transfers) go through a GM client over the module socket. If no GM is online those visual extras are queued and applied when one joins; the infusion tracking itself still works.

---

## 3. Features by milestone

**M0 — Skeleton**
`module.json` (v13, system relationship), TypeScript + Vite build (watch mode that outputs into your Foundry `Data/modules` folder via a symlink), fvtt-types, ESLint + Prettier, vitest, settings, `lang/en.json`. GitHub Action builds the release zip.

**M1 — Core tracking (usable on its own)**
- Infusion model, store, rules engine with unit tests. Works for **character and adversary** actors.
- Manual "New infusion" dialog from the actor sheet or a token HUD button.
- Actions-tab "Infusions" section: pool, +/- buttons, end, reclaim.
- Drain on caster turn start (activated flag), plus a round-start fallback option.
- Self-infusions drain from the caster. Investiture 0 ends self-infusions.
- Chat log of drains and ends.

**M2 — Automation**
- `useItem` hook: when Investiture was consumed and the item matches a surge preset, open a prefilled "Create infusion?" dialog.
- Item-sheet "Infusion" config (flags) so the GM can mark any item or talent as infusion-creating, with defaults.
- Talent auto-detection on the actor: Extended X, Master of the Skies, Reclamation, etc. Modifiers are applied automatically and can be overridden per infusion.
- Turn-start prompt for top-up, reclaim and end.
- Surge rank lookup for the Surge Scaling hints (die/size, Extended N).

**M3 — Visuals and table tools**
- Stackable "Infused" status on target tokens, with pool shown as stacks and an optional glow.
- GM Infusion Tracker window: all infusions, filters, bulk end at scene end.
- Health-bearing infusions (Fine Control, Physical Illusion): HP tracking, ending at 0.
- GM "Drain infusion by N" action (larkin Drain Light), with an optional transfer to another actor.
- Temporary drain multiplier (Opportunity: "burns Stormlight too quickly").
- Shadesmar: bead manifestation (`day` cadence, gem source) and bead structures.
- Linked targets (Group Flight, Multiplicative Lightweaving).
- Out-of-combat cadence and `updateWorldTime` drain.

**M4 — Extras (in scope)**
- Explicit-upkeep effects (Enhance, Tunneling, Gravitational Support) appear in the same turn-start prompt as "Pay 1 to maintain?" and end when declined.
- Sphere tracking: an optional per-actor count of infused/dun chips, marks and broams. A Breathe Stormlight helper refills Investiture from it (+1 per mark or broam), and a "Highstorm" GM button re-infuses everything.
- Empowered (refill at turn start).
- Squire limits.
- Public API: `game.modules.get(id).api.createInfusion/…` for macros.

---

## 4. Testing and delivery

- Unit tests (vitest, TypeScript) for the engine: drain cadence, free-while-invested, reclaim, pool 0, self + Investiture 0, Extended N.
- A manual test checklist in a Foundry v13 world with `cosmere-rpg` 3.1.x: fast/slow turns, boss double turn, unconscious caster, player vs GM ownership, two clients.
- Releases: GitHub releases with `module.json` manifest/download URLs (your repo, not the system's).

## 5. Risks

- **Premium module IDs.** All 10 surge keys are confirmed. Talent IDs are confirmed from the compendium (§1.4). They're kept as defaults, still checked against the installed compendium at `ready`, and editable in settings.
- **System updates** (3.x to 4.x) may change flags or hooks. All system touchpoints are isolated in `integrations/` and `turn-detector.ts`.
- **Action-cost icons** from the PDF were not extracted, so costs need verifying against the book.
- **Copyright:** the module ships mechanics only (numbers, names), no book text.

---

## 6. Decisions

| # | Topic | Decision |
|---|---|---|
| 2 | Language | **TypeScript** with a Vite build |
| 3 | Automation | **Prompt first** (add / reclaim / end), then drain. **Players run it** for their own actors; the GM runs it for adversaries. |
| 4 | Localization | **English only** (still using `lang/en.json` keys, so other languages can be added later) |
| 5 | M4 extras | **Included**: Enhance/Tunneling/Gravitational Support upkeep and sphere tracking |
| 6 | ID / name / distribution | **`sargas-cosmere-infusion`**, "Cosmere Infusions", released from your own GitHub repo |

## 7. Still open

Nothing blocking. The character export answered the premium-module question (see §1.4).
