const fields = foundry.data.fields;

/** Matches template.json Item > templates > "source". Function, not object — see base.mjs for why. */
export function SourceFields() {
    return {
        supplier: new fields.ObjectField({initial: {}}),
        // Elements are "name:payload" strings (see item.mjs's provider.split(":")), not objects.
        possibleProviders: new fields.ArrayField(new fields.StringField()),
        isSupplied: new fields.BooleanField({initial: false})
    };
}
