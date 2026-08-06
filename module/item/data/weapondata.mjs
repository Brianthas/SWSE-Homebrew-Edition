import ItemSystemDataModel from "./abstract.mjs";
import {BaseItemFields} from "./templates/base.mjs";
import {ItemFields} from "./templates/item.mjs";
import {CategoriesFields} from "./templates/categories.mjs";
import {ModifiableFields} from "./templates/modifiable.mjs";
import {SourceFields} from "./templates/source.mjs";
import {ModeFields} from "./templates/mode.mjs";

const fields = foundry.data.fields;

/**
 * Matches template.json Item > weapon (templates: base, item, categories, modifiable, source, mode)
 * plus the weapon-specific "weapon" object and the "equipped"/"stripping" fields, which are used
 * throughout item.mjs/actor.mjs but were never declared in template.json at all — they must be
 * declared here or they'd start getting stripped too, now that this type has an explicit schema.
 */
export default class WeaponData extends ItemSystemDataModel {
    static _systemType = "weapon";

    static defineSchema() {
        return {
            ...BaseItemFields(),
            ...ItemFields(),
            ...CategoriesFields(),
            ...ModifiableFields(),
            ...SourceFields(),
            ...ModeFields(),
            weapon: new fields.ObjectField({initial: {}}),
            equipped: new fields.StringField({initial: "unequipped", blank: true, required: false}),
            stripping: new fields.ObjectField({initial: {}})
        };
    }
}
