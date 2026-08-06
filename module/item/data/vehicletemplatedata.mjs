import ItemSystemDataModel from "./abstract.mjs";
import {BaseItemFields} from "./templates/base.mjs";
import {ItemFields} from "./templates/item.mjs";
import {ModFields} from "./templates/mod.mjs";

/** Matches template.json Item > vehicleTemplate (templates: base, item, mod). */
export default class VehicleTemplateData extends ItemSystemDataModel {
    static _systemType = "vehicleTemplate";

    static defineSchema() {
        return {
            ...BaseItemFields(),
            ...ItemFields(),
            ...ModFields()
        };
    }
}
