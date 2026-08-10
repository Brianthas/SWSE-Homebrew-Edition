import {getInheritableAttribute} from "../../../attribute-helper.mjs";
import {defaultAttributes, getGroupedSkillMap, NEW_LINE, skillDetails, skills} from "../../../common/constants.mjs";
import {resolveValueArray, toNumber} from "../../../common/util.mjs";
import {generateArmorCheckPenalties} from "../../armor-check-penalty.mjs";
import {DEFAULT_SKILL} from "../../../common/classDefaults.mjs";
import {titleCase} from "../../../common/helpers.mjs";

const fields = foundry.data.fields;

export class SkillFields {

    static migrateData(source) {
        const entries = Object.entries(source.skills ?? {});

        let skillKeys = Object.keys(this.character)
        for (const [key, value]  of entries) {
            if(skillKeys.includes(key)){
                continue;
            }

            const matchedSkill = skillKeys.find(skill => skill.toLowerCase() === key.toLowerCase());
            if(matchedSkill && !!value){
                source.skills[matchedSkill] = value;
                delete source.skills[key];
            }
        }
    }
    static #_skillProperties(ability, skill) {
        return new fields.SchemaField({
            ability: new fields.StringField({
                initial: ability,
                blank: false,
                label: "Related Ability",
            }),
            trained: new fields.BooleanField({
                initial: false,
                label: "Trained",
            }),
            manualBonus: new fields.NumberField({
                initial: 0,
                integer: true,
                label: `Manual ${skill} Bonus`,
            }),
            trainedOnly: new fields.BooleanField({
                initial: false,
                label: "Trained Only",
            }),
            armorPenalty: new fields.BooleanField({
                initial: false,
                label: "Armor Penalty",
            }),
            value: new fields.NumberField({
                initial: 0,
                integer: true,
                label: `${skill} Mod`,
            })
        });
    }

    /**
     * Returns the current schema based on configuration
     * @returns {{}}
     */
    static get character() {
        let availableSkills = skills("character", false).sort()
        let groupedSkills = getGroupedSkillMap()

        let resolvedSkills = {}

        for (const availableSkill of availableSkills) {
            let ability = skillDetails[availableSkill]?.ability ?? groupedSkills.get(availableSkill)?.ability

            resolvedSkills[availableSkill] = this.#_skillProperties(ability, availableSkill);
        }

        return resolvedSkills;
    }

    static get vehicle() {
        return {
            Initiative: this.#_skillProperties("dex", "Initiative"),
            Mechanics: this.#_skillProperties("int", "Mechanics"),
            Perception: this.#_skillProperties("wis", "Perception"),
            Pilot: this.#_skillProperties("dex", "Pilot"),
            Ride: this.#_skillProperties("dex", "Ride"),
            Stealth: this.#_skillProperties("dex", "Stealth"),
            "Use Computer": this.#_skillProperties("int", "Use Computer"),
        };
    }
}

export class SkillFunctions {
    get availableTrainedSkillCount() {
        const system = this;
        const actor = system.parent;
        const intBonus = system.abilities.int.mod;
        let classBonus = 0;
        for (let co of actor.itemTypes.class) {
            if (co.levelsTaken.includes(1)) {
                classBonus = getInheritableAttribute({
                    entity: co,
                    attributeKey: "trainedSkillsFirstLevel",
                    reduce: "SUM",
                });
                break;
            }
        }
        let classSkills = Math.max(
            toNumber(resolveValueArray([classBonus, intBonus])),
            1
        );
        let automaticTrainedSkill = getInheritableAttribute({
            entity: actor,
            attributeKey: "automaticTrainedSkill",
            reduce: "VALUES_TO_LOWERCASE",
        }).filter((value) => value === "#payload#").length;
        let otherSkills = getInheritableAttribute({
            entity: actor,
            attributeKey: "trainedSkills",
            reduce: "SUM",
        });
        return toNumber(
            resolveValueArray([classSkills, otherSkills, automaticTrainedSkill])
        );
    }

    get trainedSkills() {
        let result = [];
        for (let skill of Object.values(this.skills)) {
            if (skill.trained) result.push(skill);
        }
        return result;
    }

    get untrainedSkills() {
        let result = [];
        for (let skill of Object.values(this.skills)) {
            if (!skill.trained) result.push(skill);
        }
        return result;
    }

    get focusedSkills() {
        let skillFocuses = getInheritableAttribute({
            entity: this.parent,
            attributeKey: "skillFocus",
            reduce: "VALUES",
        }).map((skill) => (skill || "").toLowerCase());
        return skillFocuses;
    }

    get classSkills() {
        let classSkills = new Set();
        let skills = getInheritableAttribute({
            entity: this.parent,
            attributeKey: "classSkill",
            reduce: "VALUES",
        });

        for (let skill of skills) {
            if (
                [
                    "knowledge (all skills, taken individually)",
                    "knowledge (all types, taken individually)",
                ].includes(skill.toLowerCase())
            ) {
                classSkills.add("knowledge (galactic lore)");
                classSkills.add("knowledge (bureaucracy)");
                classSkills.add("knowledge (sciences)");
                classSkills.add("knowledge (tactics)");
                classSkills.add("knowledge (technology)");
            } else {
                classSkills.add(skill.toLowerCase());
            }
        }

        return classSkills;
    }

    _prepareSkillDerivedData(options = {}) {
        let actor = this.parent;
        let system = this;


        //move to parameter
        let groupedSkillMap = options.groupedSkillMap ?? getGroupedSkillMap() ?? new Map()

        let halfCharacterLevel = Math.floor(system.level.value / 2);

        let classSkills = system.classSkills;

        let automaticTrainedSkill = getInheritableAttribute({
            entity: actor,
            attributeKey: "automaticTrainedSkill",
            reduce: "VALUES_TO_LOWERCASE",
        });
        // Homebrew size table: Small characters are automatically trained in Stealth.
        if (actor.size?.name === "Small" && !automaticTrainedSkill.includes("stealth")) {
            automaticTrainedSkill.push("stealth");
        }
        let skillBonus = getInheritableAttribute({
            entity: actor,
            attributeKey: "skillBonus",
            reduce: "VALUES",
        }).map((skill) => (skill?.replace(" ", "") || "").toLowerCase());
        let skillBonusAttr = getInheritableAttribute({
            entity: actor,
            attributeKey: "skillBonus",
            reduce: "VALUES"
        })
        let untrainedSkillBonuses = getInheritableAttribute({
            entity: actor,
            attributeKey: "untrainedSkillBonus",
            reduce: "VALUES",
        }).map((skill) => (skill || "").toLowerCase());
        let reRollSkills = getInheritableAttribute({
            entity: actor,
            attributeKey: "skillReRoll",
        });
        //Skill Focus
        let skillFocuses = getInheritableAttribute({
            entity: actor,
            attributeKey: "skillFocus",
            reduce: "VALUES",
        }).map((skill) => (skill || "").toLowerCase());

        let acPenalty = generateArmorCheckPenalties(actor);
        // Homebrew: some armor applies a flat ACP to Strength/Dexterity-based skills regardless
        // of proficiency, separate from (and additive with) the non-proficiency ACP above.
        let flatArmorCheckPenalty = 0;
        for (const item of actor.equipped) {
            if (item.type !== "armor") continue;
            flatArmorCheckPenalty = Math.min(flatArmorCheckPenalty, -Math.abs(item.armorFlatCheckPenalty || 0));
        }
        let builtSkills = {};

        const skillMap = new Map();
        const resolvedSkills = this.applyGroupedSkills(options.skills ?? skills(actor.type), groupedSkillMap);

        const nonSituationalSkills = [];
        const distinctSkillBonuses = skillBonusAttr.map(bonus => bonus.split(":")[0]).distinct()
        for (const distinctSkillBonus of distinctSkillBonuses) {
            let isSub = false;
            let isAttribute = defaultAttributes.includes(this.standardizedAttribute(distinctSkillBonus));

            for (const resolvedSkill of resolvedSkills) {
                if (distinctSkillBonus.toLowerCase().startsWith(resolvedSkill.toLowerCase())) {
                    isSub = true
                    break;
                }
            }
            if(!isSub && !isAttribute){
                nonSituationalSkills.push(distinctSkillBonus)
            }
        }

        resolvedSkills.push(...nonSituationalSkills);

        for (let resSkill of resolvedSkills) {
            let key = resSkill.toLowerCase();

            const customSkill = groupedSkillMap?.get(resSkill)
            const skill = this.createNewSkill(resSkill, actor.system.skills[resSkill] || {}, customSkill)
            let abilityMod = system.abilities[skill.ability]?.mod;

            const skillAttributeChanges = getInheritableAttribute({
                entity: actor,
                attributeKey: "skillAttribute"
            });
            for (const change of skillAttributeChanges) {
                const [attrSkillKey, altAttribute] = (change.value || "").split(":");
                if ((attrSkillKey || "").toLowerCase() !== key || !altAttribute) continue;
                const altMod = system.abilities[altAttribute.toLowerCase()]?.mod;
                if (altMod > abilityMod) {
                    abilityMod = altMod;
                    skill.ability = altAttribute.toLowerCase();
                }
            }

            let notes = [];

            skill.isClass = this.isClassSkill(key, actor, classSkills);

            let situationalSkillNames = customSkill?.grouped || []

            let bonuses = [];

            //Level Bonus - Always
            bonuses.push({
                value: halfCharacterLevel,
                description: `Half character level: ${halfCharacterLevel}`,
            });

            //Ability Modifier - Always
            bonuses.push({
                value: abilityMod,
                description: `Ability Mod: ${abilityMod}`,
            });
            skill.abilityBonus = abilityMod;

            if (automaticTrainedSkill.includes(key)) {
                skill.trained = true;
                skill.locked = true;
            }

            let trainedSkillBonus = skill.trained === true ? 5 : 0;
            bonuses.push({
                value: trainedSkillBonus,
                description: `Trained Skill Bonus: ${trainedSkillBonus}`,
            });

            //UntrainedBonus or 0 - Untrained only
            let untrainedSkillBonus =
                !skill.trained && untrainedSkillBonuses.includes(key) ? 2 : 0; //<<<TODO add support for other untrained bonuses
            bonuses.push({
                value: untrainedSkillBonus,
                description: `Untrained Skill Bonus: ${untrainedSkillBonus}`,
            });
            skill.trainedBonus = trainedSkillBonus + untrainedSkillBonus;

            //Ability Skill Bonus - sneak or perception - only if exists
            let abilitySkillBonus = actor.getAbilitySkillBonus(key);
            bonuses.push({
                value: abilitySkillBonus,
                description: `Ability Skill Modifier: ${abilitySkillBonus}`,
            });

            //Armor and Weight penalty - only if exists
            if (skill.acp) {
                bonuses.push({
                    value: acPenalty,
                    description: `Armor Class Penalty: ${acPenalty}`,
                });
                skill.armorPenalty = acPenalty;
            }

            //Homebrew flat Armor Check Penalty - Strength/Dexterity skills only
            if (skill.ability === "str" || skill.ability === "dex") {
                bonuses.push({
                    value: flatArmorCheckPenalty,
                    description: `Armor Check Penalty: ${flatArmorCheckPenalty}`,
                });
            }

            //Skill Focus bonus - Skill Focus only
            if (skillFocuses.includes(key)) {
                let skillFocusBonus = 5;
                let skillFocusCalculationOption = game.settings.get(
                    "swse",
                    "skillFocusCalculation"
                );
                if (skillFocusCalculationOption === "charLevelUp") {
                    skillFocusBonus = Math.ceil(system.level.value / 2);
                } else if (skillFocusCalculationOption === "charLevelDown") {
                    skillFocusBonus = Math.floor(system.level.value / 2);
                }
                bonuses.push({
                    value: skillFocusBonus,
                    description: `Skill Focus Bonus: ${skillFocusBonus}`,
                });
                skill.focusBonus = skillFocusBonus;
                skill.focus = true;
            }

            //Other Skill Bonuses from inherited - only if exists
            // let miscBonuses = skillBonus
            //     .filter((bonus) => bonus.startsWith(dirtyKey))
            //     .map((bonus) => bonus.split(":")[1]);
            // let miscBonus = miscBonuses.reduce(
            //     (prev, curr) => prev + toNumber(curr),
            //     0
            // );

            const rawSkillBonuses = skillBonusAttr.filter(bonus => {
                const bonusKey = bonus.split(":")[0].toLowerCase();
                return bonusKey === resSkill.toLowerCase() || this.standardizedAttribute(bonusKey) === this.standardizedAttribute(skill.ability) || bonusKey === "all"
            })

            let miscBonuses = this.resolveBonusesAndHandleModifiers(rawSkillBonuses);

            situationalSkillNames.push(... skillBonusAttr.map(bonus => bonus.split(":")[0]).filter(bonus =>
                bonus.toLowerCase() !== resSkill.toLowerCase() && bonus.toLowerCase().startsWith(resSkill.toLowerCase())).map(bonus => bonus.split(":")[0]))
            let miscBonus = miscBonuses.reduce((prev, curr) => prev + toNumber(curr), 0);

            bonuses.push({
                value: miscBonus,
                description: `Miscellaneous Bonus: ${miscBonus}`,
            });
            skill.miscBonus = miscBonus;

            //Character Sheet adjustment - only if exists
            if (skill.manualBonus) {
                bonuses.push({
                    value: skill.manualBonus,
                    description: `Manual Bonus: ${skill.manualBonus}`,
                });
            }

            //----------------------------------------------------------------
            //END Skill adjustments

            //Rerolls
            system._addSkillRerollNotes(reRollSkills, key, notes, skill);

            //Final skill calculations
            let nonZeroBonuses = bonuses.filter((bonus) => bonus.value !== 0);

            this.configureSkill(skill, nonZeroBonuses, actor, resSkill, abilityMod);

            for (const situationalSkillName of situationalSkillNames) {
                //const modifiedSkill = JSON.parse(JSON.stringify(skill));

                const modifiedSkill = this.createNewSkill(resSkill, actor.system.skills[situationalSkillName] || {}, JSON.parse(JSON.stringify(skill)))
                modifiedSkill.isClass = false;
                delete modifiedSkill.situationalSkills
                delete modifiedSkill.grouped
                delete modifiedSkill.classes

                modifiedSkill.sitKey = situationalSkillName
                const resolvedName = situationalSkillName.startsWith(resSkill) ? situationalSkillName : `${resSkill} (${situationalSkillName})`
                const situationalBonuses = [...nonZeroBonuses]
                //if(modifiedSkill.manualBonus){
                const situationalKey = resolvedName.toLowerCase()

                let miscBonuses = skillBonusAttr.filter(bonus => bonus.split(":")[0] === resolvedName).map(bonus => {return {value: bonus.split(":")[1], description: "Situational Bonuses"}});
                situationalBonuses.push(...miscBonuses)
                //modifiedSkill.manualBonus = actor.system.skills[situationalKey]?.manualBonus || 0

                situationalBonuses.push({value: modifiedSkill.manualBonus, description: "Situational Manual Bonus"})
                //}


                this.configureSkill(modifiedSkill, situationalBonuses, actor, resolvedName, abilityMod);
                skill.situationalSkills.push(modifiedSkill)
            }

            //Roll Data
            system._prepareSkillRollData(key, skill, notes);

            builtSkills[resSkill] = skill
            //system.skills[resSkill] = skill;
        }

        //Remaining Skills
        system._prepareRemainingSkills();
        system.skills = builtSkills;

        this.applySkillSubstitutions(actor, builtSkills);
    }

    /**
     * Homebrew skill substitution — applied after every skill is built, because a substitution
     * reads another skill's finished value and the build order isn't guaranteed to put the source
     * skill first.
     *
     * Only "always" substitutions change anything here (e.g. Force Intuition: Use the Force in
     * place of Initiative). They're resolved eagerly rather than prompted so that every path picks
     * them up, including Foundry's combat tracker, which rolls initiative itself and never goes
     * through the sheet. Prompt-based ones are just annotated onto the skill for the roll handler.
     *
     * No chaining: substitutes read `originalValue` where present, so a skill that has itself been
     * substituted still contributes its own base modifier.
     */
    applySkillSubstitutions(actor, builtSkills) {
        if (!actor.getSkillSubstitutions) return;
        // Skills are keyed by their display name ("Use the Force"), so match case-insensitively.
        const findSkill = (name) => {
            const wanted = String(name).toLowerCase();
            const key = Object.keys(builtSkills).find(k => k.toLowerCase() === wanted);
            return key ? builtSkills[key] : undefined;
        };

        for (const [name, skill] of Object.entries(builtSkills)) {
            const substitutions = actor.getSkillSubstitutions(name) || [];
            if (!substitutions.length) continue;
            skill.substitutions = substitutions;

            const always = substitutions.find(s => s.always);
            if (!always) continue;
            const source = findSkill(always.source);
            if (!source || typeof source.value !== "number") continue;

            skill.substitutedFrom = always.source;
            skill.originalValue = skill.value;
            skill.value = source.originalValue ?? source.value;
            skill.title = `${skill.title}${NEW_LINE}Uses ${always.source} instead${always.sourceDescription ? ` (${always.sourceDescription})` : ""}`;
            actor.resolvedVariables.set(skill.variable, "1d20 + " + skill.value);
        }
    }

    configureSkill(skill, nonZeroBonuses, actor, label, skillAttributeMod) {
        skill.title = nonZeroBonuses.map(bonus => bonus.description).join(NEW_LINE);
        skill.value = resolveValueArray(nonZeroBonuses.map(bonus => bonus.value), actor);
        skill.variable = `@${actor.cleanSkillName(label)}`;
        actor.resolvedVariables.set(skill.variable, "1d20 + " + skill.value);
        skill.label = titleCase(label)
        skill.key = label.toLowerCase()
        actor.resolvedLabels.set(skill.variable, skill.label);
        skill.abilityBonus = skillAttributeMod;
        skill.situationalSkills = [];
        // Homebrew skill substitution is applied in applySkillSubstitutions once every skill is
        // built — it reads other skills' finished values, so it can't run per-skill here.
    }

     applyGroupedSkills(skills, skillMap) {
        const skillsCopy = [...skills];
        if (!skillMap || skillMap.keys().length === 0){
            return skillsCopy.sort();
        }
        //add groupers
        skillsCopy.push(...Array.from(skillMap.keys()).flat())
        //remove
        const groupedSkills = Array.from(skillMap.values().map(skill => skill.grouped)).flat().distinct()

        return skillsCopy.filter(s => !groupedSkills.includes(s)).sort()

    }

     resolveBonusesAndHandleModifiers(rawSkillBonuses) {
        const skillBonuses = [];

        let implant = 0;
        for (const skillBonus of rawSkillBonuses) {
            const toks = skillBonus.split(":");
            if (toks.length > 2) {
                const modifier = toks[2].toLowerCase().trim();
                switch (modifier) {
                    case "implant":
                        implant = implant + parseInt(toks[1]);
                        break;
                }
                continue;
            }
            skillBonuses.push(toks[1]);
        }
        if (implant) {
            skillBonuses.push(Math.max(implant, -5));
        }
        return skillBonuses;
    }

     createNewSkill(skill, actualSkill = {}, customSkill = {}) {

        const merged = {...DEFAULT_SKILL, ...(skillDetails[skill] || {}), ...customSkill, ...actualSkill};
        // Canonical ability always wins over a stale persisted value (e.g. from before a
        // homebrew ability-score change), since there's no player-facing way to set this per-skill.
        merged.ability = customSkill?.ability ?? skillDetails[skill]?.ability ?? merged.ability;
        return merged;

    }


     configureSkill(skill, nonZeroBonuses, actor, label, skillAttributeMod) {
        skill.title = nonZeroBonuses.map(bonus => bonus.description).join(NEW_LINE);
        skill.value = resolveValueArray(nonZeroBonuses.map(bonus => bonus.value), actor);
        skill.variable = `@${actor.cleanSkillName(label)}`;
        actor.resolvedVariables.set(skill.variable, "1d20 + " + skill.value);
        skill.label = titleCase(label)
        skill.key = label.toLowerCase()
        actor.resolvedLabels.set(skill.variable, skill.label);
        skill.abilityBonus = skillAttributeMod;
        skill.situationalSkills = [];
    }

     standardizedAttribute(rerollKey)
    {
        if (!rerollKey) {
            return rerollKey;
        }
        rerollKey = rerollKey.toLowerCase()
        switch(rerollKey)
        {
            case "dex":
                return "dexterity";
            case "str":
                return "strength";
            case "con":
                return "constitution";
            case "int":
                return "intelligence";
            case "wis":
                return "wisdom";
            case "cha":
                return "charisma";
            default:
                return rerollKey;
        }
    }

    isClassSkill(key, actor, classSkills) {
        return key === "use the force"
            ? actor.isForceSensitive
            : classSkills.has(key);
    }

    _prepareSkillRollData(key, skill, notes) {
        let system = this;
        let actor = system.parent;
        let variable = `@${system.cleanSkillName(key)}`;
        let label = key.titleCase().replace("Knowledge", "K.");

        actor.resolvedVariables.set(variable, "1d20 + " + skill.value);
        actor.resolvedLabels.set(variable, label);
        actor.resolvedNotes.set(variable, notes);
    }

    _addSkillRerollNotes(reRollSkills, key, notes, skill) {
        let applicableRerolls = reRollSkills.filter(
            (reroll) =>
                reroll.value.toLowerCase() === key ||
                reroll.value.toLowerCase() === "any"
        );
        for (let reroll of applicableRerolls) {
            notes.push(
                `[[/roll 1d20 + ${skill.value}]] ${reroll.sourceDescription}`
            );
        }
    }

    _prepareRemainingSkills() {
        let system = this;
        //Remaining skills is calculated based on the number of trained skills.
        let remainingSkills =
            system.availableTrainedSkillCount - system.trainedSkills.length;
        system.remainingSkills = remainingSkills < 0 ? false : remainingSkills;
        system.tooManySkills =
            remainingSkills < 0 ? Math.abs(remainingSkills) : false;
    }

    cleanSkillName(key) {
        return this.uppercaseFirstLetters(key)
            .replace("Knowledge ", "K")
            .replace("(", "")
            .replace(")", "")
            .replace(" ", "")
            .replace(" ", "");
    }

    uppercaseFirstLetters(s) {
        const words = s.split(" ");

        for (let i = 0; i < words.length; i++) {
            if (words[i][0] === "(") {
                words[i] =
                    words[i][0] +
                    words[i][1].toUpperCase() +
                    words[i].substr(2);
            } else {
                words[i] = words[i][0].toUpperCase() + words[i].substr(1);
            }
        }
        return words.join(" ");
    }
}
