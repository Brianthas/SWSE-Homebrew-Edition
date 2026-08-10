import ItemSystemDataModel from "./abstract.mjs";
import {BaseItemFields} from "./templates/base.mjs";
import {ItemFields} from "./templates/item.mjs";
import {CategoriesFields} from "./templates/categories.mjs";
import {SourceFields} from "./templates/source.mjs";

const fields = foundry.data.fields;

/**
 * "vehicleSystem" has no template.json declaration at all (one of the 7 previously-unspecified
 * types), so this schema is built from direct code evidence rather than a template.json contract:
 * - actor.mjs reads item.system.subtype (e.g. "weapon systems") and item.system.equipped
 *   (values "installed"/"pilotInstalled"), so it needs the "item" template's fields.
 * - common/constants.mjs lists "vehicleSystem" subtype categories and in EQUIPABLE_TYPES, and
 *   item.mjs's getStripping() is used generically across equipable types — equipped/stripping
 *   included for the same reason as weapondata.mjs.
 */
export default class VehicleSystemData extends ItemSystemDataModel {
    static _systemType = "vehicleSystem";

    static defineSchema() {
        return {
            ...BaseItemFields(),
            ...ItemFields(),
            ...CategoriesFields(),
            ...SourceFields(),
            equipped: new fields.StringField({initial: "", blank: true, required: false}),
            stripping: new fields.ObjectField({initial: {}}),
            // Universal-ish across subtypes (slot cost).
            emplacementPoints: new fields.StringField({initial: "", blank: true, required: false}),
            // Weapon Systems / Ammunition.
            damage: new fields.StringField({initial: "", blank: true, required: false}),
            damageType: new fields.StringField({initial: "", blank: true, required: false}),
            ammo: new fields.StringField({initial: "", blank: true, required: false}),
            ammoCapacity: new fields.StringField({initial: "", blank: true, required: false}),
            ammoCapacityIncrease: new fields.StringField({initial: "", blank: true, required: false}),
            rangePointBlank: new fields.StringField({initial: "", blank: true, required: false}),
            rangeShort: new fields.StringField({initial: "", blank: true, required: false}),
            rangeMedium: new fields.StringField({initial: "", blank: true, required: false}),
            rangeLong: new fields.StringField({initial: "", blank: true, required: false}),
            rangeStarshipPointBlank: new fields.StringField({initial: "", blank: true, required: false}),
            rangeStarshipShort: new fields.StringField({initial: "", blank: true, required: false}),
            rangeStarshipMedium: new fields.StringField({initial: "", blank: true, required: false}),
            rangeStarshipLong: new fields.StringField({initial: "", blank: true, required: false}),
            // Defense Systems.
            shieldRating: new fields.StringField({initial: "", blank: true, required: false}),
            reflexDefenseBonus: new fields.StringField({initial: "", blank: true, required: false}),
            hitPointEq: new fields.StringField({initial: "", blank: true, required: false}),
            // Movement Systems. `hyperdrive` deliberately excluded — see default-changes.mjs.
            speedStarshipScale: new fields.StringField({initial: "", blank: true, required: false}),
            dexterityBonus: new fields.StringField({initial: "", blank: true, required: false}),
            astrogationBonus: new fields.StringField({initial: "", blank: true, required: false})
        };
    }
}
