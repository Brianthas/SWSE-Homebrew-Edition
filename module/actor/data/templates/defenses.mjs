import {getInheritableAttribute} from "../../../attribute-helper.mjs";
import {equippedItems, resolveValueArray, toNumber} from "../../../common/util.mjs";

const fields = foundry.data.fields;

export class DefenseFields {
    //data scheme for npcs
    static get npc() {
        return {
            ref: new fields.SchemaField({
                value: new fields.NumberField({
                    initial: 10,
                    integer: true,
                    min: 0,
                    label: `Reflex Defense`,
                }),
            }),
            fort: new fields.SchemaField({
                value: new fields.NumberField({
                    initial: 10,
                    integer: true,
                    min: 0,
                    label: `Fortitude Defense`,
                }),
            }),
            will: new fields.SchemaField({
                value: new fields.NumberField({
                    initial: 10,
                    integer: true,
                    min: 0,
                    label: `Will Defense`,
                }),
            }),
            reff: new fields.SchemaField({
                value: new fields.NumberField({
                    initial: 10,
                    integer: true,
                    min: 0,
                    label: `Reflex flat-footed Defense`,
                }),
            }),
            special: new fields.StringField({
                initial: "",
                label: "Defense Special",
            }),
            dr: new fields.NumberField({
                initial: 0,
                integer: true,
                min: 0,
                label: `Damage Reduction`,
            }),
        };
    }

    /**
     * Homebrew: classes no longer grant Defense bonuses. Instead a Heroic character
     * assigns 4 points across the three Defenses (max 2 each), and at level 10 gains a
     * second pool of 4 more (max 2 each again, so 4 total per Defense).
     * Kept out of `system.defense`, which is rebuilt as derived data every prepare.
     */
    static #_defensePointPool(label) {
        return new fields.SchemaField({
            level1: new fields.NumberField({
                initial: 0, integer: true, min: 0, max: 2, label: `${label} Defense Points`,
            }),
            level10: new fields.NumberField({
                initial: 0, integer: true, min: 0, max: 2, label: `${label} Defense Points (Level 10)`,
            }),
        });
    }

    static get character() {
        return {
            damageThreshold:  new fields.SchemaField({
                misc: new fields.NumberField({
                    initial: 0,
                    integer: true,
                    label: `Misc Damage Threshold`,
                })
            }),
            // Blank means "use the value derived from armor/talents/templates"; anything
            // here replaces it. A string rather than a number so DR can carry its
            // bypass notation (e.g. "5/lightsabers", "2/-"). Display-only - the damage
            // application in actor.mjs reads the raw damageReduction attributes itself.
            damageReductionOverride: new fields.StringField({
                initial: "",
                blank: true,
                label: `Damage Reduction Override`,
            }),
            defensePoints: new fields.SchemaField({
                fortitude: this.#_defensePointPool("Fortitude"),
                reflex: this.#_defensePointPool("Reflex"),
                will: this.#_defensePointPool("Will"),
            }),
            // A plain manual add-on for anything not modeled elsewhere (e.g. Improved Defenses)
            // - folds into the same Misc column/tooltip as item/talent-granted bonuses (see
            // applyBonuses/resolvedWill), so the combined total shows in one place. Always
            // additive, never an override.
            additionalModifier: new fields.SchemaField({
                fortitude: new fields.NumberField({initial: 0, integer: true, nullable: false, label: "Fortitude Additional Modifier"}),
                reflex: new fields.NumberField({initial: 0, integer: true, nullable: false, label: "Reflex Additional Modifier"}),
                will: new fields.NumberField({initial: 0, integer: true, nullable: false, label: "Will Additional Modifier"}),
            }),
            // Free text for conditional/situational Defense bonuses that can't be expressed as a
            // flat number - e.g. "Unstoppable Force: +2 Will, but only against Force effects".
            // Purely a reminder for play; nothing reads this mechanically.
            notes: new fields.StringField({
                initial: "",
                blank: true,
                label: "Defense Notes",
            }),
        }
    }
}
export class DefenseFunctions {
    /**
     * Homebrew: the player-assigned Defense points for one Defense, replacing the old
     * per-class Defense bonus. The level-10 pool only counts once the character
     * actually reaches level 10.
     * @param name {"fortitude"|"reflex"|"will"}
     * @return {number}
     */
    assignedDefensePoints(name) {
        const pool = this.defense?.defensePoints?.[name];
        if (!pool) return 0;

        const level1 = pool.level1 || 0;
        const level10 = (this.parent?.characterLevel || 0) >= 10 ? (pool.level10 || 0) : 0;
        return level1 + level10;
    }

    get armorBonus() {
        let actor = this.parent;
        let armorReflexDefenseBonus = this.armorReflexDefenseBonus || 0;

        if (["vehicle", "npc-vehicle"].includes(actor.type)) {
            if (actor.pilot) {
                let armorBonus = actor.pilot.items.filter(
                    (i) =>
                        i.type === "class" &&
                        Object.values(i.system.attributes).find(
                            (a) => a.key === "isHeroic"
                        ).value
                ).length;
                return Math.max(armorBonus, armorReflexDefenseBonus);
            } else {
                return armorReflexDefenseBonus;
            }
        } else {
            return this._selectRefBonus(
                actor,
                actor.defenseLevelBonus,
                armorReflexDefenseBonus
            );
        }
    }

    get armorReflexDefenseBonus() {
        let bonuses = equippedItems(this.parent, "armor")
            .map((i) => i.armorReflexDefenseBonus)
            .filter((bonus) => !!bonus);

        if (bonuses.length === 0) {
            return undefined;
        }
        return Math.max(...bonuses);
    }

    resolvedFort() {
        const actor = this.parent;
        let fortitudeDefense = this.defense?.fortitude ?? {};

        /** @type {{value: number, type: string}[]} */
        let bonuses = [];
        bonuses.push({value: 10, type: "Base"});

        //+ level bonus - full per heroic level, 3/4 (floored) per NPC-class (Beast/Nonheroic)
        // level, per tovec's homebrew (see SWSEActor#defenseLevelBonus).
        let levelBonus = actor.defenseLevelBonus;
        bonuses.push({value: levelBonus, type: "Armor"});

        //+ equipment bonus
        let equipmentBonus = this._getEquipmentFortBonus(actor);
        bonuses.push({value: equipmentBonus, type: "Armor"});

        //+ ability modifier
        let ability = actor.ignoreCon() ?
            CONFIG.SWSE.Defense.defense.fortitude.droidAbility :
            CONFIG.SWSE.Defense.defense.fortitude.ability;
        let abilityBonus = actor.system.abilities[ability].mod;
        bonuses.push({value: abilityBonus, type: "Ability"});

        //+ class bonus
        // Homebrew: assigned Defense points replace the old per-class Defense bonus.
        let classBonus = this.assignedDefensePoints("fortitude");
        bonuses.push({value: classBonus, type: "Class"});

        //+ fortitude defense bonus
        let fortitudeDefenseBonus = getInheritableAttribute({
            entity: actor,
            attributeKey: "fortitudeDefenseBonus",
            reduce: ["SUM", "SUMMARY", "MAPPED"],
            attributeFilter: (attr) => !attr.modifier,
        });
        bonuses.push({value: fortitudeDefenseBonus["SUM"], type: "Miscellaneous"});

        //+ manual additional modifier - tagged "Manual" (shows as its own line in the Misc
        // column's tooltip breakdown) but folds into the same Misc total as everything else.
        bonuses.push({value: this.defense.additionalModifier?.fortitude || 0, type: "Manual"});

        //total
        let name = "Fortitude";
        let total = this.overrides.fort ?? resolveValueArray(bonuses, actor);

        actor.setResolvedVariable("@FortDef", total, name, name);
        fortitudeDefense.name = name;
        fortitudeDefense.defenseBlock = true;

        this.applyBonuses(fortitudeDefense, total, bonuses);
        return fortitudeDefense;
    }

     resolvedWill() {
        const system = this;
        const actor = system.parent;
        const skip = ["vehicle", "npc-vehicle"].includes(actor.type);
        let willDefense = system.defense?.will ?? {};
        let bonuses = [];
        bonuses.push(10); //base

        //+ level bonus - full per heroic level, 3/4 (floored) per NPC-class (Beast/Nonheroic)
        // level, per tovec's homebrew (see SWSEActor#defenseLevelBonus).
        let levelBonus = actor.defenseLevelBonus;
        bonuses.push(levelBonus);

        //+ ability modifier
        let ability = actor.isDroid ?
            CONFIG.SWSE.Defense.defense.will.droidAbility :
            CONFIG.SWSE.Defense.defense.will.ability;
        let abilityBonus = actor.system.abilities[ability]?.mod ?? 0;
        bonuses.push(abilityBonus);
        willDefense.abilityBonus = abilityBonus;

        bonuses.push(...this.implantInterference(actor))
        //+ class bonus
        // Homebrew: assigned Defense points replace the old per-class Defense bonus.
        let classBonus = system.assignedDefensePoints("will");
        bonuses.push(classBonus);
        willDefense.classBonus = classBonus;

        //+ will defense bonus
        let willDefenseBonus = getInheritableAttribute({
            entity: actor,
            attributeKey: "willDefenseBonus",
            reduce: ["SUM", "SUMMARY", "MAPPED"],
            attributeFilter: (attr) => !attr.modifier,
        });

        let otherBonus = willDefenseBonus["SUM"];
        let miscBonusTip = willDefenseBonus["SUMMARY"];
        let miscBonuses = [otherBonus];

        for (let val of getInheritableAttribute({
            entity: actor,
            attributeKey: "applyBonusTo",
            reduce: "VALUES",
        })) {
            if (val.toLowerCase().endsWith(":will")) {
                let toks = val.split(":");
                let attributeKey = toks[0];

                if (attributeKey === "equipmentFortitudeDefenseBonus") {
                    let equipmentFortBonus = this._getEquipmentFortBonus(actor);
                    miscBonuses.push(equipmentFortBonus);
                    miscBonusTip +=
                        "Equipment Fort Bonus: " + equipmentFortBonus;
                } else {
                    let inheritableAttribute = getInheritableAttribute({
                        entity: actor,
                        attributeKey: attributeKey,
                        reduce: ["SUM", "SUMMARY", "MAPPED"],

                        attributeFilter: (attr) => !attr.modifier,
                    });

                    miscBonuses.push(inheritableAttribute["SUM"]);
                    miscBonusTip += inheritableAttribute["SUMMARY"];
                }
            }
        }
        //+ manual additional modifier - folded into miscBonuses (not pushed to `bonuses`
        // directly) so it's included in the displayed Misc total/tooltip like everything else.
        miscBonuses.push(this.defense.additionalModifier?.will || 0);
        willDefense.miscBonusTip = miscBonusTip;

        let miscBonus = resolveValueArray(miscBonuses);
        bonuses.push(miscBonus);
        willDefense.miscBonus = miscBonus;

        let armorBonus = resolveValueArray([levelBonus]);
        willDefense.armorBonus = armorBonus;

        let total = system.overrides.will ?? resolveValueArray(bonuses, actor);
        let name = "Will";
        willDefense.value = total;
        willDefense.total = total;
        actor.setResolvedVariable("@WillDef", total, name, name);
        willDefense.name = name;
        willDefense.skip = skip;
        willDefense.defenseBlock = true;
        return willDefense;
    }

     implantInterference(actor) {
        let disruption = getInheritableAttribute({
            entity: actor,
            attributeKey: "implantDisruption",
            reduce: "OR"
        })
        let training = getInheritableAttribute({
            entity: actor,
            attributeKey: "implantTraining",
            reduce: "OR"
        })

        if(disruption && !training){
            return [-2]
        }

        return [];
    }

    resolvedRef() {
        const system = this;
        const actor = system.parent;
        let reflexDefense = system.defense?.ref ?? {};

        /** @type {{value: number, type: string}[]} */
        let bonuses = [];
        bonuses.push({value: 10, type: "Base"});

        //+ armor/level bonus
        let armorBonus = this.armorBonus;
        bonuses.push({value: armorBonus, type: "Armor"});

        //+ ability modifier
        let ability = actor.isDroid ?
            CONFIG.SWSE.Defense.defense.reflex.droidAbility :
            CONFIG.SWSE.Defense.defense.reflex.ability;
        let armorDexOverride = this._getArmorDexterityOverride(actor);
        let abilityBonus;
        if (armorDexOverride !== undefined) {
            abilityBonus = armorDexOverride === "str" ? actor.system.abilities.str.mod : toNumber(armorDexOverride);
        } else {
            abilityBonus = Math.min(
                actor.system.abilities[ability].mod,
                this._getEquipmentMaxDexBonus(actor)
            );
        }
        bonuses.push({value: abilityBonus, type: "Ability"});

        //+ class bonus
        // Homebrew: assigned Defense points replace the old per-class Defense bonus.
        let classBonus = system.assignedDefensePoints("reflex");
        bonuses.push({value: classBonus, type: "Class"});

        //+ reflex defense bonus
        let reflexDefenseBonus = getInheritableAttribute({
            entity: actor,
            attributeKey: "reflexDefenseBonus",
            reduce: ["SUM", "SUMMARY", "MAPPED"],
            attributeFilter: (attr) => !attr.modifier,
        });
        let otherBonus = reflexDefenseBonus["SUM"];
        bonuses.push({value: otherBonus, type: "Miscellaneous"});

        //+ manual additional modifier - before _resolveFFRef below so flat-footed Reflex
        // inherits it too; folds into the same Misc total/tooltip as everything else.
        bonuses.push({value: this.defense.additionalModifier?.reflex || 0, type: "Manual"});

        let naturalArmorBonus = getInheritableAttribute({
            entity: actor,
            attributeKey: "naturalArmorReflexDefenseBonus",
            reduce: "SUM",
            attributeFilter: (attr) => !attr.modifier,
        });

        let bonusDodgeReflexDefense = getInheritableAttribute({
            entity: actor,
            attributeKey: "bonusDodgeReflexDefense",
            reduce: ["SUM", "SUMMARY", "MAPPED"],
            attributeFilter: (attr) => !attr.modifier,
        });

        bonuses.push({value: bonusDodgeReflexDefense["SUM"], type: "Dodge"});
        bonuses.push({value: naturalArmorBonus, type: "Natural"});

        reflexDefense.defenseModifiers = [
            this._resolveFFRef(
                actor,
                bonuses,
                reflexDefense.defenseModifiers
            ),
        ];

        let total = system.overrides.ref ?? resolveValueArray(bonuses, actor);
        let name = "Reflex";
        reflexDefense.value = total;
        reflexDefense.total = total;
        actor.setResolvedVariable("@RefDef", total, name, name);

        reflexDefense.name = name;
        reflexDefense.skip = false;
        reflexDefense.defenseBlock = true;

        this.applyBonuses(reflexDefense, total, bonuses)

        return reflexDefense;
    }

     applyBonuses(defense, total, bonuses) {
        defense.total = defense.override ? defense.override : total;
        defense.value = defense.total;
        defense.abilityBonus = bonuses.find(b => b.type === "Ability")?.value || 0;
        defense.armorBonus = bonuses.find(b => b.type === "Armor")?.value || 0;
        defense.classBonus = bonuses.find(b => b.type === "Class")?.value || 0;
        // "Manual" (the player-entered Additional Modifier box) intentionally folds into the
        // Misc column/tooltip here, same as every other non-Ability/Armor/Class/Base bonus -
        // so the whole combined bonus is visible in one place on the main defense row.
        const miscBonus = bonuses.filter(b => !(b.type === "Ability" || b.type === "Armor" || b.type === "Class" || b.type === "Base"));
        defense.miscBonus = miscBonus.reduce((acc, obj) => acc + toNumber(obj.value), 0);
        defense.miscBonusTip = miscBonus.map(b => `${b.type} ${b.value > -1 ? "Bonus" : "Modifier"}: ${b.value}`).join("\n");
    }

    /**
     * Homebrew: how many Defense points are assigned vs available. Two pools of 4
     * (max 2 per Defense each), the second unlocking at level 10 - so a single Defense
     * can hold at most 2 before level 10 and 4 after.
     */
    _resolveDefensePointBudget() {
        const pools = this.defense?.defensePoints ?? {};
        const names = ["fortitude", "reflex", "will"];
        const sum = (key) => names.reduce((total, name) => total + (pools[name]?.[key] || 0), 0);

        const level10Unlocked = (this.parent?.characterLevel || 0) >= 10;
        const level1Used = sum("level1");
        const level10Used = level10Unlocked ? sum("level10") : 0;

        return {
            level1Used,
            level1Max: 4,
            level1Over: level1Used > 4,
            level10Unlocked,
            level10Used,
            level10Max: 4,
            level10Over: level10Used > 4,
            perDefenseMax: 2
        };
    }

    _prepareDefenseDerivedData() {
        let system = this;
        const actor = system.parent;
        system.defense = system.defense ?? {};

        //TODO can we filter attributes by proficiency in the get search so we can get rid of some of the complex armor logic?

        system.defense.pointBudget = this._resolveDefensePointBudget();

        system.defense.fortitude = this.resolvedFort();
        system.defense.will = this.resolvedWill();
        system.defense.reflex = this.resolvedRef();
        system.defense.damageThreshold = this._resolveDt(system);
        system.defense.situationalBonuses = this._getSituationalBonuses(actor);
        // Keep the derived value available so the sheet can show it as a placeholder,
        // then let an explicit override replace it.
        system.defense.derivedDamageReduction = getInheritableAttribute({
            entity: actor,
            attributeKey: "damageReduction",
            reduce: "SUM",
        });
        const drOverride = (system.defense.damageReductionOverride || "").trim();
        system.defense.damageReduction = drOverride
            ? drOverride
            : system.defense.derivedDamageReduction;

        let armors = [];

        for (const armor of actor.itemTypes.armor.filter(
            (item) => item.system.equipped
        )) {
            armors.push(this.generateArmorBlock(actor, armor));
        }
        system.armors = armors;
    }

    _getEquipmentMaxDexBonus(actor) {
        let equipped = actor.itemTypes.armor.filter(
            (item) => item.equipped === "equipped"
        );
        let bonus = 1000;

        for (let item of equipped) {
            let maximumDexterityBonus = item.maximumDexterityBonus;
            if (!isNaN(maximumDexterityBonus)) {
                bonus = Math.min(bonus, maximumDexterityBonus);
            }
        }

        return bonus;
    }

    /**
     * Homebrew: some armor replaces the Dex-mod term of Reflex Defense outright rather than
     * capping it. Returns the override ("str" or a flat number) from equipped armor, if any.
     */
    _getArmorDexterityOverride(actor) {
        let equipped = actor.itemTypes.armor.filter(
            (item) => item.equipped === "equipped"
        );
        for (let item of equipped) {
            let override = item.armorDexterityOverride;
            if (override !== undefined && override !== "") {
                return override;
            }
        }
        return undefined;
    }

    _getEquipmentFortBonus(actor) {
        let equipped = actor.items.filter((item) => item.system.equipped);
        let bonus = 0;

        for (let item of equipped) {
            if (item.fortitudeDefenseBonus) {
                bonus = Math.max(bonus, item.fortitudeDefenseBonus);
            }
        }

        return bonus;
    }

    _selectRefBonus(actor, levelBonus, armorBonus) {
        if (armorBonus) {
            let proficientWithEquipped = true;

            for (const armor of actor.itemTypes.armor.filter(
                (item) => item.system.equipped
            )) {
                if (!armor._parentIsProficientWithArmor()) {
                    proficientWithEquipped = false;
                }
            }

            if (proficientWithEquipped) {
                let improvedArmoredDefense = getInheritableAttribute({
                    entity: actor,
                    attributeKey: "improvedArmoredDefense",
                    reduce: "OR",
                });
                if (improvedArmoredDefense) {
                    return Math.max(
                        armorBonus,
                        levelBonus + Math.floor(armorBonus / 2)
                    );
                }

                let armoredDefense = getInheritableAttribute({
                    entity: actor,
                    attributeKey: "armoredDefense",
                    reduce: "OR",
                });
                if (armoredDefense || actor.isFollower) {
                    return Math.max(armorBonus, levelBonus);
                }
            }
            return armorBonus;
        }
        return levelBonus;
    }

    _resolveFFRef(
        actor, bonuses, defenseModifiers
    ) {
        bonuses = JSON.parse(JSON.stringify(bonuses));

        bonuses = bonuses.filter(b => !((b.type === "Ability" && b.value > -1) || b.type === "Encumbrance"));

        let total = resolveValueArray(bonuses, actor);
        let name = 'Reflex (Flat-Footed)';

        actor.setResolvedVariable("@RefFFDef", total, name, name);

        let ffReflexDefense =  {};
        if(defenseModifiers){
            ffReflexDefense = defenseModifiers['reflex (flat-footed)'] || {};
        }

        this.applyBonuses(ffReflexDefense, total, bonuses)
        ffReflexDefense.name = name;
        ffReflexDefense.skip = false;
        ffReflexDefense.defenseBlock = true;
        return ffReflexDefense
    }

    _resolveDt(system) {
        const actor = system.parent;
        let bonuses = [];
        const damageThreshold = system.defense.damageThreshold;

        bonuses.push(system.defense.fortitude.value);
        bonuses.push(this._getDamageThresholdSizeMod(actor));
        bonuses.push(
            getInheritableAttribute({
                entity: actor,
                attributeKey: "damageThresholdBonus",
                reduce: "SUM",
            })
        );
        bonuses.push(
            ...getInheritableAttribute({
                entity: actor,
                attributeKey: "damageThresholdHardenedMultiplier",
                reduce: "NUMERIC_VALUES",
            }).map((value) => "*" + value)
        );
        bonuses.push(damageThreshold.misc)

        let total = resolveValueArray(bonuses, actor);
        damageThreshold.total = total
        damageThreshold.value = total

        return damageThreshold
    }

    _getDamageThresholdSizeMod(actor) {
        let attributes = actor.getTraitAttributesByKey(
            "damageThresholdSizeModifier"
        );
        let total = [];

        for (let attribute of attributes) {
            total.push(attribute);
        }

        return toNumber(resolveValueArray(total, actor));
    }

    _getSituationalBonuses(actor) {
        let defenseBonuses = getInheritableAttribute({
            entity: actor,
            attributeKey: [
                "fortitudeDefenseBonus",
                "reflexDefenseBonus",
                "willDefenseBonus",
            ],
            attributeFilter: (attr) => !!attr.modifier,
        });

        let situational = [];
        for (let defenseBonus of defenseBonuses) {
            let value = toNumber(defenseBonus.value);
            let defense = defenseBonus.key.replace("DefenseBonus", "");
            situational.push(
                `${(value > -1 ? "+" : "") + value} ${value < 0 ? "penalty" : "bonus"
                } to their ${defense.titleCase()} Defense to resist ${defenseBonus.modifier
                }`
            );
        }

        let immunities = getInheritableAttribute({
            entity: actor,
            attributeKey: "immunity",
        });

        for (let immunity of immunities) {
            situational.push(`Immunity: ${immunity.value}`);
        }

        return situational;
    }

    generateArmorBlock(actor, armor) {
        let attributes = getInheritableAttribute({
            entity: armor,
            attributeKey: "special",
            reduce: "VALUES",


        });
        if (!armor._parentIsProficientWithArmor()) {
            attributes.push("(Not Proficient)");
        }
        const notes = attributes.join(", ");
        return {
            name: armor.name,
            refDefense: armor.armorReflexDefenseBonus,
            fortDefense: armor.fortitudeDefenseBonus,
            maxDex: armor.maximumDexterityBonus,
            notes: notes,
            subtype: armor.armorType,
            notesHTML: notes,
            notesText: notes,
            modes : armor.modes
        };
    }
}
