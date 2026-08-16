import ItemSystemDataModel from "./abstract.mjs";
import {BaseItemFields} from "./templates/base.mjs";
import {ItemFields} from "./templates/item.mjs";
import {CategoriesFields} from "./templates/categories.mjs";

/**
 * "vehicleBaseType" has no template.json declaration. actor/warnings.mjs actively tells users to
 * remove this item type from their sheet ("you may notice strange behavior") - it's legacy/on its
 * way out. Given a minimal safe schema (base + item + categories) rather than deep investment.
 */
export default class VehicleBaseTypeData extends ItemSystemDataModel {
    static _systemType = "vehicleBaseType";

    static defineSchema() {
        return {
            ...BaseItemFields(),
            ...ItemFields(),
            ...CategoriesFields()
        };
    }
}
