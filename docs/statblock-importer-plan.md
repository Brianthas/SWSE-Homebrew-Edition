# SWSE Statblock Importer - Implementation Plan

Status: phases 1 to 4 built and verified live; phases 5 and 6 outstanding. Target: the baseline
`swse` system (not a separate module).

## Context

We want the equivalent of [5e-statblock-importer](https://github.com/Aioros/5e-statblock-importer)
for SWSE: paste a statblock from the SWSE fandom wiki, get a working actor.

The complication is that this fork is not RAW. The wiki publishes Saga Edition rules as printed;
`HOUSERULES.md` documents a substantially different ruleset. A naive importer produces exactly the
actors we already purged once.

### Why it goes in the baseline system, not a module

Every tool the importer needs is internal, non-public API:

- `resolveEntity()` in `module/compendium/compendium-util.mjs` already does name to compendium item,
  strips trailing `*`, and understands the `Weapon Focus (Pistols)` payload convention. That is the
  hardest single piece and it exists.
- `SWSEActor#addItems()` (`module/actor/actor.mjs:2774`) already takes the shape a statblock parses
  into, with `skipPrerequisite`, `suppressWarnings` and `returnFailures`.
- `processActor()` (`module/compendium/generation.mjs:4`) is already a statblock importer for the
  JSON form: create, `skipPrepare`, bulk add, re-prepare.

A module would reach through `game.swse` into all of it and break on every refactor, for no benefit
we can use: we do not need independent release cadence and there is no audience outside this fork.

### Why not a new simplified actor type

It was built and deliberately removed. `DetailFields.npc`
(`module/actor/data/templates/details.mjs:100-184`) is precisely a flat free-text statblock schema
(`species`, `classes`, `senses`, `lang`, `specialHp`, `immunities`, `atkOptions`, `talents`,
`feats`, `skills`, `possesses`). It is now wired only to vehicles, and the `npc` actor type
self-destructs into `character` on creation (`module/actor/actor.mjs:127-136`).

A flat type also loses the point of importing at all: real actors get rollable attacks from
`AttackDelegate`, working equipment, the condition track, and homebrew-correct derivation. A flat
card would need all of that bolted back on within a session or two of real play.

## The core decision: import identity, derive numbers

**Wiki statblock numbers are outputs of RAW. This fork computes different outputs from the same
inputs. Do not import the numbers.**

Verified divergences:

| Quantity | RAW (wiki) | This fork | Evidence |
|---|---|---|---|
| Lightsaber damage | 2d8 | **3d8** | `packs/_source/weapon/Lightsaber_*.json` `damageDie` |
| Beast level-1 HP | varies by CON/HD | **flat 24** | `packs/_source/classes/Beast_75RKn7O9gNje8E5m.json` `firstLevelHitPoints` |
| Heroic BAB | class table | **= level** | `HOUSERULES.md` Classes |
| Class Defense bonus | per class | **4 assignable points (8 at L10)** | `HOUSERULES.md` Classes |
| Feats per level | heroic only | **every odd level as well** | `HOUSERULES.md` Feats |

Darth Vader's printed `Lightsaber +23 (2d8+17)` is wrong here in both the die and, downstream, the
attack bonus. Kath Hound's printed 18 HP is wrong against a fork Beast 4 (24 + 3 HD + CON).

This reverses the "pin the printed number via `system.overrides`" instinct. Pinning RAW outputs onto
a homebrew chassis is what makes an unusable sheet: the header numbers contradict the actor's own
items, and the attacks still roll the fork's dice. So:

**Transfers (inputs):** name, size, CL (cosmetic), ability scores, species, classes and their level
counts, feats, talents, force powers/secrets/techniques, languages, gear, beast components, and the
*set* of trained skills.

**Does not transfer (outputs):** HP, Reflex/Fortitude/Will, damage threshold, BAB, grapple, attack
bonuses, damage dice, speed, initiative.

`system.overrides.{ref,fort,will,health}` stays available, but as a per-field opt-in offered in the
divergence report, never as the default.

## What actually breaks, measured

The purged `units-cl-*` compendia are the control group. All 2317 were extracted from `18f58660^`
and every `providedItems` entry resolved against today's packs using the system's own matching
rules:

```
units with providedItems:        2317
units that import 100% clean:     124  (5.4%)
item references:                65747
unresolved references:           7809  (11.9%)
distinct unresolved names:        619
```

**94.6% of those actors had at least one dead reference.** That is why they were unusable, and it
happened because they were bulk-imported with no report and no gate, so the breakage was only ever
discovered in play.

The distribution is the good news. Unresolved references by type:

```
language 2256 | feat 2094 | class 1237 | item 790 | talent 756
affiliation 271 | background 128 | destiny 119 | species 113 | (rest <25)
```

Top offenders, and nearly every one is a documented houserule:

```
1281  language: Unassigned      (data artifact in the old packs, not a rules divergence)
 938  feat: Point-Blank Shot    (deleted)
 518  class: Scoundrel          (merged into Smuggler)
 516  class: Scout              (merged into Smuggler)
 362  feat: Precise Shot        (deleted)
 308  talent: Deflect           (merged into Dueling Stance)
 254  talent: Block             (merged into Dueling Stance)
 234  feat: Weapon Finesse      (deleted)
 215  feat: Dodge               (deleted)
 170  feat: Melee Defense       (deleted)
 141  talent: Redirect Shot     (merged into Redirection Stance)
 137  feat: Power Attack        (deleted)
```

Coverage curve for a hand-written alias table:

```
entries | refs fixed | units 100% clean
      0 |       0.0% |  5.4%
     12 |      65.0% | 36.3%
     30 |      73.2% | 48.6%
    100 |      84.4% | 65.6%
    300 |      95.2% | 88.0%
    619 |     100.0% | 100.0%
```

**Read that as: a table is worth building, but a table alone is not the answer.** Twelve entries fix
two thirds of all broken references, and those twelve are writable straight from `HOUSERULES.md`.
Getting to 88% of actors clean would need roughly 300 hand entries, which is not worth authoring up
front for a corpus we will never import wholesale. The tail has to be handled by review-and-learn.

## Design

### Pipeline

1. **Input.** URL box or paste box. Verified working:
   `https://swse.fandom.com/api.php?action=parse&page=Kath_Hound&prop=wikitext&format=json&origin=*`
   returns `Access-Control-Allow-Origin: *` and passes Cloudflare, so Foundry can fetch it directly
   from the browser. Prefer wikitext over pasted rendered text, because
   `[[Lightsaber (Weapon)|Lightsaber]]` hands us the exact compendium name the display text hides.
   Keep paste as a fallback.
2. **Parse** to a neutral `StatblockData` object. No Foundry dependency, so it is unit-testable.
3. **Map** `StatblockData` plus aliases to a `providedItems` payload plus a report.
4. **Review dialog.** Show mapped / dropped-by-houserule / unresolved. Bryan resolves the unresolved
   inline. **Nothing is created until he confirms.** This gate is the entire difference from the
   purged compendia.
5. **Create** by handing the payload to the existing `processActor()`.
6. **Divergence report.** Printed vs derived for HP, the three defenses, damage threshold, BAB,
   grapple, and per-attack damage. Each row gets a "pin printed value" checkbox that writes
   `system.overrides.*`. Default off.
7. **Learn.** Write manual picks back into a world-setting alias overlay.

### The parse target

The wiki format is far more regular than 5e statblocks. Verified identical skeleton on Kath Hound,
Rancor, Stormtrooper and Darth Vader:

```
== <Name> Statistics (CL n) ==
<Size> <Species> <Class> <n>[/<Class> <n>...]      or   <Size> [[Beast]] <n>
'''Destiny Points:''' / '''Force Points:''' / '''Dark Side Score:'''     (optional)
'''Initiative:''' +n; '''Senses:''' ...
'''Languages:''' ...                                                     (optional)
=== Defenses ===   Reflex/Flat-Footed/Fortitude/Will, Hit Points, Damage Threshold,
                   Immune, Weaknesses
=== Offense ===    Speed, Melee:/Ranged: lines, Fighting Space, Reach, BAB, Grapple,
                   Attack Options, Special Actions, Force Power Suite,
                   Force Secrets, Force Techniques
=== Base Stats === Abilities, Talents, Feats, Skills, Possessions
=== Abilities ===  free prose, goes to biography                         (optional)
```

Parse section by section against that skeleton. Anything unrecognised goes to the biography verbatim
rather than being silently dropped.

### Mapping, in three tiers

**Tier 1 - resolver improvements. No table entries.** Mechanical variance that a rule handles:

- Quantity suffix: `Claws (2)` to `Claw` x2. Verified: `packs/_source/beast-components/` contains
  `Claw`, not `Claws`.
- Numeric payload: `Fast Healing 5` resolves to the beast component `Fast Healing 5`, or to the
  trait `Fast Healing` with payload 5.
- Search a **type set**, not one type. A "Species Traits:" line can yield `trait`, `beastQuality` or
  `beastSense`. Getting this wrong accounted for 2 of the 8 misses in a hand test of four statblocks.
- Naive singularisation as a last resort.

**Tier 2 - curated alias table.** This is the real deliverable, and it is small. Entry shape:

```json
{
  "from": {"type": "talent", "name": "Block"},
  "to":   {"type": "talent", "name": "Dueling Stance"},
  "reason": "HOUSERULES.md#jedi - Block and Deflect merged into Dueling Stance",
  "collapse": true
}
```

- `to: null` means intentionally deleted. Reported as "dropped by houserule", **not** as an error.
  This distinction matters: an error the GM must act on and a rules change he already made must not
  look the same in the report.
- `collapse: true` means many-to-one, deduplicated. Vader carries both Block and Deflect and must
  end up with exactly one Dueling Stance.
- `reason` cites the houserule, so an entry is auditable and findable when the houserules change.

Seed set, all writable directly from `HOUSERULES.md` today:

| From | To | Houserule |
|---|---|---|
| feats Dodge, Melee Defense, Point-Blank Shot, Power Attack, Power Blast, Precise Shot, Unstoppable Combatant, Vitality Surge, Weapon Finesse | `null` | Feats |
| talents Block, Deflect | Dueling Stance (collapse) | Jedi |
| talents Redirect Shot, Riposte | Redirection Stance (collapse) | Jedi |
| classes Scoundrel, Scout | Smuggler | Classes |
| prestige classes Assassin, Charlatan, Corporate Agent, Enforcer, Gladiator, Improviser, Infiltrator, Master Privateer, Medic, Military Engineer, Outlaw, Pathfinder, Saboteur, Shaper, Spy, Vanguard | `null` | Prestige Classes |
| skills Climb, Jump, Swim | Athletics | Skills |
| skills Knowledge (Life Sciences), Knowledge (Physical Sciences), and the other hard-science Knowledges | Knowledge (Sciences) | Skills |

Roughly 35 entries, covering the entire measured head. The skill rows hit the very first example:
Kath Hound's only skill is `Jump +9`, and `defaultSkills` in `module/common/constants.mjs:664` has
no Climb/Jump/Swim. Cross-check against `scripts/tag-skill-substitutions.mjs`, which already encodes
some of this.

Toughness needs no entry. It still exists under its own name; only its effect changed, and the
effect lives in the pack item. The importer adds the item and the fork's version applies. **Any
houserule that changes an item's effect rather than its name needs no table entry at all**, which is
a large fraction of `HOUSERULES.md` and it is free.

**Tier 3 - gear, by category not by name.** This cannot be a name table. The fork ships 4 armors
(Assault, Battle, Mesh, Power) and 34 weapons against the wiki's hundreds; 790 unresolved `item`
references across the corpus. Map by group instead:

- Armor: RAW armor type to one of the 4 (Light to Mesh, Medium to Battle, Heavy to Assault or
  Power), plus a small explicit table for frequently seen named armors (Stormtrooper Armor to Battle
  Armor, 42 references).
- Weapons: RAW weapon group to the fork's `system.subtype` (`Pistols`, `Rifles`, `Advanced Melee
  Weapons`, `Simple Melee Weapons`, `Lightsabers`, `Heavy Weapons`), then offer the fork's items in
  that group as a dropdown.

Tier 3 is always a review-dialog decision the first time, then learned.

### Learned mappings

Manual picks persist to a world setting (`swse.statblockAliases`), consulted after the shipped
table. This is what makes the tail tractable: we will never import 2317 units, only the NPCs
actually used at the table, so the table converges on real usage instead of on a theoretical corpus.
A "promote learned aliases" button dumps the setting as JSON to paste into the repo file, so
anything durable graduates into version control.

### Validation - the part that prevents silent rot

A hand-maintained table's failure mode is quietly pointing at nothing after a pack rename. A Quench
suite under `module_test/quench/import/` must assert:

1. Every non-null `to` in the shipped table resolves in the compendia.
2. Every `from` in the table does **not** resolve. An entry whose source name came back is stale and
   is now shadowing a real item.
3. Three or four checked-in fixture statblocks (Kath Hound, Stormtrooper, Rancor, Vader wikitext)
   round-trip through parse and map to the expected `providedItems`.

Checks 1 and 2 are the ones that earn their keep.

## Files

New, under `module/import/`:

- `statblock-parser.mjs` - wikitext to `StatblockData`. No Foundry dependency.
- `statblock-mapper.mjs` - `StatblockData` plus aliases to actor payload plus report.
- `statblock-aliases.json` - the curated table.
- `statblock-import-app.mjs` - review UI. Model on `module/item/item-sheet.mjs`, the only
  first-party ApplicationV2 Handlebars app in the codebase. Simple prompts can use `DialogV2` as in
  `module/common/dialog.mjs:5`.
- `templates/import/statblock-import.hbs` and `templates/import/divergence-report.hbs`, registered
  in the partial preload at `module/swse.mjs:160`.

Touched:

- `module/swse.mjs` - expose the app on `game.swse`; add a `renderActorDirectory` hook button
  following the idempotent pattern at `module/compendium/compendium-web.mjs:738-776`. It **must**
  remove its own previous container before appending; skipping that is what filled the compendium
  sidebar with duplicate buttons before.
- `module/settings/core.mjs` - register the `statblockAliases` world setting.
- `module/compendium/generation.mjs` - let `processActor` accept a pre-built payload and skip the
  beast natural-armor step when the caller has already reconciled defenses.
- `README.md` and the changelog, in the same commit, per the working agreement.

## Verification

- Quench: the three assertions above, plus the existing suites still green.
- Live, via `foundry-console-tools`: import Kath Hound, Stormtrooper and Rancor by URL. Then
  `node cdp-eval.mjs` to read back the created actor and confirm, on the artifact rather than the
  intent:
  - Kath Hound has an `Athletics` trained skill and no `Jump`, and two `Claw` beast attacks.
  - Rancor reports Power Attack as *dropped by houserule*, not as an error.
  - Vader has exactly **one** Dueling Stance and one Redirection Stance.
  - BAB and HP match the fork's derivation, not the printed value, with the divergence report
    showing the gap.
- Open each sheet and roll one attack. A statblock that imports but cannot roll is not done.

## Phasing

1. ~~Parser plus checked-in fixtures plus unit tests.~~ Done.
2. ~~Tier 1 resolver improvements, tier 2 seed table, validation suite.~~ Done.
3. ~~Review dialog and the create path through `processActor`.~~ Done.
4. ~~Divergence report with selective override pinning.~~ Done.
5. Learned aliases and the promote button.
6. Tier 3 gear mapping.

Phases 1 to 3 are independently useful and worth shipping before the rest exists.


## Build log

### Phases 1 and 2, done

- `module/import/statblock-parser.mjs` - wikitext to StatblockData, no imports at all.
- `module/import/statblock-mapper.mjs` - StatblockData plus aliases to an actor payload and a
  report. Compendium access is injected as `resolve`, so it runs offline against `packs/_source` in
  tests and against live compendia in Foundry.
- `module/import/statblock-aliases.json` - 36 seeded entries.
- `module_test/statblock-parser.test.mjs` and `module_test/statblock-aliases.test.mjs` - 38 tests,
  under plain `node --test`. They do NOT use `module_test/setup.mjs`, whose Foundry mocks are
  incomplete: the module graph throws "Handlebars is not defined" at `module/common/helpers.mjs:401`
  and `npm test` is red before any of this. Keeping the parser and mapper import-free is what makes
  them testable at all.
- Fixtures: Kath Hound, Rancor, Stormtrooper and Darth Vader wikitext in
  `module_test/resources/statblocks/`.

Verified live against Foundry 14.365, world `swse-testing`, over CDP. All four parse with nothing
left in `unparsed`. Darth Vader imports 51 items with zero failures, exactly one Dueling Stance
(Deflect collapsed onto it) and one Redirection Stance, and his lightsaber rolls

    3d8 + 9[Half Heroic Level] + 3[Attribute Modifier] + 2[Weapon Specialization]

which is this fork's 3d8 rather than the 2d8 the wiki prints. Rancor reports Power Attack as
dropped by house rule rather than as an error. Kath Hound maps Jump onto Athletics and gets two
Claw natural weapons at 1d3.

Fetching wikitext straight from the browser is confirmed working from Foundry's own origin, so the
URL input path in phase 3 needs no proxy.

### Phase 3, done

- `module/import/statblock-resolver.mjs` - the Foundry side: name plus candidate types to a real
  compendium entry, the substitution option lists, and the wiki fetch. Everything that needs `game`
  lives here so the mapper stays import-free.
- `module/import/statblock-import-app.mjs` - the review dialog (ApplicationV2 + Handlebars) and the
  `renderActorDirectory` button, plus `templates/import/statblock-import.hbs` and
  `scss/components/_statblock-import.scss`.
- Registered in `module/swse.mjs`: partial preload, `game.swse.applications.StatblockImportApp`, and
  `initializeStatblockImportButton()`.

The flow is: paste a page name, a wiki URL, or raw wikitext; read it; review what will be added,
what a house rule dropped, what was merged, and what could not be found; substitute or leave out
each unresolved entry; then create. **Nothing is written until Create actor is pressed.**

Verified live end to end through the real UI, not through the API: the sidebar button renders once
and stays at one across three directory re-renders (the idempotency trap that filled the compendium
sidebar with duplicates); a Stormtrooper imported from a wiki URL reports 12 mapped and 2
unresolved; substituting Battle Armor and Grenade produces a 15-item actor with all five gear items
equipped and attacks rolling Blaster Rifle 3d8 and Grenade 4d6.

### Phase 4, done

The import ends on a printed-versus-derived table rather than closing straight to the sheet. Each
row shows what the wiki printed, what this fork derived, the difference, and a checkbox where the
printed value can be pinned. Nothing is pinned by default: the derived numbers are the ones that
follow the house rules, and the table exists so the gap is visible rather than silent.

Pin targets, all confirmed live to take effect AND to restore the derived value when cleared:

| Value | Written to |
|---|---|
| Hit Points | `system.overrides.health` |
| Reflex / Fortitude / Will | `system.overrides.ref` / `.fort` / `.will` (note the short key names) |
| Damage Threshold | `system.defense.damageThreshold.misc`, as a difference from the derived value |

Base attack bonus, grapple, initiative, flat-footed Reflex and speed have no override anywhere in
this system, so they are shown for comparison and carry no checkbox. A checkbox that quietly did
nothing would be worse than none.

Verified live by ticking Hit Points ALONE on a Kath Hound: hit points became the printed 18 with
`overrides.health` set, while Reflex stayed at the derived 16 with `overrides.ref` still null and
`damageThreshold.misc` still 0. Pinning everything would have looked identical if the selection had
been ignored, which is why the check was done that way round.

Two bugs of mine found in that testing. Grapple was read from `actor.system.grapple`, which reads
back null - and transiently NaN - depending on when it is sampled; `actor.grapple` recomputes
correctly and is what the row uses now, with an explicit non-finite guard since NaN is neither null
nor undefined and rendered as the literal string "NaN". Speed was comparing "6 Squares" against
"Walk 25"; both sides are now reduced to feet at five feet per square, so a Small beast reads 30
printed against 25 derived.

### A fifth defect, this one mine

The first version of the resolver searched every Item pack. That made the review screen lie:
"Frag Grenade" exists only in `swse.legacy-weapons`, which `getCompendium("weapon")` does not
include, so the dialog promised it, `SWSEActor#addItem` could not find it, and it vanished with no
error on the actor. The resolver and the substitution lists now both go through `getCompendium()`,
so everything offered is something the add path can actually fetch. A report that names something
the importer cannot add is worse than no report at all.

### Four pre-existing defects found and fixed on the way

None of these were caused by the importer; all of them broke it.

1. `module/compendium/generation.mjs` - `processActor` read `actorData.system.providedItems` AFTER
   `SWSEActor.create()`. `providedItems` is a declared field on Items but not on the actor
   DataModel, and `create()` cleans the object it is handed IN PLACE, so the read returned
   undefined. Every actor came out with zero items and zero reported failures. Now snapshotted
   before the create.
2. `module/actor/actor.mjs` - `addItems` expanded `quantity: 4` into four references to the SAME
   object, so a class with `firstLevel: true` took `nextLevel = 1` four times over. `levelsTaken`
   came out `[1,1,1,1]` and first-level hit points were charged four times: a Beast 4 had 100 HP
   instead of 31. Each expansion is now its own copy and only the first keeps `firstLevel`.
3. `module/compendium/compendium-util.mjs` - `getCompendium` had no case for `equipment`,
   `implant`, `hazard`, `droid system`, `beastQuality` or `beastSense`, though all six have packs.
4. `module/compendium/compendium-util.mjs` - `getIndexAndPack` returned `{}` where callers expect an
   array, so `getIndexEntryByName`'s `lookups.length === 0` guard passed (`undefined !== 0`) and
   threw "lookups is not iterable". One unknown item type aborted an entire import. It now returns
   `[]`, and the guard returns a miss-shaped object instead of bare `undefined`.

### Open questions for Bryan

- **Trained skills are dropped on some actors.** The importer writes `trained: true` into
  `_source.system.skills` correctly - verified on both actors - but the derivation keeps Kath
  Hound's Athletics and discards Rancor's Perception. Both have INT 2, both have
  `availableTrainedSkillCount === 1`, and both have exactly one trained skill stored, so it is not
  the budget cap. Needs a look at `_prepareSkillDerivedData` in
  `module/actor/data/templates/skills.mjs`.
- **`getResolvedSize` ignores `system.size`.** It reads the `size` inheritable attribute off an item
  and starts at `sizeIndex` 0, which is Fine, so an actor with no size TRAIT resolves every
  `...Scalable` change at Fine. The importer works around it by adding the size trait when there is
  no species to supply one, but the two sources of truth for size disagree and that will bite again.
- **Ride has no home.** RAW has a Ride skill; `defaultSkills` does not, and `HOUSERULES.md` does not
  say where it went. Left out of the alias table deliberately rather than guessed at, so it will
  surface as an unresolved skill on any statblock that has it.
