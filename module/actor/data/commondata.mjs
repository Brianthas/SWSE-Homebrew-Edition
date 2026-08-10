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
            // Homebrew: attacks that aren't backed by an equipped item (e.g. a Grapple check) —
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
            settings: new fields.SchemaField({
                isNPC: new fields.BooleanField({
                    initial: false
                }),
                autoSizeToken: new fields.BooleanField({
                    initial: false
                }),
                allowSheetLighting: new fields.BooleanField({
                    initial: false
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
