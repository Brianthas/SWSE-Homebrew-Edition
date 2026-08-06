const fields = foundry.data.fields;

/**
 * Matches template.json Item > templates > "base".
 * `changes`/`providedItems` hold heterogeneous plain objects (e.g. {key, value, mode}); ObjectField
 * keeps them lossless without needing a full schema for every shape in use across the compendium.
 * `modes` here is a duplicate of the "mode" template's field of the same name (harmless, same shape).
 */
// A function, not a static object: each DataField instance can only belong to one parent schema,
// so every type composing this must get its own freshly-constructed set of fields.
export function BaseItemFields() {
    return {
        finalName: new fields.StringField({initial: "", blank: true, required: false}),
        description: new fields.StringField({initial: "", blank: true, required: false}),
        textDescription: new fields.StringField({initial: "", blank: true, required: false}),
        sourceString: new fields.StringField({initial: "", blank: true, required: false}),
        attributes: new fields.ObjectField({initial: {}}),
        changes: new fields.ArrayField(new fields.ObjectField()),
        choices: new fields.ArrayField(new fields.ObjectField()),
        // Despite the template.json "[]" default, item.mjs writes/reads this as a dict keyed by mode
        // index/id (e.g. system.modes[modeIndex] = {...}), not an array — ObjectField matches real usage.
        modes: new fields.ObjectField({initial: {}}),
        providedItems: new fields.ArrayField(new fields.ObjectField()),
        payload: new fields.StringField({initial: "", blank: true, required: false}),
        buildInstructions: new fields.ArrayField(new fields.ObjectField())
    };
}
