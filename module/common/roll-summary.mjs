// Reads a Roll as dice plus signed, labelled modifiers, for the chat cards and the sheet's attack
// tooltips. Works on an unevaluated Roll (the sheet's preview) and an evaluated one (a card).
//
// Terms are told apart by shape rather than class, so the module loads without Foundry's dice
// classes: an operator has `operator`, a die has `faces`, a number has a numeric `number` and no
// `faces`. Anything else (a critical's bracketed, multiplied group) makes the roll "complex", and
// callers show its formula instead of chips.

const MINUS = "−";

/** "+3", or "-3" written with a true minus sign. */
export function signed(value) {
    const n = Number(value) || 0;
    return n < 0 ? `${MINUS}${Math.abs(n)}` : `+${n}`;
}

/**
 * @param roll {Roll}
 * @return {{dice: {formula: string, faces: number, results: {result: number, active: boolean}[], total: number|undefined}[],
 *           modifiers: {value: number, label: string}[], bonus: number, complex: boolean, formula: string, total: number|undefined}}
 */
export function summarizeRoll(roll) {
    const dice = [];
    const modifiers = [];
    let sign = 1;
    let complex = false;
    for (const term of roll?.terms ?? []) {
        if (!term) continue;
        if (typeof term.operator === "string") {
            if (term.operator === "+" || term.operator === "-") {
                sign = term.operator === "-" ? -1 : 1;
            } else {
                complex = true;
            }
            continue;
        }
        if (term.faces) {
            dice.push({
                formula: term.formula ?? `${term.number}d${term.faces}`,
                faces: term.faces,
                results: (term.results ?? []).map(r => ({result: r.result, active: r.active !== false && !r.discarded})),
                total: term.total
            });
        } else if (typeof term.number === "number") {
            modifiers.push({value: sign * term.number, label: term.options?.flavor || ""});
        } else {
            complex = true;
        }
        sign = 1;
    }
    return {
        dice,
        modifiers,
        bonus: modifiers.reduce((sum, m) => sum + m.value, 0),
        complex,
        formula: roll?.formula ?? "",
        total: roll?._evaluated ? roll.total : undefined
    };
}

/** "3d8 (6 · 4 · 7)": each die group with its active results, when rolled. */
export function diceText(summary) {
    return summary.dice.map(d => {
        const shown = d.results.filter(r => r.active).map(r => r.result);
        return shown.length ? `${d.formula} (${shown.join(" · ")})` : d.formula;
    }).join(" + ");
}

/** The natural d20 of an attack or check roll: the active result of its d20, if it has one. */
export function naturalD20(summary) {
    const d20 = summary.dice.find(d => d.faces === 20);
    return d20?.results.find(r => r.active)?.result;
}

function escapeHTML(text) {
    return `${text ?? ""}`.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * The sheet's hover tooltip for an attack's to-hit or damage roll: the total up top ("+23", or
 * "3d8 +14" for damage), then a line per die and modifier. A roll this cannot split into a sum
 * shows its formula.
 * @param kind {"attack"|"damage"}
 * @param roll {Roll|undefined}
 * @return {string} HTML, or "" when there is no roll
 */
export function rollTooltipHtml(kind, roll) {
    if (!roll) return "";
    const summary = summarizeRoll(roll);
    const title = kind === "attack" ? "Attack bonus" : "Damage";
    let total;
    const lines = [];
    if (summary.complex) {
        total = summary.formula;
    } else if (kind === "attack") {
        total = signed(summary.bonus);
    } else {
        total = [summary.dice.map(d => d.formula).join(" + "), summary.bonus ? signed(summary.bonus) : ""].filter(Boolean).join(" ");
        for (const die of summary.dice) lines.push({label: "Dice", value: die.formula, negative: false});
    }
    if (!summary.complex) {
        for (const m of summary.modifiers) lines.push({label: m.label || "Other", value: signed(m.value), negative: m.value < 0});
    }
    const rows = lines.map(line => `<li class="${line.negative ? "is-negative" : ""}"><span>${escapeHTML(line.label)}</span><span>${escapeHTML(line.value)}</span></li>`).join("");
    return `<div class="swse-roll-tip"><div class="swse-roll-tip-head"><span>${title}</span><strong>${escapeHTML(total)}</strong></div>${rows ? `<ul>${rows}</ul>` : ""}</div>`;
}

/**
 * Chips for a card: one per modifier, "+1 Weapon Focus", penalties flagged so the card can color
 * them. Unlabelled numbers read as a bare value.
 */
export function modifierChips(summary) {
    return summary.modifiers.map(m => ({
        text: m.label ? `${signed(m.value)} ${m.label}` : signed(m.value),
        negative: m.value < 0
    }));
}
