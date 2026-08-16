import {getInheritableAttribute} from "../../../attribute-helper.mjs";
import {getLongKey, resolveValueArray} from "../../../common/util.mjs";

const fields = foundry.data.fields;

export class AbilityFields {
    static migrateData(source) {
        function coerceOldAttributes(attributes) {

            for (let [key, value] of Object.entries(attributes)) {
                if(value.manual === "-"){
                    value.manual = null;
                }
            }
            return attributes;
        }

        if(!source.abilities && source.attributes){
            source.abilities = coerceOldAttributes(source.attributes);
            delete source.attributes;
        }
    }


    static #abilityProperties(ability) {
        return new fields.SchemaField({
            value: new fields.NumberField({
                initial: 10,
                integer: true,
                min: 0,
                label: `${ability} Score`,
            }),
            manual: new fields.NumberField({
                nullable: true,
                initial: null,
                integer: true,
                min: 0,
                label: `${ability} Manual`,
            }),
            base: new fields.NumberField({
                nullable: true,
                initial: 10,
                integer: true,
                min: 0,
                label: `${ability} Base`,
            }),
            customBonus: new fields.NumberField({
                initial: 0,
                integer: true,
                label: `${ability} Custom`,
            }),
        });
    }

    static get physical() {
        return {
            str: this.#abilityProperties("Strength"),
            dex: this.#abilityProperties("Dexterity"),
            con: this.#abilityProperties("Constitution"),
        };
    }

    static get mental() {
        return {
            int: this.#abilityProperties("Intelligence"),
            wis: this.#abilityProperties("Wisdom"),
            cha: this.#abilityProperties("Charisma"),
        };
    }

    static get darkside() {
        return {
            darkside: new fields.SchemaField({
                value: new fields.NumberField({
                    initial: 0,
                    min: 0,
                    integer: true,
                    label: "Darkside Score",
                }),
                // Derived each prepare (half Wisdom, rounded up) - declared so the schema
                // advertises darkside as a token resource bar, which needs `value` and `max`.
                max: new fields.NumberField({
                    initial: 0,
                    min: 0,
                    integer: true,
                    nullable: false,
                    label: "Darkside Score Maximum",
                }),
            }),
        };
    }
}
export class AbilityFunctions {
    // Homebrew size table: Large is +STR/-DEX, Small is +DEX/-STR, Medium is unmodified.
    // Replaces the old per-species flat ability bonuses for playable (Medium/Large/Small) species.
    sizeAbilityAdjustment(key) {
        const sizeName = this.parent.size?.name;
        if (sizeName === "Large") {
            if (key === "str") return 2;
            if (key === "dex") return -2;
        } else if (sizeName === "Small") {
            if (key === "dex") return 2;
            if (key === "str") return -2;
        }
        return 0;
    }

    _prepareAbilityDerivedData() {
        let actor = this.parent;
        let abilityGenType = this.settings.attributeGeneration;
        if(abilityGenType === "Default"){
            abilityGenType = game.settings.get("swse", "defaultAttributeGenerationType") || "Manual";
        }

        let hide = [];
        if(actor.type === "vehicle"){
            hide = ["cha", "wis"];
        }

        // Homebrew: Small non-droids can't put their free "+2 any" bonus into Dexterity
        // (they already get a fixed +2 Dex from size); Small droids are the stated exception.
        this.abilityBonusChoiceDexDisabled = actor.size?.name === "Small" && !actor.isDroid;

        // Loop through ability scores, and add their modifiers to our sheet output.
        for (let [key, ability] of Object.entries(this.abilities)) {
            if (abilityGenType !== "Manual") {
                let longKey = getLongKey(key);
                if (!longKey) continue;

                let bonuses = getInheritableAttribute({
                    entity: actor,
                    attributeKey: `${longKey}Bonus`,
                    reduce: "VALUES",
                });

                ability.bonus = resolveValueArray(bonuses, actor);

                ability.bonus += this.sizeAbilityAdjustment(key);
                if (this.abilityBonusChoice === key) {
                    ability.bonus += 2;
                }
            }

            if(hide.includes(key)){
                ability.skip = true;
            }

            // if there's no base, set value to 10.  is that right?
            ability.value = ability.base === null ? 10 : ability.base + (ability.bonus ?? 0) + ability.customBonus;

            // Calculate the modifier using d20 rules.
            ability.mod = Math.floor(
                (ability.value - 10) / 2
            );

            // Prepare the roll data
            let totalModifiers = ability.mod;
            let label = CONFIG.SWSE.Abilities.abilitiesShort[key];

            ability.label = key.toUpperCase();

            let rollLabel = label + " Modifer";
            actor.setResolvedVariable(
                "@" + key.toUpperCase() + "ROLL",
                "1d20" + (totalModifiers ? " + " : " - ") + totalModifiers,
                rollLabel,
                rollLabel
            );
            actor.setResolvedVariable(
                "@" + key.toUpperCase() + "MOD",
                totalModifiers,
                rollLabel,
                rollLabel
            );
            rollLabel = label + " Score";
            actor.setResolvedVariable(
                "@" + key.toUpperCase() + "SCORE",
                ability.value,
                rollLabel,
                rollLabel
            );
        }


        //move this somewhere else.  this is prepped too early
        // Homebrew: Dark Side Score maximum is half Wisdom score, rounded up (was full Wisdom score).
        this.darkside.max = Math.ceil(this.abilities.wis.value / 2);
        this.darkside.taint = getInheritableAttribute({
            entity: actor,
            attributeKey: "darksideTaint",
            reduce: "SUM"}
        )
        this.darkside.finalScore = this.darkside.value + this.darkside.taint;
    }
}
