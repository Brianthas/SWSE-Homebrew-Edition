import {getInheritableAttribute} from "../../attribute-helper.mjs";
import {appendNumericTerm, appendTerm, appendTerms, toNumber} from "../../common/util.mjs";

/**
 * Table-driven registry of situational combat bonuses the player can toggle on/off from the
 * sheet (as opposed to the ephemeral, per-roll-dialog "Miscellaneous Bonus" text boxes). Toggle
 * state is persisted on the actor (`system.combatToggles`), actor-global rather than per-weapon,
 * since these are conditions about the attacker's current situation (flat-footed target, charging,
 * etc.), not properties of a specific weapon.
 */
export const COMBAT_TOGGLE_DEFINITIONS = [
    {
        id: "sneakAttack",
        label: "Sneak Attack",
        appliesTo: "damage",
        availability: {grantAttributeKey: "sneakAttack"},
        // Homebrew: Sneak Attack adds one extra die of the weapon's OWN damage die per talent
        // take (a lightsaber's d8 weapon adds +Nd8), not a flat d6 - see matchWeaponDie below.
        bonus: {type: "matchWeaponDie", countAttributeKey: "sneakAttack", reduce: "SUM"},
    },
];

/**
 * @param {SWSEActor} actor
 * @return {[{id:string, label:string, active:boolean}]} toggles the actor currently has access to
 */
export function getAvailableCombatToggles(actor) {
    if (!actor) {
        return [];
    }
    const activeToggles = actor.system.combatToggles || {};
    return COMBAT_TOGGLE_DEFINITIONS
        .filter(def => !def.availability?.grantAttributeKey || !!getInheritableAttribute({
            entity: actor,
            attributeKey: def.availability.grantAttributeKey,
            reduce: "OR",
        }))
        .map(def => ({
            id: def.id,
            label: def.label,
            active: !!activeToggles[def.id],
        }));
}

function resolveBonusTerms(def, actor, context) {
    const bonus = def.bonus;
    switch (bonus.type) {
        case "flat":
            return appendNumericTerm(bonus.value, def.label);
        case "dice":
            return appendTerms(bonus.value, def.label);
        case "matchWeaponDie": {
            const faces = context?.weaponDieFaces;
            if (!faces) {
                return [];
            }
            const count = toNumber(getInheritableAttribute({
                entity: actor,
                attributeKey: bonus.countAttributeKey,
                reduce: bonus.reduce || "SUM",
            }));
            if (!count) {
                return [];
            }
            return appendTerm(`${count}d${faces}`, def.label);
        }
        default:
            return [];
    }
}

/**
 * @param {Attack} attack
 * @param {"attack"|"damage"} rollType
 * @param {{weaponDieFaces:number}} [context] roll-specific data resolver types may need
 *  (e.g. matchWeaponDie needs the equipped weapon's own die size, already resolved by the caller)
 * @return {RollTerm[]}
 */
export function getActiveCombatToggleTerms(attack, rollType, context = {}) {
    const actor = attack?.actor;
    if (!actor) {
        return [];
    }
    const activeToggles = actor.system.combatToggles || {};
    const terms = [];
    for (const def of COMBAT_TOGGLE_DEFINITIONS) {
        if (def.appliesTo !== rollType || !activeToggles[def.id]) {
            continue;
        }
        terms.push(...resolveBonusTerms(def, actor, context));
    }
    return terms;
}
