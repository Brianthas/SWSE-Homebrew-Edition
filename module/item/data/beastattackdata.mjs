import ItemSystemDataModel from "./abstract.mjs";
import {BaseItemFields} from "./templates/base.mjs";
import {ItemFields} from "./templates/item.mjs";
import {CategoriesFields} from "./templates/categories.mjs";
import {ModifiableFields} from "./templates/modifiable.mjs";
import {SourceFields} from "./templates/source.mjs";
import {ModeFields} from "./templates/mode.mjs";

/** Matches template.json Item > beastAttack (templates: base, item, categories, modifiable, source, mode). */
export default class BeastAttackData extends ItemSystemDataModel {
    static _systemType = "beastAttack";

    static defineSchema() {
        return {
            ...BaseItemFields(),
            ...ItemFields(),
            ...CategoriesFields(),
            ...ModifiableFields(),
            ...SourceFields(),
            ...ModeFields()
        };
    }
}
