import ItemSystemDataModel from "./abstract.mjs";
import {BaseItemFields} from "./templates/base.mjs";
import {CategoriesFields} from "./templates/categories.mjs";
import {SourceFields} from "./templates/source.mjs";

/**
 * "destiny" has no template.json declaration and no strong type-specific evidence found in code
 * beyond being read as a generic itemTypes["destiny"] list — given base + categories + source,
 * matching other narrative/non-physical content types (trait-shaped minus prerequisites).
 */
export default class DestinyData extends ItemSystemDataModel {
    static _systemType = "destiny";

    static defineSchema() {
        return {
            ...BaseItemFields(),
            ...CategoriesFields(),
            ...SourceFields()
        };
    }
}
