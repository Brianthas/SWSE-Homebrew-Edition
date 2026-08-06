import ItemSystemDataModel from "./abstract.mjs";
import {BaseItemFields} from "./templates/base.mjs";
import {CategoriesFields} from "./templates/categories.mjs";

const fields = foundry.data.fields;

/** Matches template.json Item > species (templates: base, categories) plus "traits". */
export default class SpeciesData extends ItemSystemDataModel {
    static _systemType = "species";

    static defineSchema() {
        return {
            ...BaseItemFields(),
            ...CategoriesFields(),
            traits: new fields.ArrayField(new fields.StringField())
        };
    }
}
