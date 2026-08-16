import ItemSystemDataModel from "./abstract.mjs";
import {BaseItemFields} from "./templates/base.mjs";
import {ItemFields} from "./templates/item.mjs";
import {CategoriesFields} from "./templates/categories.mjs";
import {ModifiableFields} from "./templates/modifiable.mjs";
import {SourceFields} from "./templates/source.mjs";

const fields = foundry.data.fields;

/**
 * Matches template.json Item > armor (templates: base, item, categories, modifiable, source) plus
 * the armor-specific "armorType" field and the "equipped"/"stripping" fields used throughout
 * item.mjs/actor.mjs but never declared in template.json (see weapondata.mjs for the same note).
 */
export default class ArmorData extends ItemSystemDataModel {
    static _systemType = "armor";

    static defineSchema() {
        return {
            ...BaseItemFields(),
            ...ItemFields(),
            ...CategoriesFields(),
            ...ModifiableFields(),
            ...SourceFields(),
            armorType: new fields.StringField({initial: "", blank: true, required: false}),
            equipped: new fields.StringField({initial: "", blank: true, required: false}),
            stripping: new fields.ObjectField({initial: {}}),
            armorFlatSpeedPenalty: new fields.NumberField({initial: null, required: false}),
            // Flat number, or the literal string "str" (substitute Strength modifier) - see
            // SWSEItem#armorDexterityOverride.
            armorDexterityOverride: new fields.StringField({initial: "", blank: true, required: false}),
            armorFlatCheckPenalty: new fields.NumberField({initial: null, required: false}),
            strengthBonus: new fields.NumberField({initial: null, required: false}),
            damageReduction: new fields.NumberField({initial: null, required: false})
        };
    }
}
