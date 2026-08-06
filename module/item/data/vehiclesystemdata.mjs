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
            equipped: new fields.StringField({initial: "unequipped", blank: true, required: false}),
            stripping: new fields.ObjectField({initial: {}})
        };
    }
}
