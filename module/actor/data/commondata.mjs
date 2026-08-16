import {AbilityFields} from "./templates/abilities.mjs";
import {HealthFields} from "./templates/health.mjs";
import {ShieldFields} from "./templates/shields.mjs";
import {DefenseFields} from "./templates/defenses.mjs";
import {SlotFields} from "./templates/slots.mjs";

const fields = foundry.data.fields;

export default class CommonActorData {
    static get commonData() {

        return {
            abilities: new fields.SchemaField({
                ...AbilityFields.physical,
                ...AbilityFields.mental,
            }),
            ...AbilityFields.darkside,
            health: new fields.SchemaField({
                ...HealthFields.common,
            }),
            shields: new fields.SchemaField({
                ...ShieldFields.common,
            }),
            ...SlotFields.common,
            toggles: new fields.ObjectField({
                label: "Stored Sheet Toggles",
            }),
            combatToggles: new fields.ObjectField({
                label: "Active Situational Combat Bonuses",
            }),
            overrides: new fields.ObjectField({
                label: "Stored Sheet Overrides",
            }),
            actorLinks: new fields.ArrayField(new fields.SchemaField({
                id: new fields.DocumentIdField(),
                uuid: new fields.StringField({required: true}),
                position: new fields.StringField({initial: "neutral"}),
                slot: new fields.StringField({
                    nullable: true,
                    initial: null}),
            }), {
                label: "Actor Links",
                initial: []
            }),
            changes: new fields.ArrayField(new fields.SchemaField({
                key: new fields.StringField({required: true}),
                mode: new fields.NumberField({required: true, initial: 2}),
                priority: new fields.NumberField({initial: 1}),
                value: new fields.StringField({})
            })),
            // Homebrew: attacks that aren't backed by an equipped item (e.g. a Grapple check) -
            // see module/actor/custom-attack-item.mjs, which wraps one of these into the same
            // "virtual item" shape UnarmedAttack already uses so it flows through the existing
            // Attack pipeline (bonuses, advantage/disadvantage, etc.) unmodified.
            customAttacks: new fields.ArrayField(new fields.SchemaField({
                id: new fields.DocumentIdField(),
                name: new fields.StringField({required: true, initial: "Custom Attack"}),
                ability: new fields.StringField({initial: ""}),
                damageDie: new fields.StringField({initial: ""}),
                damageType: new fields.StringField({initial: ""}),
                proficient: new fields.BooleanField({initial: true}),
                notes: new fields.StringField({initial: ""})
            }), {
                label: "Custom Attacks",
                initial: []
            }),
            // Display order for the Attacks panel, as a list of attack keys. Attacks come from
            // several unrelated sources (equipped weapons, natural weapons, custom attacks, the
            // synthetic Unarmed Attack), so there's no single underlying list whose `sort` could
            // order them - hence an explicit key order held on the actor. Keys not listed fall to
            // the end in their natural order, so a newly-equipped weapon still shows up.
            attackOrder: new fields.ArrayField(new fields.StringField(), {
                label: "Attack Order",
                initial: []
            }),
            // Attack keys hidden from the Attacks panel. Hidden rather than deleted because most
            // attacks are generated (from an equipped weapon, or the stand-in Unarmed Attack) and
            // have nothing to delete - unhiding is just removing the key again.
            hiddenAttacks: new fields.ArrayField(new fields.StringField(), {
                label: "Hidden Attacks",
                initial: []
            }),
            settings: new fields.SchemaField({
                isNPC: new fields.BooleanField({
                    initial: false
                }),
                // On by default: a token matching the actor's size is almost always what's wanted,
                // and turning it off is the rare case. Only affects newly-created actors - an
                // existing actor keeps whatever value is already stored (the Refresh Sheet button
                // in Settings re-applies current defaults to an existing actor).
                autoSizeToken: new fields.BooleanField({
                    initial: true
                }),
                allowSheetLighting: new fields.BooleanField({
                    initial: true
                }),
                ignorePrerequisites: new fields.BooleanField({
                    initial: false
                }),
                attributeGeneration: new fields.StringField({
                    initial: "Default",
                    label: "Ability Generation",
                }),
            }),
            defense: new fields.SchemaField({
                ...DefenseFields.character
            })
        };
    }
}
