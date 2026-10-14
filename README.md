# Cosmere Infusions

A Foundry VTT **v13** module for the [Cosmere RPG system](https://github.com/the-metalworks/cosmere-rpg) (3.1+) that tracks Radiant **infusions**: Investiture put into objects, characters or yourself by surges. It drains each round, can be topped up and reclaimed, and ends when it runs out.

Works on its own (manual mode) and recognises surges and talents automatically when the *Stormlight Handbook* premium module is active.

> This is an unofficial fan module. It isn't affiliated with The Metalworks, Brotherwise Games or Dragonsteel. It contains no rules text, only the mechanics needed to track infusions. You need the Stormlight Handbook to play.

## Install

In Foundry: **Add-on Modules → Install Module**, paste the manifest URL:

```
https://github.com/sargas79/sargas-cosmere-infusion/releases/latest/download/module.json
```

## Features

- **Infusions on the sheet.** An *Infusions* section on the Actions tab of characters and adversaries shows each infusion, its Investiture, targets, and buttons to add, reclaim, edit or end it. The token HUD sun button opens the same list in a window.
- **Created when you use a surge.** Using Abrasion, Adhesion, Cohesion, Gravitation, Illumination, Progression or Tension opens a prefilled *New infusion* window. It uses the Investiture you spent and your targeted tokens. Talents that trigger a surge (Binding Strike…) work too. Division, Transformation and Transportation are instant and don't prompt.
- **Talents applied automatically.** Your talents set the infusion's rules, and you can override each one:
  - Extended Adhesion / Regrowth / Tension and Lingering Lightweavings: drain every N rounds.
  - Master of the Skies, Smooth Operator, Endless Illusions and Extended Tension: free while you're Invested.
  - Stormlight Reclamation, Distant Surgebinding / Through the Stone, Fine Control, the Physical Illusion, Group Flight, Aerial Squadron, Multiplicative Lightweaving and Multiple Lashings.
- **Start of turn.** When a combatant activates their fast or slow turn in the tracker, the player who owns the character gets a window: add Investiture, reclaim, end, or keep paying upkeep effects. Then infusions drain once. Closing the window continues. The GM gets the window for adversaries and offline players.
- **Rules handled:**
  - Self infusions draw from your Investiture and end at 0 (non-Invested); infused pools keep running.
  - Empowered refills Investiture before the drain.
  - Bosses drain once per round (configurable).
- **Out of combat.** The GM tracker has a scene mode (combat, conversation, endeavor, free time) and an *Advance round* button. Advancing world time drains 10-minute (simple illusions) and daily (Shadesmar beads) infusions, and round infusions in free time.
- **GM tracker** (sun button in the token controls): every active infusion in the world, *End all* at the end of a scene, drain by N (larkin Drain Light, optionally giving it to the targeted token), and double drain (an Opportunity that burns Stormlight too quickly).
- **Infused markers.** Targets get an *Infused (N)* effect, created through the GM when the player doesn't own the target.
- **Upkeep effects.** Enhance, Tunneling and Gravitational Support ask *Maintain?* each turn. Not maintaining Enhance turns its Enhanced effects off.
- **Spheres (optional).** Breathe Stormlight turns infused marks and broams dun (1 Investiture each), and the GM's *Highstorm* re-infuses them.
- **Other:** light type per infusion (Stormlight, Voidlight…), infusions paid from a gem, squires (no talent modifiers), and per-item infusion settings (sun button in the item sheet header).

## Settings

| Setting | Default |
|---|---|
| Drain trigger: turn start / round start / manual | turn start |
| Boss turns: drain once per round / on both turns | once |
| Start-of-turn window | on |
| Offer infusion on surge use (per user) | on |
| Whisper summaries | on |
| Infused markers | on |
| Drain with world time | on |
| Track spheres / Breathe Stormlight refills | off / off |
| End Enhanced with upkeep | on |
| Surge and talent mapping (menu) | built-in ids, checked against the Handbook compendium |

## API

```js
const api = game.modules.get('sargas-cosmere-infusion').api;
api.getInfusions(actor);
await api.createInfusion(actor, { surge: 'grv', kind: 'object', label: 'Lashed crate', pool: 3 }, 3);
await api.addInvestiture(actor, id, 2);
await api.endInfusion(actor, id, { refund: true });
const drained = await api.drainInfusion(actor, id, 2);
await api.runTurnStart(actor);
api.openTracker();
```

Hooks: `sargas-cosmere-infusion.changed (actor, infusions)` and `sargas-cosmere-infusion.turnResolved (actor, result)`.

## Development

```bash
npm install
npm run dev        # watch build into dist/
npm test           # unit tests (rules engine, modifiers, localization)
npm run lint && npm run typecheck
```

To develop against Foundry, link `dist/` as `Data/modules/sargas-cosmere-infusion` (on Windows run `mklink /D` from an elevated prompt). Releases are built by GitHub Actions when a `v*` tag is pushed.

See [PLAN.md](PLAN.md) for the design and [TESTING.md](TESTING.md) for the manual test checklist.
