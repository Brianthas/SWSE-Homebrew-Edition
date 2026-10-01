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

/**
 * "1d20 + 5[Half Level] + 2[Wisdom] - 2[Armor Check Penalty]": a check's formula with each part
 * labelled, so its card can list them. Returns `fallback` unless every part is a number with a
 * label and the parts add up to `total`, so the labelled roll always totals what the plain one
 * would.
 * @param die {string} "1d20"
 * @param parts {{value: *, label: string}[]}
 * @param total {number} the check's modifier as the sheet shows it
 * @param fallback {string}
 */
export function labeledFormula(die, parts, total, fallback) {
    // A blank value (an unset manual bonus) counts as 0; anything else must be a number.
    const numbers = parts
        .map(p => ({value: p.value === undefined || p.value === null || p.value === "" ? 0 : Number(p.value), label: p.label}))
        .filter(p => p.value !== 0);
    if (numbers.some(p => !Number.isFinite(p.value) || !p.label || /[[\]]/.test(p.label))) return fallback;
    if (numbers.reduce((sum, p) => sum + p.value, 0) !== Number(total)) return fallback;
    return [die, ...numbers.map(p => `${p.value < 0 ? "-" : "+"} ${Math.abs(p.value)}[${p.label}]`)].join(" ");
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
 * Chips for a card: one per modifier, label first as PF2e writes them ("Weapon Focus +1"),
 * penalties flagged so the card can color them. Unlabelled numbers read as a bare value.
 */
export function modifierChips(summary) {
    return summary.modifiers.map(m => ({
        text: m.label ? `${m.label} ${signed(m.value)}` : signed(m.value),
        negative: m.value < 0
    }));
}

/**
 * A roll's arithmetic on one line: each die group's formula and what it rolled, then the summed
 * bonus. "d20 [8] +17", "3d8 [17] +5". A critical or a natural 1 colours the dice and adds a tag
 * (`criticalLabel`, `failLabel`). A roll that is not a plain sum shows its formula.
 * @param summary {ReturnType<summarizeRoll>}
 * @return {string} HTML
 */
export function rollMathHtml(summary, {critical = false, fail = false, criticalLabel = "Critical", failLabel = "Nat 1"} = {}) {
    const tag = critical ? `<span class="swse-natural is-critical">${escapeHTML(criticalLabel)}</span>`
        : fail ? `<span class="swse-natural is-fail">${escapeHTML(failLabel)}</span>` : "";
    if (summary.complex) {
        return `<span class="swse-math"><span class="swse-math-formula">${escapeHTML(summary.formula)}</span>${tag}</span>`;
    }
    const state = critical ? " is-critical" : fail ? " is-fail" : "";
    const dice = summary.dice.map(d => {
        const shown = d.results.filter(r => r.active).map(r => r.result);
        const total = d.total ?? shown.reduce((sum, n) => sum + n, 0);
        const each = shown.length > 1 ? ` title="${shown.join(" + ")}"` : "";
        // One die reads as its name: "d20", not "1d20".
        const name = d.formula.replace(/^1d/, "d");
        return `<span class="swse-math-formula">${escapeHTML(name)}</span><span class="swse-die${state}"${each}>${total}</span>`;
    }).join(`<span class="swse-math-op">+</span>`);
    const bonus = summary.bonus ? `<span class="swse-math-bonus">${signed(summary.bonus)}</span>` : "";
    return `<span class="swse-math">${dice}${bonus}${tag}</span>`;
}
