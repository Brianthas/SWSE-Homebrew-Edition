import ItemSystemDataModel from "./abstract.mjs";
import {BaseItemFields} from "./templates/base.mjs";
import {ItemFields} from "./templates/item.mjs";
import {CategoriesFields} from "./templates/categories.mjs";
import {SourceFields} from "./templates/source.mjs";

/**
 * "background" has no template.json declaration. common/constants.mjs lists background subtype
 * categories ("event", "occupation", "planet of origin"), implying the "item" template's subtype
 * field is in real use — included for that reason even though background isn't a physical object.
 */
export default class BackgroundData extends ItemSystemDataModel {
    static _systemType = "background";

    static defineSchema() {
        return {
            ...BaseItemFields(),
            ...ItemFields(),
            ...CategoriesFields(),
            ...SourceFields()
        };
    }
}
