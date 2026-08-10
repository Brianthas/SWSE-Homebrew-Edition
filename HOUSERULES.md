# House Rules

These are the table's homebrew rules for our SWSE (Star Wars: Saga Edition)
campaign, originally compiled at
[tovec.wikidot.com/episode-vii](http://tovec.wikidot.com/episode-vii). This
system fork implements them (with a few noted below still in progress).
Reproduced here for reference alongside the code that implements them.

## Table of Contents

- [Character Creation](#character-creation)
- [Species](#species)
- [Languages](#languages)
- [Classes](#classes)
- [Skills](#skills)
- [Feats](#feats)
- [The Force](#the-force)
- [Equipment](#equipment)
- [Droids](#droids)
- [Armor](#armor)
- [Weapons](#weapons)
- [Combat](#combat)
- [Healing](#healing)
- [Prestige Classes](#prestige-classes)
- [Non-Player Characters](#non-player-characters)
- [Companion](#companion)

## Character Creation

- Characters must be built with **25 point buy**, using the Pathfinder
  measurement — maximum of 18 and minimum of 8. This is before species
  adjustments. You may choose to reduce below 8 but there is no bonus given
  for doing so.
- Use **Intelligence** for "number known" abilities, including number of
  Force Powers for Force Training.
- Using the Force requires **Wisdom** instead of Charisma.

## Species

The following adjustments replace any relevant factors for species and are
not in addition to them. Some species will have additional adjustments, such
as Hutts.

| Size   | Ability Scores                        | Speed  | Stealth        | Unarmed Dmg |
|--------|----------------------------------------|--------|----------------|-------------|
| Medium | +2 Any                                 | 30 ft. | n/a            | d6          |
| Large  | +2 STR, -2 DEX, and +2 Any             | 30 ft. | -5 Misc.       | d8          |
| Small  | +2 DEX, -2 STR, and +2 Any             | 25 ft. | Skill Training | d4          |

- Small species may not have their "any" apply to Dexterity. Small Droids
  are the exception which may.
- If the species previously had Skill Training in Stealth, they get Skill
  Focus in Stealth instead.
- Droids now have a Constitution Score. They are also no longer blanket
  immune to all mind-affecting effects — they are still granted partial or
  full immunity against effects that attempt to violate their programming.
- Primitive does have implications, but does not limit your starting weapon
  proficiency options. Primitive species gain another trained skill as a
  bonus.

## Languages

| Intelligence | Understands                    | Speaks (one of)                |
|--------------|---------------------------------|----------------------------------|
| 8            | Galactic Basic, Huttese, or Ryl | —                                |
| 10           | Galactic Basic, Huttese, or Ryl | Galactic Basic, Huttese, or Ryl |
| 12           | Commons, including Binary       | Galactic Basic, Huttese, or Ryl |
| 16           | Commons and Rares               | Galactic Basic, Huttese, or Ryl |
| 20           | Commons, Rares, and Secrets     | Galactic Basic, Huttese, or Ryl |

- Characters always understand and speak their Species language.
- **Linguist** effectively considers the character's Intelligence to be 4
  higher for the purposes of understanding languages. It also grants the
  ability to speak another language of their choice, assuming they are
  physically capable.
- A character with the **Primitive** Species trait is considered to have
  Intelligence 2 lower for the purposes of understanding and speaking
  languages.
- Species without human-like mouth and throat structure are usually
  incapable of speaking Basic regardless of intelligence total.
- Only droids without a Vocabulator are capable of speaking Binary, and it
  is considered their Species language. Droids with a Vocabulator lose the
  ability to speak Binary but are granted another language as their default
  Species language, as dictated by their manufacturer or that of the
  Vocabulator's manufacturer — they keep understanding of Binary regardless
  of Intelligence total.

## Classes

|                       | Jedi                                              | Noble                              | Smuggler                                  | Soldier                                   |
|-----------------------|----------------------------------------------------|-------------------------------------|---------------------------------------------|---------------------------------------------|
| HP at level 1         | 30                                                 | 18                                  | 24                                           | 30                                           |
| Hit Dice (HD)         | d10                                                | d6                                  | d8                                           | d10                                          |
| Trained Skills        | 4+INT                                              | 6+INT                               | 5+INT                                        | 4+INT                                        |
| Weapon Proficiencies  | Advanced Melee, Lightsabers, Pistols, Simple       | Advanced Melee, Pistols, Simple     | Advanced Melee, Pistols, Rifles, Simple      | Advanced Melee, Pistols, Rifles, Simple      |
| Starting Feats        | Force Sensitivity                                  | Linguist                            | Quick Draw                                   | Armor Proficiency                            |

- All Heroic and Prestige Classes have BAB equal to Level.
- There is no longer a list of skills per class. Characters may choose to
  train in any skills they wish. Maximum number of trained skills is still
  based on Class Bonus + INT.
- There is no longer a list of feats per class. Characters may choose to
  train in any feat they qualify for when gaining a non-specified feat from
  any source.
- There is no longer a default class bonus to Defenses per class. Instead,
  all Heroic Characters are granted 4 points which they may assign to
  whichever Defenses they wish, to a maximum of 2 to a single Defense. At
  level 10 this increases to 8 points and 4 maximum to a single Defense.
- Multiclassing Hit Die for Healing is the highest Hit Die of all classes
  taken.

### Jedi

- Block and Deflect is now one talent called **Dueling Stance**. Likewise,
  Redirect Shot and Riposte now merge into a new talent called
  **Redirection Stance**, allowing one free counter-attack per turn,
  assuming you manage to negate the attack.
- When using Lightsaber Throw, you may use the Force to attempt to recover
  a thrown weapon as a free action on your turn after everything has
  resolved. If you fail, you may Move Light Object to return your
  lightsaber as a Standard Action.
- Skill Focus for Use the Force requires level 10 and a justification.
- Characters need not be from the Jedi Order. If from another Tradition (or
  Order), you lose access to the Jedi talent trees and gain the talent tree
  associated with the chosen Tradition. With approval (including
  appropriate species-restrictions), other Traditions include: the Sith
  Order (use Believer Disciple, Blazing Chain, or Krath), Baran Do (Kel Dor
  only), Dathomiri Witches (use Dathomiri Witch, Disciple of Twilight, or
  Krath), Felucian Shamans (Felucian only), Ithorian Priesthood (Ithorian
  only), Imperial Legion (Jensaarai Defender or Kilian Ranger), Jal Shey,
  Keetael (Draethos only), Luka Sene (Miraluka only), Matukai, and Order of
  Shasa (Selkath only) — more may be added as other traditions come up.
- The following talent trees are banned: Agent of Ossus, Aing-Tii Monk,
  Iron Knight, White Current Adept, and Zeison Sha Warrior.

### Noble

- Nobles gain access to the Fortune, Misfortune, Run and Gun, Smuggling,
  and Spy talent trees in addition to their normal talent trees.
- Nobles cannot take the Connections talent for money or contacts — those
  are roleplay effects.
- Noble Fencing Style adds Charisma to damage as well as attack. This
  effect only works on weapons wielded single-handed.

### Smuggler

- Scoundrels and Scouts have been combined into one class called
  **Smuggler**. They gain access to all talent trees associated with
  either Scoundrel or Scout, except Melkite Poisoner and Yuuzhan Vong
  Biotech.
- Sneak Attack is now +1 die, instead of +1d6.

### Soldier

- Soldiers gain access to the Awareness and Opportunist talent trees in
  addition to their normal talent trees.
- The Armor Specialist Tree has been retooled in accordance with the
  current Armor rules.

## Skills

- There is no longer a list of skills per class. Characters may choose to
  train in any skills they wish. Maximum number of trained skills is still
  based on Class Bonus + INT.
- No advanced uses of Skills from the books.
- A new Skill, **Athletics**, has been added, encompassing Climb, Jump, and
  Swim.
- A new Skill, **Biotech**, has been added — a Wisdom-based skill. The
  Biotech Surgery feat is still required when attempting to install a
  Biotech prosthesis.
- A new Skill, **Knowledge (Sciences)**, has been added, encompassing all
  other Science-based Knowledge skills.

## Feats

- There is no longer a list of feats per class. Characters may choose to
  train in any feat they qualify for when gaining a non-specified feat from
  any source.
- All characters now get a feat every odd level (1, 3, 5, 7, etc.), in
  addition to those granted by Heroic Classes.
- The following feats no longer exist: Dodge, Melee Defense, Point Blank
  Shot, Power Attack, Power Blast, Precise Shot, Unstoppable Combatant,
  Vitality Surge, and Weapon Finesse.
- **Toughness** grants 5 Hit Points plus 1 point per level, and adds +1 to
  any Healing received, as if an increase to Constitution. You can take
  Toughness more than once; the effects stack, except you do not receive an
  additional 5 HP each time.
- **Force Boon** grants 2 Force Points per day instead of 1, and increases
  your Destiny Point cap accordingly. You can only take Force Boon once.
- **Force Sensitivity**'s prerequisite is ignored — anyone can take it,
  including non-force sensitives and Droids.
- **Force of Personality** allows you to use Charisma in place of Wisdom
  for the Force.
- **Martial Arts I, II, and III** each now increase the number of dice by
  one per feat, instead of a die step per feat.
- **Greater Weapon Focus** is also a Feat or Talent, requiring Weapon Focus
  as a prerequisite. **Weapon Specialization** is considered a Feat or
  Talent, requiring Weapon Focus as a prerequisite. **Greater Weapon
  Specialization** is also a Feat or Talent, requiring Weapon
  Specialization as a prerequisite.

## The Force

- Use the Force checks use **Wisdom** instead of Charisma by default.
- All characters gain a number of Force Points per day depending on their
  level:
  - Level 1-5: 1 Force Point
  - Level 6-10: 2 Force Points
  - Level 11-15: 3 Force Points
  - Level 16-20: 4 Force Points
- Characters with Force Sensitivity gain 1 extra Force Point per day. Force
  Boon grants 2 extra Force Points per day.
- You also gain 1 Destiny Point per level, kept as a running total and lost
  when used. You can have a maximum number of Destiny Points equal to the
  amount of Force Points per day you receive.
- Removing one Dark Side Point requires a day spent in meditation and a DC
  20 Use the Force check. Spending a Destiny Point means you do not need
  the check or the time spent in meditation.

### Force Points

- Do not add 1d6 to a d20 roll. If used before rolling, roll 2d20 and
  choose which roll to use. If used after rolling, reroll the d20 and take
  the new roll.
- Recover a per-encounter or per-day ability, such as an expended Force
  Power, Talent, or Second Wind.
- Use a Force Power you do not have — this also gains you a Dark Side
  point. If you spend a Force Point or Destiny Point to increase the
  effect of a power, you gain one additional Dark Side point for each point
  spent.
- 3 Force Points can be used on any effect requiring 1 Destiny Point. You
  cannot increase your Destiny Point pool this way.

### Destiny Points

- Turn a critical hit into a regular hit.
- Automatic hit on an attack roll — can be done before or after the roll is
  made; this is NOT automatically a critical. If used before you roll, you
  can still roll to see if you get the natural 20 (which is a critical).
- Gain an immediate extra Standard Action on your turn.
- Reduce Dark Side score by 1 — this cannot return you to the light if you
  have completely fallen.
- Turn 1 Destiny Point into 3 Force Points. You keep these extra Force
  Points in a pool similar to your Destiny Point pool, separate from Force
  Points per day. The maximum of Force Points you can pool this way cannot
  exceed 3.

### Force Power Changes

- You DO NOT regain all expended Force Powers when you roll a natural 20.
- In order to maintain a power, you must succeed on a DC 10 + damage taken
  (after DR and SR). Applies to concentration effects, such as Force Grip
  or Move Object, but not recurring effects such as Battle Strike from
  Combat Trance or extended Dark Rage.
- **Negate Energy** is essentially damage reduction for the attack equal to
  the Use the Force total. This still only applies to a single hit as your
  Reaction, and cannot negate Physical damage. It can be used on the same
  round as Dueling Stance, however it must be done in place of that roll
  and before the damage is known.
- **Dark Transfer** is removed. **Force Cloak** is removed.
- **Force Disarm** does benefit from the Improved Disarm feat.
- **Force Grip** is a dark side power.
- **Move Object** damage is capped to the size of the character or object
  being moved.

## Equipment

- You possess a number of **Light** slots equal to your Strength Score.
  Light objects include: Blaster Pistols, Datapads, Glowrods, Grenades,
  Lightsabers, Medical Stims, Personal Comlinks, Personal Holo Projectors,
  and Vox-boxes — essentially any item you can easily grasp in one hand.
- You possess a number of **Kit** slots equal to your Strength Modifier
  plus 1 (minimum 1). You can carry another Kit in your two hands. Kits
  include: Blaster Rifles, Climbing Kits, Electrobinoculars, Field Kits,
  Fuel Tanks, Hyperwave Transceivers, Jetpacks, Medical Kits, Portable
  Computers, Power Generators, Security Kits, Slicing Kits, Sniper Rifles,
  Survival Kits, and Toolkits — these objects are assumed to require both
  hands to carry.
- Characters of Large or Larger possess additional Light and Kit slots
  (handled case by case). Characters of Small or Smaller lose one Kit slot
  per size category — they retain the ability to carry a Kit in their
  hands, though it may require extra effort.
- **Extended Capacity** (a new feat) doubles your carrying capacity — both
  Light and Kit slot totals.
- **Integrated Equipment** takes up twice as many slots.
- **Vocal Modulators** cost 5,000 and modify speech to allow their user to
  achieve specific sounds they cannot achieve with their original vocal
  arrangements.
- No dual/multi-colour lightsaber crystals. No missile, rocket, or torpedo
  weapons are available for use outside of starship scale. No
  wrist-mounted weapon variants. No personal shields.

## Droids

- Translator Units cost 5,000 credits and effectively consider the
  Intelligence of the Droid to be 4 higher for the purposes of
  understanding languages. Assuming the Droid can speak, it also grants
  the ability to speak one other language (usually Basic, Huttese, or
  Ryl). This item does stack with Linguist.
- Individual translation packs cost 50 credits (modified by rarity), must
  be installed one at a time, taking one hour per language.
- Vocabulators cost 1,000 and allow a Droid to speak any language it
  knows. Without a Vocabulator they can only speak Binary. Once a Droid has
  a Vocabulator it is incapable of speaking Binary, and is granted another
  language as its default Species Language, as determined by its
  manufacturer or the Vocabulator's manufacturer.

## Armor

| Armor Type    | Dexterity Bonus     | Special Properties                    | Beskar Upgrade          |
|---------------|----------------------|-----------------------------------------|---------------------------|
| Assault Armor | STR instead of DEX  | —                                        | Damage Reduction 2/-     |
| Battle Armor  | 4                    | Damage Reduction 2/Lightsabers          | Damage Reduction 5/-     |
| Mesh Armor    | 5                    | No Speed or Armor Check Penalties       | Damage Reduction 2/-     |
| Power Armor   | 4                    | +2 Strength Score                       | Damage Reduction 2/-     |

- All armors reduce your speed by 5 feet and have an Armor Check Penalty of
  2.
- All armors have 1 Upgrade Point.
- The only way you are getting Beskar'gam is if you are a Mandalorian.

## Weapons

### Simple Weapons

| Weapon                | Size    | Damage                     | Special                                                              |
|------------------------|---------|------------------------------|-------------------------------------------------------------------------|
| Bow and Crystal Arrows | 2 Kits  | 2d8 Physical                 | —                                                                        |
| Combat Gloves          | Light   | +1 Die Unarmed Physical      | —                                                                        |
| Crystal Macuahuitl     | Kit     | Varies Physical              | Damage is 2d8 (1 handed) or 2d10 (2 handed)                             |
| Crystal Tepoztopilli   | Kit     | 2d8 Physical                 | Damage becomes 2d10 if using a launcher (separate kit)                  |
| Crystal Tomahawk       | Light   | 2d6 Physical                 | Can be thrown. Reduces penalties for dual-wielding by 2, min 0.         |
| Grenade                | Light   | 4d6 Varies                   | Half damage on a miss. 2 square burst is at -5.                        |
| Power Gloves           | Light   | +1 Die Unarmed Energy        | —                                                                        |
| Shock Gloves           | Light   | +1 Die Unarmed Stun          | —                                                                        |
| Staff                  | Kit     | 1d6/1d6 or 1d8[2h] Physical  | —                                                                        |

### Advanced Melee Weapons

| Weapon        | Size    | Damage              | Special                                                                          |
|----------------|---------|------------------------|-------------------------------------------------------------------------------------|
| Electrostaff   | Kit     | 3d6/3d6 Energy         | Reduces penalties for dual-wielding by 2, min 0.                                    |
| Fire Blade     | Light   | 3d4 Energy             | Provides +5 to Stealth checks to conceal.                                           |
| Laser Axe      | Kit     | 3d10 Energy            | Requires two-hands.                                                                  |
| Shock Stick    | Kit     | 3d8 Physical or Stun   | Requires two-hands. Switch between damage types as a Swift Action.                  |
| Stun Baton     | Light   | 3d6 Physical or Stun   | Switch between damage types as a Swift Action.                                      |
| Vibroaxe       | Kit     | 3d10 Physical          | Requires two-hands.                                                                  |
| Vibroblade     | 2 Light | 3d8 Physical           | May be wielded one or two-handed.                                                    |
| Vibroknife     | Light   | 3d4 Physical           | Can be thrown. Provides +5 to Stealth checks to conceal. Reduces dual-wield penalty by 2, min 0. |
| Vibrostaff     | Kit     | 3d6/3d6 Physical       | Reduces penalties for dual-wielding by 2, min 0.                                    |

### Lightsabers

| Weapon           | Size  | Damage        | Special                                                             |
|-------------------|-------|-----------------|-------------------------------------------------------------------------|
| Lightsaber        | Light | 3d8 Energy      | May be wielded one or two-handed.                                       |
| Lightsaber Staff  | Light | 3d6/3d6 Energy  | Reduces penalties for dual-wielding by 2, min 0.                        |
| Shotosaber        | Light | 3d6 Energy      | Cannot be wielded two-handed. Reduces penalties for dual-wielding by 2, min 0. |

### Pistols

| Weapon           | Size  | Damage             | Special                                                     |
|-------------------|-------|-----------------------|------------------------------------------------------------------|
| Blaster Pistol    | Light | 3d6 Energy or Stun    | Switch between damage types as a Swift Action.                   |
| Hold-out Blaster  | Light | 3d4 Energy             | Provides +5 to Stealth checks to conceal.                        |
| Pulse Pistol      | Light | 3d8 Energy             | —                                                                  |
| Sonic Pistol      | Light | 2d6 Sonic              | Sonic damage cannot be deflected. Has shorter range.              |

### Rifles

| Weapon         | Size | Damage             | Special                                                                          |
|-----------------|------|-----------------------|---------------------------------------------------------------------------------------|
| Blaster Carbine | Kit  | 3d6 Energy             | Half damage on a miss.                                                                |
| Blaster Rifle   | Kit  | 3d8 Energy or Stun     | Switch between damage types as a Swift Action.                                        |
| Pulse Rifle     | Kit  | 3d10 Energy            | —                                                                                       |
| Sniper Rifle    | Kit  | 3d12 Energy            | Must aim. Provokes attacks in melee range. Comes in Ion and Stun varieties as well.    |
| Sonic Rifle     | Kit  | 2d8 Sonic              | Sonic damage cannot be deflected. Has shorter range.                                   |

### Heavy Weapons

| Weapon           | Size    | Damage        | Special                                                                          |
|-------------------|---------|-----------------|---------------------------------------------------------------------------------------|
| Assault Cannon    | 2 Kits  | 3d12 Energy     | Requires power generator. May deal half damage on a miss at -5.                       |
| Flamethrower      | 2 Kits  | 4d6 Burn        | Requires fuel tank. 30 foot line. Half damage on a miss.                              |
| Repeating Cannon  | 2 Kits  | 3d10 Energy     | Requires power generator. Half damage on a miss. 1 square burst is at -5.             |
| Tactical Cannon   | 2 Kits  | 4d12 Energy     | Requires power generator. Must be placed on tripod as a Standard Action before use.   |

### General Weapon Rules

- All energy-damage weapons come in Ion or Stun damage variants. Droids and
  all other non-organic targets are immune to Stun Damage. Organic targets
  are immune to Ion Damage.
- Melee weapons can use STR or DEX for attack and damage. Two-handed
  weapons cannot use DEX, but provide STR x2 damage instead of STR. Double
  weapons can use STR or DEX as if using two separate single-handed
  weapons.
- Ranged weapons, including grenades, use DEX for attack and damage.
  Thrown weapons, including one and two-handed melee weapons, may use STR
  or DEX for attack and damage.
- Area Effects and Burst Effects can only crit on a Natural 20 when
  targeting a character. When attacking a square there is a -5 penalty and
  it must hit DC 10. Natural 20s always hit but do not provide a critical
  effect.

## Combat

| Size        | Tiny | Small | Medium | Large | Huge | Gargantuan |
|--------------|------|-------|--------|-------|------|------------|
| Base Damage  | d3   | d4    | d6     | d8    | d10  | d12        |

- No Condition Track.
- Damage Threshold at +5 is the Defense used to oppose various combat
  maneuvers, including forced movement, grapple, and disarm.
- Five foot step exists, but requires a Swift Action.
- Defensive Stance is a Full-Round Action which provides a +5 bonus to
  Defenses. In this stance you cannot take Actions, Reactions, or Attack,
  including making Attacks of Opportunity.
- A full attack action only requires a Standard Action, leaving Move and
  Swift Actions unused.

## Healing

- Healing is: Hit Die + CON + Level. The HD is the highest of any classes
  taken; Level is total character level.
- Droids benefit from all forms of healing as an organic character,
  however replace Medical Kit with Toolkit and Treat Injury with Mechanics
  check.
- **Second Wind** is a Swift Action. You can Second Wind in or out of
  combat, regardless of HP total, even multiple times per turn (if you
  have extra uses). You must be conscious and not helpless in order to
  Second Wind. It can be done before or after other sources of healing.
- **First Aid** is a DC 20 Treat Injury check. For every point you exceed
  the DC you heal an additional +1. This requires a Medical Kit or Healing
  Stim and a Standard Action, and the healer must be in an adjacent
  square. This form of healing can only be done once after the character
  is damaged, regardless of how much damage the character has taken
  (within reason). Failure results in the character being considered
  "healed" without gaining any HP.
- A Heroic character is **Staggered** when at exactly 0 HP — they can only
  take a single Standard Action (or less) on their turn. If they perform
  anything more strenuous than a Move Action they take 1 damage and begin
  dying.
- **Dying** is not Dead (yet), at least for Characters with Heroic Classes.
  A Dying character is Helpless — they lose concentration on any effects,
  cannot take any actions, and cannot activate or sustain any abilities. A
  Dying Character must be healed within a number of rounds equal to their
  level or else they die. Attacks against a Dying character are considered
  critical hits. You can have a maximum number of negative HP equal to
  your full normal HP before you die.
- Every round, a Dying Character can roll a d20 and on a Natural 20 is no
  longer dying and has 1 HP. If the character was successfully healed
  since the end of their last turn by any method (and returned to negative
  HP), they roll with Advantage. If damaged, they also roll with
  Disadvantage.
- Performing Treat Injury on a Dying Character requires a Medical Kit and a
  Standard Action. Before rolling, choose what action is attempted:
  1. DC 15 — the Dying Character is considered healed and gains no HP, but
     does roll an attempt to rise now and rolls with advantage for all
     future rolls (unless damaged again).
  2. Performing First Aid (as above) except at DC 30, which heals them as
     normal (beginning from 0 HP).
- Dead Characters may be revived via Surgery with a Treat Injury DC 30 +
  the number of rounds since they died (not including Dying). Surgery
  takes a minimum of one minute to perform, plus the elapsed time since
  they died. This revives them at 1 HP if successful, and they are
  limited to 50% of total HP for 1 day.
- Droids are special in relation to death and can be resurrected via
  various means — duration since death rarely matters when reviving a
  droid.

## Prestige Classes

- The only prerequisites for ANY Prestige Class are having Heroic Levels
  and roleplay justification. Specific abilities, talents, feats, or
  skills only matter if they impact a talent you plan to take.
- The following Prestige Classes do not exist: Assassin, Charlatan,
  Corporate Agent, Enforcer, Gladiator, Improviser, Infiltrator, Master
  Privateer, Medic, Military Engineer, Outlaw, Pathfinder, Saboteur,
  Shaper, Spy, and Vanguard.
- There is no longer a default class bonus to Defenses per class. Instead,
  all Heroic Characters are granted 4 points which they may assign to
  whichever Defenses they wish, to a maximum of 2 to a single Defense. At
  level 10 this increases to 8 points and 4 maximum to a single Defense.
- **Force Adepts** gain access to the Duelist, Korunnai Adept, and
  Lightsaber Forms talent trees.
- **Force Disciple** loses Indomitable and Prophet, may select talents
  from any Force Tradition (with some limitations), and gains access to
  Many Shades of the Force (independent from the Aing-Tii Monk talent
  tree).
- **Imperial Legionnaires** gain access to the Bando Gora Captain, Believer
  Disciple, Blazing Chain, Duelist, Jensaarai Defender, Kilian Rangers, and
  Lightsaber Forms talent trees. Praetoria Ishu does not require a Force
  Point to negate attacks on allies.
- **Jedi Knights** gain access to the Tyia Adept talent tree.
- **Jedi Master** loses Fearless and Serenity, may select talents from any
  Force Tradition (with some limitations), gains access to Many Shades of
  the Force (independent from Aing-Tii Monk), and gains access to the
  Duelist, Jedi Archivist, Jedi Instructor, and Lightsaber Forms talent
  trees.
- **Sith Apprentices** gain access to the Believer Disciple, Blazing
  Chain, Duelist, Lightsaber Forms, and Krath talent trees.
- **Sith Lord** loses Fearless and Temptation, may select talents from any
  Force Tradition (with some limitations), gains access to Many Shades of
  the Force (independent from Aing-Tii Monk), and gains access to the
  Believer Disciple, Duelist, Lightsaber Forms, Sith Alchemy, Sith
  Commander, and Krath talent trees.
- **Folded Space Mastery** allows a character to travel in hyperspace
  extremely slowly.
- **Bounty Hunter** gains the Gladiatorial Combat talent tree; the
  Unflinching ability (K 46) becomes a Gladiatorial Combat talent.
- **Martial Arts Masters** gain access to the Brawl talent tree.
- **Melee Duelist** gains the Fortune (Core 46), Privateer (FU 52), and
  Trickery (SaV 31) talent trees; the Score and Swindle abilities (SaV 32)
  become Trickery talents.

### New Prestige Classes

All three classes below have a d8 HD.

**Agent** — may select one of the following class abilities for free (the
others may be taken as talents): Create Cover (Reb 44), Executive
Leadership (K 44), Targeted Suspect ability (FU 46), and Veteran Privateer
(SaV 34). Gains access to these talent trees:

| Tree | Book | Page |
|---|---|---|
| Assassin | Knights of the Old Republic | 52 |
| Corporate Power | Knights of the Old Republic | 52 |
| Enforcement | Force Unleashed | 45 |
| Infamy | Core Rulebook | 210 |
| Leadership | Core Rulebook | 44 |
| Pathfinder | Rebellion Era | 45 |
| Piracy | Scum and Villainy | 33 |
| Privateer | Force Unleashed | 52 |
| Spy | Force Unleashed | 28 |

**Engineer** — may select one of the following class abilities for free
(the others may be taken as talents): Destructive Saboteur (FU 58),
Field-Created Weapon (CW 44), Fugitive (SaV 35), and No Tools Required
(Reb 42). Gains access to these talent trees:

| Tree | Book | Page |
|---|---|---|
| Improviser | Rebellion Era | 43 |
| Military Engineer | Clone Wars | 45 |
| Misfortune | Core Rulebook | 46 |
| Outlaw | Scum and Villainy | 34 |
| Outlaw Tech | Starships of the Galaxy | 16 |
| Procurement | Rebellion Era | 43 |
| Sabotage | Force Unleashed | 56 |
| Slicer | Core Rulebook | 47 |
| Turret | Force Unleashed | 47 |

**Operative** — may select one of the following class abilities for free
(the others may be taken as talents): Lead Infiltrator (FU 50), Surprise
Attack (CW 46), Mark (SaV 30), Unarmed Stun (FU 50). Gains access to these
talent trees:

| Tree | Book | Page |
|---|---|---|
| Assassin | Knights of the Old Republic | 52 |
| Awareness | Core Rulebook | 49 |
| Bothan Spynet | Force Unleashed | 50 |
| Camouflage | Core Rulebook | 49 |
| Genohardan | Scum and Villainy | 29 |
| Infiltration | Force Unleashed | 49 |
| Malkite Techniques | Threats of the Galaxy | 13 |
| Spy | Force Unleashed | 28 |
| Vanguard | Clone Wars | 47 |

> The Agent/Engineer/Operative table above was reconstructed from a
> flattened wiki export; double-check against the original page
> ([tovec.wikidot.com/episode-vii](http://tovec.wikidot.com/episode-vii))
> if a specific tree/book/page pairing matters at the table.

- Murderous Arts I and Murderous Arts II are removed. **Murderous Arts**,
  which has no prerequisites, has the effect of +1 die, unless you have
  Mark, in which case it is +2 dice.

### Turrets

Pick either Energy, Ion, or Stun for the weapon damage when you first gain
a turret talent — you may change it as if taking another talent in the
tree. Otherwise, due to the miniature and temporary nature of these
constructs, they cannot be modified or altered except by taking more
talents in the tree.

- **Blaster Turret I**: Size Tiny, Initiative +4, Perception +4, Reflex
  Defense 14 + INT, HP is 10 + LVL, attack equal to BAB + INT, dealing
  3d6 + INT damage.
- **Blaster Turret II**: Size Tiny, Initiative +8, Perception +8, Reflex
  Defense 18 + INT, HP is 15 + LVL, attack equal to BAB + INT + 2, dealing
  3d8 + INT damage.
- **Blaster Turret III**: Takes the effects of Blaster Turret II, plus the
  turret gains the ability to fire twice per round.

## Non-Player Characters

- Nonheroic Characters use 15 point buy.
- Most Droids, especially those without Heuristic Processors, should have
  Nonheroic levels only.
- Heroic Characters use 20 or 25 point buy, depending on role.
- Only Heroic Class Companions qualify for Prestige Classes, with the
  exception of the Independent Droid Prestige Class.
- Beasts may use 15, 20, or 25 point buy, depending on role. Do not
  increase Intelligence for Beasts — they have a 1 or 2 (but put a 10 into
  a calculator).
- Nonheroic Characters which become heroic characters should completely
  rebuild using Heroic Class levels, as opposed to merely adding Heroic
  levels on top of Nonheroic levels.

|                       | Beast          | Nonheroic                                     |
|-----------------------|-----------------|--------------------------------------------------|
| HP at level 1         | 24              | 18                                                |
| Hit Dice (HD)         | varies          | d6                                                |
| Trained Skills        | 2+INT (min 1)   | 2+INT (min 1)                                     |
| Weapon Proficiencies  | Natural         | Advanced Melee, Pistols, Rifles, and Simple       |

Weapon Proficiencies are in addition to the feats provided by leveling. NPC
Classes have a Base Attack and Level Bonus to Defenses equal to 3/4 their
total level.

Beast HD is based on size:

| Size     | Tiny | Small | Medium | Large | Huge | Gargantuan |
|-----------|------|-------|--------|-------|------|------------|
| Beast HD | d4   | d6    | d8     | d10   | d12  | d20        |

## Companion

- You may gain a Companion if you spend a feat or talent. If your
  Companion dies, a new Companion can be acquired.
- Companions are controlled by you, but are (usually) not mindless or
  suicidal. Companions are built using 15 point buy.
- Your Companion's level is tied to you:
  - A Nonheroic Class Companion has HD equal to your level.
  - A Beast Companion has HD equal to 3/4 your level (minimum difference
    of your level - 2).
  - A Heroic Class Companion has HD equal to 3/4 your level minus 1
    (minimum difference of your level - 2).
