# SWSE: Homebrew Edition

A personal, heavily modified fork of the Star Wars: Saga Edition (SWSE)
system for Foundry VTT, maintained for my own home campaign. It has diverged
substantially from the upstream project it started from - homebrew rules,
a reworked sheet UI, restructured item schemas, and a lot of one-off fixes
that are specific to how my table plays. It is **not** kept in sync with
upstream and isn't intended as a drop-in replacement for it.

Community content is available under [CC-BY-SA](https://www.fandom.com/licensing)
unless otherwise noted.

## House Rules

This fork implements the table's homebrew rules, originally compiled at
[tovec.wikidot.com/episode-vii](http://tovec.wikidot.com/episode-vii). See
[`HOUSERULES.md`](HOUSERULES.md) for the full reference (character creation,
species/language changes, class/skill/feat changes, the Force, equipment,
armor, weapons, combat, healing, prestige classes, and NPC/companion rules).

## Importing statblocks from the wiki

**Import Statblock** in the Actors sidebar builds an NPC or beast from a
[SWSE wiki](https://swse.fandom.com/) statblock. Give it a page name, a page
URL, or paste the wikitext.

Names are imported; numbers are not. The wiki prints Saga Edition as published,
and this fork derives its own hit points, defences, base attack bonus and damage
dice from the house rules, so a lightsaber comes out at this fork's 3d8 rather
than the 2d8 the wiki shows. Species, classes and their levels, feats, talents,
Force powers, languages, gear, size and ability scores all come across, and
everything else is recalculated.

Before anything is created you get a review screen split five ways: what will be
added, what a house rule dropped (the deleted feats), what was merged (Block and
Deflect become one Dueling Stance, Scoundrel and Scout become Smuggler), what
needs you to choose, and what could not be found. The choices are the retired
prestige classes whose talent tree two classes now carry, so an Assassin or a Spy
asks whether this particular NPC is an Agent or an Operative. Anything that could
not be found offers a dropdown of real substitutes or can be left out. Nothing is
written until you press **Create actor**.

Text that this fork has no item for (Rakghoul Disease, Overwhelm and the like) is
kept as description text on the sheet rather than dropped.

Afterwards it shows what the wiki printed beside what this fork derived, with a
checkbox to pin a printed value where you want it. Nothing is pinned by default.

Substitutions are remembered, so gear you have already matched once resolves by
itself next time. `game.swse.exportLearnedAliases()` dumps them as JSON for
pasting into `module/import/statblock-aliases.json`;
`game.swse.clearLearnedAliases()` forgets them.

## Beasts compendium

The **Beasts** compendium holds 196 creatures, every published page in the wiki's
Beasts category, built with the importer above. Their hit points, defences and
base attack bonus are this fork's derived values rather than the printed ones,
and their feats, talents and natural weapons are real items off the packs. Each
one records the page it came from in `flags.swse.statblockImport.page`, so a
creature can be checked against its source.

## Rolling

Rolls made from a character sheet normally roll in Foundry. A player who rolls
physical dice at the table, or rolls somewhere outside Foundry, can turn on
**Enter my own roll results** in the sheet's Settings tab. Every roll from that
sheet then asks for the number instead of rolling it.

The prompt takes either the face you rolled, in which case the sheet adds the
modifier for you and everything that keys off the natural roll still works
(Exceptional Skill, a force power's DC bands), or a finished total when that is
all you have. There is a **Roll in Foundry** button on the prompt for the times
you would rather let Foundry roll after all, so the setting does not have to be
switched off and back on for one roll.

The setting lives on the character rather than the user, so a physical-dice
player's PC prompts even when the GM opens it, and an NPC the GM rolls for
normally still rolls normally.

Not yet covered: initiative and the attack pipeline still roll in Foundry.

Foundry also has its own per-user version of this, under Dice Configuration, if
a player wants every roll everywhere to prompt: set d20 to Manual, which needs
the Manual Rolls permission enabled for that role.

## Install

Manifest link: <https://raw.githubusercontent.com/Brianthas/SWSE-Homebrew-Edition/main/system.json>

## Credits

### Original system

This project began as a fork of
[Foundry-VTT-StarWars-SagaEdition](https://github.com/kypvalanx/Foundry-VTT-StarWars-SagaEdition)
by **Andy Lijewski** ([@kypvalanx](https://github.com/kypvalanx)), who created
and continues to maintain the original system. All of the foundational work -
the data model, the original compendium content, and the core rules
implementation - traces back to that project. If you're looking for the
actively-maintained, publicly-distributed version of this system (not this
personal fork), that's the one to use:

- Repo: <https://github.com/kypvalanx/Foundry-VTT-StarWars-SagaEdition>
- Discord: <https://discord.gg/tGpxsrH9Em>
- Support Andy: [Patreon](https://www.patreon.com/stagnu) · [Ko-fi](https://ko-fi.com/A0A1BJ400)

### Icon art

Many item/feat/talent/power icons come from the
[Foundry VTT Starfinder 2e (sf2e)](https://github.com/foundryvtt/sf2e) system,
which in turn sources most of its icon set from
[game-icons.net](https://game-icons.net), created by **Lorc**, **Delapouite**,
and contributors, licensed under the
[Creative Commons Attribution 3.0 Unported License (CC BY 3.0)](https://creativecommons.org/licenses/by/3.0/).

> Icons by Lorc, Delapouite & contributors (<https://game-icons.net>), used
> under the Creative Commons Attribution 3.0 Unported License
> (<https://creativecommons.org/licenses/by/3.0/>), sourced via the Foundry VTT
> Starfinder 2e system (<https://github.com/foundryvtt/sf2e>).

See [`icon/CREDITS.md`](icon/CREDITS.md) for the exact folder-by-folder
breakdown of what was sourced from where.
