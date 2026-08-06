const fields = foundry.data.fields;

/**
 * Matches template.json Item > templates > "mode". `modes` matches item.mjs's real dict usage (see base.mjs).
 * Function, not object — see base.mjs for why.
 */
export function ModeFields() {
    return {
        modes: new fields.ObjectField({initial: {}}),
        activeModes: new fields.ArrayField(new fields.StringField())
    };
}
