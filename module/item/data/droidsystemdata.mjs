import ItemSystemDataModel from "./abstract.mjs";
import {BaseItemFields} from "./templates/base.mjs";
import {ItemFields} from "./templates/item.mjs";
import {CategoriesFields} from "./templates/categories.mjs";
import {SourceFields} from "./templates/source.mjs";

const fields = foundry.data.fields;

/**
 * "droid system" (note: type key literally contains a space) has no template.json declaration.
 * actor.mjs groups it with weapon/armor/equipment/vehicleSystem/implant in the same
 * equipped-item-cache loop, so it gets the same treatment (see implantdata.mjs/vehiclesystemdata.mjs).
 */
export default class DroidSystemData extends ItemSystemDataModel {
    static _systemType = "droid system";

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
