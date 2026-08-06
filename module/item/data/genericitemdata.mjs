import ItemSystemDataModel from "./abstract.mjs";
import {BaseItemFields} from "./templates/base.mjs";
import {CategoriesFields} from "./templates/categories.mjs";
import {SourceFields} from "./templates/source.mjs";
import {PrerequisitesFields} from "./templates/prerequisites.mjs";
import {ModFields} from "./templates/mod.mjs";

/**
 * Shared DataModel classes for Item types whose template.json composition is identical to another
 * type already covered, so no need for a one-off file each. Registered per-type in swse.mjs.
 */

/** base + categories + source (forcePower, starShipManeuver, affiliation, forceTechnique, forceSecret, forceRegimen). */
export class BaseCategoriesSourceData extends ItemSystemDataModel {
    static defineSchema() {
        return {
            ...BaseItemFields(),
            ...CategoriesFields(),
            ...SourceFields()
        };
    }
}

/** base + source (classFeature). */
export class BaseSourceData extends ItemSystemDataModel {
    static defineSchema() {
        return {
            ...BaseItemFields(),
            ...SourceFields()
        };
    }
}

/** base + categories + source + prerequisites (trait-shaped: beastSense, beastType, beastQuality). */
export class BaseCategoriesSourcePrerequisitesData extends ItemSystemDataModel {
    static defineSchema() {
        return {
            ...BaseItemFields(),
            ...CategoriesFields(),
            ...SourceFields(),
            ...PrerequisitesFields()
        };
    }
}

/** base + mod (template). */
export class BaseModData extends ItemSystemDataModel {
    static defineSchema() {
        return {
            ...BaseItemFields(),
            ...ModFields()
        };
    }
}

/** base only (language). */
export class BaseOnlyData extends ItemSystemDataModel {
    static defineSchema() {
        return {
            ...BaseItemFields()
        };
    }
}
