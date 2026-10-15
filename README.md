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

- **Infusions on the sheet.** Two collapsible tables on the Effects tab, below Injuries:
  - *Sustained Infusions*: the infusions you keep up, with target, duration (rounds left), **+** (1 Investiture, 1 more round), details and a menu (edit, reclaim, remove; drain and double drain for the GM).
  - *Active Infusions*: the infusions on this character and who they come from, with their effects listed under them. Both tables show the same infusion, so a change or removal shows in both.

  The token HUD sun button opens the infusion list in a window.
- **Created when you use a surge.** Using Abrasion, Adhesion, Cohesion, Gravitation, Illumination, Progression or Tension opens a short *New infusion* window: target type, targets and Investiture. It uses the Investiture you spent, your targeted tokens and your talents; everything else can be changed later with Edit. Talents that trigger a surge (Binding Strike…) work too. Division, Transformation and Transportation are instant and don't prompt.
- **Talents applied automatically.** Your talents set the infusion's rules, and you can override each one:
  - Extended Adhesion / Regrowth / Tension and Lingering Lightweavings: drain every N rounds.
  - Master of the Skies, Smooth Operator, Endless Illusions and Extended Tension: free while you're Invested.
  - Stormlight Reclamation, Distant Surgebinding / Through the Stone, Fine Control, the Physical Illusion, Group Flight, Aerial Squadron, Multiplicative Lightweaving and Multiple Lashings.
- **Start of turn.** When a combatant activates their fast or slow turn in the tracker, their infusions drain once. If they keep self infusions or upkeep effects up, the player who owns the character first gets a window to **Maintain** or **End** each one. Closing the window maintains everything. The GM gets the window for adversaries and offline players.
- **Enhance at the end of the turn.** Enhance lasts until the end of the turn after the one it was used in. From then on, it asks *Maintain / End* when the character's turn ends (another combatant activates, or the round ends). No window when it's free (the *Speak the Second Ideal* goal is completed) or when there's no Investiture left (it ends).
- **Chat summaries** list each infusion as *Surge on Target* (e.g. **Tension** on **Selaneth**: drained 1, 3 left).
- **Rules handled:**
  - Self infusions draw from your Investiture and end at 0 (non-Invested); infused pools keep running.
  - Empowered refills Investiture before the drain.
  - Bosses drain once per round (configurable).
- **Out of combat.** The GM tracker has a scene mode (combat, conversation, endeavor, free time) and an *Advance round* button. Advancing world time drains 10-minute (simple illusions) and daily (Shadesmar beads) infusions, and round infusions in free time.
- **GM tracker** (sun button in the token controls): every active infusion in the world, *End all* at the end of a scene, drain by N (larkin Drain Light, optionally giving it to the targeted token), and double drain (an Opportunity that burns Stormlight too quickly).
- **Infused markers.** Targets get an *Infused (N)* effect, created through the GM when the player doesn't own the target.
- **Upkeep effects.** Enhance, Tunneling and Gravitational Support ask *Maintain?* each turn. Not maintaining Enhance turns its Enhanced effects off.
- **Infusion effects.** Infused characters get active effects listed under the infusion:
  - Abrasion (self): *Skate* (focus cost and path follow Smooth Operator and Graceful Skating) and *Slide*; *Frictionless Motion* (Move +10 ft) with that talent.
  - Adhesion: *Restrained* with Living Adhesion.
  - Gravitation: *Basic Lashing*, Fly 25 ft (40 ft with Flying Ace).
  - Progression: *Regrowth*. When the character is activated in combat, the healing is rolled and applied: the caster's Progression surge die (d4 at 1 rank, d6 at 2…) + Progression modifier, plus Medicine ranks with Swift Healer and Lore ranks with Applied Medicine. With Swift Regeneration, the target also adds the caster's Progression modifier to injury rolls.
  - Tension: *Hardened Defense*, Physical defense +2 (+4 with Clothsmith). Only one counts per character; extra copies stay disabled until the active one ends.

  Effects and formulas can be changed in *Surge and talent mapping* (`subEffects`, `formulas`).
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
| Infusion effects | on |
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
await api.runTurnEnd(actor);    // end-of-turn upkeep (Enhance)
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
