import {COMMMA_LIST, innerJoin, toNumber} from "./util.mjs";

// The homebrew damage types are "Ion" and "Stun"; some pack items still carry the book's
// "Energy (Ion)" and "Energy (Stun)", so both spellings count.
const ION_TYPES = ["Ion", "Energy (Ion)"];
const STUN_TYPES = ["Stun", "Energy (Stun)"];

/**
 * Determines if the provided damage types can bypass shields.
 *
 * @param {string[]} damageTypes - An array of damage type strings to evaluate.
 * @return {boolean} Returns true if the shields can be bypassed, otherwise returns false.
 */
export function bypassShields(damageTypes) {
    // if(damageTypes.includes("Lightsabers")){
    //     return false;
    // }
    if (!damageTypes.includes("Energy") && !damageTypes.some(type => ION_TYPES.includes(type))) {
        return true;
    }
    return false;
}

/**
 * Damage left after damage reduction and the damage-type immunities. Shields are applied first,
 * by the caller.
 *
 * Lightsabers ignore damage reduction unless the target blocks lightsabers. Homebrew: organic
 * targets are immune to Ion damage, and droids, vehicles and other non-organic targets are immune
 * to Stun damage.
 *
 * @param {number} damage
 * @param {string[]} damageTypes
 * @param {object} target
 * @param {boolean} target.lightsaber the damage comes from a lightsaber
 * @param {{value: *, modifier: string}[]} target.damageReductions each DR's modifier lists the
 *     damage types that bypass it
 * @param {boolean} target.blocksLightsaber
 * @param {boolean} target.skipDamageReduction
 * @param {boolean} target.takesIonDamage a droid, a vehicle, or carrying unshielded cybernetics
 * @param {boolean} target.takesStunDamage organic
 * @param {string[]} [target.notes] receives why the damage changed, for the result message
 * @return {number}
 */
export function resolveDamageTaken(damage, damageTypes, target) {
    let total = damage;
    const notes = Array.isArray(target.notes) ? target.notes : [];

    const ignoresReduction = (target.lightsaber || damageTypes.includes("Lightsabers")) && !target.blocksLightsaber;
    if (!target.skipDamageReduction && ignoresReduction && (target.damageReductions || []).length > 0) {
        notes.push("lightsabers ignore Damage Reduction");
    }
    if (!target.skipDamageReduction && !ignoresReduction) {
        for (const damageReduction of target.damageReductions || []) {
            const modifier = damageReduction.modifier || "";
            if (!modifier || innerJoin(damageTypes, modifier.split(COMMMA_LIST)).length === 0) {
                total = Math.max(total - toNumber(damageReduction.value), 0);
                notes.push(`Damage Reduction ${toNumber(damageReduction.value)}`);
            }
        }
    }

    if (damageTypes.some(type => ION_TYPES.includes(type)) && !target.takesIonDamage) {
        total = 0;
        notes.push("immune to Ion");
    } else if (damageTypes.some(type => STUN_TYPES.includes(type)) && !target.takesStunDamage) {
        total = 0;
        notes.push("immune to Stun");
    }

    return Math.max(total, 0);
}
