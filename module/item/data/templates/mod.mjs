const fields = foundry.data.fields;

/** Matches template.json Item > templates > "mod". Function, not object — see base.mjs for why. */
export function ModFields() {
    return {
        hasItemOwner: new fields.BooleanField({initial: false})
    };
}
