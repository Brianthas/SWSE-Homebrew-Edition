// Local copy of CONST.ACTIVE_EFFECT_MODES's values. Reading that CONST directly logs a V14
// deprecation warning on every access (removed in V16); the underlying numbers it returns are
// unchanged, and that's all this system's own change-resolution logic (util.mjs) actually needs.
export const ACTIVE_EFFECT_MODES = Object.freeze({
    CUSTOM: 0,
    MULTIPLY: 1,
    ADD: 2,
    DOWNGRADE: 3,
    UPGRADE: 4,
    OVERRIDE: 5
});

export const PHYSICAL_SKILLS = ["strength", "dexterity", "constitution"];
export const dieSize = ["1", "1d2", "1d3", "1d4", "1d6", "1d8", "2d6", "2d8", "3d6", "3d8"];
export const dieSize_vanilla = ["1", "1d2", "1d3", "1d4", "1d6", "1d8", "1d10", "1d12"];
export const dieType = ["1", "2", "3", "4", "6", "8", "10", "12"];
export const sizeArray = ["Fine", "Diminutive", "Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan", "Colossal", "Colossal (Frigate)", "Colossal (Cruiser)", "Colossal (Station)"];
// Fine-Colossal, but not the starship-scale Colossal (Frigate)/(Cruiser)/(Station) variants — no
// beast in this campaign is ship-scale; a starship-sized creature is just "Colossal".
export const beastSizeArray = ["Fine", "Diminutive", "Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan", "Colossal"];
// Core damage/availability enums for the typed gear-type item sheets (Item Schema & Sheet
// Overhaul, Track A) — legacy compendium data has messier free-text variants (typos, combined
// "X, Y" values); these dropdowns cover the common case, an unmatched legacy value just shows
// as unselected until manually reselected.
export const DAMAGE_TYPES = ["Bludgeoning", "Piercing", "Slashing", "Energy", "Ion", "Sonic", "Stun", "Fire", "Physical"];
// The homebrew consolidates vanilla's Bludgeoning/Piercing/Slashing into plain Physical and uses
// Burn rather than Fire, so this is what a weapon can actually deal at this table. DAMAGE_TYPES
// above is kept for the item sheet, where legacy weapons still carry the vanilla types.
// Alphabetical, since this is rendered straight into a picker.
export const HOMEBREW_DAMAGE_TYPES = ["Burn", "Energy", "Ion", "Physical", "Sonic", "Stun"];
export const AVAILABILITY_TYPES = ["Licensed", "Restricted", "Military", "Rare", "Illegal"];
// Homebrew "Beast HD" table — the Beast class's per-level-up hit die scales by the
// creature's size instead of being a flat die like every other class. Only consulted for
// beast-type actors' own Beast class levels (see SWSEItem#levelUpHitPoints). Tiny-Gargantuan
// are Bryan's original chart; Fine/Diminutive (below) and the Colossal tiers (above) extend
// the same progression — step-down by die size on the small end, step-up by dice count on the
// large end, matching how this system already scales other things (e.g. unarmed damage) past
// a single die's range.
export const BEAST_HIT_DIE_BY_SIZE = {
    Fine: "1", Diminutive: "1d2", Tiny: "1d4", Small: "1d6", Medium: "1d8",
    Large: "1d10", Huge: "1d12", Gargantuan: "1d20",
    Colossal: "2d12",
};
export const SIZE_CHANGES = {
    "Fine" : [
        {"key" : "reflexDefenseBonus","value" : "10","mode" : 2},
        {"key" : "shipSkillModifier","value" : "10","mode" : 2},
        {"key" : "characterFightingSpace","value" : "1 square","mode" : 2},
        {"key" : "unarmedDamage","value" : "1","mode" : 2},
        {"key" : "skillBonus","value" : "stealth:20","mode" : 2},
        {"key" : "damageThresholdSizeModifier","value" : "0","mode" : 2},
    ],
    "Diminutive" : [
        {"key" : "reflexDefenseBonus","value" : "5","mode" : 2},
        {"key" : "shipSkillModifier","value" : "5","mode" : 2},
        {"key" : "characterFightingSpace","value" : "1 square","mode" : 2},
        {"key" : "unarmedDamage","value" : "1","mode" : 2},
        {"key" : "skillBonus","value" : "stealth:15","mode" : 2},
        {"key" : "damageThresholdSizeModifier","value" : "0","mode" : 2},
    ],
    "Tiny" : [
        {"key" : "reflexDefenseBonus","value" : "2","mode" : 2},
        {"key" : "shipSkillModifier","value" : "2","mode" : 2},
        {"key" : "characterFightingSpace","value" : "1 square","mode" : 2},
        {"key" : "unarmedDamage","value" : "1d2","mode" : 2},
        {"key" : "skillBonus","value" : "stealth:10","mode" : 2},
        {"key" : "damageThresholdSizeModifier","value" : "0","mode" : 2},
    ],
    "Small" : [
        {"key" : "reflexDefenseBonus","value" : "1","mode" : 2},
        {"key" : "characterFightingSpace","value" : "1 square","mode" : 2},
        {"key" : "shipSkillModifier","value" : "1","mode" : 2},
        {"key" : "unarmedDamage","value" : "1d4","mode" : 2},
        {"key" : "damageThresholdSizeModifier","value" : "0","mode" : 2},
    ],
    "Medium" : [
        {"key" : "reflexDefenseBonus","value" : "0","mode" : 2},
        {"key" : "characterFightingSpace","value" : "1 square","mode" : 2},
        {"key" : "shipSkillModifier","value" : "0","mode" : 2},
        {"key" : "unarmedDamage","value" : "1d6","mode" : 2},
        {"key" : "skillBonus","value" : "stealth:0","mode" : 2},
        {"key" : "damageThresholdSizeModifier","value" : "0","mode" : 2},
    ],
    "Large" : [
        {"key" : "reflexDefenseBonus","value" : "-1","mode" : 2},
        {"key" : "characterFightingSpace","value" : "4 squares","mode" : 2},
        {"key" : "shipSkillModifier","value" : "-1","mode" : 2},
        {"key" : "unarmedDamage","value" : "1d8","mode" : 2},
        {"key" : "skillBonus","value" : "stealth:-5","mode" : 2},
        {"key" : "damageThresholdSizeModifier","value" : "5","mode" : 2},
        {"key" : "grappleSizeModifier","value" : "5","mode" : 2},
    ],
    "Huge" : [
        {"key" : "reflexDefenseBonus","value" : "-2","mode" : 2},
        {"key" : "characterFightingSpace","value" : "9 squares","mode" : 2},
        {"key" : "shipSkillModifier","value" : "-2","mode" : 2},
        {"key" : "unarmedDamage","value" : "1d8","mode" : 2},
        {"key" : "skillBonus","value" : "stealth:-10","mode" : 2},
        {"key" : "damageThresholdSizeModifier","value" : "10","mode" : 2},
        {"key" : "grappleSizeModifier","value" : "10","mode" : 2},
    ],
    "Gargantuan" : [
        {"key" : "reflexDefenseBonus","value" : "-5","mode" : 2},
        {"key" : "characterFightingSpace","value" : "16 squares","mode" : 2},
        {"key" : "shipSkillModifier","value" : "-5","mode" : 2},
        {"key" : "unarmedDamage","value" : "2d6","mode" : 2},
        {"key" : "skillBonus","value" : "stealth:-15","mode" : 2},
        {"key" : "damageThresholdSizeModifier","value" : "20","mode" : 2},
        {"key" : "grappleSizeModifier","value" : "15","mode" : 2},
    ],
    "Colossal" : [
        {"key" : "shipSkillModifier","value" : "-10","mode" : 2},
        {"key" : "reflexDefenseBonus","value" : "-10","mode" : 2},
        {"key" : "unarmedDamage","value" : "2d8","mode" : 2},
        {"key" : "vehicleFightingSpace","value" : "1 square","mode" : 2},
        {"key" : "skillBonus","value" : "stealth:-20","mode" : 2},
        {"key" : "damageThresholdSizeModifier","value" : "50","mode" : 2},
        {"key" : "grappleSizeModifier","value" : "20","mode" : 2},
    ],
    "Colossal (Frigate)" : [
        {"key" : "shipSkillModifier","value" : "-10","mode" : 2},
        {"key" : "reflexDefenseBonus","value" : "-10","mode" : 2},
        {"key" : "unarmedDamage","value" : "2d8","mode" : 2},
        {"key" : "vehicleFightingSpace","value" : "1 square","mode" : 2},
        {"key" : "skillBonus","value" : "stealth:-20","mode" : 2},
        {"key" : "damageThresholdSizeModifier","value" : "100","mode" : 2},
        {"key" : "grappleSizeModifier","value" : "25","mode" : 2},
    ],
    "Colossal (Cruiser)" : [
        {"key" : "shipSkillModifier","value" : "-10","mode" : 2},
        {"key" : "reflexDefenseBonus","value" : "-10","mode" : 2},
        {"key" : "unarmedDamage","value" : "2d8","mode" : 2},
        {"key" : "vehicleFightingSpace","value" : "4 squares","mode" : 2},
        {"key" : "skillBonus","value" : "stealth:-20","mode" : 2},
        {"key" : "damageThresholdSizeModifier","value" : "200","mode" : 2},
        {"key" : "grappleSizeModifier","value" : "30","mode" : 2},
    ],
    "Colossal (Station)" : [
        {"key" : "shipSkillModifier","value" : "-10","mode" : 2},
        {"key" : "reflexDefenseBonus","value" : "-10","mode" : 2},
        {"key" : "unarmedDamage","value" : "2d8","mode" : 2},
        {"key" : "vehicleFightingSpace","value" : "4 squares","mode" : 2},
        {"key" : "skillBonus","value" : "stealth:-20","mode" : 2},
        {"key" : "damageThresholdSizeModifier","value" : "500","mode" : 2},
        {"key" : "grappleSizeModifier","value" : "35","mode" : 2},
    ],
}

//This is a 3d lookup table to be used like this [scalablekey][mediumValue][size]
// first give it the scalable change key.  it will end with "Scalable",
// then give it the value that it should have for a medium-sized character, then give it the actual size
export const SCALABLE_CHANGES = {
    "damageScalable" : {
        "1d4":{
            "Fine": [
                {"key" : "damage","value" : "1","mode" : 2}
            ],
            "Diminutive": [
                {"key" : "damage","value" : "1","mode" : 2}
            ],
            "Tiny": [
                {"key" : "damage","value" : "1d2","mode" : 2}
            ],
            "Small": [
                {"key" : "damage","value" : "1d3","mode" : 2}
            ],
            "Medium": [
                {"key" : "damage","value" : "1d4","mode" : 2}
            ],
            "Large": [
                {"key" : "damage","value" : "1d6","mode" : 2}
            ],
            "Huge": [
                {"key" : "damage","value" : "1d8","mode" : 2}
            ],
            "Gargantuan": [
                {"key" : "damage","value" : "2d6","mode" : 2}
            ],
            "Colossal": [
                {"key" : "damage","value" : "3d6","mode" : 2}
            ]
        },
        "1d6":{
            "Fine": [
                {"key" : "damage","value" : "1","mode" : 2}
            ],
            "Diminutive": [
                {"key" : "damage","value" : "1d2","mode" : 2}
            ],
            "Tiny": [
                {"key" : "damage","value" : "1d3","mode" : 2}
            ],
            "Small": [
                {"key" : "damage","value" : "1d4","mode" : 2}
            ],
            "Medium": [
                {"key" : "damage","value" : "1d6","mode" : 2}
            ],
            "Large": [
                {"key" : "damage","value" : "1d8","mode" : 2}
            ],
            "Huge": [
                {"key" : "damage","value" : "2d6","mode" : 2}
            ],
            "Gargantuan": [
                {"key" : "damage","value" : "3d6","mode" : 2}
            ],
            "Colossal": [
                {"key" : "damage","value" : "4d6","mode" : 2}
            ]
        }
    },
    "shipSkillModifierScalable": {
        "0": {
            "Fine" : [
                {"key" : "shipSkillModifier","value" : "10","mode" : 2}
            ],
            "Diminutive" : [
                {"key" : "shipSkillModifier","value" : "5","mode" : 2}
            ],
            "Tiny" : [
                {"key" : "shipSkillModifier","value" : "2","mode" : 2}
            ],
            "Small" : [
                {"key" : "shipSkillModifier","value" : "1","mode" : 2}
            ],
            "Medium" : [
                {"key" : "shipSkillModifier","value" : "0","mode" : 2}
            ],
            "Large" : [
                {"key" : "shipSkillModifier","value" : "-1","mode" : 2}
            ],
            "Huge" : [
                {"key" : "shipSkillModifier","value" : "-2","mode" : 2}
            ],
            "Gargantuan" : [
                {"key" : "shipSkillModifier","value" : "-5","mode" : 2}
            ],
            "Colossal" : [
                {"key" : "shipSkillModifier","value" : "-10","mode" : 2}
            ],
            "Colossal (Frigate)" : [
                {"key" : "shipSkillModifier","value" : "-10","mode" : 2}
            ],
            "Colossal (Cruiser)" : [
                {"key" : "shipSkillModifier","value" : "-10","mode" : 2}
            ],
            "Colossal (Station)" : [
                {"key" : "shipSkillModifier","value" : "-10","mode" : 2}
            ],
        }
    },
    "reflexDefenseBonusScalable": {
        "0": {
            "Fine" : [
                {"key" : "reflexDefenseBonus","value" : "10","mode" : 2}
            ],
            "Diminutive" : [
                {"key" : "reflexDefenseBonus","value" : "5","mode" : 2}
            ],
            "Tiny" : [
                {"key" : "reflexDefenseBonus","value" : "2","mode" : 2}
            ],
            "Small" : [
                {"key" : "reflexDefenseBonus","value" : "1","mode" : 2}
            ],
            "Medium" : [
                {"key" : "reflexDefenseBonus","value" : "0","mode" : 2}
            ],
            "Large" : [
                {"key" : "reflexDefenseBonus","value" : "-1","mode" : 2}
            ],
            "Huge" : [
                {"key" : "reflexDefenseBonus","value" : "-2","mode" : 2}
            ],
            "Gargantuan" : [
                {"key" : "reflexDefenseBonus","value" : "-5","mode" : 2}
            ],
            "Colossal" : [
                {"key" : "reflexDefenseBonus","value" : "-10","mode" : 2}
            ],
            "Colossal (Frigate)" : [
                {"key" : "reflexDefenseBonus","value" : "-10","mode" : 2}
            ],
            "Colossal (Cruiser)" : [
                {"key" : "reflexDefenseBonus","value" : "-10","mode" : 2}
            ],
            "Colossal (Station)" : [
                {"key" : "reflexDefenseBonus","value" : "-10","mode" : 2}
            ],
        }
    },
    "characterFightingSpaceScalable": {
        "1 square": {
            "Fine" : [
                {"key" : "characterFightingSpace","value" : "1 square","mode" : 2}
            ],
            "Diminutive" : [
                {"key" : "characterFightingSpace","value" : "1 square","mode" : 2}
            ],
            "Tiny" : [
                {"key" : "characterFightingSpace","value" : "1 square","mode" : 2}
            ],
            "Small" : [
                {"key" : "characterFightingSpace","value" : "1 square","mode" : 2}
            ],
            "Medium" : [
                {"key" : "characterFightingSpace","value" : "1 square","mode" : 2}
            ],
            "Large" : [
                {"key" : "characterFightingSpace","value" : "4 squares","mode" : 2}
            ],
            "Huge" : [
                {"key" : "characterFightingSpace","value" : "9 squares","mode" : 2}
            ],
            "Gargantuan" : [
                {"key" : "characterFightingSpace","value" : "16 squares","mode" : 2}
            ],
            "Colossal" : [],
            "Colossal (Frigate)" : [],
            "Colossal (Cruiser)" : [],
            "Colossal (Station)" : [],
        }
    },
    "unarmedDamageScalable": {
        "1d4": {
            "Fine" : [
                {"key" : "unarmedDamage","value" : "1","mode" : 2}
            ],
            "Diminutive" : [
                {"key" : "unarmedDamage","value" : "1","mode" : 2}
            ],
            "Tiny" : [
                {"key" : "unarmedDamage","value" : "1d2","mode" : 2}
            ],
            // Homebrew unarmed die by size (Small d4 / Medium d6 / Large d8), matching the
            // SIZE_CHANGES table the species rework established. This table is what the unarmed
            // attack actually resolves through, so leaving it on the vanilla progression made
            // the homebrew values dead letters — every character punched one die size too low.
            "Small" : [
                {"key" : "unarmedDamage","value" : "1d4","mode" : 2}
            ],
            "Medium" : [
                {"key" : "unarmedDamage","value" : "1d6","mode" : 2}
            ],
            "Large" : [
                {"key" : "unarmedDamage","value" : "1d8","mode" : 2}
            ],
            "Huge" : [
                {"key" : "unarmedDamage","value" : "1d8","mode" : 2}
            ],
            "Gargantuan" : [
                {"key" : "unarmedDamage","value" : "2d6","mode" : 2}
            ],
            "Colossal" : [
                {"key" : "unarmedDamage","value" : "2d8","mode" : 2}
            ],
            "Colossal (Frigate)" : [
                {"key" : "unarmedDamage","value" : "2d8","mode" : 2}
            ],
            "Colossal (Cruiser)" : [
                {"key" : "unarmedDamage","value" : "2d8","mode" : 2}
            ],
            "Colossal (Station)" : [
                {"key" : "unarmedDamage","value" : "2d8","mode" : 2}
            ],
        }
    },
    "vehicleFightingSpaceScalable": {
        "0 squares": {
            "Fine" : [],
            "Diminutive" : [],
            "Tiny" : [],
            "Small" : [],
            "Medium" : [],
            "Large" : [],
            "Huge" : [],
            "Gargantuan" : [],
            "Colossal" : [
                {"key" : "vehicleFightingSpace","value" : "1 square","mode" : 2}
            ],
            "Colossal (Frigate)" : [
                {"key" : "vehicleFightingSpace","value" : "1 square","mode" : 2}
            ],
            "Colossal (Cruiser)" : [
                {"key" : "vehicleFightingSpace","value" : "4 squares","mode" : 2}
            ],
            "Colossal (Station)" : [
                {"key" : "vehicleFightingSpace","value" : "4 squares","mode" : 2}
            ],
        }
    },
    "skillBonusScalable": {
        "stealth:0": {
            "Fine" : [
                {"key" : "skillBonus","value" : "stealth:20","mode" : 2}
            ],
            "Diminutive" : [
                {"key" : "skillBonus","value" : "stealth:15","mode" : 2},
            ],
            "Tiny" : [
                {"key" : "skillBonus","value" : "stealth:10","mode" : 2}
            ],
            "Small" : [
                {"key" : "skillBonus","value" : "stealth:5","mode" : 2}
            ],
            "Medium" : [
                {"key" : "skillBonus","value" : "stealth:0","mode" : 2}
            ],
            "Large" : [
                {"key" : "skillBonus","value" : "stealth:-5","mode" : 2}
            ],
            "Huge" : [
                {"key" : "skillBonus","value" : "stealth:-10","mode" : 2}
            ],
            "Gargantuan" : [
                {"key" : "skillBonus","value" : "stealth:-15","mode" : 2}
            ],
            "Colossal" : [
                {"key" : "skillBonus","value" : "stealth:-20","mode" : 2}
            ],
            "Colossal (Frigate)" : [
                {"key" : "skillBonus","value" : "stealth:-20","mode" : 2}
            ],
            "Colossal (Cruiser)" : [
                {"key" : "skillBonus","value" : "stealth:-20","mode" : 2}
            ],
            "Colossal (Station)" : [
                {"key" : "skillBonus","value" : "stealth:-20","mode" : 2}
            ],
        }
    },
    "damageThresholdSizeModifierScalable": {
        "0":{
            "Fine" : [
                {"key" : "damageThresholdSizeModifier","value" : "0","mode" : 2}
            ],
            "Diminutive" : [
                {"key" : "damageThresholdSizeModifier","value" : "0","mode" : 2}
            ],
            "Tiny" : [
                {"key" : "damageThresholdSizeModifier","value" : "0","mode" : 2}
            ],
            "Small" : [
                {"key" : "damageThresholdSizeModifier","value" : "0","mode" : 2}
            ],
            "Medium" : [
                {"key" : "damageThresholdSizeModifier","value" : "0","mode" : 2}
            ],
            "Large" : [
                {"key" : "damageThresholdSizeModifier","value" : "5","mode" : 2}
            ],
            "Huge" : [
                {"key" : "damageThresholdSizeModifier","value" : "10","mode" : 2}
            ],
            "Gargantuan" : [
                {"key" : "damageThresholdSizeModifier","value" : "20","mode" : 2}
            ],
            "Colossal" : [
                {"key" : "damageThresholdSizeModifier","value" : "50","mode" : 2}
            ],
            "Colossal (Frigate)" : [
                {"key" : "damageThresholdSizeModifier","value" : "100","mode" : 2}
            ],
            "Colossal (Cruiser)" : [
                {"key" : "damageThresholdSizeModifier","value" : "200","mode" : 2}
            ],
            "Colossal (Station)" : [
                {"key" : "damageThresholdSizeModifier","value" : "500","mode" : 2}
            ],
        }
    },
    "grappleSizeModifierScalable": {
        "0":{
            "Fine" : [],
            "Diminutive" : [],
            "Tiny" : [],
            "Small" : [],
            "Medium" : [],
            "Large" : [
                {"key" : "grappleSizeModifier","value" : "5","mode" : 2}
            ],
            "Huge" : [
                {"key" : "grappleSizeModifier","value" : "10","mode" : 2}
            ],
            "Gargantuan" : [
                {"key" : "grappleSizeModifier","value" : "15","mode" : 2}
            ],
            "Colossal" : [
                {"key" : "grappleSizeModifier","value" : "20","mode" : 2}
            ],
            "Colossal (Frigate)" : [
                {"key" : "grappleSizeModifier","value" : "25","mode" : 2}
            ],
            "Colossal (Cruiser)" : [
                {"key" : "grappleSizeModifier","value" : "30","mode" : 2}
            ],
            "Colossal (Station)" : [
                {"key" : "grappleSizeModifier","value" : "35","mode" : 2}
            ],
        }
    },
    "droidUnarmedDamageScalable":{
        "1":{
            "Fine": [
                {"key" : "droidUnarmedDamage","value" : "0","mode" : 2}
            ],
            "Diminutive": [
                {"key" : "droidUnarmedDamage","value" : "0","mode" : 2}
            ],
            "Tiny": [
                {"key" : "droidUnarmedDamage","value" : "0","mode" : 2}
            ],
            "Small": [
                {"key" : "droidUnarmedDamage","value" : "0","mode" : 2}
            ],
            "Medium": [
                {"key" : "droidUnarmedDamage","value" : "1","mode" : 2}
            ],
            "Large": [
                {"key" : "droidUnarmedDamage","value" : "1d2","mode" : 2}
            ],
            "Huge": [
                {"key" : "droidUnarmedDamage","value" : "1d3","mode" : 2}
            ],
            "Gargantuan": [
                {"key" : "droidUnarmedDamage","value" : "1d4","mode" : 2}
            ],
            "Colossal": [
                {"key" : "droidUnarmedDamage","value" : "1d6","mode" : 2}
            ]
        },
        "1d2":{
            "Fine": [
                {"key" : "droidUnarmedDamage","value" : "0","mode" : 2}
            ],
            "Diminutive": [
                {"key" : "droidUnarmedDamage","value" : "0","mode" : 2}
            ],
            "Tiny": [
                {"key" : "droidUnarmedDamage","value" : "0","mode" : 2}
            ],
            "Small": [
                {"key" : "droidUnarmedDamage","value" : "1","mode" : 2}
            ],
            "Medium": [
                {"key" : "droidUnarmedDamage","value" : "1d2","mode" : 2}
            ],
            "Large": [
                {"key" : "droidUnarmedDamage","value" : "1d3","mode" : 2}
            ],
            "Huge": [
                {"key" : "droidUnarmedDamage","value" : "1d4","mode" : 2}
            ],
            "Gargantuan": [
                {"key" : "droidUnarmedDamage","value" : "1d6","mode" : 2}
            ],
            "Colossal": [
                {"key" : "droidUnarmedDamage","value" : "1d8","mode" : 2}
            ]
        },
        "1d3":{
            "Fine": [
                {"key" : "droidUnarmedDamage","value" : "0","mode" : 2}
            ],
            "Diminutive": [
                {"key" : "droidUnarmedDamage","value" : "0","mode" : 2}
            ],
            "Tiny": [
                {"key" : "droidUnarmedDamage","value" : "1","mode" : 2}
            ],
            "Small": [
                {"key" : "droidUnarmedDamage","value" : "1d2","mode" : 2}
            ],
            "Medium": [
                {"key" : "droidUnarmedDamage","value" : "1d3","mode" : 2}
            ],
            "Large": [
                {"key" : "droidUnarmedDamage","value" : "1d4","mode" : 2}
            ],
            "Huge": [
                {"key" : "droidUnarmedDamage","value" : "1d6","mode" : 2}
            ],
            "Gargantuan": [
                {"key" : "droidUnarmedDamage","value" : "1d8","mode" : 2}
            ],
            "Colossal": [
                {"key" : "droidUnarmedDamage","value" : "2d6","mode" : 2}
            ]
        },
        "1d4":{
            "Fine": [
                {"key" : "droidUnarmedDamage","value" : "0","mode" : 2}
            ],
            "Diminutive": [
                {"key" : "droidUnarmedDamage","value" : "1","mode" : 2}
            ],
            "Tiny": [
                {"key" : "droidUnarmedDamage","value" : "1d2","mode" : 2}
            ],
            "Small": [
                {"key" : "droidUnarmedDamage","value" : "1d3","mode" : 2}
            ],
            "Medium": [
                {"key" : "droidUnarmedDamage","value" : "1d4","mode" : 2}
            ],
            "Large": [
                {"key" : "droidUnarmedDamage","value" : "1d6","mode" : 2}
            ],
            "Huge": [
                {"key" : "droidUnarmedDamage","value" : "1d8","mode" : 2}
            ],
            "Gargantuan": [
                {"key" : "droidUnarmedDamage","value" : "2d6","mode" : 2}
            ],
            "Colossal": [
                {"key" : "droidUnarmedDamage","value" : "2d8","mode" : 2}
            ]
        },
    }
}

export const SCALABLE_CHANGE_KEYS = Object.keys(SCALABLE_CHANGES).map(c => c.substring(0, c.length-8));

export const XP_REQUIREMENT = {
    "1": 0,
    "2": 1000,
    "3": 3000,
    "4": 6000,
    "5": 10000,
    "6": 15000,
    "7": 21000,
    "8": 28000,
    "9": 36000,
    "10": 45000,
    "11": 55000,
    "12": 66000,
    "13": 78000,
    "14": 91000,
    "15": 105000,
    "16": 120000,
    "17": 136000,
    "18": 153000,
    "19": 171000,
    "20": 190000
}

///INCLUSION LISTS
/**
 * Change keys an equipped weapon is allowed to contribute when its changes are read from the
 * ACTOR's perspective. Weapons are otherwise excluded there so one weapon's bonuses never leak
 * onto another's attack.
 *
 * The gloves (Combat/Power/Shock) are the case this exists for: they are weapon-type items whose
 * whole purpose is to modify the wearer's *unarmed* damage, which is resolved against the actor.
 */
export const WEAPON_INCLUSION_LIST = ["unarmedGearDamageDieCount", "unarmedDamageType"]



export const d20 = "1d20";
export const defaultAttributes = ["strength", "dexterity", "constitution", "wisdom", "intelligence", "charisma"]
export const defaultSkills = ["Acrobatics", "Biotech", "Deception", "Endurance", "Gather Information", "Initiative",
    "Knowledge (Bureaucracy)", "Knowledge (Galactic Lore)",
    "Knowledge (Tactics)", "Knowledge (Technology)", "Mechanics", "Perception",
    "Persuasion", "Pilot", "Stealth", "Survival", "Treat Injury", "Use Computer", "Use the Force"];
export const defaultVehicleSkills = ["Pilot (Pilot)", "Initiative (Pilot)", "Stealth (Pilot)", "Deception (Pilot)", "Pilot (Copilot)", "Use Computer (Commander)", "Knowledge (Tactics) (Commander)", "Mechanics (System Operator)", "Use Computer (System Operator)", "Mechanics (Engineer)"];

export const allDefaultSkills = [...defaultSkills, ...defaultVehicleSkills];
    export function getGroupedSkillMap() {
    return EPISODE_VII_HOMEBREW_SKILLS;
}

// Homebrew (Episode VII houserules): Athletics replaces Climb/Jump/Swim; Knowledge (Sciences)
// replaces the "hard science" Knowledge subskills. Unconditional — this is this fork's actual
// ruleset, not an optional toggle. The old individual skills no longer exist in any form (no
// situational sub-skill breakdown) — only the consolidated parent skill is rollable.
export const EPISODE_VII_HOMEBREW_SKILLS = new Map([
    ["Athletics", {
        ability: "str",
        uut: true
    }],
    ["Knowledge (Sciences)", {
        ability: "int",
        uut: false
    }]
]);

export function skills(actorType = "character", removeGroupedSkills = true) {
    let skills = actorType === "character" ? [...defaultSkills] : [...defaultVehicleSkills];
    let groupedSkillMap = getGroupedSkillMap();

    if (groupedSkillMap) {
        const grouped = [];
        for (const [key, value] of groupedSkillMap) {
            skills.push(key)
            if (value.grouped) {
                grouped.push(...value.grouped)
            }
        }
        if (grouped && removeGroupedSkills) {
            skills = skills.filter(s => !grouped.includes(s))
        }
    }

    return skills;
}

export const skillDetails = {
    "Acrobatics": {
        value: 0,
        ability: "dex",
        uut: true,
        acp: true,
        link: "https://swse.fandom.com/wiki/Acrobatics"
    },
    "Biotech": {
        value: 0,
        ability: "wis",
        uut: true,
        acp: false,
        link: "https://swse.fandom.com/wiki/Biotech"
    },
    "Deception": {
        value: 0,
        ability: "cha",
        uut: true,
        acp: false,
        link: "https://swse.fandom.com/wiki/Deception"
    },
    "Endurance": {
        value: 0,
        ability: "con",
        uut: true,
        acp: true,
        link: "https://swse.fandom.com/wiki/Endurance"
    },
    "Gather Information": {
        value: 0,
        ability: "cha",
        uut: true,
        acp: false,
        link: "https://swse.fandom.com/wiki/Gather_Information"
    },
    "Initiative": {
        value: 0,
        ability: "dex",
        uut: true,
        acp: true,
        link: "https://swse.fandom.com/wiki/Initiative"
    },
    "Knowledge (Bureaucracy)": {
        value: 0,
        ability: "int",
        uut: true,
        acp: false,
        link: "https://swse.fandom.com/wiki/Knowledge"
    },
    "Knowledge (Galactic Lore)": {
        value: 0,
        ability: "int",
        uut: true,
        acp: false,
        link: "https://swse.fandom.com/wiki/Knowledge"
    },
    "Knowledge (Tactics)": {
        value: 0,
        ability: "int",
        uut: true,
        acp: false,
        link: "https://swse.fandom.com/wiki/Knowledge"
    },
    "Knowledge (Technology)": {
        value: 0,
        ability: "int",
        uut: true,
        acp: false,
        link: "https://swse.fandom.com/wiki/Knowledge"
    },
    "Mechanics": {
        value: 0,
        ability: "int",
        uut: false,
        acp: false,
        link: "https://swse.fandom.com/wiki/Mechanics"
    },
    "Perception": {
        value: 0,
        ability: "wis",
        uut: true,
        acp: false,
        link: "https://swse.fandom.com/wiki/Perception"
    },
    "Persuasion": {
        value: 0,
        ability: "cha",
        uut: true,
        acp: false,
        link: "https://swse.fandom.com/wiki/Persuasion"
    },
    "Pilot": {
        value: 0,
        ability: "dex",
        uut: true,
        acp: false,
        link: "https://swse.fandom.com/wiki/Pilot"
    },
    "Stealth": {
        value: 0,
        ability: "dex",
        uut: true,
        acp: true,
        link: "https://swse.fandom.com/wiki/Stealth"
    },
    "Survival": {
        value: 0,
        ability: "wis",
        uut: true,
        acp: false,
        link: "https://swse.fandom.com/wiki/Survival"
    },
    "Treat Injury": {
        value: 0,
        ability: "wis",
        uut: true,
        acp: false,
        link: "https://swse.fandom.com/wiki/Treat_Injury"
    },
    "Use Computer": {
        value: 0,
        ability: "int",
        uut: true,
        acp: false,
        link: "https://swse.fandom.com/wiki/Use_Computer"
    },
    "Use the Force": {
        value: 0,
        // Homebrew: Use the Force defaults to Wisdom (Force of Personality feat lets Charisma substitute
        // when higher, via the existing skillAttribute inheritable-attribute mechanism).
        ability: "wis",
        uut: false,
        acp: false,
        link: "https://swse.fandom.com/wiki/Use_the_Force"
    }
}

export const lightsaberForms = ["Ataru",
    "Djem So",
    "Jar'Kai",
    "Juyo",
    "Makashi",
    "Niman",
    "Shien",
    "Shii-Cho",
    "Sokan",
    "Soresu",
    "Trakata",
    "Vaapad",
    "Dun Möch",
    "Maho-Kai",
    "Tripzest"];

export const CREW_QUALITIES = ["Untrained","Normal","Skilled","Expert","Ace"];

export const COLORS = {
    "red": "#FF0000",
    "green": "#00FF00",
    "cyan": "#00FFFF",
    "blue": "#0000FF",
    "crimson": "#DC143C",
    "dark crimson": "#402327",
    "aquamarine": "#7fffd4",
    "purple": "#663399",
    "orange": "#BB4411",
    "silver": "#999999"

}

export const vehicleActorTypes = ["vehicle", "npc-vehicle"];
export const characterActorTypes = ["character", "npc", "beast"];

export const uniqueKey = ["damage", "stunDamage"];

export const weaponGroup = {
    "Ranged Weapons": ["Heavy Weapons", "Pistols", "Rifles", "Simple Ranged Weapons", "Exotic Ranged Weapons", "Ranged Natural Weapons", 'Weapon Systems'],
    "Melee Weapons": ["Advanced Melee", "Lightsabers", "Simple Melee Weapons", "Exotic Melee Weapons", "Melee Natural Weapons"]
};

export const EQUIPABLE_TYPES = ["armor", "weapon", "equipment", "upgrade", "trait", "vehicleSystem"];
export const LIMITED_TO_ONE_TYPES = ["feat", "talent"]


export const RANGED_WEAPON_TYPES = ["pistols", "rifles", "exotic ranged weapons", "ranged weapons", "grenades", "heavy weapons", "simple ranged weapons"];
export const LIGHTSABER_WEAPON_TYPES = ["lightsabers", "lightsaber"];
export const SIMPLE_WEAPON_TYPES = ['simple melee weapons', 'simple ranged weapons', 'simple melee weapon', 'simple ranged weapon', "grenades"];

export const SUBTYPES = {
    "weapon": ["Advanced Melee", "Exotic Melee Weapons", "Exotic Ranged Weapons", "Grenades", "Heavy Weapons", "Lightsabers", "Mines", "Pistols", "Rifles", "Simple Melee Weapons", "Simple Ranged Weapons", "Explosives"],
    "armor": ["Light Armor", "Medium Armor", "Heavy Armor", "Droid Accessories (Droid Armor)", "Energy Shield"],
    "equipment": ["Equipment", "Communications Devices", "Computers and Storage Devices", "Cybernetic Devices", "Detection and Surveillance Devices", "Life Support", "Medical Gear", "Hazard", "Survival Gear", "Tools", "Weapon and Armor Accessories", "Advanced Cybernetics", "Implants", "Sith Artifacts", "Locomotion Systems", "Processor Systems", "Appendages", "Droid Accessories (Sensor Systems)", "Droid Accessories (Translator Units)", "Droid Accessories (Miscellaneous Systems)", "Droid Accessories (Communications Systems)", "Droid Accessories (Droid Stations)", "Droid Accessories (Shield Generator Systems)", "Droid Accessories (Hardened Systems)"],
    "upgrade": ["Weapon Upgrade", "Armor Upgrade", "Universal Upgrade", "Armor Trait", "Device Trait",
        "Droid Trait",
        "Vehicle Trait",
        "Weapon Trait",
        "Dark Armor Trait",
        "Sith Weapon Trait",
        "Sith Abomination Trait", "Lightsaber Crystals", "Lightsaber Modifications"],
    "template": ["Vehicle Templates", "Weapon Templates", "Armor Templates", "Droid Templates", "General Templates"],
    "vehicleSystem": ["Starship Accessories", "Weapon Systems", "Defense Systems", "Movement Systems", "Droid Accessories (Droid Stations)"],
    "class": ["Nonheroic", "Heroic", "Prestige"],
    "species": ["Organic", "Droid"],
    "beastattack": ["Melee Natural Weapons", "Ranged Natural Weapons"],
    "implant":["Bio-Implants", "Cybernetic Devices", "Implants", "Advanced Cybernetics"]
}

export const GM_BONUSES = [
    {display: "Ace Pilot Talent Trees", key: "provides", value: "Ace Pilot Talent Trees:#integer#"},
    {display: "Assassin Talent Trees", key: "provides", value: "Assassin Talent Trees:#integer#"},
    {display: "Bounty Hunter Talent Trees", key: "provides", value: "Bounty Hunter Talent Trees:#integer#"},
    {display: "Charlatan Talent Trees", key: "provides", value: "Charlatan Talent Trees:#integer#"},
    {display: "Corporate Agent Talent Trees", key: "provides", value: "Corporate Agent Talent Trees:#integer#"},
    {display: "Crime Lord Talent Trees", key: "provides", value: "Crime Lord Talent Trees:#integer#"},
    {display: "Droid Commander Talent Trees", key: "provides", value: "Droid Commander Talent Trees:#integer#"},
    {display: "Elite Trooper Talent Trees", key: "provides", value: "Elite Trooper Talent Trees:#integer#"},
    {display: "Enforcer Talent Trees", key: "provides", value: "Enforcer Talent Trees:#integer#"},
    {display: "Force Adept Talent Trees", key: "provides", value: "Force Adept Talent Trees:#integer#"},
    {display: "Force Disciple Talent Trees", key: "provides", value: "Force Disciple Talent Trees:#integer#"},
    {display: "Force Powers", key: "provides", value: "Force Powers:#integer#"},
    {display: "Force Prodigy Bonus Feats", key: "provides", value: "Force Prodigy Bonus Feats:#integer#"},
    {display: "Force Secret", key: "provides", value: "Force Secret:#integer#"},
    {display: "Force Talent Trees", key: "provides", value: "Force Talent Trees:#integer#"},
    {display: "Force Technique", key: "provides", value: "Force Technique:#integer#"},
    {display: "General Feats", key: "provides", value: "General Feats:#integer#"},
    {display: "Gladiator Talent Trees", key: "provides", value: "Gladiator Talent Trees:#integer#"},
    {display: "Gunslinger Talent Trees", key: "provides", value: "Gunslinger Talent Trees:#integer#"},
    {display: "Health Points", key: "hitPointEq", value: "#integer#"},
    {display: "Imperial Knight Talent Trees", key: "provides", value: "Imperial Knight Talent Trees:#integer#"},
    {display: "Improviser Talent Trees", key: "provides", value: "Improviser Talent Trees:#integer#"},
    {display: "Independent Droid Talent Trees", key: "provides", value: "Independent Droid Talent Trees:#integer#"},
    {display: "Infiltrator Talent Trees", key: "provides", value: "Infiltrator Talent Trees:#integer#"},
    {display: "Jedi Bonus Feats", key: "provides", value: "Jedi Bonus Feats:#integer#"},
    {display: "Jedi Knight Talent Trees", key: "provides", value: "Jedi Knight Talent Trees:#integer#"},
    {display: "Jedi Master Talent Trees", key: "provides", value: "Jedi Master Talent Trees:#integer#"},
    {display: "Jedi Talent Trees", key: "provides", value: "Jedi Talent Trees:#integer#"},
    {display: "Martial Arts Master Talent Trees", key: "provides", value: "Martial Arts Master Talent Trees:#integer#"},
    {display: "Master Privateer Talent Trees", key: "provides", value: "Master Privateer Talent Trees:#integer#"},
    {display: "Medic Talent Trees", key: "provides", value: "Medic Talent Trees:#integer#"},
    {display: "Melee Duelist Talent Trees", key: "provides", value: "Melee Duelist Talent Trees:#integer#"},
    {display: "Military Engineer Talent Trees", key: "provides", value: "Military Engineer Talent Trees:#integer#"},
    {display: "Noble Bonus Feats", key: "provides", value: "Noble Bonus Feats:#integer#"},
    {display: "Noble Talent Trees", key: "provides", value: "Noble Talent Trees:#integer#"},
    {display: "Officer Talent Trees", key: "provides", value: "Officer Talent Trees:#integer#"},
    {display: "Outlaw Talent Trees", key: "provides", value: "Outlaw Talent Trees:#integer#"},
    {display: "Pathfinder Talent Trees", key: "provides", value: "Pathfinder Talent Trees:#integer#"},
    {display: "Saboteur Talent Trees", key: "provides", value: "Saboteur Talent Trees:#integer#"},
    {display: "Scoundrel Bonus Feats", key: "provides", value: "Scoundrel Bonus Feats:#integer#"},
    {display: "Scoundrel Talent Trees", key: "provides", value: "Scoundrel Talent Trees:#integer#"},
    {display: "Scout Bonus Feats", key: "provides", value: "Scout Bonus Feats:#integer#"},
    {display: "Scout Talent Trees", key: "provides", value: "Scout Talent Trees:#integer#"},
    {display: "Shaper Talent Trees", key: "provides", value: "Shaper Talent Trees:#integer#"},
    {display: "Sith Apprentice Talent Trees", key: "provides", value: "Sith Apprentice Talent Trees:#integer#"},
    {display: "Sith Lord Talent Trees", key: "provides", value: "Sith Lord Talent Trees:#integer#"},
    {display: "Soldier Bonus Feats", key: "provides", value: "Soldier Bonus Feats:#integer#"},
    {display: "Soldier Talent Trees", key: "provides", value: "Soldier Talent Trees:#integer#"},
    {display: "Technician Bonus Feats", key: "provides", value: "Technician Bonus Feats:#integer#"},
    {display: "Technician Talent Trees", key: "provides", value: "Technician Talent Trees:#integer#"},
    {display: "Trained Skills", key: "trainedSkills", value: "#integer#"},
    {display: "Vanguard Talent Trees", key: "provides", value: "Vanguard Talent Trees:#integer#"},
    {display: "Fortitude Defense Bonus", key: "fortitudeDefenseBonus", value: "#integer#"},
    {display: "Reflex Defense Bonus", key: "reflexDefenseBonus", value: "#integer#"},
    {display: "Will Defense Bonus", key: "willDefenseBonus", value: "#integer#"}
]

//fortitudeDefenseBonus
export const NEW_LINE = `
`;

export const DROID_COST_FACTOR = {
    "Colossal": 20,
    "Gargantuan": 10,
    "Huge": 5,
    "Large": 2,
    "Medium": 1,
    "Small": 2,
    "Tiny": 5,
    "Diminutive": 10,
    "Fine": 20
}
export const SIZE_CARRY_CAPACITY_MODIFIER = {
    "Colossal": 20,
    "Gargantuan": 10,
    "Huge": 5,
    "Large": 2,
    "Medium": 1,
    "Small": 0.75,
    "Tiny": 0.5,
    "Diminutive": 0.25,
    "Fine": 0.01
}

// Homebrew: Kit slots lose 1 per size category below Medium. Large+ bonuses are
// deliberately not automated (the ruleset leaves them "case by case").
export const KIT_SLOT_SIZE_PENALTY = {
    "Colossal": 0,
    "Gargantuan": 0,
    "Huge": 0,
    "Large": 0,
    "Medium": 0,
    "Small": 1,
    "Tiny": 2,
    "Diminutive": 3,
    "Fine": 4
}

export const GRAVITY_CARRY_CAPACITY_MODIFIER = {
    "Normal": 1,
    "High": 0.5,
    "Low": 2,
    "Zero": 10,
}

export const ITEM_ONLY_ATTRIBUTES = [
    "damage",
    "damageType",
    "takeMultipleTimes",
    "isThrowable",
    "itemMod",
    "overheatLimit",
    "prefix",
    "suffix",
    "cooldownTime"
]

export const CLASSES_BY_STARTING_FEAT = {
    "Shake It Off": ["Scout"],
    "Weapon Proficiency (Heavy Weapons)": ["Nonheroic"],
    "Force Sensitivity": ["Jedi", "Force Prodigy"],
    "Armor Proficiency (Light)": ["Soldier", "Nonheroic"],
    "Weapon Proficiency (Lightsabers)": ["Jedi"],
    "Weapon Proficiency (Rifles)": ["Scout", "Soldier", "Nonheroic"],
    "Skill Training": ["Nonheroic"],
    "Linguist": ["Noble"],
    "Weapon Proficiency (Pistols)": ["Noble", "Scoundrel", "Scout", "Soldier", "Nonheroic"],
    "Tech Specialist": ["Technician"],
    "Skill Focus": ["Nonheroic"],
    "Weapon Proficiency (Simple Weapons)": ["Jedi", "Noble", "Scoundrel", "Scout", "Soldier", "Technician", "Force Prodigy", "Nonheroic"],
    "Force Training": ["Force Prodigy"],
    "Point-Blank Shot": ["Scoundrel"],
    "Armor Proficiency (Medium)": ["Soldier", "Nonheroic"],
    "Weapon Proficiency (Advanced Melee)": ["Nonheroic"]
}

export const KNOWN_WEIRD_UNITS = [
    "Eldewn and Elsae Sarvool"
]
