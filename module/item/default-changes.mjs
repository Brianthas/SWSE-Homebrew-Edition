// Synthesizes legacy-style {key, value} change entries from an item's own typed schema
// fields, feeding `getLocalChangesOnDocument`'s `document.defaultChanges` seam
// (module/attribute-helper.mjs) so every existing getInheritableAttribute call site keeps
// working unmodified as item types get their generic `changes` array migrated to real typed
// fields one type at a time (see the Item Schema & Sheet Overhaul plan).
//
// Only types listed in PROMOTED_FIELDS have actually been migrated - every other type keeps
// flowing entirely through the raw system.changes array exactly as before. Adding a type here
// must happen in lockstep with that type's real compendium migration
// (scripts/migrate-item-schema.mjs uses this same map) - otherwise a field would be
// double-counted: once from defaultChanges, once from the not-yet-stripped duplicate still
// sitting in that type's changes[].

// Universal ItemFields() baseline - cost/weight/availability/size/subtype are already typed
// StringFields on every gear type (module/item/data/templates/item.mjs), but
// getInheritableAttribute never reads typed fields directly, only system.changes. Emitting
// them here means a migrated type's compendium JSON no longer needs to redundantly duplicate
// them into changes[] too.
export const UNIVERSAL_ITEM_FIELDS = ["cost", "weight", "availability", "size", "subtype"];

/**
 * Per-type map of {typedFieldName: legacyChangeKey} for fields promoted out of the generic
 * changes array. This is the single source of truth shared with scripts/migrate-item-schema.mjs
 * - one list feeds both the runtime synthesis here and the one-time compendium migration.
 */
export const PROMOTED_FIELDS = {
    weapon: {
        damageDie: "damage",
        damageType: "damageType",
        specialQualities: "special",
        lightSlotCost: "lightSlotCost",
        kitSlotCost: "kitSlotCost",
        // toHitModifier/bonusDamage themselves stay generic (any item type can grant them) -
        // these just give a weapon its own dedicated, always-visible entry point into the same
        // generic keys, synthesized here exactly like every other promoted field. A value of 0
        // (the default) is emitted too, but appendTerm/appendNumericTerm (common/util.mjs) both
        // already skip falsy values, so no "+0" term ever shows up on a plain weapon's roll.
        miscAttackBonus: "toHitModifier",
        miscDamageBonus: "bonusDamage"
    },
    armor: {
        armorFlatSpeedPenalty: "armorFlatSpeedPenalty",
        armorDexterityOverride: "armorDexterityOverride",
        armorFlatCheckPenalty: "armorFlatCheckPenalty",
        strengthBonus: "strengthBonus",
        damageReduction: "damageReduction"
    },
    equipment: {
        kitSlotCost: "kitSlotCost",
        lightSlotCost: "lightSlotCost",
        specialQualities: "special",
        seeAlso: "seeAlso"
    },
    // itemMod stays generic on purpose: real data shows it's a cross-type boolean classification
    // flag (also appears on 54 `templates` pack items, not just upgrade), and item.mjs's drag-drop
    // upgrade-install check (~line 1046) reads it straight off item.system.changes rather than
    // through getInheritableAttribute/defaultChanges - promoting it would silently break that path.
    upgrade: {
        upgradePointCost: "upgradePointCost",
        seeAlso: "seeAlso"
    },
    // skillBonus stays generic on purpose: real data shows it's always the identical string
    // "Use the Force:-1:IMPLANT" (34/34 items) - a generic cross-grantable skill-bonus entry in
    // the system-wide skill:value:source-tag format, not implant-owned structured data.
    implant: {
        cybernetic: "cybernetic",
        installationCost: "installationCost",
        rejectionAttackBonus: "rejectionAttackBonus",
        implantDisruption: "implantDisruption"
    },
    // droidPart stays generic on purpose: real data shows it's always the literal boolean `true`
    // (100/100 items) - a cross-type classification flag (also appears on 9 `equipment` items),
    // and grep found zero code readers of it anywhere (not even via getInheritableAttribute) - so
    // promoting it would be pure churn with no functional benefit, same profile as `itemMod`.
    "droid system": {
        requires: "requires",
        baseSpeedScalable: "baseSpeedScalable",
        appendages: "appendages",
        appendageType: "appendageType",
        droidUnarmedDamageScalable: "droidUnarmedDamageScalable"
    },
    // `hyperdrive` deliberately stays generic - real landmine, not just a cross-grantable-key
    // judgment call like `itemMod`/`droidPart`. Actor#hyperdrive (actor.mjs ~line 655) and
    // SWSEItem#hyperdrive (item.mjs ~line 1736) both read `item.changes.find(c => c.key ===
    // "hyperdrive")` straight off the raw array, completely bypassing getInheritableAttribute/
    // defaultChanges. Promoting and stripping it would silently break hyperdrive-class detection
    // for every vehicle with one installed.
    vehicleSystem: {
        emplacementPoints: "emplacementPoints",
        damage: "damage",
        damageType: "damageType",
        ammo: "ammo",
        ammoCapacity: "ammoCapacity",
        ammoCapacityIncrease: "ammoCapacityIncrease",
        rangePointBlank: "rangePointBlank",
        rangeShort: "rangeShort",
        rangeMedium: "rangeMedium",
        rangeLong: "rangeLong",
        rangeStarshipPointBlank: "rangeStarshipPointBlank",
        rangeStarshipShort: "rangeStarshipShort",
        rangeStarshipMedium: "rangeStarshipMedium",
        rangeStarshipLong: "rangeStarshipLong",
        shieldRating: "shieldRating",
        reflexDefenseBonus: "reflexDefenseBonus",
        hitPointEq: "hitPointEq",
        speedStarshipScale: "speedStarshipScale",
        dexterityBonus: "dexterityBonus",
        astrogationBonus: "astrogationBonus"
    }
};

export function buildDefaultChanges(item) {
    const map = PROMOTED_FIELDS[item.type];
    if (!map) {
        return [];
    }

    const changes = [];
    for (const field of UNIVERSAL_ITEM_FIELDS) {
        const value = item.system?.[field];
        if (value) {
            changes.push({key: field, value});
        }
    }
    for (const [systemField, changeKey] of Object.entries(map)) {
        const value = item.system?.[systemField];
        if (value !== undefined && value !== null && value !== "") {
            // Hand-authored changes[] entries are always strings (Foundry's own convention for
            // this free-form format), and some reduce modes downstream assume that - e.g.
            // "VALUES_WITH_MODIFIERS" (util.mjs) unconditionally calls value.split("|") to peel
            // off pipe-delimited roll modifiers. A typed NumberField promoted straight through
            // as a raw number would throw there. Coerce to match every other change entry.
            changes.push({key: changeKey, value: typeof value === "number" ? String(value) : value});
        }
    }
    return changes;
}
