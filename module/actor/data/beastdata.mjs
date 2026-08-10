import {CharacterDataModel} from "./characterdata.mjs";
import {beastSizeArray} from "../../common/constants.mjs";

const fields = foundry.data.fields;

export class BeastDataModel extends CharacterDataModel {
    static _systemType = "beast";

    static defineSchema() {
        const schema = super.defineSchema();
        // Homebrew Beast HD table needs a much wider size range than the 3-choice player-facing
        // field in TraitsFields#_commonCharacter().
        schema.size = new fields.StringField({
            initial: "Medium",
            blank: false,
            choices: beastSizeArray,
            label: "Size",
        });
        return schema;
    }
}
