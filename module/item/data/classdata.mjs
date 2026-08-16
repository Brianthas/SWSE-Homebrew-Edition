import ItemSystemDataModel from "./abstract.mjs";
import {BaseItemFields} from "./templates/base.mjs";
import {PrerequisitesFields} from "./templates/prerequisites.mjs";
import {HealthFields} from "./templates/health.mjs";
import {LevelsFields} from "./templates/levels.mjs";

const fields = foundry.data.fields;

/**
 * Matches template.json Item > class (templates: base, prerequisites, health, levels) plus
 * "levelsTaken" - undeclared in template.json but directly read/written throughout actor.mjs/
 * item.mjs (character levels at which this class was taken, e.g. [1, 3, 5] for multiclassing).
 * Distinct from "levels" (per-level bonus data, keyed by level number).
 */
export default class ClassData extends ItemSystemDataModel {
    static _systemType = "class";

    static defineSchema() {
        return {
            ...BaseItemFields(),
            ...PrerequisitesFields(),
            ...HealthFields(),
            ...LevelsFields(),
            levelsTaken: new fields.ArrayField(new fields.NumberField({integer: true}))
        };
    }
}
