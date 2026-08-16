import ItemSystemDataModel from "./abstract.mjs";
import {BaseItemFields} from "./templates/base.mjs";
import {CategoriesFields} from "./templates/categories.mjs";
import {SourceFields} from "./templates/source.mjs";
import {PrerequisitesFields} from "./templates/prerequisites.mjs";

const fields = foundry.data.fields;

/**
 * Matches template.json Item > trait (templates: base, categories, source, prerequisites) plus
 * "equipped"/"stripping" - undeclared in template.json, but "trait" is listed in
 * common/constants.mjs's EQUIPABLE_TYPES (traits can be equipped/toggled), so both are needed
 * (see weapondata.mjs for the same note).
 */
export default class TraitData extends ItemSystemDataModel {
    static _systemType = "trait";

    static defineSchema() {
        return {
            ...BaseItemFields(),
            ...CategoriesFields(),
            ...SourceFields(),
            ...PrerequisitesFields(),
            equipped: new fields.StringField({initial: "", blank: true, required: false}),
            stripping: new fields.ObjectField({initial: {}})
        };
    }
}
