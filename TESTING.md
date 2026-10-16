# Manual test checklist

Use a **test world** (not a live game) on Foundry v13 with cosmere-rpg 3.1.x. Use one GM client and one player client (two browsers, or one private window). The player should own a Radiant character with surges, for example a Windrunner with Adhesion and Gravitation.

## Setup
- [ ] The module enables without console errors, with and without the Stormlight Handbook module.
- [ ] Settings → Surge and talent mapping → *Check against compendium* lists the 10 surges and finds every mapped talent.

## Creating infusions
- [ ] Use Gravitation with 3 Investiture and a target. The New infusion window opens with pool 3, the target listed, and no extra charge. It has an empty, optional Description field and no Surge, Already paid, Notes or Drain fields; Edit on the infusion shows them all.
- [ ] *New infusion* (+) on the sheet, without using an action, does show the Surge field.
- [ ] The Investiture field is narrow, with up/down arrows next to it.
- [ ] Target type *Area or surface*: no Targets box, and the Description hint asks to describe the area.
- [ ] Raise the pool to 4: the window says 1 more will be charged, and creating it reduces Investiture by 1.
- [ ] A Gravitation self Lashing shows *Sustained* (checked) above a disabled *Investiture infused* field. Created from a Gravitation use it charges nothing more; created from the sheet it charges 1. Its duration reads *Sustained*.
- [ ] Unchecking *Sustained* enables the Investiture field; the infusion then has a pool, shows rounds left and a **+** button, and drains the pool instead of the caster.
- [ ] Use Division / Transformation / Transportation: no window opens.
- [ ] Binding Strike only opens one window (from the triggered Adhesion use).
- [ ] Use Enhance: an upkeep entry is created without a window. Using it again doesn't add a second one.
- [ ] Item sheet sun button → *Never* stops the window for that item. *Always* forces it on a homebrew action.
- [ ] Targeting a token larger than your surge size shows a warning in the New infusion window.
- [ ] The chat card of a surge use has a *Create infusion* button for the owner only.

## Talents
- [ ] Extended Adhesion: the dialog shows "drain every N rounds" with N = Adhesion ranks.
- [ ] Master of the Skies: a self Lashing is "free while Invested". A Lashing on another character is not.
- [ ] Stormlight Reclamation: *Reclaim* appears in the Sustained Infusions menu only for that surge's infusions, and returns the pool (capped at max).
- [ ] A squire ignores talent modifiers.

## Sheet (Effects tab)
- [ ] *Sustained Infusions* sits below Injuries, collapses from its header, and stays collapsed after the sheet re-renders.
- [ ] Each row shows the art, the target (portrait with a yellow border for characters) and "N rounds".
- [ ] **+** takes 1 Investiture and adds 1 round, with no window. Hidden for sustained and upkeep infusions.
- [ ] View details expands the row. The menu has Edit and Remove (plus Reclaim / Damage when they apply; no Drain or double drain).
- [ ] Rows show the surge name, with the description in gray under it; without a description the name is centered.
- [ ] Active Infusions has a Duration column between Source and the actions. Sustained infusions show *Sustained* in both tables.
- [ ] A target's sheet shows the infusion under *Active Infusions* with the caster as Source; removing it there removes it from the caster's Sustained list too, and the other way round.
- [ ] A player who doesn't own the caster sees no menu on the target's Active Infusions row.

## Infusion effects
- [ ] Self Gravitation: *Basic Lashing* under the infusion in Active Infusions, Fly 25 ft (40 with Flying Ace).
- [ ] Tension on a character's clothing (target the token): *Hardened Defense*, Physical defense +2 (+4 with Clothsmith). A second Tension infusion on the same character adds a disabled copy, which turns on when the first ends.
- [ ] Abrasion self: *Skate* (2 focus, straight line; 1 focus with Smooth Operator, any path with Graceful Skating) and *Slide*, and *Frictionless Motion* (+10 ft Move) with that talent. Adhesion with Living Adhesion: target is Restrained.
- [ ] The effect toggle turns the effect off without ending the infusion. Ending the infusion removes its effects, also on tokens the player doesn't own (GM relay).
- [ ] Progression on a character: activating that character posts a Progression card with a Healing section like an item use, rolls Regrowth (surge die + caster's Progression modifier, + Medicine ranks with Swift Healer, + Lore ranks with Applied Medicine) and heals them. With Swift Regeneration they get an injury roll bonus.

## Start of turn (combat)
- [ ] The player activates their slow turn: the window opens on the **player's** client, and only once.
- [ ] The GM activates the player's combatant: the window still opens on the player's client.
- [ ] The window lists sustained infusions and upkeep effects, each with Maintain / End toggles (only one can be selected). Infusions with a pool drain without a window.
- [ ] With Investiture 0 (and not Empowered), Maintain is disabled and End is selected for anything that costs Investiture this turn.
- [ ] With Stormlight Reclamation for the surge, infusions with a pool are listed with Keep / Reclaim. Reclaim ends the infusion after the drain and returns the rest of the pool (capped at max).
- [ ] A character with the Regenerate action gets a Regenerate row (Use / Do not use). Unhurt: *Do not use* is selected. Hurt: *Use* is selected; continuing uses Regenerate (its Investiture is spent, its card posted) and heals the rolled amount. No Investiture: Use is disabled.
- [ ] Nothing to ask (no sustained infusion, upkeep, reclaimable infusion or Regenerate): no window, the drain still happens.
- [ ] Closing the window keeps the defaults and still drains.
- [ ] Chat: a "TRIGGERS" card (bolt icon, Skill Test header style). Each row has the infusion art, **Tension** on **Selaneth**, and a small gray update: *Drained 1 · 3 left*, *Maintained*, *Reclaimed 2*, *Ended: out of Investiture*, *Ended*.
- [ ] Pool 1 → the infusion ends, its marker disappears, and the chat says "out of Investiture".
- [ ] Sustained infusion with Investiture 1 → it drains to 0 and ends (non-Invested).
- [ ] Spending Investiture down to 0 elsewhere ends sustained infusions immediately; self infusions with a pool keep running.
- [ ] Unconscious caster: infusions still drain.
- [ ] Boss with fast + slow turns: drains once per round by default, twice with "both turns".
- [ ] Empowered (status): Investiture refills to max before the drain.
- [ ] Enhance asks nothing at the start of the turn, nor at the end of the turn it was used in. At the end of the following turn (another combatant activates, or the next round) *End of turn* opens with Maintain / End; chat says **Enhance**: Maintained (or Ended).
- [ ] Ending Enhance turns its Enhanced effects off.
- [ ] With *Speak the Second Ideal* completed (goal level 3), no window and no Investiture spent. With 0 Investiture, Enhance ends without a window.
- [ ] After a page reload, the first activation doesn't end the previous turn (turns are tracked in memory); the next ones do.
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
