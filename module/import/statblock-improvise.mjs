/**
 * Builds a real item for a statblock entry this fork has no match for.
 *
 * The importer's "Not found" list used to offer two answers: substitute something real, or leave it
 * out. Both lose whatever the statblock said the thing did. But a wiki statblock usually states the
 * bonuses inline, in the bracket after the name:
 *
 *     Custom Armor (As Armored Flight Suit with Helmet Package (+8 Reflex; +2 Perception, Low-Light Vision))
 *     Stormtrooper Armor (+6 Reflex, +2 Fortitude)
 *
 * so there is enough there to build something that works on the sheet rather than nothing at all.
 *
 * Deliberately conservative about what becomes a mechanic. A `+N` against a defense or a real skill
 * becomes a change; everything else is kept as description text where the GM can read it and rule
 * on it. Writing a change whose key or skill name is not real is worse than writing none, because
 * `getInheritableAttribute` silently returns nothing for it and the sheet shows a bonus that never
 * applies.
 *
 * No static imports, so this stays runnable under plain `node --test` alongside the parser and
 * mapper. The caller supplies the skill list.
 */

/** Defense words as a statblock spells them, mapped to the change keys defenses.mjs reads. */
const DEFENSE_KEYS = {
    reflex: "reflexDefenseBonus",
    fortitude: "fortitudeDefenseBonus",
    will: "willDefenseBonus"
};

/**
 * Everything built here is `equipment`, deliberately, whatever the entry looked like.
 *
 * The unresolved row's `type` is not a fact about the entry, it is the FIRST of the candidate types
 * the resolver tried. For a possession that is `weapon`, so keying the built item off it made
 * Vader's Custom Armor a weapon, and a weapon on an actor generates an attack: he came out able to
 * swing his own armour.
 *
 * `equipment` carries `changes` exactly as any other item does, so the bonuses still apply, and it
 * neither invents an attack nor pretends to be armour under a fork whose armour model is four fixed
 * types with a Dexterity override rather than a per-item Reflex bonus.
 */
const IMPROVISED_TYPE = "equipment";

/**
 * Splits the outermost bracket off an entry, returning the name and everything inside it.
 *
 * Vader's armor nests a bracket inside the bracket, so a lazy `\(([^)]*)\)` stops at the first
 * inner `)` and loses "+2 Perception, Low-Light Vision". Scan and count depth instead.
 */
export function splitPrinted(text) {
    const raw = String(text ?? "").trim();
    const open = raw.indexOf("(");
    if (open < 0 || !raw.endsWith(")")) return {name: raw, detail: ""};
    let depth = 0;
    for (let i = open; i < raw.length; i++) {
        if (raw[i] === "(") depth++;
        else if (raw[i] === ")") {
            depth--;
            if (depth === 0) {
                // Only treat it as the entry's own bracket if it closes at the very end.
                if (i !== raw.length - 1) return {name: raw, detail: ""};
                return {name: raw.slice(0, open).trim(), detail: raw.slice(open + 1, i).trim()};
            }
        }
    }
    return {name: raw, detail: ""};
}

/**
 * Reads "+8 Reflex", "+2 Perception" and the like out of the detail text.
 *
 * @param {string} detail          the text inside the entry's bracket
 * @param {Set<string>} skillNames the skills this fork actually has, lower-cased
 * @returns {{changes: Array, applied: Array<string>, leftover: Array<string>}}
 */
export function readBonuses(detail, skillNames) {
    const changes = [];
    const applied = [];
    const leftover = [];

    // Brackets nest, so flatten before splitting on separators: "(+8 Reflex; +2 Perception)" and
    // "+8 Reflex; +2 Perception" have to read the same.
    const flat = String(detail ?? "").replace(/[()]/g, " ");
    for (const rawPiece of flat.split(/[;,]/)) {
        const piece = rawPiece.trim();
        if (!piece) continue;
        // Anchored at the END, not the start. Vader's bracket reads "As Armored Flight Suit with
        // Helmet Package (+8 Reflex; ...)", so once the nested brackets are flattened the first
        // piece is prose followed by the bonus. A start-anchored match sees no bonus there at all
        // and drops the +8 silently.
        const match = /([+-]\s*\d+)\s+([A-Za-z][A-Za-z' ]*?)\s*$/.exec(piece);
        if (!match) {
            leftover.push(piece);
            continue;
        }
        // Whatever preceded the bonus is prose, and the GM should still see it.
        const prefix = piece.slice(0, match.index).trim();
        if (prefix) leftover.push(prefix);
        const value = Number(match[1].replace(/\s+/g, ""));
        // "Reflex Defense" and "Reflex" are the same thing; so are "Perception checks".
        const target = match[2].trim()
            .replace(/\s+(Defense|Defence)$/i, "")
            .replace(/\s+checks?$/i, "")
            .trim();

        const defenseKey = DEFENSE_KEYS[target.toLowerCase()];
        if (defenseKey) {
            changes.push({key: defenseKey, value: String(value), mode: 2, priority: 0});
            applied.push(`${match[1].replace(/\s+/g, "")} ${target}`);
            continue;
        }
        if (skillNames.has(target.toLowerCase())) {
            // skills.mjs splits this on ":" and reads [0] as the skill and [1] as the value.
            changes.push({key: "skillBonus", value: `${target}:${value}:IMPORTED`, mode: 2, priority: 0});
            applied.push(`${match[1].replace(/\s+/g, "")} ${target}`);
            continue;
        }
        // A bonus to something this fork has no key for. Kept as text rather than guessed at.
        leftover.push(`${match[1].replace(/\s+/g, "")} ${target}`);
    }
    return {changes, applied, leftover};
}

/**
 * Reads a count off the front of an entry's bracket.
 *
 * Darth Vader's line is "Cybernetic Prosthesis (4, Both Arms and Legs)", and the 4 is the whole
 * mechanical point of it: the wiki's rule for the item is "-1 penalty on Use the Force checks for
 * each prosthetic replacement they possess (to a maximum penalty of -5)". Importing one gave him
 * -1 where he should have -4, so his Use the Force read three points too high.
 *
 * Deliberately narrow. It must be an unsigned integer at the very start, closed by a comma or the
 * end of the bracket, so it cannot catch a bonus ("+8 Reflex", signed) or a qualifier
 * ("Self-Built", not a digit). Capped at 20 because a statblock typo should not create hundreds of
 * embedded items.
 */
export function countFromPayload(payload) {
    const match = /^\s*(\d+)\s*(?:,|$)/.exec(String(payload ?? ""));
    if (!match) return 1;
    const count = Number(match[1]);
    return Number.isInteger(count) && count > 1 && count <= 20 ? count : 1;
}

/**
 * Identity of what a change actually modifies, for spotting one that is already there.
 *
 * `key` alone is too coarse for skills: every skill bonus in the packs is keyed `skillBonus`, so
 * comparing keys would treat "+2 Perception" as already present because the item happens to carry
 * an unrelated "Use the Force -1". The skill name has to be part of the identity.
 */
export function changeTarget(change) {
    if (change?.key === "skillBonus") {
        return `skillBonus:${String(change.value).split(":")[0].trim().toLowerCase()}`;
    }
    return String(change?.key ?? "");
}

/** Human-readable form of a change, for the import report. */
export function describeChange(change) {
    if (change?.key === "skillBonus") {
        const [skill, value] = String(change.value).split(":");
        return `${Number(value) >= 0 ? "+" : ""}${value} ${skill}`;
    }
    const label = String(change?.key ?? "").replace(/DefenseBonus$/, "");
    return `${Number(change?.value) >= 0 ? "+" : ""}${change?.value} ${label}`;
}

/**
 * Builds the item payload for an unresolved row the GM chose to import anyway.
 *
 * @param {object} row              a row from report.unresolved ({name, type, printed})
 * @param {object} options
 * @param {Iterable<string>} options.skills  skill names this fork has
 * @returns {{payload: object, applied: Array<string>, leftover: Array<string>}}
 */
export function buildImprovisedItem(row, {skills = []} = {}) {
    const skillNames = new Set([...skills].map(s => String(s).toLowerCase()));
    const {name, detail} = splitPrinted(row?.printed ?? row?.name ?? "");
    const {changes, applied, leftover} = readBonuses(detail, skillNames);

    const finalName = (name || row?.name || "Imported item").trim();
    const type = IMPROVISED_TYPE;

    const lines = [
        `<p><i>Imported from a statblock; this fork has no item of this name.</i></p>`,
        detail ? `<p><b>As printed:</b> ${escapeHtml(row.printed)}</p>` : null,
        applied.length
            ? `<p><b>Applied as bonuses:</b> ${applied.map(escapeHtml).join(", ")}.</p>`
            : `<p><b>No bonuses were applied automatically.</b></p>`,
        leftover.length
            ? `<p><b>Not automated, adjudicate at the table:</b> ${leftover.map(escapeHtml).join("; ")}.</p>`
            : null
    ].filter(Boolean);

    return {
        payload: {
            name: finalName,
            type,
            system: {
                description: lines.join(""),
                changes,
                quantity: 1
            }
        },
        applied,
        leftover
    };
}

/** Statblock text is wiki-authored, so it never goes into an item description unescaped. */
function escapeHtml(text) {
    return String(text ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
