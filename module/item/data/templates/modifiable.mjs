const fields = foundry.data.fields;

/** Matches template.json Item > templates > "modifiable". Function, not object - see base.mjs for why. */
export function ModifiableFields() {
    return {
        items: new fields.ArrayField(new fields.ObjectField())
    };
}
