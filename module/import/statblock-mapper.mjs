/**
 * Turns parsed StatblockData into an actor payload this fork can actually create, plus a report of
 * everything that was remapped, dropped or could not be found.
 *
 * The governing rule, from docs/statblock-importer-plan.md: IMPORT IDENTITY, DERIVE NUMBERS.
 * Wiki statblocks print RAW outputs, and this fork computes different outputs from the same inputs
 * (a Lightsaber is 3d8 here and 2d8 on the wiki; a Beast's first level is a flat 24 HP here; heroic
 * BAB equals level here). So names, classes, levels, species, gear and ability scores are imported,
 * and hit points, defenses, base attack bonus, grapple and damage dice are left for the system to
 * derive. Printed numbers are carried through on `printed` for the divergence report only.
 *
 * Compendium access is injected as `resolve` rather than imported, so this module stays testable
 * under plain `node --test` against packs/_source while running against live compendia in Foundry.
 */

/**
 * Which item types each statblock section may legitimately resolve to. Several sections are
 * genuinely ambiguous: a "Species Traits:" line yields a trait on a humanoid but a beastQuality or
 * beastSense on a creature, and getting this wrong is what made "Fast Healing 5" look missing when
 * it exists in beast-components.
 */
export const TYPE_CANDIDATES = {
    species: ["species"],
    class: ["class"],
    feat: ["feat"],
    talent: ["talent"],
    language: ["language"],
    forcePower: ["forcePower"],
    forceSecret: ["forceSecret"],
    forceTechnique: ["forceTechnique"],
    forceRegimen: ["forceRegimen"],
    speciesTrait: ["trait", "beastQuality", "beastSense", "beastType"],
    naturalWeapon: ["beastAttack", "beastQuality"],
    possession: ["weapon", "armor", "equipment", "upgrade", "hazard", "implant", "droid system"]
};

/** Attack names the wiki uses as placeholders rather than as real weapons. */
const PLACEHOLDER_ATTACKS = new Set(["by weapon", "unarmed", "unarmed attack"]);

/**
 * Kinds where a trailing parenthetical is a CHOICE the character made, so it becomes a payload.
 * Gear is deliberately excluded: "Lightsaber (Self-Built)" and "Cybernetic Prosthesis (4, Both Arms
 * and Legs)" are flavour text, and feeding them to setPayload() would rename the item to something
 * that does not exist. For gear the parenthetical is kept as a report note instead.
 */
const PAYLOAD_KINDS = new Set(["feat", "talent", "forcePower", "forceSecret", "forceTechnique", "forceRegimen"]);

/** Builds a lookup of alias entries keyed by "type:name". */
function indexAliases(aliases) {
    const index = new Map();
    for (const entry of aliases?.entries ?? []) {
        index.set(`${entry.from.type}:${entry.from.name}`.toLowerCase(), entry);
    }
    return index;
}

/**
 * Tier 1 resolver variants, tried in order before an entry is called unresolved.
 * These are mechanical spelling differences, not rules divergence, so they are handled by rule
 * rather than by adding rows to the alias table.
 */
function nameVariants(name) {
    const variants = [name];

    // "Claws" -> "Claw". The beast-components pack is singular.
    if (/[a-z]s$/.test(name) && !/ss$/.test(name)) variants.push(name.replace(/s$/, ""));

    // "Fast Healing 5" -> "Fast Healing" (the numeric part becomes a payload).
    const trailingNumber = /^(.*?)\s+(\d+)$/.exec(name);
    if (trailingNumber) variants.push(trailingNumber[1]);

    // "Weapon Focus (Rifles)" -> "Weapon Focus", for packs that store the payload separately.
    const parenthetical = /^(.*?)\s*\([^()]*\)$/.exec(name);
    if (parenthetical) variants.push(parenthetical[1].trim());

    return [...new Set(variants.filter(Boolean))];
}

/**
 * Resolves one parsed entry to a compendium item, applying the alias table first.
 *
 * @returns {Promise<{status: "mapped"|"dropped"|"unresolved", ...}>}
 */
async function resolveOne(entry, kind, {resolve, aliasIndex}) {
    const candidates = TYPE_CANDIDATES[kind] ?? [kind];
    const sourceName = entry.name;

    // The alias table wins over the packs. A house rule deletion must be reported as a deletion
    // even in the unlikely case an item of that name still exists somewhere.
    //
    // Variants are tried after the exact name so a learned substitution recorded against
    // "Stormtrooper Armor" also catches the statblock's fuller
    // "Stormtrooper Armor (+6 Reflex, +2 Fortitude; ...)". Exact always wins.
    for (const type of candidates) {
        let alias = null;
        for (const variant of nameVariants(sourceName)) {
            alias = aliasIndex.get(`${type}:${variant}`.toLowerCase());
            if (alias) break;
        }
        if (!alias) continue;
        if (alias.to === null) {
            return {status: "dropped", source: {type, name: sourceName}, reason: alias.reason};
        }
        const found = await resolve(alias.to.name, [alias.to.type]);
        if (found) {
            return {
                status: "mapped", via: "alias", collapse: alias.collapse === true,
                source: {type, name: sourceName}, target: found, reason: alias.reason
            };
        }
        // The table names a target the packs no longer have. statblock-aliases.test.mjs is meant to
        // catch this before it ships; report rather than silently fall through to a fuzzy match.
        return {
            status: "unresolved", source: {type, name: sourceName}, candidates,
            reason: `alias target "${alias.to.name}" not found in the packs`
        };
    }

    for (const variant of nameVariants(sourceName)) {
        const found = await resolve(variant, candidates);
        if (!found) continue;

        // A payload is only meaningful when the parenthetical was STRIPPED to get a match, i.e.
        // the pack stores "Weapon Proficiency" and the choice separately. When the full
        // "Weapon Specialization (Lightsabers)" matched as-is, that IS the item's name and adding a
        // payload on top would apply the choice twice. This mirrors getIndexEntryByName() in
        // module/compendium/compendium-util.mjs, which clears the payload on a full-name hit.
        const stripped = variant !== sourceName;
        return {
            status: "mapped",
            via: stripped ? "resolver" : "direct",
            source: {type: candidates[0], name: sourceName},
            target: found,
            payload: stripped && PAYLOAD_KINDS.has(kind) ? derivePayload(sourceName, variant) : null,
            note: stripped && !PAYLOAD_KINDS.has(kind) ? derivePayload(sourceName, variant) : null
        };
    }

    return {status: "unresolved", source: {type: candidates[0], name: sourceName}, candidates, reason: "no match in the packs"};
}

/**
 * Splits on a multi-character separator, ignoring occurrences inside parentheses or brackets.
 * Used for "A with B" gear entries, where the same word appears inside descriptive parentheticals.
 */
export function splitOutsideParens(text, separator) {
    const parts = [];
    let depth = 0;
    let current = "";
    const source = String(text ?? "");
    for (let i = 0; i < source.length; i++) {
        const char = source[i];
        if (char === "(" || char === "[") depth++;
        else if (char === ")" || char === "]") depth = Math.max(0, depth - 1);

        if (depth === 0 && source.startsWith(separator, i)) {
            parts.push(current.trim());
            current = "";
            i += separator.length - 1;
            continue;
        }
        current += char;
    }
    parts.push(current.trim());
    return parts.filter(Boolean);
}

/** When a variant matched, recovers the part of the original name that became a payload. */
function derivePayload(original, matched) {
    if (!original.startsWith(matched)) return null;
    const remainder = original.slice(matched.length).trim().replace(/^\(|\)$/g, "").trim();
    return remainder || null;
}

/**
 * Maps parsed StatblockData onto an actor payload plus an import report.
 *
 * @param {object} block          output of parseStatblock
 * @param {object} options
 * @param {Function} options.resolve   async (name, types) => ({type, name}) | null
 * @param {object} options.aliases     parsed statblock-aliases.json
 * @returns {Promise<{actorData: object, report: object}>}
 */
export async function mapStatblock(block, {resolve, aliases}) {
    const aliasIndex = indexAliases(aliases);
    const report = {mapped: [], dropped: [], unresolved: [], collapsed: [], printed: block.printed};
    const providedItems = [];
    const seenTargets = new Set();

    /** Adds a resolved entry to providedItems, honouring collapse-dedupe. */
    const record = (result, extra = {}) => {
        if (result.status === "dropped") {
            report.dropped.push({name: result.source.name, type: result.source.type, reason: result.reason});
            return;
        }
        if (result.status === "unresolved") {
            report.unresolved.push({
                name: result.source.name,
                type: result.source.type,
                reason: result.reason,
                // Candidate types and the providedItem extras this entry would have carried, so the
                // review dialog can offer the right substitutes and re-apply "equipped" and the like
                // to whatever the GM picks.
                candidates: result.candidates ?? [result.source.type],
                extra
            });
            return;
        }
        const key = `${result.target.type}:${result.target.name}`;
        if (result.collapse && seenTargets.has(key)) {
            report.collapsed.push({source: result.source.name, target: result.target.name, reason: result.reason});
            return;
        }
        seenTargets.add(key);
        report.mapped.push({
            from: result.source.name, to: result.target.name,
            type: result.target.type, via: result.via,
            reason: result.reason ?? null,
            // Detail the wiki carried that this fork's item does not model, e.g. "Self-Built" on a
            // lightsaber. Surfaced in the review dialog so the GM can add it by hand if it matters.
            note: result.note ?? null
        });
        providedItems.push({name: result.target.name, type: result.target.type, ...extra});
    };

    const mapList = async (entries, kind, extraFor = () => ({})) => {
        for (const entry of entries ?? []) {
            const result = await resolveOne(entry, kind, {resolve, aliasIndex});
            // Only resolveOne decides whether a payload applies; it clears one when the full
            // parenthesised name matched an item outright, so do not fall back to entry.payload.
            const payload = result.payload ?? null;
            record(result, {...(payload ? {payloads: {payload}} : {}), ...extraFor(entry)});
        }
    };

    // --- Identity -----------------------------------------------------------------------------
    const isBeast = block.classes.some(c => /^beast$/i.test(c.name));
    const actorData = {
        name: block.name,
        type: isBeast ? "beast" : "character",
        system: {
            settings: {isNPC: true},
            size: block.size ?? "Medium",
            abilities: {},
            details: {cl: block.cl ?? ""},
            skills: {},
            providedItems
        }
    };

    // Ability scores are INPUTS to the fork's derivation, not outputs of RAW, so they transfer.
    for (const [key, value] of Object.entries(block.abilities)) {
        actorData.system.abilities[key] = {base: value};
    }

    // --- Species and classes ------------------------------------------------------------------
    if (block.species) {
        const result = await resolveOne({name: block.species}, "species", {resolve, aliasIndex});
        record(result, {answers: [actorData.system.size]});
    } else {
        // No species means nothing supplies the size TRAIT, and that trait is what carries the
        // homebrew size table: reflexDefenseBonusScalable, damageThresholdSizeModifierScalable,
        // grappleSizeModifierScalable, characterFightingSpaceScalable, unarmedDamageScalable and
        // the Small Stealth bonus all live on it. system.size declares the category;
        // the trait applies its mechanical effects. A beast needs both.
        const sizeTrait = await resolve(actorData.system.size, ["trait"]);
        if (sizeTrait) {
            report.mapped.push({
                from: actorData.system.size, to: sizeTrait.name, type: "trait", via: "size",
                reason: "size trait added so size-scaled damage and defences resolve", note: null
            });
            providedItems.push({name: sizeTrait.name, type: "trait"});
        } else {
            report.unresolved.push({
                name: actorData.system.size, type: "trait",
                reason: "no size trait of this name; size-scaled values will resolve at Fine"
            });
        }
    }

    let first = true;
    for (const cls of block.classes) {
        const result = await resolveOne({name: cls.name}, "class", {resolve, aliasIndex});
        // A merged class (Scoundrel and Scout both becoming Smuggler) must ADD its levels rather
        // than be dropped as a duplicate, so classes bypass the collapse-dedupe and merge instead.
        if (result.status === "mapped") {
            const existing = providedItems.find(i => i.type === "class" && i.name === result.target.name);
            if (existing) {
                existing.quantity = String(Number(existing.quantity) + (cls.levels ?? 1));
                report.collapsed.push({
                    source: cls.name, target: result.target.name,
                    reason: `${result.reason ?? "merged class"} - levels added to the existing entry`
                });
                continue;
            }
        }
        record(result, {quantity: String(cls.levels ?? 1), ...(first ? {firstLevel: true} : {})});
        first = false;
    }

    // --- Everything else that becomes an embedded item ----------------------------------------
    await mapList(block.feats, "feat", e => (e.quantity > 1 ? {quantity: String(e.quantity)} : {}));
    await mapList(block.talents, "talent");
    await mapList(block.forcePowers, "forcePower");
    await mapList(block.forceSecrets, "forceSecret");
    await mapList(block.forceTechniques, "forceTechnique");
    await mapList(block.forceRegimens, "forceRegimen");
    await mapList(block.speciesTraits, "speciesTrait");
    await mapList((block.languages ?? []).map(name => ({name})), "language");

    // Natural weapons come from the attack lines on a beast. "Claws (2)" is two of the singular
    // "Claw" component, which nameVariants() handles.
    if (isBeast) {
        for (const attack of block.attacks) {
            if (PLACEHOLDER_ATTACKS.has(attack.name.toLowerCase())) continue;
            const result = await resolveOne({name: attack.name}, "naturalWeapon", {resolve, aliasIndex});
            record(result, attack.quantity > 1 ? {quantity: String(attack.quantity)} : {});
        }
    }

    // Possessions are tier 3 in the plan: this fork ships 4 armors and 34 weapons against the
    // wiki's hundreds, so most named gear cannot resolve by name and lands in `unresolved` for the
    // review dialog to map by weapon group or armor class.
    //
    // "Utility Belt with Medpac" is two items, not one. The split is depth-aware so it does not
    // fire inside "Custom Armor (As Armored Flight Suit with Helmet Package (...))".
    const possessions = [];
    for (const entry of block.possessions ?? []) {
        for (const part of splitOutsideParens(entry.name, " with ")) {
            possessions.push({...entry, name: part});
        }
    }
    await mapList(possessions, "possession", () => ({equip: "equipped"}));

    // --- Skills ---------------------------------------------------------------------------------
    // Only the SET of trained skills transfers. The printed bonus is a RAW output built from a
    // different level ladder, ability array and Skill Focus rule, so the fork recomputes it.
    for (const skill of block.skills ?? []) {
        const alias = aliasIndex.get(`skill:${skill.name}`.toLowerCase());
        if (alias && alias.to === null) {
            report.dropped.push({name: skill.name, type: "skill", reason: alias.reason});
            continue;
        }
        const name = alias?.to?.name ?? skill.name;
        const known = await resolve(name, ["skill"]);
        if (!known) {
            report.unresolved.push({name: skill.name, type: "skill", reason: "not a skill in this fork"});
            continue;
        }
        if (actorData.system.skills[name]) {
            report.collapsed.push({source: skill.name, target: name, reason: alias?.reason ?? "already trained"});
            continue;
        }
        actorData.system.skills[name] = {trained: true};
        if (alias) {
            report.mapped.push({from: skill.name, to: name, type: "skill", via: "alias", reason: alias.reason});
        }
    }

    // --- Token -----------------------------------------------------------------------------------
    // Imported NPCs always autosize their token from system.size. `system.size` is what the sheet's
    // Size control writes (templates/actor/parts/actor-summary.hbs), so setting it here is the same
    // edit a GM would make by hand.
    actorData.system.settings.autoSizeToken = true;

    // --- Free text ------------------------------------------------------------------------------
    const biography = [
        block.notes?.length ? block.notes.join("\n\n") : null,
        block.immunities?.length ? `Immune: ${block.immunities.join(", ")}` : null,
        block.weaknesses?.length ? `Weaknesses: ${block.weaknesses.join(", ")}` : null,
        block.senses?.length ? `Senses: ${block.senses.join(", ")}` : null
    ].filter(Boolean).join("\n\n");
    if (biography) actorData.system.details.biography = biography;

    return {actorData, report};
}

/**
 * Post-creation reconciliation. Run AFTER processActor has created the actor and added its items,
 * because both steps below depend on values that only exist once the items are on the actor.
 *
 * A printed statblock is authoritative about how many skills the creature is trained in. This
 * fork's budget (`availableTrainedSkillCount`, module/actor/data/templates/skills.mjs:93) is
 * class bonus plus INT modifier, floored at 1, and for a low-INT creature that is smaller than
 * what the statblock shows: a Rancor prints two trained skills but has an INT modifier of -4 and
 * so a budget of 1. Rather than silently dropping the difference, grant the shortfall as a
 * `trainedSkills` change on the actor so the sheet's own counter agrees with what was imported.
 *
 * @param {object} actor      the created SWSEActor
 * @param {object} actorData  the payload mapStatblock produced for it
 * @returns {Promise<string[]>} notes for the import report
 */
export async function finalizeImportedActor(actor, actorData) {
    const notes = [];
    const desired = Object.entries(actorData.system?.skills ?? {})
        .filter(([, skill]) => skill?.trained)
        .map(([name]) => name);

    if (desired.length === 0) {
        await actor.prepareData();
        await sizePrototypeToken(actor, notes);
        return notes;
    }

    const available = Number(actor.system.availableTrainedSkillCount ?? 0);
    const shortfall = desired.length - available;
    if (shortfall > 0) {
        const changes = [...(actor.system.changes ?? [])];
        changes.push({
            key: "trainedSkills",
            value: shortfall,
            mode: 2,
            priority: 0
        });
        await actor.safeUpdate({"system.changes": changes});
        notes.push(`Granted ${shortfall} extra trained skill${shortfall === 1 ? "" : "s"} `
            + `(statblock trains ${desired.length}, this fork's budget allowed ${available}).`);
    }

    // Re-assert the trained flags. Nested rather than dotted because skill names contain spaces
    // and parentheses ("Knowledge (Sciences)") and a dotted path would be re-split on any ".".
    const skillUpdate = {};
    for (const name of desired) skillUpdate[name] = {trained: true};
    await actor.safeUpdate({system: {skills: skillUpdate}});
    await actor.prepareData();
    await sizePrototypeToken(actor, notes);

    const stillMissing = desired.filter(name => !actor.system.skills?.[name]?.trained);
    if (stillMissing.length) {
        notes.push(`Could not train: ${stillMissing.join(", ")}.`);
    }
    return notes;
}

/**
 * Sizes the actor's PROTOTYPE token from system.size.
 *
 * `SWSEActor#handleTokenupdates` already honours the autoSizeToken setting, but it only updates
 * tokens already placed on a scene - it never touches the prototype. A freshly imported Huge
 * creature therefore drops onto the map at 1x1 and only snaps to size once its data is prepared.
 * Setting the prototype at import time means the very first drop is correct.
 *
 * The size helpers are imported dynamically so this module keeps zero static imports and stays
 * runnable under plain `node --test`; the import is only evaluated inside Foundry, where this
 * function is the only caller.
 */
async function sizePrototypeToken(actor, notes) {
    if (!actor.system?.settings?.autoSizeToken) return;
    try {
        const {getGridSizeFromSize, getTokenTextureScaleFromSize} = await import("../actor/size.mjs");
        const sizeName = actor.size?.name ?? actor.system.size;
        const gridSize = getGridSizeFromSize(sizeName);
        const scale = getTokenTextureScaleFromSize(sizeName);
        await actor.update({
            "prototypeToken.width": gridSize,
            "prototypeToken.height": gridSize,
            "prototypeToken.texture.scaleX": scale,
            "prototypeToken.texture.scaleY": scale
        });
        notes.push(`Prototype token sized ${gridSize}x${gridSize} for ${sizeName}.`);
    } catch (e) {
        notes.push(`Could not size the prototype token: ${e.message}`);
    }
}

/**
 * Which printed values can be pinned onto the actor, and where the pin is written.
 *
 * Every path here was confirmed live to take effect and to restore the derived value when cleared:
 * pinning Fortitude to 20 moved Damage Threshold with it, and a damageThreshold.misc of 5 moved DT
 * from 15 to 20. `ref` and `fort` are the real key names - not `reflex` and `fortitude` - because
 * that is what defenses.mjs reads (`system.overrides.ref ?? ...`).
 *
 * Base attack bonus, grapple, initiative, flat-footed Reflex and speed have no override in this
 * system at all, so they are reported for comparison and cannot be pinned. Offering a checkbox that
 * quietly did nothing would be worse than showing none.
 */
const DIVERGENCE_ROWS = [
    {key: "hitPoints", label: "Hit Points", derive: a => a.system.health?.max, pin: "system.overrides.health"},
    {key: "reflex", label: "Reflex Defense", derive: a => a.system.defense?.reflex?.total, pin: "system.overrides.ref"},
    {key: "fortitude", label: "Fortitude Defense", derive: a => a.system.defense?.fortitude?.total, pin: "system.overrides.fort"},
    {key: "will", label: "Will Defense", derive: a => a.system.defense?.will?.total, pin: "system.overrides.will"},
    {key: "damageThreshold", label: "Damage Threshold", derive: a => a.system.defense?.damageThreshold?.total, pin: "damageThresholdMisc"},
    {key: "flatFooted", label: "Flat-Footed Reflex", derive: a => a.system.defense?.reflex?.defenseModifiers?.[0]?.value, pin: null},
    {key: "baseAttackBonus", label: "Base Attack Bonus", derive: a => a.system.baseAttack, pin: null},
    // The GETTER, not system.grapple. system.grapple is assigned during derivation from the same
    // getter and reads back null (and transiently NaN) depending on when it is sampled, while
    // actor.grapple recomputes correctly on demand.
    {key: "grapple", label: "Grapple", derive: a => a.grapple, pin: null},
    {key: "initiative", label: "Initiative", derive: a => a.system.skills?.Initiative?.value, pin: null},
    // The wiki prints speed in squares and this fork stores it in feet, so comparing the raw
    // strings ("6 Squares" against "Walk 25") tells the GM nothing. Both sides are reduced to feet.
    {
        key: "speed", label: "Speed (feet)", pin: null,
        derive: a => {
            const match = /(\d+)/.exec(String(a.speed ?? ""));
            return match ? Number(match[1]) : undefined;
        },
        printedTransform: value => {
            const match = /(\d+)/.exec(String(value ?? ""));
            return match ? Number(match[1]) * SQUARE_IN_FEET : undefined;
        }
    }
];

/** One battle-grid square is five feet, which is how the wiki's "6 Squares" becomes 30. */
const SQUARE_IN_FEET = 5;

/**
 * Compares what the wiki printed against what this fork derived, once the actor exists.
 *
 * This is the honest reckoning the importer owes the GM: the numbers were deliberately not
 * imported, so this is where you see how far the house rules moved them and decide, per value,
 * whether to pin the printed one.
 *
 * @param {object} actor    the created actor, already prepared
 * @param {object} printed  the `printed` block from the import report
 * @returns {Array<object>} one row per comparable value
 */
export function buildDivergenceReport(actor, printed = {}) {
    const rows = [];
    const usable = value => value !== null && value !== undefined
        && !(typeof value === "number" && !Number.isFinite(value));

    for (const row of DIVERGENCE_ROWS) {
        let printedValue = printed[row.key];
        if (!usable(printedValue)) continue;
        if (row.printedTransform) printedValue = row.printedTransform(printedValue);
        if (!usable(printedValue)) continue;

        let derivedValue;
        try {
            derivedValue = row.derive(actor);
        } catch {
            derivedValue = undefined;
        }
        // NaN has to be excluded explicitly: it is neither null nor undefined, and it rendered as
        // a literal "NaN" in the comparison table.
        if (!usable(derivedValue)) continue;

        const numeric = typeof printedValue === "number" && typeof derivedValue === "number";
        const delta = numeric ? derivedValue - printedValue : null;
        rows.push({
            key: row.key,
            label: row.label,
            printed: printedValue,
            derived: derivedValue,
            delta,
            differs: numeric ? delta !== 0 : String(printedValue) !== String(derivedValue),
            pinnable: !!row.pin && numeric,
            pin: row.pin
        });
    }
    return rows;
}

/**
 * Writes the chosen pins onto the actor.
 *
 * Damage Threshold has no direct override, only an additive `misc` field, so its pin is expressed
 * as the difference from the derived value. That keeps the adjustment visible in the sheet's own
 * Misc breakdown rather than hiding it behind a flat number.
 *
 * @param {object} actor
 * @param {Array<{key: string}>} pins rows from buildDivergenceReport that the GM ticked
 * @returns {Promise<string[]>} notes describing what was pinned
 */
export async function applyPins(actor, pins) {
    if (!pins?.length) return [];
    const update = {};
    const notes = [];

    for (const pin of pins) {
        const row = DIVERGENCE_ROWS.find(r => r.key === pin.key);
        if (!row?.pin) continue;

        if (row.pin === "damageThresholdMisc") {
            const currentMisc = Number(actor.system.defense?.damageThreshold?.misc ?? 0);
            const derived = Number(row.derive(actor) ?? 0);
            update["system.defense.damageThreshold.misc"] = currentMisc + (Number(pin.printed) - derived);
        } else {
            update[row.pin] = Number(pin.printed);
        }
        notes.push(`${row.label} pinned to ${pin.printed}`);
    }

    if (Object.keys(update).length) {
        await actor.update(update);
        await actor.prepareData();
    }
    return notes;
}
