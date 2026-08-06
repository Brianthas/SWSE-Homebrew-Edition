import ItemSystemDataModel from "./abstract.mjs";
import {BaseItemFields} from "./templates/base.mjs";
import {PrerequisitesFields} from "./templates/prerequisites.mjs";
import {CategoriesFields} from "./templates/categories.mjs";
import {SourceFields} from "./templates/source.mjs";

const fields = foundry.data.fields;

/** Matches template.json Item > talent (templates: base, prerequisites, categories, source) plus talent-tree fields. */
export default class TalentData extends ItemSystemDataModel {
    static _systemType = "talent";

    static defineSchema() {
        return {
            ...BaseItemFields(),
            ...PrerequisitesFields(),
            ...CategoriesFields(),
            ...SourceFields(),
            talentTree: new fields.StringField({initial: "", blank: true, required: false}),
            talentTreeSource: new fields.StringField({initial: "", blank: true, required: false}),
            talentTreeUrl: new fields.StringField({initial: "", blank: true, required: false}),
            bonusTalentTree: new fields.StringField({initial: "", blank: true, required: false})
        };
    }
}
