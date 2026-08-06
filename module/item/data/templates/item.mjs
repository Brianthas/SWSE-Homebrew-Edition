const fields = foundry.data.fields;

/** Matches template.json Item > templates > "item". Function, not object — see base.mjs for why. */
export function ItemFields() {
    return {
        cost: new fields.StringField({initial: "", blank: true, required: false}),
        weight: new fields.StringField({initial: "", blank: true, required: false}),
        availability: new fields.StringField({initial: "", blank: true, required: false}),
        size: new fields.StringField({initial: "", blank: true, required: false}),
        type: new fields.StringField({initial: "", blank: true, required: false}),
        subtype: new fields.StringField({initial: "", blank: true, required: false}),
        quantity: new fields.NumberField({initial: 1, integer: true})
    };
}
