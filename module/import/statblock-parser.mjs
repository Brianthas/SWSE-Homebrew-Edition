/**
 * Parses a Star Wars Saga Edition statblock from the SWSE fandom wiki into a neutral
 * StatblockData object.
 *
 * This file deliberately has NO imports. It touches no Foundry global and nothing from the rest of
 * the system, so it can be unit tested under plain `node --test` without the Foundry mocks in
 * module_test/setup.mjs (which are currently incomplete - the module graph throws on Handlebars).
 * Keep it that way: mapping names onto compendium items is statblock-mapper.mjs's job, not this
 * file's.
 *
 * The parser reads WIKITEXT, not rendered page text. Wikitext is strictly more informative:
 * `[[Lightsaber (Weapon)|Lightsaber]]` tells us the display name is "Lightsaber" while the wiki
 * page is "Lightsaber (Weapon)", and the rendered text throws that away. Fetch it with:
 *   https://swse.fandom.com/api.php?action=parse&page=PAGE&prop=wikitext&format=json&formatversion=2&origin=*
 *
 * Nothing here interprets house rules and nothing here is trusted as a number to store on an actor.
 * Printed values are captured under `printed` purely so the importer can show a
 * printed-versus-derived divergence report. See docs/statblock-importer-plan.md.
 */

/** Sizes that can lead the type line. Ordered longest-first so "Colossal (Cruiser)" wins. */
const SIZES = ["Colossal (Cruiser)", "Colossal (Station)", "Colossal", "Gargantuan", "Huge",
    "Large", "Medium", "Small", "Tiny", "Diminutive", "Fine"];

const ABILITY_KEYS = {
    strength: "str", dexterity: "dex", constitution: "con",
    intelligence: "int", wisdom: "wis", charisma: "cha"
};

/**
 * Strips wiki markup down to the text a reader sees.
 * `[[A|B]]` becomes B (the display name, which is what matches our compendium entries),
 * `[[A]]` becomes A, and bold/italic quote runs are removed.
 */
export function stripMarkup(text) {
    return String(text ?? "")
        .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, "$2")
        .replace(/\[\[([^\]]*)\]\]/g, "$1")
        .replace(/<ref[^>]*>.*?<\/ref>/gi, "")
        .replace(/<[^>]+>/g, "")
        .replace(/'{2,}/g, "")
        // The wiki contains both the &nbsp; entity and literal U+00A0 characters, and the raw
        // character is the dangerous one: it looks identical to a space, so a name carrying one
        // never matches its compendium entry and the failure is invisible on screen. Normalise
        // every unicode space to a plain one, then collapse runs.
        .replace(/&nbsp;/g, " ")
        .replace(/[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/g, " ")
        .replace(/[ \t]{2,}/g, " ")
        .trim();
}

/**
 * Splits on a single-character separator, but only where parentheses and brackets are balanced.
 *
 * Needed because statblock lists nest commas inside notes that must not be split:
 *   "Use the Force +17 (may reroll ..., may substitute for Pilot checks)"
 *   "Custom Armor (As Armored Flight Suit with Helmet Package (+8 Reflex; +2 Perception, ...))"
 * A naive split on "," shreds both.
 */
export function splitTop(text, separator = ",") {
    const parts = [];
    let depth = 0;
    let current = "";
    for (const char of String(text ?? "")) {
        if (char === "(" || char === "[") depth++;
        else if (char === ")" || char === "]") depth = Math.max(0, depth - 1);

        if (char === separator && depth === 0) {
            parts.push(current);
            current = "";
        } else {
            current += char;
        }
    }
    parts.push(current);
    return parts.map(p => p.trim()).filter(p => p.length > 0);
}

/**
 * Splits one list entry into name, payload and quantity.
 *
 * The wiki overloads a trailing parenthetical for three different things:
 *   "Weapon Focus (Rifles)"  -> payload "Rifles"      (a choice made when the feat was taken)
 *   "Force Training (3)"     -> quantity 3            (the feat was taken three times)
 *   "Claws (2)"              -> quantity 2            (two natural weapons)
 * A purely numeric parenthetical is a quantity; anything else is a payload. A trailing "*" is a
 * footnote marker the wiki uses to flag "includes Power Attack" and similar, and is preserved as
 * `footnoted` because it signals the printed number bakes in a modifier we do not want.
 */
export function parseEntry(rawEntry) {
    const raw = stripMarkup(rawEntry);
    let working = raw;

    const footnoted = /\*\s*$/.test(working) || /\*\s*\(/.test(working);
    working = working.replace(/\*/g, "").trim();

    // Trailing parenthetical, only when it closes the string.
    const match = /^(.*?)\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)$/.exec(working);
    if (!match) {
        return {name: working, payload: null, quantity: 1, footnoted, raw};
    }

    const name = match[1].trim();
    const inside = match[2].trim();

    if (/^\d+$/.test(inside)) {
        return {name, payload: null, quantity: Number(inside), footnoted, raw};
    }
    // "Weapon Specialization (Lightsabers)" is the compendium item's own name, so keep the full
    // string as the name AND expose the payload. The mapper tries both, matching the system's
    // own resolveEntity behaviour in module/compendium/compendium-util.mjs.
    return {name: working, payload: inside, baseName: name, quantity: 1, footnoted, raw};
}

/** Parses a signed modifier such as "+17", "-2" or "0". Returns null when absent. */
function parseModifier(text) {
    const match = /^\s*([+-]?\d+)/.exec(String(text ?? ""));
    return match ? Number(match[1]) : null;
}

/** Pulls the challenge level out of a heading's parenthetical, which may carry extra words
 *  ("CL 10 Each"). Returns null when there is no CL at all. */
function readChallengeLevel(text) {
    const match = /CL\s*([\d/+-]+)/i.exec(String(text ?? ""));
    return match ? match[1].trim() : null;
}

/** Splits a wikitext body into its "== X Statistics (CL n) ==" block and that block's subsections. */
function findStatisticsBlock(wikitext) {
    const lines = String(wikitext ?? "").split(/\r?\n/);
    const heading = /^\s*(={2,})\s*(.+?)\s*\1\s*$/;

    let start = -1;
    let title = null;
    let cl = null;

    for (let i = 0; i < lines.length; i++) {
        const match = heading.exec(lines[i]);
        if (!match || match[1].length !== 2) continue;
        const text = stripMarkup(match[2]);
        const stats = /^(.*?)\s*Statistics\s*(?:\((.*)\))?\s*$/i.exec(text);
        if (stats) {
            start = i + 1;
            title = stats[1].trim();
            cl = readChallengeLevel(stats[2]);
            break;
        }
        // Some pages drop the word "Statistics" and head the block "Name (CL 4)" instead.
        const bare = /^(.*?)\s*\(\s*CL\s+([\d/+-]+)[^)]*\)\s*$/i.exec(text);
        if (bare) {
            start = i + 1;
            title = bare[1].trim();
            cl = bare[2].trim();
            break;
        }
    }
    if (start === -1) return null;

    // Runs until the next level-2 heading, or the end of the page.
    let end = lines.length;
    for (let i = start; i < lines.length; i++) {
        const match = heading.exec(lines[i]);
        if (match && match[1].length === 2) {
            end = i;
            break;
        }
    }

    // Within the block, "" is the preamble and each level-3+ heading opens a section.
    const sections = new Map([["", []]]);
    let current = "";
    for (let i = start; i < end; i++) {
        const match = heading.exec(lines[i]);
        if (match && match[1].length > 2) {
            current = stripMarkup(match[2]).toLowerCase();
            if (!sections.has(current)) sections.set(current, []);
            continue;
        }
        if (/^\s*\[\[Category:/i.test(lines[i])) continue;
        sections.get(current).push(lines[i]);
    }

    return {title, cl, sections};
}

// Digits are allowed inside a label because "Force Power Suite (Use the Force +17):" carries the
// suite's governing skill and its modifier in the label itself.
const LABEL_PATTERN = /^([A-Za-z][A-Za-z\d\s()'+-]*?):\s*(.*)$/;

/** Labels that carry catalogue information rather than character data. Kept as notes. */
const COSMETIC_LABELS = new Set(["availability", "cost", "reference book", "affiliations", "source"]);

/** Sections whose lines are read as statblock fields. Anything else is prose, kept as notes. */
const PARSED_SECTIONS = new Set(["", "defenses", "offense", "base stats"]);

/**
 * Pulls "Label: value" pairs out of a line, after markup is stripped.
 *
 * A line can carry several pairs, and the wiki is inconsistent about which separator it uses:
 *   "'''Initiative:''' +2; '''Senses:''' Perception +1"                      (semicolon)
 *   "Reflex Defense: 14 (Flat-Footed: 14), Fortitude Defense: 12, ..."       (comma)
 *   "'''Base Attack Bonus:''' +3, '''Grapple:''' +0"                         (comma)
 * so both have to split pairs. But a comma is ALSO the separator inside a single value
 * ("Senses: Low-Light Vision, Perception +9"), which means splitting alone is not enough.
 *
 * Resolution: split on both, then decide per chunk. A chunk that opens with "Label:" starts a new
 * pair. A chunk that does not is a continuation - rejoined onto the previous value when it followed
 * a comma, or emitted as an unlabelled trailing note when it followed a semicolon, which is how the
 * wiki appends things like "; Fast Healing 5" and "; Block, Deflect".
 */
function readLabels(line) {
    const text = stripMarkup(line);
    const found = [];

    // Split on ";" and "," at depth 0, remembering which separator preceded each chunk.
    const chunks = [];
    let depth = 0;
    let current = "";
    let separator = null;
    for (const char of text) {
        if (char === "(" || char === "[") depth++;
        else if (char === ")" || char === "]") depth = Math.max(0, depth - 1);

        if (depth === 0 && (char === ";" || char === ",")) {
            chunks.push({text: current.trim(), separator});
            current = "";
            separator = char;
        } else {
            current += char;
        }
    }
    chunks.push({text: current.trim(), separator});

    for (const chunk of chunks) {
        if (!chunk.text) continue;
        const match = LABEL_PATTERN.exec(chunk.text);
        if (match) {
            found.push({label: match[1].trim().toLowerCase(), value: match[2].trim()});
            continue;
        }
        const previous = found[found.length - 1];
        if (previous && chunk.separator === ",") previous.value += `, ${chunk.text}`;
        else found.push({label: null, value: chunk.text});
    }
    return found;
}

/**
 * Parses the type line, e.g.
 *   "Small [[Beast]] 4"
 *   "Medium [[Human]] [[Nonheroic]] 4"
 *   "Medium [[Human]] [[Jedi]] 7/[[Jedi Knight]] 5/[[Ace Pilot]] 2"
 *
 * Species and class are distinguished by their wiki links rather than by word boundaries, because
 * "Human Jedi" and "Jedi Knight" are indistinguishable once the links are stripped.
 */
function parseTypeLine(line) {
    const result = {size: null, species: null, classes: [], unparsed: []};
    const chunks = splitTop(line, "/");
    if (chunks.length === 0) return result;

    chunks.forEach((chunk, index) => {
        let working = chunk;

        if (index === 0) {
            const plain = stripMarkup(working);
            const size = SIZES.find(s => plain.toLowerCase().startsWith(s.toLowerCase()));
            if (size) {
                result.size = size;
                // Remove the size from the raw (still-linked) chunk.
                working = working.replace(new RegExp("^\\s*" + size.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "");
            }
        }

        const levelMatch = /(\d+)\s*$/.exec(stripMarkup(working));
        const level = levelMatch ? Number(levelMatch[1]) : null;

        const links = [...working.matchAll(/\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/g)]
            .map(m => (m[2] ?? m[1]).trim())
            .filter(Boolean);

        if (links.length === 0) {
            // No links at all - fall back to stripping the trailing level off the plain text.
            const plain = stripMarkup(working).replace(/\s*\d+\s*$/, "").trim();
            if (plain) result.classes.push({name: plain, levels: level});
            else result.unparsed.push(chunk.trim());
            return;
        }

        if (index === 0 && links.length >= 2) {
            result.species = links[0];
            result.classes.push({name: links[links.length - 1], levels: level});
        } else {
            result.classes.push({name: links[links.length - 1], levels: level});
        }
    });

    return result;
}

/** Splits on a separator only where brackets are balanced. */
function splitOutsideBrackets(text, separator) {
    const parts = [];
    let depth = 0, current = "";
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === "(" || c === "[") depth++;
        else if (c === ")" || c === "]") depth = Math.max(0, depth - 1);
        if (depth === 0 && text.toLowerCase().startsWith(separator, i)) {
            parts.push(current.trim());
            current = "";
            i += separator.length - 1;
            continue;
        }
        current += c;
    }
    parts.push(current.trim());
    return parts.filter(Boolean);
}

/** Index of `needle` in `text` where brackets are balanced, or -1. */
function indexOfAtTopLevel(text, needle) {
    let depth = 0;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === "(" || c === "[") depth++;
        else if (c === ")" || c === "]") depth = Math.max(0, depth - 1);
        else if (depth === 0 && text.startsWith(needle, i)) return i;
    }
    return -1;
}

/** The contents of each top-level (...) group, nested brackets kept intact. */
function topLevelGroups(text) {
    const groups = [];
    let depth = 0, start = -1;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === "(") { if (depth === 0) start = i + 1; depth++; }
        else if (c === ")") { depth--; if (depth === 0 && start > -1) { groups.push(text.slice(start, i).trim()); start = -1; } }
    }
    return groups;
}

/**
 * Parses one "Melee:"/"Ranged:" attack line.
 *   "Bite +5 (1d3+4)"
 *   "Claws (2) +5 (1d3+4)"
 *   "Frag Grenade (1) +3 (4d6, 2-Square Burst)"
 *   "Lightsaber +21 (3d8+17) with Rapid Strike"
 *
 * Damage is captured for the divergence report ONLY. This fork's weapon dice differ from RAW
 * (Lightsaber is 3d8 here, 2d8 on the wiki), so the imported weapon item supplies the real dice.
 */
function parseAttackLine(range, value) {
    const text = stripMarkup(value);
    // "Bite +11* (2d6+20)" - the asterisk is a footnote marker ("*Includes 6 points of Power
    // Attack") sitting between the bonus and the damage, so it has to come out before matching.
    // It is recorded per attack because it means the printed bonus bakes in a modifier.
    const footnoted = text.includes("*");
    const cleaned = text.replace(/\*/g, "");

    // Split the "with X" tail off first so it cannot be mistaken for part of the damage.
    let condition = null;
    const withMatch = /\s+with\s+(.+)$/i.exec(cleaned);
    let body = cleaned;
    if (withMatch) {
        condition = withMatch[1].trim();
        body = cleaned.slice(0, withMatch.index).trim();
    }

    // "Bite +3 (1d2) (Rakghoul Disease and Burrow)" is ONE attack. Splitting on " and " without
    // regard for brackets cut that in half and produced an attack literally named "Burrow)".
    const attacks = [];
    for (const part of splitOutsideBrackets(body, " and ")) {
        let text = part.trim();

        // A rider after the damage: "Bite +7 (1d4+1) plus Poison". Found at bracket depth zero so
        // it is not confused with one written inside the damage, as in "(1 plus Poison (See Below))".
        let rider = null;
        const riderAt = indexOfAtTopLevel(text, " plus ");
        if (riderAt > -1) {
            rider = text.slice(riderAt + 6).trim();
            text = text.slice(0, riderAt).trim();
        }

        const bonusMatch = /([+-]\d+)/.exec(text);
        if (!bonusMatch) {
            attacks.push({range, name: text, bonus: null, damage: null, rider, condition, footnoted, raw: text});
            continue;
        }
        const entry = parseEntry(text.slice(0, bonusMatch.index));
        const tail = text.slice(bonusMatch.index + bonusMatch[0].length);

        // Everything in brackets after the bonus. A statblock can carry several: a qualifier such as
        // "(2-Square Reach)" and then the damage, in that order. The damage is whichever one reads
        // as dice or a flat number; the rest are notes.
        const groups = topLevelGroups(tail);
        const damage = groups.find(g => /^\s*\d+(d\d+)?([+-]\d+)?\s*(,|$)/i.test(g)) ?? null;
        const notes = groups.filter(g => g !== damage);

        attacks.push({
            range,
            name: entry.name,
            quantity: entry.quantity,
            bonus: Number(bonusMatch[1]),
            damage,
            rider,
            notes: notes.length ? notes : undefined,
            footnoted,
            condition,
            raw: text
        });
    }

    return attacks;
}

/** Parses a "Skills:" list entry, e.g. "Use the Force +17 (may reroll ...)". */
function parseSkillEntry(rawEntry) {
    const text = stripMarkup(rawEntry);
    const match = /^(.*?)\s*([+-]\d+)\s*(?:\((.*)\))?\s*$/.exec(text);
    if (!match) return {name: text, bonus: null, note: null, raw: text};
    return {
        name: match[1].trim(),
        bonus: Number(match[2]),
        note: match[3] ? match[3].trim() : null,
        raw: text
    };
}

/**
 * Parses a full wiki page (or just its statblock section) into StatblockData.
 *
 * Anything the parser does not recognise is pushed onto `unparsed` rather than dropped, so the
 * import review dialog can show it instead of silently losing content.
 *
 * @param {string} wikitext
 * @returns {object|null} StatblockData, or null when no "X Statistics" heading is present.
 */
export function parseStatblock(wikitext) {
    const block = findStatisticsBlock(wikitext);
    if (!block) return null;

    const data = {
        name: block.title,
        cl: block.cl,
        size: null,
        species: null,
        classes: [],
        abilities: {},
        printed: {},
        senses: [],
        languages: [],
        speciesTraits: [],
        immunities: [],
        weaknesses: [],
        damageReduction: null,
        droidSystems: [],
        shieldRating: null,
        isVehicle: false,
        specialQualities: [],
        attackOptions: [],
        specialActions: [],
        feats: [],
        talents: [],
        forcePowers: [],
        forceSecrets: [],
        forceTechniques: [],
        forceSuiteSkill: null,
        skills: [],
        attacks: [],
        possessions: [],
        notes: [],
        unparsed: []
    };

    const entries = list => splitTop(list, ",").map(parseEntry);

    for (const [section, lines] of block.sections) {
        for (const rawLine of lines) {
            if (!rawLine.trim()) continue;
            const plain = stripMarkup(rawLine);
            if (!plain) continue;

            // The preamble's first content line is the type line and carries no "Label:".
            if (section === "" && !data.size && data.classes.length === 0 && !LABEL_PATTERN.test(plain)) {
                const parsed = parseTypeLine(rawLine);
                data.size = parsed.size;
                data.species = parsed.species;
                data.classes = parsed.classes;
                data.unparsed.push(...parsed.unparsed);
                continue;
            }

            // The Abilities line is handled whole, before the label splitter touches it. Some
            // pages write "Strength: 6, Dexterity: 15" with colons, and readLabels would treat
            // every ability after the first as its own label and lose them. Droids also print
            // "Constitution: -", which is an absent score rather than a number.
            // Checked BEFORE the section gate: a "=== Abilities ===" heading holds free prose
            // on a beast page but the actual scores on some droid pages, so the line has to be
            // recognised wherever it appears. Guarded so prose cannot overwrite real scores.
            const abilityLine = /^abilities\s*:\s*(.+)$/i.exec(plain);
            if (abilityLine && Object.keys(data.abilities).length === 0) {
                for (const part of splitTop(abilityLine[1], ",")) {
                    const match = /^([A-Za-z]+)\s*:?\s*(-|—|\d+)$/.exec(part.trim());
                    if (!match) { data.unparsed.push(part.trim()); continue; }
                    const key = ABILITY_KEYS[match[1].toLowerCase()];
                    if (!key) { data.unparsed.push(part.trim()); continue; }
                    // A dash means the creature has no such score at all - a droid's Constitution.
                    if (match[2] === "-" || match[2] === "—") continue;
                    data.abilities[key] = Number(match[2]);
                }
                continue;
            }

            // Only the four structured sections are parsed for labels. A trailing prose section
            // such as Rancor's "=== Abilities ===" is kept verbatim as notes, because its lines are
            // label-shaped ("'''Fast Healing 5:''' A Rancor automatically regains...") and would
            // otherwise be mistaken for statblock fields.
            if (!PARSED_SECTIONS.has(section)) {
                data.notes.push(plain);
                continue;
            }

            for (const {label, value} of readLabels(rawLine)) {
                if (label === null) {
                    // Defenses lines carry several "X Defense: n" pairs plus a bare tail.
                    if (value) data.notes.push(value);
                    continue;
                }
                switch (label) {
                    case "initiative": data.printed.initiative = parseModifier(value); break;
                    case "senses": data.senses = splitTop(value, ",").map(stripMarkup); break;
                    case "languages": case "language":
                        data.languages = splitTop(value, ",").map(stripMarkup); break;
                    case "dark side score": data.darkSideScore = parseModifier(value); break;
                    case "force points": data.forcePoints = parseModifier(value); break;
                    case "destiny points": data.destinyPoints = parseModifier(value); break;

                    case "reflex defense": {
                        data.printed.reflex = parseModifier(value);
                        // Flat-footed is nested inside the Reflex parenthetical, so it is
                        // depth-protected from the pair split and has to be dug out here.
                        const flat = /flat[\s-]?footed\s*:\s*([+-]?\d+)/i.exec(value);
                        if (flat) data.printed.flatFooted = Number(flat[1]);
                        break;
                    }
                    case "flat-footed": case "flat footed":
                        data.printed.flatFooted = parseModifier(value); break;
                    case "fortitude defense": data.printed.fortitude = parseModifier(value); break;
                    case "will defense": data.printed.will = parseModifier(value); break;
                    case "hit points": data.printed.hitPoints = parseModifier(value); break;
                    case "damage threshold": data.printed.damageThreshold = parseModifier(value); break;
                    case "immune": data.immunities = splitTop(value, ",").map(stripMarkup); break;
                    case "damage reduction": data.damageReduction = stripMarkup(value); break;
                    case "weakness":
                    case "weaknesses": data.weaknesses = splitTop(value, ",").map(stripMarkup); break;
                    // Droid shields. Unlike the other printed defences this one transfers, because
                    // this fork derives shields from an override alone rather than from a rule.
                    case "shield rating": data.shieldRating = parseModifier(value); break;

                    // Vehicle-only fields. A vehicle statblock has a different shape entirely -
                    // no ability scores, crew and cargo instead - and this importer builds
                    // characters and beasts. Recording them is how the importer can say so
                    // plainly instead of producing a broken character.
                    case "crew": case "passengers": case "cargo": case "consumables":
                    case "carried craft": case "hyperdrive": case "availability (vehicle)":
                        data.isVehicle = true;
                        data.notes.push(`${label}: ${stripMarkup(value)}`);
                        break;
                    // "Special: Self-Destruct System +5 (4d6, 2-Square Burst)" - a one-off attack
                    // with no item behind it. Kept as prose so the GM can add it by hand.
                    case "special": data.notes.push(`Special: ${stripMarkup(value)}`); break;

                    case "speed": data.printed.speed = stripMarkup(value); break;
                    case "fighting space": data.printed.fightingSpace = stripMarkup(value); break;
                    case "reach": data.printed.reach = stripMarkup(value); break;
                    case "base attack bonus": data.printed.baseAttackBonus = parseModifier(value); break;
                    case "grapple": data.printed.grapple = parseModifier(value); break;
                    case "melee": data.attacks.push(...parseAttackLine("Melee", value)); break;
                    case "ranged": data.attacks.push(...parseAttackLine("Ranged", value)); break;
                    case "attack options": data.attackOptions = entries(value); break;
                    case "special actions": data.specialActions = entries(value); break;
                    case "species traits": data.speciesTraits = entries(value); break;

                    case "abilities": {
                        for (const part of splitTop(value, ",")) {
                            const match = /^([A-Za-z]+)\s+(\d+)$/.exec(stripMarkup(part));
                            if (!match) { data.unparsed.push(part); continue; }
                            const key = ABILITY_KEYS[match[1].toLowerCase()];
                            if (key) data.abilities[key] = Number(match[2]);
                            else data.unparsed.push(part);
                        }
                        break;
                    }
                    case "talents": data.talents = entries(value); break;
                    case "feats": data.feats = entries(value); break;
                    case "force secrets": data.forceSecrets = entries(value); break;
                    case "force techniques": data.forceTechniques = entries(value); break;
                    case "force regimens": data.forceRegimens = entries(value); break;
                    case "skill":
                    case "skills": data.skills = splitTop(value, ",").map(parseSkillEntry); break;
                    case "droid systems": data.droidSystems = entries(value); break;
                    case "logic upgrade": data.droidSystems = [...(data.droidSystems ?? []), ...entries(value)]; break;
                    case "possessions": data.possessions = entries(value); break;

                    default: {
                        // "Force Power Suite (Use the Force +17)" carries the suite's skill in its
                        // own label, so it cannot be matched as a fixed string.
                        const suite = /^force power suite\s*\(([^)]*)\)$/.exec(label);
                        if (suite) {
                            data.forceSuiteSkill = suite[1].trim();
                            data.forcePowers = entries(value);
                            break;
                        }
                        // "Species Traits (Togruta):" - the species name rides in the label.
                        if (/^species traits/.test(label)) {
                            data.speciesTraits = entries(value);
                            break;
                        }
                        if (/^starship maneuver suite/.test(label)) {
                            data.notes.push(`${label}: ${value}`);
                            break;
                        }
                        // "Initiative (Use the Force): +20" - a conditional variant of a stat we
                        // already read; keep the base one rather than reporting it as unknown.
                        if (["perception", "initiative"].includes(label)) {
                            data.notes.push(`${label}: ${value}`);
                            break;
                        }
                        const qualified = /^([a-z ]+?)\s*\([^)]*\)$/.exec(label);
                        if (qualified && ["initiative", "perception"].includes(qualified[1].trim())) {
                            data.notes.push(`${label}: ${value}`);
                            break;
                        }
                        // Catalogue metadata, not character data.
                        if (COSMETIC_LABELS.has(label)) {
                            data.notes.push(`${label}: ${value}`);
                            break;
                        }
                        data.unparsed.push(`${label}: ${value}`);
                    }
                }
            }
        }
    }

    // A statblock with no ability scores is not a character or a beast. Vehicles are the whole of
    // this case in the sampled corpus, and importing one as a character produces exactly the
    // unusable sheet this tool exists to avoid.
    if (Object.keys(data.abilities).length === 0) data.isVehicle = true;

    return data;
}
