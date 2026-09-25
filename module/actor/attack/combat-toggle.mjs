import {getInheritableAttribute} from "../../attribute-helper.mjs";
import {appendNumericTerm, appendTerm, appendTerms, toNumber} from "../../common/util.mjs";

const half = level => Math.floor(level / 2);

/**
 * Table-driven registry of situational combat bonuses the player can toggle on/off from the
 * sheet (as opposed to the ephemeral, per-roll-dialog "Miscellaneous Bonus" text boxes). Toggle
 * state is persisted on the actor (`system.combatToggles`), actor-global rather than per-weapon,
 * since these are conditions about the attacker's current situation (flat-footed target, a
 * designated opponent, etc.), not properties of a specific weapon.
 *
 * Class features are made available by the change key that grants them. The Bounty Hunter's level
 * effects write `familiarFoe`; the Agent, Engineer and Operative abilities (`mark`,
 * `targetedSuspect`, ...) are written by the trait picked when the class is first taken. The bonus
 * is computed from the level in the named class, and a toggle whose bonus is 0 at the character's
 * level is not offered.
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
    {
        // Core Rulebook 208: once per encounter, designate an opponent; damage rolls against it
        // gain a bonus equal to the class level for the rest of the encounter.
        id: "huntersTarget",
        label: "Hunter's Target",
        appliesTo: "damage",
        availability: {talentName: "Hunter's Target"},
        bonus: {type: "classLevel", className: "Bounty Hunter", amount: level => level},
    },
    {
        // Scum and Villainy 30: one-half class level on damage rolls against the marked target.
        id: "mark",
        label: "Mark",
        appliesTo: "damage",
        availability: {grantAttributeKey: "mark"},
        bonus: {type: "classLevel", className: "Operative", amount: half},
    },
    {
        // Core Rulebook 209: one-half class level on attack rolls against the observed opponent.
        // The matching Reflex bonus against that opponent's attacks is not applied, because a
        // toggle would raise Reflex against every attacker.
        id: "familiarFoe",
        label: "Familiar Foe",
        appliesTo: "attack",
        availability: {grantAttributeKey: "familiarFoe"},
        bonus: {type: "classLevel", className: "Bounty Hunter", amount: half},
    },
    {
        // Force Unleashed 46: one-half class level on attack rolls against the observed opponent.
        // The same bonus on Deception, Perception and Persuasion checks is not applied.
        id: "targetedSuspect",
        label: "Targeted Suspect",
        appliesTo: "attack",
        availability: {grantAttributeKey: "targetedSuspect"},
        bonus: {type: "classLevel", className: "Agent", amount: half},
    },
    {
        // Force Unleashed 50: an unarmed attack declared as a stun attack deals +1 die at 2nd
        // level, +2 at 6th and +3 at 10th, and deals Stun damage.
        id: "unarmedStun",
        label: "Unarmed Stun",
        appliesTo: "damage",
        weapon: "unarmed",
        damageType: "Stun",
        availability: {grantAttributeKey: "unarmedStun"},
        bonus: {
            type: "classLevelWeaponDice",
            className: "Operative",
            amount: level => level >= 10 ? 3 : level >= 6 ? 2 : level >= 2 ? 1 : 0,
        },
    },
];

/**
 * Class features that apply to one attack roll at a time. These are offered as an unchecked box in
 * the attack dialog instead of a sheet toggle, so they cannot be left on by mistake.
 */
export const ATTACK_OPTION_DEFINITIONS = [
    {
        // Clone Wars 47: the first attack roll in a round against a target that is unaware of you
        // or denied its Dexterity bonus to Reflex Defense gains one-half class level.
        id: "surpriseAttack",
        label: "Surprise Attack",
        appliesTo: "attack",
        availability: {grantAttributeKey: "surpriseAttack"},
        bonus: {type: "classLevel", className: "Operative", amount: half},
    },
    {
        // Scum and Villainy 34: +2 competence bonus on an attack roll, a number of times per
        // encounter equal to one-half class level. Offered from 2nd level, the first level with a
        // use; the uses are not counted.
        id: "veteranPrivateer",
        label: "Veteran Privateer",
        appliesTo: "attack",
        availability: {grantAttributeKey: "veteranPrivateer"},
        bonus: {type: "classLevel", className: "Agent", amount: level => level >= 2 ? 2 : 0},
    },
];

/**
 * @param {SWSEActor} actor
 * @param {string} className
 * @return {number} levels taken across every class item of that name
 */
export function getClassLevel(actor, className) {
    return Array.from(actor?.items ?? [])
        .filter(item => item.type === "class" && item.name === className)
        .reduce((sum, item) => sum + (item.levelsTaken?.length || 0), 0);
}

/**
 * @return {number|undefined} the bonus a class-level definition grants this actor, or undefined
 *  when the definition's size is only known at roll time
 */
function classLevelAmount(def, actor) {
    const bonus = def.bonus;
    if (!bonus.className) {
        return undefined;
    }
    return bonus.amount(getClassLevel(actor, bonus.className));
}

function isAvailable(def, actor) {
    const availability = def.availability || {};
    if (availability.grantAttributeKey && !getInheritableAttribute({
        entity: actor,
        attributeKey: availability.grantAttributeKey,
        reduce: "OR",
    })) {
        return false;
    }
    if (availability.talentName && !Array.from(actor.items ?? [])
        .some(item => item.type === "talent" && item.name === availability.talentName)) {
        return false;
    }
    const amount = classLevelAmount(def, actor);
    return amount === undefined || amount > 0;
}

function appliesToWeapon(def, attack) {
    if (def.weapon === "unarmed") {
        return !!attack.isUnarmed;
    }
    return true;
}

function summarize(def, actor) {
    const amount = classLevelAmount(def, actor);
    if (amount === undefined) {
        return "";
    }
    if (def.bonus.type === "classLevelWeaponDice") {
        const dice = `+${amount} ${amount === 1 ? "die" : "dice"}`;
        return def.damageType ? `${dice}, ${def.damageType}` : dice;
    }
    return `+${amount} ${def.appliesTo}`;
}

/**
 * @param {SWSEActor} actor
 * @return {[{id:string, label:string, summary:string, active:boolean}]} toggles the actor currently has access to
 */
export function getAvailableCombatToggles(actor) {
    if (!actor) {
        return [];
    }
    const activeToggles = actor.system.combatToggles || {};
    return COMBAT_TOGGLE_DEFINITIONS
        .filter(def => isAvailable(def, actor))
        .map(def => ({
            id: def.id,
            label: def.label,
            summary: summarize(def, actor),
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
        case "classLevel":
            return appendNumericTerm(classLevelAmount(def, actor), def.label);
        case "classLevelWeaponDice": {
            const faces = context?.weaponDieFaces;
            const count = classLevelAmount(def, actor);
            if (!faces || !count) {
                return [];
            }
            return appendTerm(`${count}d${faces}`, def.label);
        }
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

function activeDefinitions(attack, rollType) {
    const actor = attack?.actor;
    if (!actor) {
        return [];
    }
    const activeToggles = actor.system?.combatToggles || {};
    return COMBAT_TOGGLE_DEFINITIONS.filter(def =>
        (!rollType || def.appliesTo === rollType)
        && activeToggles[def.id]
        && appliesToWeapon(def, attack)
        && isAvailable(def, actor));
}

/**
 * @param {Attack} attack
 * @param {"attack"|"damage"} rollType
 * @param {{weaponDieFaces:number}} [context] roll-specific data resolver types may need
 *  (e.g. matchWeaponDie needs the equipped weapon's own die size, already resolved by the caller)
 * @return {RollTerm[]}
 */
export function getActiveCombatToggleTerms(attack, rollType, context = {}) {
    return activeDefinitions(attack, rollType).flatMap(def => resolveBonusTerms(def, attack.actor, context));
}

/**
 * @param {Attack} attack
 * @return {string|undefined} the damage type an active toggle imposes on this attack
 */
export function getActiveCombatToggleDamageType(attack) {
    return activeDefinitions(attack).find(def => def.damageType)?.damageType;
}

/**
 * Rendered as checkboxes in the single-attack "Attack with Bonus" dialog (attackOptions in
 * common/util.mjs). Full Attack has no bonus dialog, so these are not offered there.
 *
 * @param {Attack} attack
 * @return {[{id:string, label:string, appliesTo:"attack"|"damage", amount:number}]} the single-roll
 *  class features this attack can use
 */
export function getClassFeatureAttackChoices(attack) {
    const actor = attack?.actor;
    if (!actor) {
        return [];
    }
    return ATTACK_OPTION_DEFINITIONS
        .filter(def => appliesToWeapon(def, attack) && isAvailable(def, actor))
        .map(def => ({id: def.id, label: def.label, appliesTo: def.appliesTo, amount: classLevelAmount(def, actor)}));
}
