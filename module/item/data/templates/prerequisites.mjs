const fields = foundry.data.fields;

/** Matches template.json Item > templates > "prerequisites". Function, not object — see base.mjs for why. */
export function PrerequisitesFields() {
    return {
        prerequisite: new fields.ObjectField({nullable: true, initial: null})
    };
}
