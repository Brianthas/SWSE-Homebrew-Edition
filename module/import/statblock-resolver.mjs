/**
 * The Foundry side of the statblock importer: turns a name plus a list of candidate types into a
 * real compendium entry.
 *
 * This lives apart from statblock-mapper.mjs on purpose. The mapper takes its `resolve` function as
 * a parameter so it can run under plain `node --test` against packs/_source with no Foundry at all;
 * everything that actually needs `game` is here.
 */
import {skills} from "../common/constants.mjs";
import {getCompendium} from "../compendium/compendium-util.mjs";

/**
 * The packs the ADD path will actually search for a given type.
 *
 * This must be getCompendium(), not "every Item pack". Scanning everything reported items the
 * importer could never add: "Frag Grenade" exists only in swse.legacy-weapons, which
 * getCompendium("weapon") does not include, so the review screen promised it and
 * SWSEActor#addItem then failed to find it. A report that names something the add path cannot
 * fetch is worse than no report.
 */
function packsFor(type) {
    return getCompendium(type) ?? [];
}

/**
 * Loads the index for each pack. Index entries carry `type`, so no documents need opening.
 * `fields` pulls extra properties into the index - `system.subtype` is the weapon group
 * ("Pistols", "Rifles", "Advanced Melee Weapons"), which is what makes the substitution dropdown
 * navigable instead of one flat list of every piece of gear in the system.
 */
async function ensureIndices(packs, fields = []) {
    for (const pack of packs) {
        if (pack.documentName !== "Item") continue;
        await pack.getIndex(fields.length ? {fields} : undefined);
    }
}

/**
 * Builds the resolve function mapStatblock expects.
 *
 * World compendia are searched before system ones, matching getCompendium() in
 * module/compendium/compendium-util.mjs, so a world override of an item wins.
 *
 * @returns {Promise<Function>} async (name, types) => {type, name, uuid} | null
 */
export async function buildCompendiumResolver() {
    const characterSkills = skills("character");
    const byType = new Map();

    return async function resolve(name, types) {
        const wanted = String(name ?? "").trim().toLowerCase();
        if (!wanted) return null;

        for (const type of types) {
            // Skills are fields on the actor, not items, so they resolve against the skill list.
            if (type === "skill") {
                const hit = characterSkills.find(s => s.toLowerCase() === wanted);
                if (hit) return {type: "skill", name: hit};
                continue;
            }
            if (!byType.has(type)) {
                const packs = packsFor(type);
                await ensureIndices(packs);
                byType.set(type, packs);
            }
            for (const pack of byType.get(type)) {
                const entry = pack.index.find(e => e.type === type && e.name.toLowerCase() === wanted);
                if (entry) return {type, name: entry.name, uuid: entry.uuid};
            }
        }
        return null;
    };
}

/**
 * Every item of the given types, for populating the review dialog's substitution dropdowns.
 * Returned sorted by name and grouped by type.
 *
 * @param {string[]} types
 * @returns {Promise<Array<{type: string, options: Array<{name: string, uuid: string}>}>>}
 */
export async function listCandidates(types) {
    const groups = [];
    for (const type of types) {
        if (type === "skill") {
            groups.push({type, label: "skill", options: skills("character").map(name => ({name, uuid: ""}))});
            continue;
        }
        // Same pack set as the resolver, so every option offered is one the add path can fetch.
        const packs = packsFor(type);
        await ensureIndices(packs, ["system.subtype"]);

        // Grouped by weapon group / armour class where the items declare one. A statblock's gear
        // usually cannot be matched by name in this fork - 4 armours and 34 weapons against the
        // wiki's hundreds - so the GM is picking a replacement by category, and a flat list of
        // several hundred names is the wrong shape for that decision.
        const bySubtype = new Map();
        for (const pack of packs) {
            if (pack.documentName !== "Item") continue;
            for (const entry of pack.index) {
                if (entry.type !== type) continue;
                const subtype = entry.system?.subtype || "";
                const label = subtype ? `${type} - ${subtype}` : type;
                if (!bySubtype.has(label)) bySubtype.set(label, new Map());
                const options = bySubtype.get(label);
                if (!options.has(entry.name)) options.set(entry.name, {name: entry.name, uuid: entry.uuid});
            }
        }
        for (const [label, options] of [...bySubtype].sort((a, b) => a[0].localeCompare(b[0]))) {
            groups.push({
                type,
                label,
                options: [...options.values()].sort((a, b) => a.name.localeCompare(b.name))
            });
        }
    }
    return groups;
}

/**
 * Fetches a statblock's wikitext.
 *
 * Accepts a full wiki URL or a bare page title. The MediaWiki API is used rather than scraping the
 * rendered page because wikitext keeps the link targets: `[[Lightsaber (Weapon)|Lightsaber]]` tells
 * us the item is named "Lightsaber" while the page is not. `origin=*` makes it an anonymous CORS
 * request, which Foundry's own origin is allowed to make.
 *
 * @param {string} input a URL like https://swse.fandom.com/wiki/Kath_Hound, or "Kath Hound"
 * @returns {Promise<string>} the page's wikitext
 */
export async function fetchWikitext(input) {
    const raw = String(input ?? "").trim();
    if (!raw) throw new Error("No page given.");

    let page = raw;
    const urlMatch = /^https?:\/\/[^/]*fandom\.com\/wiki\/([^?#]+)/i.exec(raw);
    if (urlMatch) page = decodeURIComponent(urlMatch[1]);
    page = page.replace(/\s+/g, "_");

    const url = `https://swse.fandom.com/api.php?action=parse&page=${encodeURIComponent(page)}`
        + `&prop=wikitext&format=json&formatversion=2&origin=*`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Wiki returned HTTP ${response.status} for "${page}".`);
    const json = await response.json();
    if (json.error) throw new Error(`Wiki: ${json.error.info ?? json.error.code}`);
    const wikitext = json?.parse?.wikitext;
    if (!wikitext) throw new Error(`No wikitext came back for "${page}".`);
    return wikitext;
}

/* -------------------------------------------------------------------------------------------- */
/*  Learned substitutions                                                                          */
/* -------------------------------------------------------------------------------------------- */

const ALIAS_SETTING = "statblockAliases";
const SHIPPED_ALIASES = "systems/swse/module/import/statblock-aliases.json";

/** The substitutions this world has learned from previous imports. */
export function getLearnedAliases() {
    const stored = game.settings.get("swse", ALIAS_SETTING);
    const entries = Array.isArray(stored?.entries) ? stored.entries : [];
    return {entries};
}

/**
 * The alias table the importer actually runs against: what ships with the system, plus whatever
 * this world has learned.
 *
 * Order matters. indexAliases() in statblock-mapper.mjs keys entries by "type:name" and the last
 * write wins, so the shipped entries go LAST and take precedence. The shipped table encodes house
 * rules - deletions and merges - and a stray substitution picked in a dialog must never quietly
 * override one of those.
 */
export async function loadAliases() {
    const response = await fetch(SHIPPED_ALIASES);
    if (!response.ok) throw new Error(`Could not read the alias table (HTTP ${response.status}).`);
    const shipped = await response.json();
    const learned = getLearnedAliases();
    return {entries: [...learned.entries, ...(shipped.entries ?? [])]};
}

/**
 * Records a substitution the GM chose, so the same wiki name resolves by itself next time.
 *
 * This is what makes the long tail tractable. Measured against the 2317 purged units, a hand table
 * would need roughly 300 entries to get 88% of actors importing clean - not worth authoring up
 * front for a corpus nobody will ever import wholesale. Learning instead means the table converges
 * on the NPCs actually used at this table.
 */
export async function rememberAliases(substitutions, sourceName) {
    if (!substitutions?.length) return 0;
    const learned = getLearnedAliases();
    const byKey = new Map(learned.entries.map(e => [`${e.from.type}:${e.from.name}`.toLowerCase(), e]));

    // Record the BASE name, without the statblock's trailing stat annotation. The wiki writes
    // "Stormtrooper Armor (+6 Reflex, +2 Fortitude; +2 Perception, Low-Light Vision)", and storing
    // that verbatim would only ever match a page that spells the parenthetical identically.
    // resolveOne() tries name variants against the alias table, so the short form catches both.
    const baseName = name => {
        const match = /^(.*?)\s*\([^()]*(?:\([^()]*\)[^()]*)*\)$/.exec(String(name ?? "").trim());
        return match ? match[1].trim() : String(name ?? "").trim();
    };

    let added = 0;
    for (const substitution of substitutions) {
        const to = substitution.to;
        const from = {...substitution.from, name: baseName(substitution.from.name)};
        const key = `${from.type}:${from.name}`.toLowerCase();
        const existing = byKey.get(key);
        // A later choice replaces an earlier one for the same name: the GM changed their mind.
        if (existing && existing.to?.name === to.name && existing.to?.type === to.type) continue;
        byKey.set(key, {
            from: {type: from.type, name: from.name},
            to: {type: to.type, name: to.name},
            reason: `learned from importing ${sourceName}`,
            learned: true
        });
        added++;
    }

    if (added) await game.settings.set("swse", ALIAS_SETTING, {entries: [...byKey.values()]});
    return added;
}

/**
 * Dumps the learned substitutions as JSON, ready to be pasted into
 * module/import/statblock-aliases.json so they graduate into version control.
 * Also copies to the clipboard when the browser allows it.
 */
export async function exportLearnedAliases() {
    const learned = getLearnedAliases();
    const json = JSON.stringify(learned.entries, null, 2);
    console.log(`SWSE: ${learned.entries.length} learned statblock aliases\n${json}`);
    try {
        await game.clipboard.copyPlainText(json);
        ui.notifications.info(`${learned.entries.length} learned aliases copied to the clipboard.`);
    } catch {
        ui.notifications.info(`${learned.entries.length} learned aliases written to the console.`);
    }
    return json;
}

/** Forgets every learned substitution. The shipped table is untouched. */
export async function clearLearnedAliases() {
    const count = getLearnedAliases().entries.length;
    await game.settings.set("swse", ALIAS_SETTING, {entries: []});
    ui.notifications.info(`Forgot ${count} learned statblock alias${count === 1 ? "" : "es"}.`);
    return count;
}
