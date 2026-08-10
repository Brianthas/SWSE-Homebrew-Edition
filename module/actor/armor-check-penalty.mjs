import {equippedItems, filterItemsByTypes} from "../common/util.mjs";
import {getInheritableAttribute} from "../attribute-helper.mjs";

/**
 *
 * @param actor {SWSEActor}
 * @returns {number}
 */
export function generateArmorCheckPenalties(actor) {
    // Homebrew: armor proficiency is unified (a single "Armor Proficiency" feat covers all
    // armor), replacing the old Light/Medium/Heavy tiered proficiency system.
    let armorProficiencies = getInheritableAttribute({
        entity: actor,
        attributeKey: "armorProficiency",
        reduce: "VALUES"
    });

    let actsAs = getInheritableAttribute({
        entity: actor,
        attributeKey: "actsAs",
        reduce: "VALUES"
    })

    let proficient = armorProficiencies.includes("armor");

    let wearingArmor = false;

    const armorItems = filterItemsByTypes(equippedItems(actor), ["armor"]).map(a => a.system.subtype);
    armorItems.push(...actsAs)
    for (let armor of armorItems) {
        if ('Armor' === armor) {
            wearingArmor = true;
        }
    }

    if (wearingArmor && !proficient) {
        return -10;
    }

    return 0;
}