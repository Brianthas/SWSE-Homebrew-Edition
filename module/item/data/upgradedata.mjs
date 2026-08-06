import ItemSystemDataModel from "./abstract.mjs";
import {BaseItemFields} from "./templates/base.mjs";
import {ItemFields} from "./templates/item.mjs";
import {ModFields} from "./templates/mod.mjs";

const fields = foundry.data.fields;

/**
 * Matches template.json Item > upgrade (templates: base, item, mod) plus the "upgrade" object and
 * "equipped"/"stripping" — undeclared in template.json, but "upgrade" is listed in
 * common/constants.mjs's EQUIPABLE_TYPES and item.mjs's getStripping() is used generically across
 * equipable types, so both are needed here too (see weapondata.mjs for the same note).
 */
export default class UpgradeData extends ItemSystemDataModel {
    static _systemType = "upgrade";

    static defineSchema() {
        return {
            ...BaseItemFields(),
            ...ItemFields(),
            ...ModFields(),
            upgrade: new fields.ObjectField({initial: {}}),
            equipped: new fields.StringField({initial: "unequipped", blank: true, required: false}),
            stripping: new fields.ObjectField({initial: {}})
        };
    }
}
