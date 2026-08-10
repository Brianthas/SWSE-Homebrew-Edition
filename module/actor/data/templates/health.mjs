import {getInheritableAttribute} from "../../../attribute-helper.mjs";
import {resolveValueArray} from "../../../common/util.mjs";

const fields = foundry.data.fields;

export class HealthFields {
    static get common() {
        return {
            value: new fields.NumberField({
                initial: 10,
                min: 0,
                integer: true,
                label: "Current HP",
            }),
            max: new fields.NumberField({
                initial: 10,
                min: 0,
                integer: true,
                label: "Maximum HP",
            }),
            bonusHP: new fields.NumberField({
                nullable: true,
                initial: null,
                integer: true,
                min: 0,
                label: "Bonus HP",
            }),
            override: new fields.NumberField({
                nullable: true,
                initial: null,
                integer: true,
                min: 0,
                label: "Override Max HP",
            })
        };
    }
}

export class HealthFunctions {
    _prepareHealthDerivedData() {
        let system = this;
        const actor = system.parent;

        let healthBonuses = [];
        for (let charClass of actor.classes || []) {
            healthBonuses.push(charClass.classLevelHealth);
            healthBonuses.push(system.abilities.con.mod);
        }
        healthBonuses.push(
            ...getInheritableAttribute({
                entity: actor,
                attributeKey: "healthHardenedMultiplier",
                reduce: "NUMERIC_VALUES",
            }).map((value) => "*" + value)
        );
        // Homebrew: a flat, one-time HP bonus (e.g. Toughness's +5) that doesn't multiply
        // when the granting feat/trait is taken multiple times, unlike hitPointEq below.
        healthBonuses.push(
            getInheritableAttribute({
                entity: actor,
                attributeKey: "hitPointFlatBonus",
                reduce: "MAX",
            }) || 0
        );

        let traitAttributes = getInheritableAttribute({
            entity: actor,
            attributeKey: "hitPointEq",
        });
        let {others, multipliers} = this.extractTraitValues(traitAttributes, healthBonuses);
        //Second Winds
        system._prepareSecondWinds();

        //Update totals
        system.health.bonusHP = resolveValueArray(others, actor);
        // Kept separate from .max so the Classes tab can show the computed total as a
        // placeholder even while an override is active (same pattern as Damage Reduction).
        system.health.derivedMax = resolveValueArray(healthBonuses, actor);
        system.health.max = system.overrides.health ?? system.health.override ?? system.health.derivedMax;
        system.health.multipliers = multipliers;
        system.health.override = actor.system.health.override;
    }

    extractTraitValues(traitAttributes, healthBonuses) {
        let others = [];
        let multipliers = [];

        for (let item of traitAttributes || []) {
            if (!item) {
                continue;
            }
            const value = item.value;
            others.push(value);
            healthBonuses.push(value);
            if (
                value &&
                (value.startsWith("*") || value.startsWith("/"))
            ) {
                multipliers.push(value);
            }
        }
        return {others, multipliers};
    }

    _prepareSecondWinds() {
        let system = this;
        const bonusSecondWind = getInheritableAttribute({
            entity: this.parent,
            attributeKey: "bonusSecondWind",
            reduce: "SUM",
        });
        system.secondWinds = bonusSecondWind + (system.parent.isHeroic ? 1 : 0);
        system.toggles.secondWinds = system.toggles.secondWinds ?? {};
        for (let i = 0; i < system.secondWinds; ++i)
            system.toggles.secondWinds[i] =
                system.toggles.secondWinds[i] ?? false;
    }
}
