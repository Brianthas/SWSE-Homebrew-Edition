const fields = foundry.data.fields;

/**
 * Matches template.json Item > templates > "categories". Elements are objects (e.g. {value: "..."}),
 * not plain strings. Function, not object — see base.mjs for why.
 */
export function CategoriesFields() {
    return {
        categories: new fields.ArrayField(new fields.ObjectField())
    };
}
