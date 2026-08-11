import {getInheritableAttribute} from "../attribute-helper.mjs";

export class UnarmedAttack {
    constructor(actor) {
        /**
         * Represents the current actor instance associated with the Unarmed Attack.
         */
        this.actor = actor;
    }

    get name() {
        return "Unarmed Attack";
    }

    get img() {
        return "systems/swse/icon/item/weapons/fist.webp";
    }

    get system(){
        return this;
    }

    get subtype() {
        return "Simple Melee Weapons";
    }

    get type() {
        return "weapon";
    }

    get stripping() {
        return {}
    }

    get isUnarmed() {
        return true;
    }

    get changes() {
        let changes = getInheritableAttribute(
            {
                entity: this.actor,
                attributeKey: "droidUnarmedDamage"
            }
        )
        // Homebrew collapses the vanilla physical damage types into a single "Physical"
        // (see HOMEBREW_DAMAGE_TYPES) — "Bludgeoning" isn't one of them, and the homebrew
        // Simple Weapons table lists a bare fist's damage as Physical.
        //
        // Worn gear can change what a punch deals (Power Gloves are Energy, Shock Gloves Stun).
        // That rides on its own `unarmedDamageType` key rather than plain `damageType`, so a
        // weapon can only ever retype the wearer's *unarmed* attack — allow-listing `damageType`
        // itself would let every equipped weapon leak its type onto the character's fists.
        const wornType = getInheritableAttribute({
            entity: this.actor,
            attributeKey: "unarmedDamageType",
            reduce: "FIRST"
        })
        changes.push({"key": "damageType", "value": wornType || "Physical"})
        changes.push({"key": "unarmedDamageScalable", "value": "1d4"})
        return changes;
    }

    get parent() {
        return this.actor;
    }
}