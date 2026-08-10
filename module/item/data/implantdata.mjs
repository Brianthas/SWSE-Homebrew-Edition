import ItemSystemDataModel from "./abstract.mjs";
import {BaseItemFields} from "./templates/base.mjs";
import {ItemFields} from "./templates/item.mjs";
import {CategoriesFields} from "./templates/categories.mjs";
import {SourceFields} from "./templates/source.mjs";

const fields = foundry.data.fields;

/**
 * "implant" has no template.json declaration at all — schema built from direct code evidence:
 * actor.mjs checks implant.system.equipped === "equipped", and common/constants.mjs lists implant
 * subtype categories (Bio-Implants, Cybernetic Devices, etc.), implying the "item" template's
 * subtype/cost/weight fields are in real use. stripping included defensively, same as other
 * equipable-style items (see weapondata.mjs).
 */
export default class ImplantData extends ItemSystemDataModel {
    static _systemType = "implant";

    static defineSchema() {
        return {
            ...BaseItemFields(),
            ...ItemFields(),
            ...CategoriesFields(),
            ...SourceFields(),
            equipped: new fields.StringField({initial: "", blank: true, required: false}),
            stripping: new fields.ObjectField({initial: {}}),
            cybernetic: new fields.BooleanField({initial: false, required: false}),
            // Strings, not numbers — real data includes formatting/annotations (e.g. "12,000
            // (2,000 if both legs are mechanical)", "+10 (no attack if both legs are mechanical)").
            installationCost: new fields.StringField({initial: "", blank: true, required: false}),
            rejectionAttackBonus: new fields.StringField({initial: "", blank: true, required: false}),
            implantDisruption: new fields.BooleanField({initial: false, required: false})
        };
    }
}
