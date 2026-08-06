import ItemSystemDataModel from "./abstract.mjs";
import {BaseItemFields} from "./templates/base.mjs";
import {CategoriesFields} from "./templates/categories.mjs";
import {SourceFields} from "./templates/source.mjs";

/**
 * "hazard" has no template.json declaration. No equipped/physical-item evidence found in code
 * (environmental/encounter content, not gear) — given base + categories + source, matching the
 * shape used by similar non-physical content types (forcePower, trait, etc.).
 */
export default class HazardData extends ItemSystemDataModel {
    static _systemType = "hazard";

    static defineSchema() {
        return {
            ...BaseItemFields(),
            ...CategoriesFields(),
            ...SourceFields()
        };
    }
}
