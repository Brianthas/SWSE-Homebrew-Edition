import ItemSystemDataModel from "./abstract.mjs";
import {BaseItemFields} from "./templates/base.mjs";
import {ItemFields} from "./templates/item.mjs";
import {CategoriesFields} from "./templates/categories.mjs";
import {ModifiableFields} from "./templates/modifiable.mjs";
import {SourceFields} from "./templates/source.mjs";
import {ModeFields} from "./templates/mode.mjs";

const fields = foundry.data.fields;

/**
 * Matches template.json Item > weapon (templates: base, item, categories, modifiable, source, mode)
 * plus the weapon-specific "weapon" object and the "equipped"/"stripping" fields, which are used
 * throughout item.mjs/actor.mjs but were never declared in template.json at all - they must be
 * declared here or they'd start getting stripped too, now that this type has an explicit schema.
 */
export default class WeaponData extends ItemSystemDataModel {
    static _systemType = "weapon";

    static defineSchema() {
        return {
            ...BaseItemFields(),
            ...ItemFields(),
            ...CategoriesFields(),
            ...ModifiableFields(),
            ...SourceFields(),
            ...ModeFields(),
            weapon: new fields.ObjectField({initial: {}}),
            equipped: new fields.StringField({initial: "", blank: true, required: false}),
            stripping: new fields.ObjectField({initial: {}}),
            // Homebrew: persisted per-weapon ability-score override for attack/damage rolls -
            // a manual choice the player owns, offered on every weapon (no gating). The three
            // lightsaber-technique values carry extra mechanical effects beyond a plain ability
            // swap (Ataru's two-handed doubling, Kinetic Combat's WIS/CHA-max) and are only
            // offered when wielding a lightsaber with the granting talent/power.
            abilityOverride: new fields.StringField({
                initial: "", blank: true,
                choices: ["", "str", "dex", "int", "wis", "cha", "ataru", "kinetic_combat", "noble_fencing"]
            }),
            // Damage usually uses the same ability as the attack, so this falls back to
            // abilityOverride when blank. Split out because they genuinely differ sometimes -
            // a turret attacks on Dexterity but deals damage on Intelligence.
            damageAbilityOverride: new fields.StringField({
                initial: "", blank: true,
                choices: ["", "str", "dex", "int", "wis", "cha", "ataru", "kinetic_combat", "noble_fencing"]
            }),
            // Some weapons come in several damage flavours - a grenade may be Physical, Energy,
            // Stun, Sonic or Burn - and which one is loaded is a per-attack choice rather than a
            // property of the item. Blank keeps whatever damage type the item itself declares.
            damageTypeOverride: new fields.StringField({initial: "", blank: true}),
            // Homebrew: persisted per-weapon handedness override ("1"/"2"), same pattern as
            // abilityOverride - a StringField (not Number) so template equality checks
            // (Handlebars ifEquals is strict ===) work the same way abilityOverride's do.
            // Blank means auto-determine from size/grip/Strength as before. Only offered on the
            // sheet for weapons that genuinely support a choice.
            handsOverride: new fields.StringField({initial: "", blank: true, choices: ["", "1", "2"]}),
            // Typed mechanical fields a weapon genuinely owns - promoted out of the generic
            // system.changes array (see module/item/default-changes.mjs). Cross-grantable keys
            // (toHitModifier, bonusDamage, proficiency/focus/specialization, grip, thrown, etc.)
            // stay generic since other item types can also grant them.
            damageDie: new fields.StringField({initial: "", blank: true, required: false}),
            damageType: new fields.StringField({initial: "", blank: true, required: false}),
            specialQualities: new fields.StringField({initial: "", blank: true, required: false}),
            lightSlotCost: new fields.NumberField({initial: null, nullable: true, required: false}),
            kitSlotCost: new fields.NumberField({initial: null, nullable: true, required: false}),
            // Homebrew: a quick, always-visible way to hand-tune *this specific weapon's* attack/
            // damage bonus (e.g. a lightsaber's crystal attunement granting +1 to attack) without
            // needing a whole talent/feat/effect to express a single number. Doesn't change the
            // toHitModifier/bonusDamage keys themselves being generic (see comment above) - these
            // just synthesize the same generic change via defaultChanges (default-changes.mjs), so
            // any other source that already grants toHitModifier/bonusDamage keeps working exactly
            // as before, this only adds a nicer, weapon-scoped entry point for one-off tweaks.
            miscAttackBonus: new fields.NumberField({initial: 0, integer: true, nullable: false, required: false}),
            miscDamageBonus: new fields.NumberField({initial: 0, integer: true, nullable: false, required: false})
        };
    }
}
