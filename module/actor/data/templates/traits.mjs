import {
    inheritableItems,
    ALPHA_FINAL_NAME,
} from "../../../common/util.mjs";
import {getInheritableAttribute} from "../../../attribute-helper.mjs";

const fields = foundry.data.fields;

export class TraitsFields {
    static migrateData(source) {
        if(source.darkSideScore && !source.darkside){
            source.darkside = {
                value: source.darkSideScore
            }
            delete source.darkSideScore;
        }

        // forcePoints/destinyPoints became {value, max} bars. Two legacy shapes exist: a bare
        // number, and (for forcePoints) an object keyed `quantity` — the latter was never a
        // declared field, it was written onto prepared data at runtime by the old getter and
        // could reach the database via the sheet's `system.forcePoints.quantity` input.
        for (const key of ["forcePoints", "destinyPoints"]) {
            const value = source[key];
            if (value === undefined || value === null) continue;
            if (typeof value === "object") {
                if (value.value === undefined && value.quantity !== undefined) {
                    value.value = parseInt(value.quantity) || 0;
                }
                delete value.quantity;
                // `roll` was likewise a runtime-only property that could be persisted.
                delete value.roll;
            } else {
                source[key] = {value: parseInt(value) || 0};
            }
        }
    }

    //Data common for all actors which needs to be persisted in the database
    static #_common() {
        return {
            xp: new fields.StringField({
                initial: "",
                label: "XP",
            }),
            baseAttack: new fields.NumberField({
                initial: 0,
                integer: true,
                label: "Base Attack",
            }),
            grapple: new fields.NumberField({
                initial: 0,
                integer: true,
                label: "Grapple",
            }),
        };
    }

    //Data common for all character actors which needs to be persisted in the database
    static #_commonCharacter() {
        return {
            // {value, max} rather than a bare number so Foundry recognises this as a token
            // resource bar (getTrackedAttributes only treats a SchemaField with both a `value`
            // and a `max` NumberField as a bar). `max` is fully derived each prepare from
            // forcePointsPerDay — it's declared here only so the schema advertises the bar.
            forcePoints: new fields.SchemaField({
                value: new fields.NumberField({
                    initial: 0,
                    integer: true,
                    min: 0,
                    nullable: false,
                    label: "Force Points",
                }),
                max: new fields.NumberField({
                    initial: 0,
                    integer: true,
                    min: 0,
                    nullable: false,
                    label: "Force Points per Day",
                }),
            }),
            // Homebrew: tracked separately from regular Force Points because a Destiny
            // Point can be broken down into a Force Point — that converted point doesn't
            // refresh daily the way normal Force Points do, so it needs its own bucket.
            bonusForcePoints: new fields.NumberField({
                initial: 0,
                integer: true,
                min: 0,
                label: "Bonus Force Points",
            }),
            // Same {value, max} bar shape as forcePoints above; the maximum is likewise
            // derived (Destiny Points per day equals Force Points per day).
            destinyPoints: new fields.SchemaField({
                value: new fields.NumberField({
                    initial: 0,
                    integer: true,
                    min: 0,
                    nullable: false,
                    label: "Destiny Points",
                }),
                max: new fields.NumberField({
                    initial: 0,
                    integer: true,
                    min: 0,
                    nullable: false,
                    label: "Destiny Points per Day",
                }),
            }),
            // Dark Side Score lives at `system.darkside` (AbilityFields.darkside, via
            // CommonActorData). A duplicate `darkSide` field used to be declared here as well,
            // with nothing anywhere reading or writing it — removed.
            // Homebrew: the size category declared here is the single source of truth
            // for the size-driven homebrew table — it is not overridden by species data.
            // Player-facing sizes are limited to the three the homebrew table covers.
            size: new fields.StringField({
                initial: "Medium",
                blank: false,
                choices: ["Small", "Medium", "Large"],
                label: "Size",
            }),
            // Homebrew: every character picks one ability to gain a +2 "size table" bonus to,
            // on top of whatever fixed adjustment their size grants (see AbilityFunctions.sizeAbilityAdjustment).
            abilityBonusChoice: new fields.StringField({
                initial: "",
                blank: true,
                choices: ["", "str", "dex", "con", "int", "wis", "cha"],
                label: "Ability Bonus Choice",
            }),
        };
    }

    //Data common for all player character actors which needs to be persisted in the database
    static get character() {
        return {
            ...this.#_common(),
            ...this.#_commonCharacter(),
        };
    }

    //Data common for all non-player character actors which need to be persisted in the database
    static get npc() {
        return {
            ...this.#_common(),
            ...this.#_commonCharacter(),
            level: new fields.SchemaField({
                value: new fields.NumberField({
                    initial: 0,
                    min: 0,
                    integer: true,
                    label: "Character Level",
                }),
            }),
            cl: new fields.SchemaField({
                value: new fields.NumberField({
                    initial: 0,
                    min: 0,
                    integer: true,
                    label: "Challenge Level",
                }),
            }),
            speed: new fields.SchemaField({
                base: new fields.NumberField({
                    initial: 6,
                    min: 0,
                    integer: true,
                    label: "Base Speed",
                }),
                swim: new fields.NumberField({
                    initial: 1.5,
                    min: 0,
                    step: 0.1,
                    label: "Swim Speed",
                }),
                climb: new fields.NumberField({
                    initial: 1.5,
                    min: 0,
                    step: 0.1,
                    label: "Climb Speed",
                }),
                fly: new fields.NumberField({
                    nullable: true,
                    initial: null,
                    min: 0,
                    integer: true,
                    label: "Fly Speed",
                }),
                special: new fields.StringField({
                    initial: "",
                    label: "Movement Special",
                }),
            }),
            // `size` comes from #_commonCharacter() — NPCs share the same field.
            reach: new fields.NumberField({
                initial: 1,
                min: 1,
                integer: true,
                label: "Reach",
            }),
        };
    }
}

export class TraitsFunctions {
    _prepareCharacterTraitsDerivedData() {
        let system = this;
        let actor = this.parent;

        system.level = system.level ?? {};
        system.level.value = actor.characterLevel;
        system.classSummary = actor.classSummary;
        system.classLevel = actor.classLevels;


        //TODO move to appropriate part of model prepare
        // if (
        //     game.settings.get("swse", "enableEncumbranceByWeight") &&
        //     actor.weight.carriedWeight >= actor.heavyLoad
        // ) {
        //     system.heavyLoad = true;
        // } else system.heavyLoad = false;

        let activeTraits = inheritableItems(actor).filter(i => i.type === 'trait');
        system.traits = activeTraits.sort(ALPHA_FINAL_NAME);

        this.baseAttack = actor.baseAttackBonus;
        this.grapple = actor.grapple;
    }

    _prepareNpcTraitsDerivedData() {
    	// let system = this;
    	// let actor = this.parent;
    	// No derived trait data for npc characters
    }
}
