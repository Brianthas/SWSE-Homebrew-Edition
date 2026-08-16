const fields = foundry.data.fields;

/**
 * Matches template.json Item > templates > "levels" (used by "class").
 * item.mjs reads this via Object.values(item.system.levels), consistent with a dict keyed by
 * level number (same pattern as "modes" in base.mjs) rather than a plain array.
 * Function, not object - see base.mjs for why.
 */
export function LevelsFields() {
    return {
        levels: new fields.ObjectField({initial: {}})
    };
}
