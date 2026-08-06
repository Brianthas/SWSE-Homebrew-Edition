import ItemSystemDataModel from "./abstract.mjs";
import {BaseItemFields} from "./templates/base.mjs";
import {ItemFields} from "./templates/item.mjs";
import {CategoriesFields} from "./templates/categories.mjs";
import {ModifiableFields} from "./templates/modifiable.mjs";
import {SourceFields} from "./templates/source.mjs";

const fields = foundry.data.fields;

/**
 * Matches template.json Item > equipment (templates: base, item, categories, modifiable, source)
 * plus the type-specific "equipment" object and "equipped"/"stripping", undeclared in template.json
 * but used throughout item.mjs/actor.mjs (see weapondata.mjs for the same note).
 */
export default class EquipmentData extends ItemSystemDataModel {
    static _systemType = "equipment";

    static defineSchema() {
        return {
            ...BaseItemFields(),
            ...ItemFields(),
            ...CategoriesFields(),
            ...ModifiableFields(),
            ...SourceFields(),
            equipment: new fields.ObjectField({initial: {}}),
            equipped: new fields.StringField({initial: "unequipped", blank: true, required: false}),
            stripping: new fields.ObjectField({initial: {}})
        };
    }
}
