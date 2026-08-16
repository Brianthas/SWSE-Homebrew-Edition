/**
 * Wraps a persisted system.customAttacks entry (see commondata.mjs) into the same "virtual
 * item" shape UnarmedAttack (unarmed-attack.mjs) already uses, so a custom, non-equipment
 * attack (e.g. Grapple) flows through the existing Attack pipeline - attackRoll/damageRoll,
 * advantage/disadvantage, the generic toHitModifier/bonusDamage sweeps, etc. - completely
 * unmodified.
 */
export class CustomAttackItem {
    constructor(actor, config) {
        this.actor = actor;
        this.config = config;
    }

    get name() {
        return this.config.name || "Custom Attack";
    }

    get img() {
        return "systems/swse/icon/item/weapons/fist.webp";
    }

    get system() {
        return this;
    }

    // "Unarmed Attack" as the subtype (rather than a real weapon-group name) is how
    // attack-handler.mjs's getProficiencyBonus/getPossibleProficiencies exempt an attack from
    // the -5 non-proficient penalty - the same mechanism the real Unarmed Attack gets via its
    // own literal name. Falls back to a real melee subtype when the attack is configured to NOT
    // get that exemption (e.g. representing a specific weapon-like improvised action the GM
    // wants proficiency to matter for).
    get subtype() {
        return this.config.proficient === false ? "Simple Melee Weapons" : "Unarmed Attack";
    }

    get type() {
        return "weapon";
    }

    get stripping() {
        return {};
    }

    get abilityOverride() {
        return this.config.ability || undefined;
    }

    // No configured damage die falls back to the actor's natural unarmed damage (scaled by
    // size), same as a punch - attack.mjs's damageRoll getter only reads system.changes'
    // damageDie when isUnarmed is false, so a specified die takes over damage resolution
    // entirely once one is set.
    get isUnarmed() {
        return !this.config.damageDie;
    }

    get changes() {
        let changes = [];
        if (this.config.damageDie) {
            changes.push({key: "damageDie", value: this.config.damageDie});
        }
        if (this.config.damageType) {
            changes.push({key: "damageType", value: this.config.damageType});
        }
        if (this.config.notes) {
            // Attack#notes reads the 'special' key off the item - same field weapon.hbs's
            // Special Qualities uses - so the freeform notes field shows up in the attack
            // card's notes row exactly like a real weapon's special qualities would.
            changes.push({key: "special", value: this.config.notes});
        }
        return changes;
    }

    get parent() {
        return this.actor;
    }
}
