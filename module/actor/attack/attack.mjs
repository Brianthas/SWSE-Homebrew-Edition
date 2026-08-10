import {UnarmedAttack} from "../unarmed-attack.mjs";
import {CustomAttackItem} from "../custom-attack-item.mjs";
import {getInheritableAttribute} from "../../attribute-helper.mjs";
import {compareSizes, getSize} from "../size.mjs";
import {
    getFocusAttackBonuses,
    getPossibleProficiencies,
    getProficiencyBonus,
    getSpecializationDamageBonuses,
    isLightsaber,
    isMelee,
    isRanged,
    isThrown
} from "../attack-handler.mjs";
import {generateArmorCheckPenalties} from "../armor-check-penalty.mjs";
import SWSEActor from "../actor.mjs";
import {reduceWeaponRange, SWSEItem} from "../../item/item.mjs";
import {
    adjustDieSize,
    appendNumericTerm,
    appendTerm,
    appendTerms,
    d20Result,
    getAttackRange,
    getDistance,
    getOrdinal,
    increaseDieSize,
    minus,
    mult,
    plus,
    resolveValueArray,
    toNumber,
    toShortAttribute
} from "../../common/util.mjs";
import {SimpleCache} from "../../common/simple-cache.mjs";
import {weaponGroup} from "../../common/constants.mjs";
import {SWSE} from "../../common/config.mjs";
import {RollModifier, RollModifierChoice} from "../../common/roll-modifier.mjs";
import SWSETemplate from "../../template/SWSETemplate.mjs";

import {selectOption} from "../../common/helpers.mjs";
import {getCrewByQuality} from "../crewDelegate.mjs";
import {getActiveCombatToggleTerms} from "./combat-toggle.mjs";


export const outOfRange = "out of range";

// Homebrew: prefix marking an Attack's weaponId as a system.customAttacks entry rather than
// a real embedded item's uuid (or the "Unarmed Attack" sentinel) — see custom-attack-item.mjs.
export const CUSTOM_ATTACK_PREFIX = "CustomAttack:";


/**
 * Groups the tokens contained within each placed Region into actor targets.
 * RegionDocument#tokens already tracks containment for us, so no manual shape math is needed.
 *
 * @param {RegionDocument[]} regions
 * @return {[{location:{x,y}, actors:[]}]}
 */
export function selectActorsByTemplates(regions = []) {
    let actorsByLocation = [];
    let gridSize = canvas.scene.grid
    for (const region of regions) {
        const bounds = region.bounds;
        let x = Math.floor((bounds.x + bounds.width / 2) / gridSize.sizeX)
        let y = Math.floor((bounds.y + bounds.height / 2) / gridSize.sizeY)
        const tokenActors = [...region.tokens].map(token => token.actor);
        const actors = tokenActors.filter(actor => !!actor);
        if(tokenActors.length !== actors.length) {
            console.warn("user targeted a token with no actor")
            ui.notifications.warn("A Targeted Token has no Actor")
        }
        actorsByLocation.push({location: {x, y}, actors: actors});
    }
    return actorsByLocation;
}


export function cleanupTemplates(regions = []) {
    for (let region of regions) {
        if (region.getFlag("swse", "cleanUp")) {
            region.delete()
        }
    }
}

function simplify(attackSummaries) {
    for (const attackSummary of attackSummaries) {
        //console.log(attackSummary)
        attackSummary.damage = attackSummary.damage.total;
    }

    return attackSummaries;
}



export class Attack {
    static TYPES = {
        FULL_ATTACK: "FULL_ATTACK",
        SINGLE_ATTACK: "SINGLE_ATTACK"
    };

    #mapToStandardRanges(range) {
        if (range === "Grenades") {
            return "Thrown Weapons"
        }

        if (range.includes("Melee") || range.includes("Lightsabers")) {
            return "Melee Weapons"
        }

        return range;
    }

    get attackKey() {
        if ('Unarmed Attack' === this.weaponId) {
            return `${this.actorId}.Unarmed Attack`
        }
        return this.weaponId;
    }

    /**
     *
     * @param actorId {String} the actor that this attack belongs to.
     * @param weaponId {String} the weapon that is being used.
     * @param operatorId {String} the actor that is using the weapon
     * @param parentId {String} the parent actor of the weapon
     * @param options {object}
     */
    constructor(actorId, weaponId, operatorId, parentId, options = {}) {
        this.actorId = actorId;
        this.weaponId = weaponId;
        this.operatorId = operatorId;
        this.parentId = parentId;
        this.options = options;
        this.cache = new SimpleCache()
        this.cacheDisabled = false;
    }

    /**
     *
     * @param criteria
     * @param criteria.actorId {String} the actor that this attack belongs to.
     * @param criteria.weaponId {String} the weapon that is being used.
     * @param criteria.operatorId {String} the actor that is using the weapon
     * @param criteria.parentId {String} the parent actor of the weapon
     * @param criteria.options {object}
     * @return {Attack}
     */
    static create(criteria) {
        return new Attack(criteria.actorId, criteria.weaponId, criteria.operatorId, criteria.parentId || criteria.actorId, JSON.parse(JSON.stringify(criteria.options || {})));
    }

    static fromJSON(json) {
        if (typeof json === "string") {
            json = JSON.parse(unescape(json));
        }
        if (Array.isArray(json)) {
            let attks = [];
            for (let atk of json) {
                attks.push(this.create(atk))
            }
            return attks;
        }
        return this.create(json)
    }

    get toJSON() {
        return {
            actorId: this.actorId,
            weaponId: this.weaponId,
            operatorId: this.operatorId,
            parentId: this.parentId,
            options: this.options
        };
    }

    get toJSONString() {
        let value = this.toJSON;
        delete value.lazyResolve
        let s = JSON.stringify(value);
        return escape(s);
    }

    getCached(key, fn) {
        if (!this.cache || this.cacheDisabled) {
            return fn();
        }
        return this.cache.getCached(key, fn)
    }

    /**
     *
     * @returns {SWSEActor}
     */
    get actor() {
        return this.getCached("actor", () => {

            if (this.parentId) {
                let tokens = canvas.tokens.children || [];
                let token = tokens.flatMap(token => token.children).find(token => token.id === this.parentId);
                const actor = token?.document?.actor
                if (actor) {
                    return actor;
                }
            }

            if (this.actorId) {
                let find = fromUuidSync(this.actorId)

                if (find) {
                    return find;
                }

                let values = [...game.packs.values()];
                for (let pack of values.filter(pack => pack.documentClass.documentName === "Actor")) {
                    find = pack.get(this.actorId)

                    if (find) {
                        return find;
                    }
                }
                return find;
            }
            if (this.operatorId) {
                let provider = this.provider;
                let quality = this.crew.quality()?.quality;
                return getCrewByQuality(quality);
            }
        })
    }

    /**
     *
     * @returns {ActorData}
     */
    get provider() {
        return fromUuidSync(this.parentId);
    }

    /**
     *
     * @returns {ActorData}
     */
    get operator() {
        return fromUuidSync(this.operatorId) || getCrewByQuality(fromUuidSync(this.actorId).crew.quality);
    }

    /**
     *
     * @returns {ActorData}
     */
    get parent() {
        return fromUuidSync(this.parentId);
    }


    /**
     * Retrieves the item associated with the current weapon ID, or an unarmed attack
     * if the weapon ID corresponds to an unarmed attack.
     *
     * This method uses caching to optimize repeated access.
     *
     * @return {Object|undefined} The item object corresponding to the weapon ID,
     * an unarmed attack object if the weapon ID indicates an unarmed attack,
     * or undefined if no actor or item is found.
     */
    get item() {
        return this.getCached("item", () => {
            let provider = this.provider;
            let actor = !!provider ? provider : this.actor;
            if (!actor) {
                return undefined;
            }

            if ('Unarmed Attack' === this.weaponId) {
                return new UnarmedAttack(actor);
            }

            if (this.isCustomAttack) {
                const config = (actor.system.customAttacks || []).find(c => c.id === this.customAttackId);
                return config ? new CustomAttackItem(actor, config) : undefined;
            }

            return actor.items.find(i => i.uuid === this.weaponId);
        })
    }

    // weapon-block.hbs renders this directly as the attack card's icon (`<img src="{{attack.img}}">`).
    // Real weapon/beast-attack items already have their own img; UnarmedAttack/CustomAttackItem
    // (synthetic, non-Item "weapons") supply their own fallback via the same getter name.
    get img() {
        return this.item?.img;
    }

    get isCustomAttack() {
        return typeof this.weaponId === "string" && this.weaponId.startsWith(CUSTOM_ATTACK_PREFIX);
    }

    /**
     * The stand-in "Unarmed Attack" shown when a character has no equipped weapon or natural
     * weapon. It's synthesised rather than backed by a document (see UnarmedAttack), so there's
     * nothing to rename.
     */
    get isUnarmedAttackPlaceholder() {
        return this.weaponId === "Unarmed Attack";
    }

    get customAttackId() {
        return this.isCustomAttack ? this.weaponId.slice(CUSTOM_ATTACK_PREFIX.length) : undefined;
    }

    /**
     * Determines if the item is considered unarmed by checking its attributes and properties.
     *
     * @return {boolean} Returns true if the item is unarmed, otherwise false.
     */
    get isUnarmed() {
        return 0 < getInheritableAttribute({
            entity: this.item,
            attributeKey: ['unarmedModifier', 'unarmedBonusDamage']
        }).length || this.item?.isUnarmed || false;
    }

    modifiers(type) {
        let modifiers = this.options?.modifiers || [];
        if (type) {
            modifiers = modifiers.filter(item => item.type === type)
        }
        return modifiers;
    }

    /**
     * Retrieves the name of the item, accounting for specific conditions such as being unarmed and applying a name modifier.
     *
     * @return {string} The modified name of the item or the original name, based on the conditions.
     */
    get name() {
        let name = this.item.name;
        // A custom attack's blank Damage Die falls back to the natural unarmed damage die (see
        // CustomAttackItem#isUnarmed) purely for damage-resolution purposes — that shouldn't
        // also relabel it as "Unarmed Attack (Grapple)", which reads like an equipped item's
        // display name, not a standalone custom attack.
        const prefixUnarmed = this.isUnarmed && 'Unarmed Attack' !== name && !this.isCustomAttack;
        return (prefixUnarmed ? `Unarmed Attack (${name})` : name) + this.nameModifier;
    }

    get nameModifier() {
        let modifiers = [""];
        if (this.options.duplicateCount > 0) {
            modifiers.push(`#${this.options.duplicateCount + 1}`)
        }
        if (this.options.additionalAttack > 0) {
            modifiers.push(`(${getOrdinal(this.options.additionalAttack + 1)} attack)`)
        }
        if (this.options.doubleAttack) {
            modifiers.push(`(Double Attack)`)
        }
        if (this.options.tripleAttack) {
            modifiers.push(`(Triple Attack)`)
        }
        return modifiers.join(" ");
    }

    /**
     * Calculates and returns the attack roll for the given weapon and operator, including all applicable modifiers
     * such as base attack bonus, condition modifiers, proficiency bonuses, and other relevant effects.
     *
     * This roll incorporates rules for determining the contributions of attributes, proficiencies, focus bonuses,
     * vehicle-related bonuses, armor check penalties, as well as custom, temporary, or inheritable effects.
     * The function accounts for both operator and vehicle-based contexts when determining applicable terms.
     *
     * @return {Roll} A Roll object representing the calculated attack roll with all modifiers applied, or undefined if the operator or weapon is not defined.
     */
    get attackRoll() {
        const weapon = this.item;
        const parent = this.parent;
        const operator = this.operator;

        if (!operator || !weapon) {
            return;
        }

        //we start with a D20
        const terms = [D20(this.advantageMode)];

        terms.push(...appendNumericTerm(operator.baseAttackBonus, "Base Attack Bonus"));

        if (!parent || parent === operator) {
            let weaponTypes = getPossibleProficiencies(operator, weapon);
            terms.push(...appendNumericTerm(this.#resolveAttributeModifier(weapon, operator, weaponTypes), "Attribute Modifier"));
            terms.push(...getProficiencyBonus(operator, weaponTypes));
            terms.push(...getFocusAttackBonuses(operator, weaponTypes));
        } else {
            terms.push(...appendNumericTerm(parent.system.abilities.int.mod, "Vehicle Computer Bonus"))

            if (weapon.position === 'pilot' && operator.system.skills.pilot.trained) {
                terms.push(...appendNumericTerm(2, "Trained Pilot Bonus"))
            }
        }

        for (let mod of this.modifiers("attack")) {
            terms.push(...appendTerms(mod.value, mod.source))
        }

        terms.push(...appendNumericTerm(generateArmorCheckPenalties(operator), "Armor Check Penalty"));
        terms.push(...this.temporaryChanges?.filter(c => c.key === "toHitModifier").map(c => appendTerm(c.value, "Custom")).flat() || []);

        //toHitModifiers only apply to the weapon they are on.  a toHitModifier change that is not on a weapon always applies
        getInheritableAttribute({
            entity: [weapon, operator, this],
            attributeKey: "toHitModifier",
            parent: !!parent ? parent : operator,
            itemFilter: ((item) => item.type !== 'weapon'),
            reduce: "VALUES_WITH_MODIFIERS"
        }).forEach(val => {

            if(this.canEffectWeapon(val)) {
                terms.push(...appendTerms(val.value, val.source, val.modifiers))
            }
        })

        terms.push(...getActiveCombatToggleTerms(this, "attack"));

        return Roll.fromTerms(terms
            .filter(term => !!term));
    }

    /*
    checks if this can even be applied to the current weapon.  looks at prereqs and sees if the answer is a possible answer for this weapon
     */
    canEffectWeapon(value) {
        if(!value.modifiers || value.modifiers.length === 0) return true;

        for (const modifier of value.modifiers) {
            if(modifier.type === "RANGE"){
                const rangeBlock = SWSE.Combat.range[this.range]
                const possibleRanges = Object.keys(rangeBlock)
                if(!possibleRanges.includes(modifier.requirement.toLowerCase())) return false;
            }
        }
        return true;
    }

    #resolveAttributeModifier(item, actor, weaponTypes) {
        let attributeStats = []
        if (isRanged(item)) {
            attributeStats.push("DEX")
            // Homebrew: thrown weapons may use Strength instead of Dexterity.
            if (isThrown(item)) {
                attributeStats.push("STR")
            }
        } else {
            attributeStats.push("STR")
            // Homebrew: one-handed melee weapons may use Strength or Dexterity for attack,
            // unconditionally (no Weapon Focus or relative-size requirement). Two-handed
            // weapons cannot use Dexterity — except thrown weapons, which keep the choice
            // even when wielded two-handed.
            if (isThrown(item) || !this.#isTwoHandedMelee(actor, item)) {
                attributeStats.push("DEX")
            }
        }

        let baseMod = Math.max(...(attributeStats.map(stat => this.#getCharacterAttributeModifier(actor, stat))));

        // Homebrew: a persisted or in-dialog ability-override choice replaces the auto-picked
        // ability outright. Strength/Dexterity/Wisdom/Charisma are offered on every weapon; the
        // lightsaber-technique choices (Kinetic Combat, Noble Fencing Style) only apply to
        // lightsabers — see #getAbilityChoice. Ataru only affects damage (see
        // #getMeleeDamageAbilityModifier), attack is unaffected.
        const abilityChoice = this.#getAbilityChoice(item);
        if (["str", "dex", "int", "wis", "cha"].includes(abilityChoice)) {
            return this.#getCharacterAttributeModifier(actor, abilityChoice);
        }
        if (isLightsaber(item) && abilityChoice && abilityChoice !== "ataru") {
            return this.#lightsaberAttributeMod(actor, abilityChoice);
        }
        return baseMod;
    }

    /**
     * Homebrew: resolves the active ability-override choice for this attack's weapon. A pick
     * made in the one-shot attack dialog (this.lightsaberAbility, ephemeral, one-roll-only)
     * takes precedence when actively set; otherwise falls back to the weapon's persisted
     * system.abilityOverride, which is what the sheet-level selector writes to.
     */
    #getAbilityChoice(item) {
        if (this.lightsaberAbility && this.lightsaberAbility !== "str_dex") {
            return this.lightsaberAbility;
        }
        return item.system.abilityOverride || undefined;
    }

    /**
     * The damage-side counterpart. Falls back to the attack choice when unset, since a weapon
     * normally uses one ability for both — the split only matters for the cases that genuinely
     * differ (e.g. a turret attacking on Dexterity but damaging on Intelligence).
     */
    #getDamageAbilityChoice(item) {
        if (this.lightsaberAbility && this.lightsaberAbility !== "str_dex") {
            return this.lightsaberAbility;
        }
        return item.system.damageAbilityOverride || item.system.abilityOverride || undefined;
    }

    /**
     * Homebrew: resolves the ability modifier for a toggled lightsaber-ability choice.
     * "ataru" only replaces the damage-side ability (handled in #getMeleeDamageAbilityModifier);
     * for attack it's a no-op (Ataru doesn't change the attack roll).
     */
    #lightsaberAttributeMod(actor, choice) {
        if (choice === "kinetic_combat") {
            return Math.max(this.#getCharacterAttributeModifier(actor, "WIS"), this.#getCharacterAttributeModifier(actor, "CHA"));
        }
        if (choice === "noble_fencing") {
            return this.#getCharacterAttributeModifier(actor, "CHA");
        }
        return undefined;
    }

    /**
     * Homebrew: builds the one-roll-only ability-override radio for the attack dialog —
     * Strength/Dexterity auto-pick baseline plus explicit Str/Dex/Wis/Cha (offered on every
     * weapon, no gating), plus Ataru/Kinetic Combat/Noble Fencing Style (lightsabers only, each
     * shown only if the actor has the granting talent/power). Defaults to whichever choice is
     * currently persisted on the weapon (system.abilityOverride) so the dialog reflects the
     * sheet's baseline rather than always resetting to Auto. A pick made here overrides the
     * persisted value for this attack only — see #getAbilityChoice.
     */
    getAbilityModifierOptions() {
        const item = this.item;
        const actor = this.actor;
        const persisted = item.system.abilityOverride || "str_dex";

        let rollModifier = RollModifier.createRadio("lightsaberAbility", "Ability", item.id);
        rollModifier.CSSClasses.push("lightsaber-ability-modifier");

        rollModifier.addChoice(new RollModifierChoice("Auto (Strength/Dexterity)", "str_dex", persisted === "str_dex"));
        rollModifier.addChoice(new RollModifierChoice("Strength", "str", persisted === "str"));
        rollModifier.addChoice(new RollModifierChoice("Dexterity", "dex", persisted === "dex"));
        rollModifier.addChoice(new RollModifierChoice("Wisdom", "wis", persisted === "wis"));
        rollModifier.addChoice(new RollModifierChoice("Charisma", "cha", persisted === "cha"));

        if (isLightsaber(item)) {
            if (getInheritableAttribute({entity: actor, attributeKey: "lightsaberAtaru", reduce: "OR"})) {
                rollModifier.addChoice(new RollModifierChoice("Ataru (Double Dexterity, damage only)", "ataru", persisted === "ataru"));
            }
            if (getInheritableAttribute({entity: actor, attributeKey: "lightsaberKineticCombat", reduce: "OR"})) {
                rollModifier.addChoice(new RollModifierChoice("Kinetic Combat (Wisdom or Charisma)", "kinetic_combat", persisted === "kinetic_combat"));
            }
            if (getInheritableAttribute({entity: actor, attributeKey: "lightsaberNobleFencing", reduce: "OR"})) {
                rollModifier.addChoice(new RollModifierChoice("Noble Fencing Style (Charisma)", "noble_fencing", persisted === "noble_fencing"));
            }
        }

        return rollModifier.hasChoices() ? [rollModifier] : [];
    }

    /**
     * Persisted per-weapon ability-override choices for the sheet-level <select> (distinct from
     * getAbilityModifierOptions(), which builds the ephemeral one-roll-only dialog radio).
     * Str/Dex/Wis/Cha are offered on every weapon; the lightsaber techniques only when wielding
     * a lightsaber with the granting talent/power. Empty for the unarmed sudo-attack, which has
     * no real item to persist a choice on.
     * @return {[{value:string, label:string}]}
     */
    get abilityOverrideOptions() {
        const item = this.item;
        if (!item || this.isUnarmed) {
            return [];
        }
        const actor = this.actor;
        const options = [
            {value: "", label: "Auto (Strength/Dexterity)"},
            {value: "str", label: "Strength"},
            {value: "dex", label: "Dexterity"},
            {value: "int", label: "Intelligence"},
            {value: "wis", label: "Wisdom"},
            {value: "cha", label: "Charisma"},
        ];
        if (isLightsaber(item)) {
            if (getInheritableAttribute({entity: actor, attributeKey: "lightsaberAtaru", reduce: "OR"})) {
                options.push({value: "ataru", label: "Ataru (Double Dexterity, damage only)"});
            }
            if (getInheritableAttribute({entity: actor, attributeKey: "lightsaberKineticCombat", reduce: "OR"})) {
                options.push({value: "kinetic_combat", label: "Kinetic Combat (Wisdom or Charisma)"});
            }
            if (getInheritableAttribute({entity: actor, attributeKey: "lightsaberNobleFencing", reduce: "OR"})) {
                options.push({value: "noble_fencing", label: "Noble Fencing Style (Charisma)"});
            }
        }
        return options;
    }

    /**
     * Same options for the damage-side selector, but the default reads "Same as attack" rather
     * than "Auto" — blank means damage follows whatever the attack ability resolved to, which is
     * the usual case (see #getDamageAbilityChoice).
     */
    get damageAbilityOverrideOptions() {
        const options = this.abilityOverrideOptions;
        if (!options.length) return [];
        return options.map(o => o.value === "" ? {value: "", label: "Same as attack"} : o);
    }

    /**
     * Persisted per-weapon handedness choice for the sheet-level <select> — mirrors
     * abilityOverrideOptions. Only offered when the weapon genuinely supports both 1-handed and
     * 2-handed use (a same-size weapon, or one with grip "one or two handed") — a weapon that
     * can ONLY ever be one size (e.g. always two-handed for this wielder) has nothing to choose,
     * so no selector is shown and it stays purely auto-determined.
     */
    get handsOverrideOptions() {
        const item = this.item;
        const actor = this.actor;
        if (!item || !actor || this.isUnarmed || !isMelee(item)) {
            return [];
        }
        const compare = compareSizes(getSize(actor), getSize(item));
        const isTwoHandedBySize = compare === 1;
        const isMySize = compare === 0;
        const optionalTwoHanded = getInheritableAttribute({
            entity: item, attributeKey: "grip", reduce: "VALUES"
        }).includes("one or two handed");

        const offersOneHand = !isTwoHandedBySize || optionalTwoHanded;
        const offersTwoHand = isTwoHandedBySize || isMySize || optionalTwoHanded;
        if (!offersOneHand || !offersTwoHand) {
            return [];
        }
        return [
            {value: "", label: "Auto"},
            {value: "1", label: "1 Hand"},
            {value: "2", label: "2 Hand"}
        ];
    }

    /**
     * Homebrew: resolves the active handedness choice for this attack's weapon. A pick made in
     * the one-shot attack dialog (this.hands, ephemeral, one-roll-only) takes precedence when
     * actively set; otherwise falls back to the weapon's persisted system.handsOverride, which
     * is what the sheet-level selector writes to. Undefined means "auto-determine," same as
     * abilityOverride's #getAbilityChoice.
     */
    #getHandsChoice(item) {
        if (this.hands === 1 || this.hands === 2) {
            return this.hands;
        }
        const override = toNumber(item.system?.handsOverride);
        return (override === 1 || override === 2) ? override : undefined;
    }

    /**
     * Homebrew: shared two-handed determination for melee weapons, used by both the attack-roll
     * and damage-roll Strength/Dexterity resolution so they stay consistent with each other.
     */
    #isTwoHandedMelee(actor, item) {
        const handsChoice = this.#getHandsChoice(item);
        if (handsChoice !== undefined) {
            return handsChoice === 2;
        }

        let strMod = parseInt(actor.attributes.str.mod);
        let isTwoHanded = compareSizes(getSize(actor), getSize(item)) === 1;
        let isMySize = compareSizes(getSize(actor), getSize(item)) === 0;

        if (isMySize) {
            let grips = getInheritableAttribute({
                entity: item,
                attributeKey: "grip",
                reduce: "VALUES"
            })

            if (grips.includes("two handed")) {
                isTwoHanded = true;
            }
            if (strMod < 1) {
                isTwoHanded = false;
            }
        }

        return isTwoHanded;
    }

    /**
     * Retrieves the modifier value of a specific character attribute.
     *
     * @param {Object} actor - The actor object containing character information and attributes.
     * @param {string} attributeName - The name of the attribute for which the modifier is being retrieved.
     * @return {number} The modifier value of the specified attribute, or 0 if the attribute is not found.
     */
    #getCharacterAttributeModifier(actor, attributeName) {
        let attributes = actor.attributes;
        return !attributes ? 0 : attributes[toShortAttribute(attributeName).toLowerCase()].mod;
    }


    /**
     * Calculates and constructs a Roll object representing the damage roll of a character's item, including applicable bonuses, modifiers, and terms.
     * The calculation considers the item's properties, the actor's attributes, temporary changes, and inheritance rules for bonuses and dice terms.
     * @return {Roll} A Roll object that can be rolled to compute the total damage for the given item, or `undefined` if the actor or item is not present.
     */
    get damageRoll() {
        let actor = this.actor
        let item = this.item

        if (!actor || !item) {
            return;
        }

        let terms = [];
        const doubleWeaponDamage = [];
        let weaponDieFaces;
        if (this.isUnarmed) {
            const unarmedDice = resolveUnarmedDamageDie(actor);
            terms.push(...unarmedDice);
            weaponDieFaces = unarmedDice.find(t => t instanceof foundry.dice.terms.Die)?.faces;
            terms.push(...appendNumericTerm(getInheritableAttribute({
                entity: item,
                attributeKey: "unarmedBonusDamage",
                reduce: "SUM"
            }), "Unarmed Bonus Damage"));
        } else {
            let damageDice = getInheritableAttribute({
                entity: item,
                parent: item.parent,
                attributeKey: ["damage", "damageDie"],
                reduce: "SUM"
            })

            const {dice, additionalTerms} = getDiceTermsFromString(damageDice);
            if (additionalTerms) {
                doubleWeaponDamage.push(...additionalTerms)
            }
            if (dice) {
                terms.push(...dice)
                weaponDieFaces = dice.find(t => t instanceof foundry.dice.terms.Die)?.faces;
            }
        }

        terms.push(...appendNumericTerm(actor.halfHeroicLevel, "Half Heroic Level"));

        if (item.type === 'beastAttack') {
            let beastClassLevels = (actor?.items || []).filter(item => item.type === 'class' && item.name === "Beast")
            let halfBeastLevel = Math.floor(beastClassLevels.length / 2)
            terms.push(...appendNumericTerm(halfBeastLevel, "Half Beast Level"));
        }
        terms.push(...this.temporaryChanges?.filter(c => c.key === "damage").map(c => appendTerm(c.value, "Custom", c.modifiers || [])).flat() || []);

        getInheritableAttribute({
            entity: [this.item, this.operator],
            attributeKey: "bonusDamage",
            parent: !!this.parent ? this.parent : this.operator,
            itemFilter: ((item) => item.type !== 'weapon'),
            reduce: "VALUES_WITH_MODIFIERS"
        }).forEach(val => {
            if(this.canEffectWeapon(val)){
                terms.push(...appendTerm(val.value, val.source, val.modifiers));
            }

        })

        for (let mod of this.modifiers("damage")) {
            terms.push(...appendTerms(mod.value, mod.source))
        }

        if (isMelee(item) || isThrown(item)) {
            const meleeDamageAbilityModifier = this.#getMeleeDamageAbilityModifier(actor, item);
            terms.push(...meleeDamageAbilityModifier)
        } else {
            // Homebrew: "Ranged weapons, including grenades, use DEX for attack and damage." Vanilla
            // SWSE adds no ability to ranged damage, so this whole branch is homebrew-only. A
            // damage-ability override replaces Dexterity here the same way it does for melee,
            // which is what lets e.g. a turret attack on Dexterity but damage on Intelligence.
            const choice = this.#getDamageAbilityChoice(item);
            const ability = ["str", "dex", "int", "wis", "cha"].includes(choice) ? choice : "dex";
            terms.push(...appendNumericTerm(this.#getCharacterAttributeModifier(actor, ability), "Attribute Modifier"));
        }

        let weaponTypes = getPossibleProficiencies(actor, item);
        terms.push(...getSpecializationDamageBonuses(actor, weaponTypes));

        terms.push(...getActiveCombatToggleTerms(this, "damage", {weaponDieFaces}));

        if (terms[0] instanceof foundry.dice.terms.OperatorTerm) {
            terms[0] = null;
        }

        terms = terms
            .filter(term => !!term);

        terms = terms.length > 0 ? terms : [new foundry.dice.terms.NumericTerm({number: 0})]
        let roll = Roll.fromTerms(terms);

        let bonusDamageDice = getInheritableAttribute({
            entity: item,
            attributeKey: "bonusDamageDie",
            reduce: "SUM"
        })
        roll.alter(1, toNumber(bonusDamageDice));

        return roll;
    }

    /**
     * Calculates the melee damage ability modifier for a given actor and item.
     * Factors in conditions such as the actor's strength, the item's size and type,
     * and special attributes (e.g., lightsaber-specific properties).
     *
     * @param {Object} actor - The actor whose ability modifier is being calculated.
     * @param {Object} item - The item for which the melee damage modifier is calculated.
     * @return {Object} A numeric term representing the calculated melee damage ability modifier,
     *                  which accounts for attributes like strength, item size, and wielding type.
     */
    #getMeleeDamageAbilityModifier(actor, item) {
        let strMod = parseInt(actor.attributes.str.mod);
        let isTwoHanded = isMelee(item) ? this.#isTwoHandedMelee(actor, item) : false;

        // Homebrew: one-handed melee weapons (and thrown weapons) may use Strength or
        // Dexterity for damage. Two-handed weapons cannot use Dexterity — except thrown
        // weapons, which keep the choice even when wielded two-handed.
        let abilityMod = strMod;
        if (isThrown(item) || !isTwoHanded) {
            let dexMod = parseInt(actor.attributes.dex.mod);
            abilityMod = Math.max(strMod, dexMod);
        }

        // Homebrew: ability-override choice replaces the auto-picked damage ability. Ataru
        // forces Dexterity (the two-handed doubling below then applies on top of it, same as
        // RAW: double Dexterity only when actually wielding the lightsaber two-handed via the
        // Handedness toggle). Kinetic Combat/Noble Fencing Style replace the ability outright
        // instead. Strength/Dexterity/Wisdom/Charisma overrides apply to any weapon.
        const abilityChoice = this.#getDamageAbilityChoice(item);
        if (["str", "dex", "int", "wis", "cha"].includes(abilityChoice)) {
            abilityMod = this.#getCharacterAttributeModifier(actor, abilityChoice);
        } else if (isLightsaber(item) && abilityChoice === "ataru") {
            abilityMod = parseInt(actor.attributes.dex.mod);
        } else if (isLightsaber(item) && abilityChoice) {
            abilityMod = this.#lightsaberAttributeMod(actor, abilityChoice);
        }

        return appendNumericTerm(isTwoHanded ? Math.max(abilityMod * 2, abilityMod) : abilityMod, "Attribute Modifier");
    }

    getHandednessModifier() {
        const compare = compareSizes(getSize(this.actor), getSize(this.item));
        let isTwoHanded = compare === 1;
        let isMySize = compare === 0;

        // Homebrew: some weapons (e.g. Lightsabers) may be wielded one- or two-handed
        // regardless of their size relative to the wielder.
        let optionalTwoHanded = getInheritableAttribute({
            entity: this.item,
            attributeKey: "grip",
            reduce: "VALUES"
        }).includes("one or two handed");

        let rollModifier = RollModifier.createRadio("hands", "Handedness", this.item.id);

        if (!isTwoHanded || optionalTwoHanded) {
            const rollModifierChoice = new RollModifierChoice(`1 Hand`, 1, !isTwoHanded && !isMySize);
            rollModifierChoice.icon = "fa-hand";
            rollModifier.addChoice(rollModifierChoice);

        }

        if (isTwoHanded || isMySize || optionalTwoHanded) {
            const rollModifierChoice1 = new RollModifierChoice(`2 Hand`, 2, isTwoHanded || isMySize);
            rollModifierChoice1.icon = "fa-hands";
            rollModifier.addChoice(rollModifierChoice1);
        }

        return rollModifier.hasChoices() ? [rollModifier] : [];
    }

    get rangeDamageModifiers() {
        const modifiers = getInheritableAttribute({
            entity: [this.item, this.operator],
            attributeKey: "bonusDamage",
            parent: !!this.parent ? this.parent : this.operator,
            itemFilter: ((item) => item.type !== 'weapon')
        });
        return this.filterBonusesByType(modifiers, "range");
    }

    get rangeAttackModifiers() {
        const modifiers = getInheritableAttribute({
            entity: [this.item, this.operator],
            attributeKey: "toHitModifier",
            parent: !!this.parent ? this.parent : this.operator,
            itemFilter: ((item) => item.type !== 'weapon')
        });
        return this.filterBonusesByType(modifiers, "range");
    }

    filterBonusesByType(modifiers, range) {
        const response = [];
        modifiers.forEach(modifier => {
            if (typeof modifier.value === "string") {
                const toks = modifier.value.split(":")
                if (toks.length > 2 && toks[1].toLowerCase() === range) {
                    response.push({type: toks[2].toLowerCase(), bonus: parseInt(toks[0])})
                }
            }
        })
        return response;
    }

    getRangeModifierBlock() {
        let range = this.effectiveRange;
        const accurate = this.isAccurate;
        const inaccurate = this.isInaccurate
        const defaultRange = this.defaultRange
        const damageModifiers = this.rangeDamageModifiers
        const attackModifiers = this.rangeAttackModifiers

        let rollModifier = RollModifier.createOption(["attack", "damage"], "Range Modifier");

        for (let [rangeName, rangeIncrement] of Object.entries(SWSE.Combat.range[range] || {})) {
            let rangePenalty = SWSE.Combat.rangePenalty[rangeName];
            if (accurate && rangeName === 'short') {
                rangePenalty = 0;
            }
            if (inaccurate && rangeName === 'long') {
                continue;
            }
            const damageBonus = damageModifiers.filter(modifier => modifier.type === rangeName).map(modifier => modifier.bonus).reduce((a, b) => a + b, 0);
            const attackBonus = attackModifiers.filter(modifier => modifier.type === rangeName).map(modifier => modifier.bonus).reduce((a, b) => a + b, 0) + rangePenalty;

            const display = `${rangeName.titleCase()}, ${rangeIncrement.string.titleCase()}, ${rangePenalty}`;
            const value = {attack: attackBonus === 0 ? "+0" : attackBonus, damage: damageBonus};
            rollModifier.addChoice(new RollModifierChoice(display, value, rangeName === defaultRange));
        }

        return rollModifier.hasChoices() ? [rollModifier] : [];
    }

    get effectiveRange() {
        let range = this.range;
        if (range === 'Grenades') {
            range = 'Thrown Weapons'
        }

        //For now, standardize 'treated as' groups
        for (let rangedGroup of weaponGroup["Ranged Weapons"]) {
            if (rangedGroup.includes(range)) {
                range = rangedGroup;
                break;
            }
        }
        return range;
    }

    get additionalDamageDice() {
        let actorData = this.actor
        let itemData = this.item

        let damageDice = getInheritableAttribute({
            entity: itemData,
            attributeKey: "damage",
            reduce: "VALUES"
        })
        let damageDie = damageDice[damageDice.length - 1];

        if (!damageDie) {
            return "";
        }

        if (!damageDie.includes("/")) {
            return [];
        }
        let additionalDie = damageDie.split("/");

        //let bonusDice = this.getInheritableAttributesByKey('bonusDamageDie');
        let bonusSize = getInheritableAttribute({
            entity: itemData,
            attributeKey: 'bonusDamageDieSize',
            reduce: "SUM"
        });
        let atks = [];
        for (let die of additionalDie) {
            die = increaseDieSize(die, bonusSize);
            atks.push(die);
        }

        return atks.slice(1);
    }

    get notes() {
        const itemData = this.item;
        const provider = this.provider;
        const operator = this.operator;
        let notes = getInheritableAttribute({
            entity: itemData,
            attributeKey: 'special'
        })
        let type = this.type;
        if ('Stun' === type || type.includes("Energy (Stun)") || type.includes("Stun")) {
            notes.push({href: "https://swse.fandom.com/wiki/Stun_Damage", value: "Stun Damage"})

        }
        if ('Ion' === type || type.includes("Energy (Ion)") || type.includes("Ion")) {
            notes.push({href: "https://swse.fandom.com/wiki/Ion_Damage", value: "Ion Damage"})
        }

        if (!!provider && provider.name !== operator.name) {
            notes.push({value: `Weapon Emplacement on ${provider.name} operated by ${operator.name + (operator instanceof SWSEActor ? "" : " Crewman")}`})
        }
        return notes;
    }

    get notesHTML() {
        return this.notes.map(note => {
            let value = note.value;
            let href = note.href;

            if (href) {
                value = `<a href="${href}">${value}</a>`
            }

            value = `<span class="note">${value}</span>`

            return value;

        }).join("<span>  </span>");
    }

    get notesText() {
        return this.notes.map(note => note.value).join(", ");
    }

    get range() {
        let item = this.item;
        let treatedAsForRange = getInheritableAttribute({
            entity: item,
            attributeKey: "treatedAs",
            reduce: "FIRST"
        });

        let resolvedSubtype = treatedAsForRange ? treatedAsForRange : item.system.subtype;

        if (item.stripping["reduceRange"]?.value) {
            resolvedSubtype = reduceWeaponRange(resolvedSubtype);
        }

        return this.#mapToStandardRanges(resolvedSubtype);
    }


    /**
     * Calculates the penalty and range description based on the given distance and configured range grid.
     *
     * @param {number} distance - The distance to evaluate against the range grid.
     * @return {penalty:number|range:string} An object containing the penalty and the range description, where:
     *                  - `penalty` is the numeric penalty associated with the range.
     *                  - `range` is the string description of the range.
     */
    rangePenalty(distance) {
        let rangeGrid = CONFIG.SWSE.Combat.range[this.range];
        if (!rangeGrid) {
            console.warn(`SWSE | rangePenalty: no range grid for "${this.range}" (item subtype "${this.item?.system?.subtype}"). Known ranges: ${Object.keys(CONFIG.SWSE.Combat.range).join(", ")}`);
            return {penalty: 0, range: outOfRange.titleCase()};
        }

        let rangeDescription = outOfRange;
        for (const [range, details] of Object.entries(rangeGrid)) {
            if (distance >= details.low && distance <= details.high) {
                rangeDescription = range;
                break;
            }
        }

        return {
            penalty: SWSE.Combat.rangePenalty[rangeDescription] || 0,
            range: rangeDescription.titleCase()
        };
    }

    get meleeRange() {
        return {}
    }

    get rangeDisplay() {
        let multipliers = getInheritableAttribute({
            entity: this.item,
            attributeKey: "rangeMultiplier",
            reduce: "VALUES"
        })

        let range1 = this.range;

        for (let multiplier of multipliers) {
            range1 = range1 + multiplier;
        }

        return range1
    }

    get critical() {
        let bonus = getInheritableAttribute({
            entity: this.item,
            attributeKey: 'criticalMultiplierBonus',
            reduce: "SUM"
        });

        return 2 + bonus
    }

    get type() {
        let item = this.item;

        if (!item) {
            return;
        }
        let attributes = getInheritableAttribute({
            entity: item,
            attributeKey: 'damageType',
            reduce: "VALUES"
        });

        if (attributes.length === 0 && item.type === "vehicleSystem") {
            attributes.push("Energy");
        }

        if (attributes.length > 1 && attributes.includes("Varies")) {
            attributes = attributes.filter(x => x !== "Varies");
        }

        return attributes.join(', ');
    }

    get modes() {
        let item = this.item;
        let modes = SWSEItem.getModesFromItem(item);
        //const dynamicModes = this.getDynamicModes(modes.filter(mode=>mode.type ==="dynamic"));
        modes = modes.filter(mode => !!mode && mode.type !== "dynamic")

        // modes.forEach(mode => {if(!mode.uuid){
        //     mode.uuid = generateUUID(this.actorId, this.itemId, mode._id)
        // }})
        return modes;
    }

//TODO REMOVE
    get defaultRange() {
        return getAttackRange(this.range, this.isAccurate, this.isInaccurate, this.actor)
    }

    get isAccurate() {
        return getInheritableAttribute({
            entity: this.item,
            attributeKey: 'special',
            attributeFilter: attr => attr.value === "accurate"
        }).length > 0
    }

    get isInaccurate() {
        return getInheritableAttribute({
            entity: this.item,
            attributeKey: 'special',
            attributeFilter: attr => attr.value === "inaccurate"
        }).length > 0
    }

    get attackOptionHTML() {
        const modifiers = this.modifierOptions;

        //modifiers.sort((a,b) => a.modifierType )

        return modifiers.map(m => m.HTMLBlock)


        // let attackLabel = document.createElement("label");
        // attackLabel.innerText = "Attack Modifier:";
        // modifiers.push(attackLabel);
        //
        // //modifiers.push(...)
        // let attackInput =
        // modifiers.push(attackInput);
        //
        // modifiers.push(document.createElement("br"))
        //
        // let damageLabel = document.createElement("label");
        // damageLabel.innerText = "Damage Modifier:";
        // modifiers.push(damageLabel);
        //
        //
        // let damageInput = document.createElement("input");
        // damageInput.dataset.source = "Miscellaneous"
        // damageInput.classList.add("damage-modifier", "suppress-propagation")
        // modifiers.push(damageInput);
        //
        // return modifiers;
    }

    /**
     *
     * @returns {RollModifier[]}
     */
    get modifierOptions() {
        let modifiers = [];
        modifiers.push(...this.getHandednessModifier())
        modifiers.push(...this.getRangeModifierBlock());
        modifiers.push(...this.getAbilityModifierOptions());
        modifiers.push(RollModifier.createTextModifier("attack", "Miscellaneous Attack Bonus"));
        modifiers.push(RollModifier.createTextModifier("damage", "Miscellaneous Damage Bonus"));
        return modifiers
    }


    /**
     * Determines if a given number represents a critical hit under specific conditions.
     *
     * @param {number} num - The number to check for critical status.
     * @param {boolean} [excludeExtendedCritRange=false] - When true, excludes the evaluation of extended critical hit ranges.
     * @return {boolean} Returns true if the number is a critical hit; otherwise, false.
     */
    isCritical(num, excludeExtendedCritRange = false) {
        if (num === 20) return true;
        if (!excludeExtendedCritRange) return false;
        return getInheritableAttribute({
            entity: this.item,
            attributeKey: 'extendedCriticalHit',
            reduce: "NUMERIC_VALUES"
        }).includes(num);
    }


    static isMiss(attackRoll, defense, autohit, autoMiss) {
        if (autoMiss) return true;
        if (autohit) return false;
        return attackRoll < defense;
    }

    /**
     * Determines whether the given number is considered an automatic miss.
     *
     * @param {number} num - The number to check for an automatic miss.
     * @return {boolean} Returns true if the number is deemed an automatic miss, otherwise false.
     */
    isAutomaticMiss(num) {
        if (num === 1) {
            return true;
        }
        return getInheritableAttribute({
            entity: this.item,
            attributeKey: 'extendedCriticalFailure',
            reduce: "NUMERIC_VALUES"
        }).includes(num);
    }

    withModifiers(modifiers) {
        this.options = this.options || {};
        this.options.modifiers = this.options.modifiers || [];

        this.options.modifiers.push(...modifiers);
    }

    clone() {
        return Attack.create(this)
    }

    checkExistingDynamicModes(existingModes, newMode) {
        const found = existingModes.find(existingMode => existingMode.modePath === newMode.modePath)
        if (found) {
            newMode.isActive = found.isActive;
            newMode.attributes = found.attributes;
        }
        return newMode;
    }

    getDynamicModes(existingDynamicModes) {
        let dynamics = [];
        if (isMelee(this.item)) {
            const actor = this.actor;
            let isMySize = compareSizes(getSize(actor), getSize(this.item)) === 0;
            let cannotUseTwoHands = getInheritableAttribute({
                entity: this.item,
                attributeKey: "isLightWeapon",
                reduce: "OR"
            })
            if (isMySize && !cannotUseTwoHands) {
                const handedness = [this.checkExistingDynamicModes(existingDynamicModes, {
                    name: "One-Handed Grip",
                    attributes: {0: {key: "grip", value: "one handed"}},
                    modePath: "One-Handed Grip",
                    group: "grip",
                    type: "dynamic"
                }),
                    this.checkExistingDynamicModes(existingDynamicModes, {
                        name: "Two-Handed Grip",
                        attributes: {0: {key: "grip", value: "two handed"}},
                        modePath: "Two-Handed Grip",
                        group: "grip",
                        type: "dynamic"
                    })];

                if (!handedness[1].isActive) {
                    handedness[0].isActive = true
                }

                dynamics.push(...handedness)
            }
            //terms.push(...appendNumericTerm(isTwoHanded ? strMod * 2 : strMod, "Attribute Modifier"))
        }
        return dynamics;
    }

//https://swse.fandom.com/wiki/Area_Attacks
    static TARGET_TYPES = {
        SINGLE_TARGET: "SINGLE_TARGET",
        BURST: "BURST",
        AUTOFIRE_WEAPON: "AUTOFIRE_WEAPON",
        SPLASH_WEAPON: "SPLASH_WEAPON"
    };


    //TODO add an expected shape filter for area attacks
    get targetType() {
        const item = this.item;

        const autofire = item.effects?.find(effect => effect.name === "Autofire");
        if (autofire && autofire.disabled === false) {
            return {type: Attack.TARGET_TYPES.AUTOFIRE_WEAPON, criticalHitEnabled: false}
        }

        if (item.system.subtype === "Grenades") {
            return {type: Attack.TARGET_TYPES.BURST, criticalHitEnabled: false}
        }
        return {type: Attack.TARGET_TYPES.SINGLE_TARGET, criticalHitEnabled: true}
    }

    get template() {
        const item = this.item;

        const autofire = item.effects?.find(effect => effect.name === "Autofire");
        if (autofire && autofire.disabled === false) {
            return {
                shape: "circle",
                size: 1,
                disableRotation: true,
                type: Attack.TARGET_TYPES.AUTOFIRE_WEAPON,
                criticalHitEnabled: false,
                snapPoint: "vertex"
            }
        }

        if (item.system.subtype === "Grenades") {
            return {
                shape: "circle",
                size: 2,
                disableRotation: true,
                type: Attack.TARGET_TYPES.BURST,
                criticalHitEnabled: false,
                snapPoint: "vertex"
            }
        }
        return {
            shape: "circle",
            size: 0.5,
            disableRotation: true,
            type: Attack.TARGET_TYPES.SINGLE_TARGET,
            criticalHitEnabled: false,
            snapPoint: "center",
            cleanUp: true
        }
    }

    async placeTemplate() {
        return SWSETemplate.fromAttack(this);
    }

    get summary() {
        return {attributes: [{key: "data-attack-key", value: this.attackKey}], value: this.attackKey, name: this.name}
    }

    attackOption(attack, id) {
        let attackString = attack.toJSONString
        return `<option id="${id}" data-item-id="${attack.itemId}" value="${attackString}" data-attack="${attackString}">${attack.name}</option>`;
    }

    // attackOption(attack, id) {
    //     let attackString = attack.toJSONString
    //     return `<option id="${id}" data-item-id="${attack.itemId}" value="${attackString}" data-attack="${attackString}">${attack.name}</option>`;
    // }

    getPossibleAttacksFromAttacks(existingWeaponNames, doubleAttack, tripleAttack) {
        const item = this.item;
        if (!item) {
            return [];
        }

        let resolvedAttacks = [];
        let quantity = item.system.quantity || 1
        for (let i = 0; i < quantity; i++) {
            let duplicateCount = existingWeaponNames.filter(name => name === this.name).length;
            if (duplicateCount > 0) {
                this.options.duplicateCount = duplicateCount;
            }
            existingWeaponNames.push(this.name)

            let clonedAttack = this.clone();
            if (item.type === "beastAttack") {
                clonedAttack.options.beastAttack = true;
            } else {
                clonedAttack.options.standardAttack = true;
            }
            resolvedAttacks.push(clonedAttack)

            for (let j = 1; j <= this.additionalDamageDice.length; j++) {
                let clonedAttack = this.clone();
                clonedAttack.options.additionalAttack = j;
                clonedAttack.options.standardAttack = true;
                resolvedAttacks.push(clonedAttack)
            }

            const subtype = item.system.subtype;
            if (doubleAttack.includes(subtype)) {
                let clonedAttack = this.clone();
                clonedAttack.options.doubleAttack = true;
                resolvedAttacks.push(clonedAttack)
            }

            if (tripleAttack.includes(subtype)) {
                let clonedAttack = this.clone();
                clonedAttack.options.tripleAttack = true;
                resolvedAttacks.push(clonedAttack)
            }
        }
        return resolvedAttacks;
    }


    /**
     * Calculates the distance modifier based on the actor's position and the specified location.
     *
     * @param {object} actor - The actor object which represents the character or token to evaluate.
     * @param {object} location - The target location object containing coordinates.
     * @return {Promise<penalty:number|range:string>}
     */
    async getDistanceModifier(actor, location) {
        let token;
        if (actor.isToken) {
            token = actor.token.object;
        } else {
            let tokens = canvas.tokens.placeables.filter(token => token.actor?.id === actor.id);
            //TODO this defaults to the first token instance.  idk if this is an issue.  would a PC have multiple?

            token = tokens[0];
        }

        let distance;
        if (!token) {
            let options = [];
            let range = CONFIG.SWSE.Combat.range[this.range]
            let rangePenalty = CONFIG.SWSE.Combat.rangePenalty
            if (!range) {
                console.warn(`SWSE | getDistanceModifier: no range grid for "${this.range}" (item subtype "${this.item?.system?.subtype}"). Known ranges: ${Object.keys(CONFIG.SWSE.Combat.range).join(", ")}`);
                return this.rangePenalty(0);
            }
            for (const entry of Object.entries(range)) {
                options.push({
                    value: rangePenalty[entry[0]],
                    display: `${entry[0].titleCase()}: ${entry[1].string.titleCase()}`
                })
            }

            if (options.length === 1) {
                distance = options[0].value;
            } else {
                distance = await selectOption(options, {
                    title: "Select Range Penalty",
                    content: "Select Range Penalty"
                }, {});
            }
        } else {
            let x = token.center.x / canvas.grid.sizeX
            let y = token.center.y / canvas.grid.sizeY
            distance = getDistance(location, {x, y})
        }


        return this.rangePenalty(distance)
    }

    /**
     * gets the actors targeted already or creates the appropriate template to select them
     * @return {Promise<{location: {x, y}, actors: []}[]>}
     */
    async targetedActors() {
        let targetActors = [];
        let targetTokens = game.user.targets
        let gridSize = canvas.scene.grid
        for (let targetToken of targetTokens.values()) {
            let actor = targetToken.actor
            if (actor) {
                let x = targetToken.x / gridSize.sizeX
                let y = targetToken.y / gridSize.sizeY
                targetActors.push({location: {x, y}, actors: [actor]})
            } else {
                console.warn(`Could not find actor for ${targetToken.name}`)
            }
        }
        if (targetActors.length > 0) return targetActors;

        // Only area-effect attacks (grenades, autofire cones, etc.) fall back to placing a
        // template to pick their targets. A single-target attack with nobody targeted (via
        // Foundry's own targeting tool — right-click a token, or press T) just rolls untargeted —
        // no forced template-click, no blocking prompt.
        if (this.targetType.type === Attack.TARGET_TYPES.SINGLE_TARGET) {
            return [];
        }

        let templates = await this.placeTemplate()
        const actors = selectActorsByTemplates(templates);
        cleanupTemplates(templates)
        return actors;
    }

    /**
     *
     * @return {Promise<{attack, damage}>}
     */
    async resolve(changes = [], advantageMode) {

        this.temporaryChanges = changes || [];
        this.advantageMode = advantageMode;

        let targetActors = await this.targetedActors();
        let attackRoll = this.attackRoll;
        await attackRoll.roll();

        let d20Value = d20Result(attackRoll);
        let autoMiss = this.isAutomaticMiss(d20Value);
        let critical = this.targetType.criticalHitEnabled && this.isCritical(d20Value);
        let autoHit = this.isCritical(d20Value, true)

        const areaAttack = this.targetType.type !== Attack.TARGET_TYPES.SINGLE_TARGET;

        let damageRoll = this.damageRoll;
        damageRoll = this.processDamage(critical, damageRoll, areaAttack);
        await damageRoll.roll();

        const response = {
            attack: this.makeVariantRoll(attackRoll, {}),
            damage: this.makeVariantRoll(damageRoll, {})
        };
        response.rangeBreakdown = []
        let attackSummaries = []

        // No target selected (single-target attacks no longer require one — see
        // Attack#targetedActors) means there's no location to measure a range penalty against,
        // but the roll itself still happened above and needs to actually show up on the chat
        // card, which only renders entries out of rangeBreakdown.
        if (targetActors.length === 0) {
            response.rangeBreakdown.push({
                range: undefined,
                attack: response.attack,
                damage: response.damage,
                damageType: this.type,
                notes: this.notes,
                critical,
                fail: autoMiss,
                targets: []
            });
        }

        for (const targetActor of targetActors) {
            let {actors, location} = targetActor;
            let {penalty, range} = await this.getDistanceModifier(this.actor, location);

            let found = response.rangeBreakdown.find(rb => rb.range === range)
            let modifiedRoll = found ? found.attack : this.makeVariantRoll(attackRoll, {range: range});

            let modifiedDamageRoll = found ? found.attack : this.makeVariantRoll(damageRoll, {range: range});
            const targets = toTargets(actors, modifiedRoll, autoMiss, autoHit, critical, areaAttack, modifiedDamageRoll, this)
            attackSummaries.push(...targets);
            if (found) {
                found.targets.push(...targets)
                continue;
            }

            response.rangeBreakdown.push({
                range: range,
                attack: modifiedRoll,
                damage: modifiedDamageRoll,
                damageType: this.type,
                notes: this.notes,
                critical,
                fail: autoMiss,
                targets
            });
        }

        response.attackSummaries = JSON.stringify(attackSummaries)

        // Attack instances are cached and reused across renders (AttackDelegate's own cache,
        // reset only on the actor's next prepareData) — temporaryChanges/advantageMode need to
        // be scoped to just this resolve() call, or the sheet's own inline to-hit/damage preview
        // (attack.attackRoll/damageRoll, read independently of resolve() on every render) would
        // keep showing this roll's one-off bonus/Advantage state indefinitely afterward.
        this.temporaryChanges = [];
        this.advantageMode = undefined;

        return response;
    }

    processDamage(critical, damageRoll, areaAttack) {
        if (critical) {
            damageRoll = modifyRollForCriticalEvenOnAreaAttack(this, damageRoll);
        }

        let ignoreCritical = getInheritableAttribute({
            entity: this.item,
            attributeKey: "skipCriticalMultiply",
            reduce: "OR"
        }) || areaAttack

        if (critical && !ignoreCritical) {
            const damageRoll1 = modifyRollForCriticalHit(this, damageRoll);
            damageRoll = damageRoll1[0];
        }
        return damageRoll;
    }

    makeVariantRoll(rollResult, context) {
        const resultingTerms = [];

        let cache = [];


        for (const term of rollResult.terms) {
            cache.push(term);
            if (term.operator) {
                continue;
            }

            let meetsPrereqs = true;
            if (term.options.prerequisites && term.options.prerequisites.length > 0) {
                for (const prerequisite of term.options.prerequisites) {
                    if (prerequisite.requirement?.toLowerCase() !== context[prerequisite.type?.toLowerCase()]?.toLowerCase()) {
                        meetsPrereqs = false;
                        break;
                    }
                }
            }
            if (!term.options.prerequisites || term.options.prerequisites.length === 0 ) {
                meetsPrereqs = true;
            }
            if (meetsPrereqs) {
                resultingTerms.push(...cache);
            }
            cache = [];
        }

        //return resultingTerms;
        resultingTerms.forEach(t => t._evaluated = true)
        return Roll.fromTerms(resultingTerms);

        // const terms = [...rollResult.terms]
        // terms.push(...appendTerm(penalty, description, true))
        // for (const term of conditionalTerms) {
        //     const toks = term.value.split(":");
        //     const contextElement = context[toks[1]?.toLowerCase()];
        //     if(!!contextElement && contextElement.toLowerCase() === toks[2].toLowerCase()){
        //         terms.push(...appendTerm(toks[0], term.sourceDescription, true));
        //     }
        // }
        //
        // terms.forEach(t => t._evaluated = true)
        // return Roll.fromTerms(terms);
    }
}


/**
 * @param dieString String
 * @returns {{additionalTerms: *[], dice: *[]}}
 */
export function getDiceTermsFromString(dieString) {
    const additionalTerms = []
    const dice = [];
    if (!dieString) {
        return {dice, additionalTerms};
    }
    dieString = `${dieString}`
    let dieTerms = dieString
        .replace(/ /g, "")
        .replace(/-/g, " - ")
        .replace(/\+/g, " + ")
        .replace(/x/g, " x ")
        .split(/ /g)

    let lastOperator = "";
    for (let dieTerm of dieTerms) {
        if (dieTerm === "0") {
            dice.push(new foundry.dice.terms.NumericTerm({number: 0}));
        } else if (!isNaN(dieTerm)) {
            if (lastOperator === "x") {
                dice.push(new foundry.dice.terms.NumericTerm({
                    number: toNumber(dieTerm),
                    options: {flavor: "multiplier"}
                }));
            } else {
                dice.push(new foundry.dice.terms.NumericTerm({number: toNumber(dieTerm)}));
            }
            lastOperator = "";
        } else if (dieTerm === "+") {
            dice.push(plus())
            lastOperator = "+"
        } else if (dieTerm === "-") {
            dice.push(minus())
            lastOperator = "-"
        } else if (dieTerm === "x") {
            dice.push(mult())
            lastOperator = "x"
        } else {
            let diceTokens = dieTerm.split("/");
            diceTokens.forEach((token, i) => {
                let toks = token.split("d")
                const die = new foundry.dice.terms.Die({number: parseInt(toks[0]), faces: parseInt(toks[1])});
                if (i === 0) {
                    dice.push(die);
                } else {
                    additionalTerms.push(die);
                }
            })
        }
    }

    return {dice, additionalTerms: additionalTerms || []};
}

/**
 * Plain 1d20, or (for advantage/disadvantage) 2d20 keeping only the higher/lower result —
 * same roll-twice mechanic as the rest of the system, see util.mjs's applyRollMode.
 *
 * @param {"advantage"|"disadvantage"|undefined} mode
 * @type {function(string=): DiceTerm}
 */
const D20 = (mode) => {
    if (mode === "advantage") return new foundry.dice.terms.Die({number: 2, faces: 20, modifiers: ["kh1"]});
    if (mode === "disadvantage") return new foundry.dice.terms.Die({number: 2, faces: 20, modifiers: ["kl1"]});
    return new foundry.dice.terms.Die({number: 1, faces: 20});
};


/**
 * TODO move to unarmed attack object
 *
 * Resolves the die to be thrown when making an unarmed attack
 * @param {SWSEActor} actor
 * @returns
 */
function resolveUnarmedDamageDie(actor) {
    let isDroid = getInheritableAttribute({
        entity: actor,
        attributeKey: "isDroid",
        reduce: "OR"
    });
    const unarmedSudoItem = actor.unarmedAttack.item;
    let damageDie = getInheritableAttribute({
        entity: unarmedSudoItem,
        attributeKey: isDroid ? "droidUnarmedDamage" : ["unarmedDamage", "unarmedDamageDie"],
        reduce: "MAX"
    });
    let bonus = getInheritableAttribute({
        entity: actor,
        attributeKey: "bonusUnarmedDamageDieSize",
        reduce: "SUM"
    })
    damageDie = increaseDieSize(damageDie, bonus);
    return getDiceTermsFromString(damageDie).dice;
}

function multiplyNumericTerms(roll, multiplier) {
    let previous;
    for (let term of roll.terms) {
        if (term instanceof foundry.dice.terms.NumericTerm) {
            if (previous && previous.operator !== "*" && previous.operator !== "/") {
                term.number = term.number * multiplier;
            }
        }
        previous = term;
    }
    return Roll.fromTerms(roll.terms);
}

function addMultiplierToDice(roll, multiplier) {
    let terms = [];

    for (let term of roll.terms) {
        terms.push(term);
        if (term instanceof foundry.dice.terms.DiceTerm) {
            terms.push(new foundry.dice.terms.OperatorTerm({operator: '*'}));
            terms.push(new foundry.dice.terms.NumericTerm({number: `${multiplier}`}))
        }
    }

    return Roll.fromTerms(terms
        .filter(term => !!term))
}

function modifyRollForPreMultiplierBonuses(attack, damageRoll) {
    let criticalHitPreMultiplierBonuses = getInheritableAttribute({
        entity: attack.item,
        attributeKey: "criticalHitPreMultiplierBonus"
    })


    for (let criticalHitPreMultiplierBonus of criticalHitPreMultiplierBonuses) {

        let value = resolveValueArray(criticalHitPreMultiplierBonus, attack.actor)

        damageRoll.terms.push(...appendNumericTerm(value, criticalHitPreMultiplierBonus.sourceString))
    }
    return damageRoll;
}

function modifyRollForPostMultiplierBonus(attack, damageRoll) {
    let postMultBonusDie = getInheritableAttribute({
        entity: attack.item,
        attributeKey: "criticalHitPostMultiplierBonusDie",
        reduce: "SUM"
    })
    damageRoll.alter(1, postMultBonusDie)
    return damageRoll;
}

export function crunchyCrit(roll) {
    const terms = [];
    let max = 0;

    for (let term of roll.terms) {
        terms.push(term);
        if (term instanceof foundry.dice.terms.DiceTerm) {
            max += term.faces * term.number
        } else if (term instanceof foundry.dice.terms.NumericTerm) {
            max += term.number
        }
    }
    terms.push(new foundry.dice.terms.OperatorTerm({operator: "+"}))
    terms.push(new foundry.dice.terms.NumericTerm({number: max}))

    return Roll.fromTerms(terms
        .filter(term => !!term))
}

export function maxRollCrit(roll) {
    const terms = [];

    for (const term of roll.terms) {
        if (term instanceof foundry.dice.terms.DiceTerm) {
            terms.push(new foundry.dice.terms.NumericTerm({
                number: term.number * term.faces,
                options: {flavor: term.expression}
            }))
        } else {
            terms.push(term)
        }
    }

    return Roll.fromTerms(terms
        .filter(term => !!term))
}

export function doubleDiceCrit(damageRoll, criticalMultiplier) {
    damageRoll.alter(criticalMultiplier, 0, true)
    return multiplyNumericTerms(damageRoll, criticalMultiplier)
}

export function doubleValueCrit(damageRoll, criticalMultiplier) {
    damageRoll = addMultiplierToDice(damageRoll, criticalMultiplier)
    return multiplyNumericTerms(damageRoll, criticalMultiplier)
}

function modifyRollForCriticalHit(attack, damageRoll, conditionalTerms = []) {
    damageRoll = modifyRollForPreMultiplierBonuses(attack, damageRoll);

    const criticalMultiplier = attack.critical;
    switch (game.settings.get("swse", "criticalHitType")) {
        case "Double Dice":
            damageRoll = doubleDiceCrit(damageRoll, criticalMultiplier);
            conditionalTerms = conditionalTerms.map(term => {
                term.value = term.value.replace("x", "*")
                return term;
            })
            break;
        case "Crunchy Crit":
            damageRoll = crunchyCrit(damageRoll)
            break;
        case "Max Damage":
            damageRoll = maxRollCrit(damageRoll)
            break;
        default:
            damageRoll = doubleValueCrit(damageRoll, criticalMultiplier);
    }

    damageRoll = modifyRollForPostMultiplierBonus(attack, damageRoll);
    return [damageRoll, conditionalTerms];
}

/**
 * Modifies the damage roll for a critical hit during an area attack, applying adjustments based on bonus critical damage die type.
 *
 * @param {Object} attack - The attack object containing details such as the attacking item.
 * @param {Object} damageRoll - The current damage roll object to be potentially modified.
 * @return {Object} The modified damage roll after applying any changes from bonus critical damage die type.
 */
function modifyRollForCriticalEvenOnAreaAttack(attack, damageRoll) {
    let bonusCriticalDamageDieType = getInheritableAttribute({
        entity: attack.item,
        attributeKey: "bonusCriticalDamageDieType",
        reduce: "SUM"
    })

    if (bonusCriticalDamageDieType) {
        damageRoll = adjustDieSize(damageRoll, bonusCriticalDamageDieType)
    }
    return damageRoll;
}


function toTarget(actor, attackRoll, autoMiss, autoHit, critical, areaAttack, damage, attack) {
    let reflexDefense = actor.system.defense.reflex.total;
    const attackRollTotal = parseInt(attackRoll.total);
    let isMiss = Attack.isMiss(attackRollTotal, reflexDefense, autoHit, autoMiss)
    const hitsTargetedArea = attackRollTotal >= 10;
    isMiss = areaAttack ? isMiss || !hitsTargetedArea : isMiss
    let isHalfDamage = areaAttack && hitsTargetedArea && isMiss;

    let targetResult;
    if (critical) {
        targetResult = "Critical Hit!";
    } else if (autoHit) {
        targetResult = "Hit";
    } else if (isHalfDamage) {
        targetResult = "Half Damage";
    } else if (autoMiss) {
        targetResult = "Automatic Miss";
    } else if (isMiss) {
        targetResult = "Miss";
    } else {
        targetResult = "Hit";
    }

    let conditionalDefenses =
        getInheritableAttribute({
            entity: actor,
            attributeKey: ["reflexDefenseBonus"],
            attributeFilter: attr => !!attr.modifier,
            reduce: "VALUES"
        });
    return {
        name: actor.name,
        defense: reflexDefense,
        defenseType: 'Ref',
        adjustedAttackRoll: attackRollTotal,
        highlight: targetResult.includes("Miss") ? "miss" : "hit",
        result: targetResult,
        conditionalDefenses: conditionalDefenses,
        uuid: actor.uuid,
        notes: attack.notes,
        damage: damage.total,
        damageType: attack.type,
    }
}

function toTargets(actors, attackRoll, autoMiss, autoHit, critical, areaAttack, damage, attack) {
    return actors.map((a) => toTarget(a, attackRoll, autoMiss, autoHit, critical, areaAttack, damage, attack));
}

