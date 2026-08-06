import ItemSystemDataModel from "./abstract.mjs";
import {BaseItemFields} from "./templates/base.mjs";
import {PrerequisitesFields} from "./templates/prerequisites.mjs";
import {CategoriesFields} from "./templates/categories.mjs";
import {SourceFields} from "./templates/source.mjs";

/** Matches template.json Item > feat (templates: base, prerequisites, categories, source). */
export default class FeatData extends ItemSystemDataModel {
    static _systemType = "feat";

    static defineSchema() {
        return {
            ...BaseItemFields(),
            ...PrerequisitesFields(),
            ...CategoriesFields(),
            ...SourceFields()
        };
    }
}
