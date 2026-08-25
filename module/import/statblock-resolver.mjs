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

/** Loads the index for each pack. Index entries carry `type`, so no documents need opening. */
async function ensureIndices(packs) {
    for (const pack of packs) {
        if (pack.documentName !== "Item") continue;
        await pack.getIndex();
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
            groups.push({type, options: skills("character").map(name => ({name, uuid: ""}))});
            continue;
        }
        // Same pack set as the resolver, so every option offered is one the add path can fetch.
        const packs = packsFor(type);
        await ensureIndices(packs);
        const seen = new Map();
        for (const pack of packs) {
            if (pack.documentName !== "Item") continue;
            for (const entry of pack.index) {
                if (entry.type !== type) continue;
                if (!seen.has(entry.name)) seen.set(entry.name, {name: entry.name, uuid: entry.uuid});
            }
        }
        if (seen.size) {
            groups.push({type, options: [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))});
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
