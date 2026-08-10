import {getInheritableAttribute} from "../../../attribute-helper.mjs";
import {KIT_SLOT_SIZE_PENALTY} from "../../../common/constants.mjs";
import {toNumber} from "../../../common/util.mjs";

const fields = foundry.data.fields;

export class SlotFields {
    static get common() {
        return {
            lightSlots: new fields.SchemaField({
                used: new fields.NumberField({initial: 0, integer: true, min: 0, label: "Light Slots Used"}),
                max: new fields.NumberField({initial: 0, integer: true, min: 0, label: "Light Slots Max"}),
            }),
            kitSlots: new fields.SchemaField({
                used: new fields.NumberField({initial: 0, integer: true, min: 0, label: "Kit Slots Used"}),
                max: new fields.NumberField({initial: 0, integer: true, min: 0, label: "Kit Slots Max"}),
            }),
        };
    }
}

/**
 * Homebrew: "Light" and "Kit" carrying-capacity slots, replacing weight-based encumbrance.
 * Light slots = Strength score. Kit slots = Strength modifier + 1 (min 1), reduced by size
 * below Medium. Both doubled by the "Extended Capacity" feat. Character-only (vehicles keep
 * their existing cargo/weight tracking, untouched by this).
 */
export class SlotFunctions {
    _prepareSlotsDerivedData() {
        let system = this;
        const actor = system.parent;

        const extendedCapacity = getInheritableAttribute({
            entity: actor,
            attributeKey: "capacitySlotMultiplier",
            reduce: "MAX",
        }) || 1;

        const strScore = actor.system.abilities.str.value;
        const strMod = actor.system.abilities.str.mod;
        // actor.size (the Size dropdown) is the single source of truth for a character's
        // declared size — not getResolvedSize's item/changes-driven resolution, which reads a
        // leftover size-named Trait item from before the size-table rework.
        const size = actor.size.name;
        const kitSizePenalty = KIT_SLOT_SIZE_PENALTY[size] || 0;

        system.lightSlots.max = strScore * extendedCapacity;
        system.kitSlots.max = Math.max(1, strMod + 1 - kitSizePenalty) * extendedCapacity;

        let lightUsed = 0;
        let kitUsed = 0;
        // Homebrew: only equipped gear counts against carrying capacity — an item sitting
        // unused in a pack shouldn't cost a Light/Kit slot. Some items carry the literal
        // string "unequipped" rather than null/"" for their off state, which is truthy in
        // JS, so check the actual value rather than relying on truthiness.
        for (let item of actor.items.values()) {
            if (item.system.equipped !== "equipped") continue;
            let quantity = toNumber(item.system.quantity) || 1;
            let lightCost = toNumber(getInheritableAttribute({
                entity: item,
                attributeKey: "lightSlotCost",
                reduce: "SUM",
            }));
            let kitCost = toNumber(getInheritableAttribute({
                entity: item,
                attributeKey: "kitSlotCost",
                reduce: "SUM",
            }));
            // Homebrew: "Integrated" gear (surgically built-in rather than just carried) costs
            // double its own slots — a per-item toggle, distinct from capacitySlotMultiplier
            // above which doubles the actor's whole pool instead of one item's cost.
            let itemMultiplier = toNumber(getInheritableAttribute({
                entity: item,
                attributeKey: "slotCostMultiplier",
                reduce: "MAX",
            })) || 1;
            lightUsed += lightCost * quantity * itemMultiplier;
            kitUsed += kitCost * quantity * itemMultiplier;
        }

        system.lightSlots.used = lightUsed;
        system.kitSlots.used = kitUsed;
    }
}
