# Manual test checklist

Use a **test world** (not a live game) on Foundry v13 with cosmere-rpg 3.1.x. Use one GM client and one player client (two browsers, or one private window). The player should own a Radiant character with surges, for example a Windrunner with Adhesion and Gravitation.

## Setup
- [ ] The module enables without console errors, with and without the Stormlight Handbook module.
- [ ] Settings → Surge and talent mapping → *Check against compendium* lists the 10 surges and finds every mapped talent.

## Creating infusions
- [ ] Use Gravitation with 3 Investiture and a target. The New infusion window opens with pool 3, already paid 3, the target listed, and no extra charge.
- [ ] Raise the pool to 4: the window says 1 more will be charged, and creating it reduces Investiture by 1.
- [ ] A Gravitation self Lashing has no pool. Creating it doesn't charge anything.
- [ ] Use Division / Transformation / Transportation: no window opens.
- [ ] Binding Strike only opens one window (from the triggered Adhesion use).
- [ ] Use Enhance: an upkeep entry is created without a window. Using it again doesn't add a second one.
- [ ] Item sheet sun button → *Never* stops the window for that item. *Always* forces it on a homebrew action.
- [ ] Targeting a token larger than your surge size shows a warning in the New infusion window.
- [ ] The chat card of a surge use has a *Create infusion* button for the owner only.

## Talents
- [ ] Extended Adhesion: the dialog shows "drain every N rounds" with N = Adhesion ranks.
- [ ] Master of the Skies: a self Lashing is "free while Invested". A Lashing on another character is not.
- [ ] Stormlight Reclamation: the Reclaim button and the Reclaim checkbox appear only for that surge's infusions.
- [ ] A squire ignores talent modifiers.

## Start of turn (combat)
- [ ] The player activates their slow turn: the window opens on the **player's** client, and only once.
- [ ] The GM activates the player's combatant: the window still opens on the player's client.
- [ ] Add 2 to an infusion with pool 1: after the drain the pool is 2 and Investiture is 2 lower.
- [ ] Reclaim returns the pool left after the drain, capped at max.
- [ ] Closing the window still drains.
- [ ] Pool 1 → the infusion ends, its marker disappears, and the chat says "out of Investiture".
- [ ] Self infusion with Investiture 1 → it drains to 0 and ends (non-Invested).
- [ ] Spending Investiture down to 0 elsewhere ends self infusions immediately.
- [ ] Unconscious caster: infusions still drain.
- [ ] Boss with fast + slow turns: drains once per round by default, twice with "both turns".
- [ ] Empowered (status): Investiture refills to max before the drain.
- [ ] Upkeep: unticking *Maintain* ends Enhance and turns its Enhanced effects off.
- [ ] Drain trigger "round start": every caster's window opens when the round advances, whoever advances it.

## Markers and ownership
- [ ] A player infusing an enemy-held object: the marker appears on the enemy token (GM relay).
- [ ] With no GM connected, the player sees "queued", and the marker appears once the GM joins.
- [ ] Linked token vs unlinked token targets both get markers.

## GM tracker
- [ ] It lists every infusion across actors and unlinked tokens, with a surge filter.
- [ ] *Advance round* sends each caster their window.
- [ ] Drain by N with a larkin token targeted: the pool goes down and the larkin gains Investiture (up to its max).
- [ ] Double drain: drains 2 next round, then back to 1.
- [ ] Damage on a Fine Control infusion down to 0 health ends it.
- [ ] *End all* clears everything.
- [ ] *Continue all turn windows* closes a turn-start window left open on a player's client, and its drain runs.

## Time
- [ ] Simple illusion (10 min): advancing world time by 1 hour drains it 6 times.
- [ ] Shadesmar bead (day): drains 1 per day.
- [ ] Free time scene mode: round infusions drain every 10 minutes of world time, and never during active combat.

## Spheres (setting on)
- [ ] Breathe Stormlight with 2 missing Investiture converts 2 marks to dun (creating the dun item if needed) and restores 2.
- [ ] Not enough spheres → a partial refill and a warning.
- [ ] *Highstorm* re-infuses every dun sphere.
