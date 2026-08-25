/**
 * Validates module/import/statblock-aliases.json against what the packs actually contain.
 *
 * This is the whole reason a hand-written mapping table is safe to keep. Its failure mode is
 * silent: rename or retire a pack item and the table goes on pointing at a name that no longer
 * exists, and the only symptom is an import that quietly drops something. These tests turn that
 * into a red build.
 *
 * Names are read from packs/_source, the git-tracked JSON that compiles into the LevelDB packs via
 * `npm run packs:pack`, and skills from module/common/constants.mjs, which has no imports and so
 * loads without Foundry. Runs under plain `node --test`.
 */
import {test, describe} from "node:test";
import assert from "node:assert/strict";
import {readFileSync, readdirSync} from "node:fs";
import {fileURLToPath} from "node:url";
import path from "node:path";

import {skills} from "../module/common/constants.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, "packs", "_source");

const aliases = JSON.parse(readFileSync(path.join(ROOT, "module", "import", "statblock-aliases.json"), "utf8"));

/** Every item name in packs/_source, indexed by item type. */
function loadPackNames() {
    const byType = new Map();
    for (const dir of readdirSync(SOURCE, {withFileTypes: true}).filter(d => d.isDirectory())) {
        for (const file of readdirSync(path.join(SOURCE, dir.name))) {
            if (!file.endsWith(".json")) continue;
            let doc;
            try {
                doc = JSON.parse(readFileSync(path.join(SOURCE, dir.name, file), "utf8"));
            } catch {
                continue;
            }
            if (!doc?.name || !doc?.type) continue;
            if (!byType.has(doc.type)) byType.set(doc.type, new Set());
            byType.get(doc.type).add(doc.name);
        }
    }
    return byType;
}

const packNames = loadPackNames();
const skillNames = new Set(skills("character"));

/** True when {type, name} names something this fork actually has. */
function exists({type, name}) {
    if (type === "skill") return skillNames.has(name);
    return packNames.get(type)?.has(name) ?? false;
}

const entries = aliases.entries;

describe("statblock alias table", () => {
    test("the fixture packs actually loaded", () => {
        // Guards against the whole suite passing vacuously if packs/_source moves or is empty.
        assert.ok(packNames.get("feat")?.size > 100, "expected the feats pack to be indexed");
        assert.ok(packNames.get("talent")?.size > 100, "expected the talents pack to be indexed");
        assert.ok(entries.length > 30, "expected a seeded alias table");
    });

    test("every entry is well formed", () => {
        for (const entry of entries) {
            assert.ok(entry.from?.type && entry.from?.name, `malformed from: ${JSON.stringify(entry)}`);
            assert.ok(entry.reason, `entry is missing its house rule citation: ${JSON.stringify(entry.from)}`);
            if (entry.choose) {
                assert.ok(Array.isArray(entry.choose) && entry.choose.length > 1,
                    `a choose entry needs at least two options: ${JSON.stringify(entry.from)}`);
                assert.equal(entry.to, undefined,
                    `an entry has both choose and to, which is ambiguous: ${JSON.stringify(entry.from)}`);
                for (const option of entry.choose) {
                    assert.ok(option?.type && option?.name, `malformed choose option: ${JSON.stringify(entry)}`);
                }
            } else if (entry.to !== null) {
                assert.ok(entry.to?.type && entry.to?.name, `malformed to: ${JSON.stringify(entry)}`);
            }
        }
    });

    test("every target resolves in this fork", () => {
        const broken = entries
            .filter(e => !e.choose && e.to !== null && !exists(e.to))
            .map(e => `${e.from.name} -> ${e.to.type} "${e.to.name}"`);
        assert.deepEqual(broken, [], "alias targets that no longer exist");
    });

    test("every option of every choose entry resolves", () => {
        // A choice the GM cannot actually pick is worse than no choice at all.
        const broken = [];
        for (const entry of entries.filter(e => e.choose)) {
            for (const option of entry.choose) {
                if (!exists(option)) broken.push(`${entry.from.name} -> ${option.type} "${option.name}"`);
            }
        }
        assert.deepEqual(broken, [], "choose options that do not exist");
    });

    test("no source name still resolves", () => {
        // A source that resolves means the house rule was reverted, the item came back, or the
        // entry was wrong to begin with. Either way the alias is now shadowing a real item.
        const stale = entries
            .filter(e => exists(e.from))
            .map(e => `${e.from.type} "${e.from.name}" still exists and should not be aliased`);
        assert.deepEqual(stale, [], "stale alias sources");
    });

    test("no source is mapped twice", () => {
        const seen = new Set();
        const duplicates = [];
        for (const entry of entries) {
            const key = `${entry.from.type}:${entry.from.name}`;
            if (seen.has(key)) duplicates.push(key);
            seen.add(key);
        }
        assert.deepEqual(duplicates, []);
    });

    test("collapse is set wherever several sources share a target", () => {
        const targets = new Map();
        for (const entry of entries) {
            if (entry.choose || entry.to === null) continue;
            const key = `${entry.to.type}:${entry.to.name}`;
            if (!targets.has(key)) targets.set(key, []);
            targets.get(key).push(entry);
        }
        const missing = [];
        for (const [key, group] of targets) {
            if (group.length > 1 && group.some(e => !e.collapse)) missing.push(key);
        }
        // choose entries have no single target, so they are not part of this rule.
        assert.deepEqual(missing, [], "many-to-one targets must set collapse so duplicates are dropped");
    });

    test("covers the house rule deletions named in HOUSERULES.md", () => {
        const deletedFeats = ["Dodge", "Melee Defense", "Point-Blank Shot", "Power Attack", "Power Blast",
            "Precise Shot", "Unstoppable Combatant", "Vitality Surge", "Weapon Finesse"];
        for (const name of deletedFeats) {
            const entry = entries.find(e => e.from.type === "feat" && e.from.name === name);
            assert.ok(entry, `no alias entry for deleted feat ${name}`);
            assert.equal(entry.to, null, `${name} is deleted by house rule and must map to null`);
        }
    });

    test("collapses the merged Jedi talents onto one target each", () => {
        const target = name => entries.find(e => e.from.type === "talent" && e.from.name === name)?.to?.name;
        assert.equal(target("Block"), "Dueling Stance");
        assert.equal(target("Deflect"), "Dueling Stance");
        assert.equal(target("Redirect Shot"), "Redirection Stance");
        assert.equal(target("Riposte"), "Redirection Stance");
    });

    test("every retired prestige class is accounted for", () => {
        // From the Prestige Classes section of HOUSERULES.md. Each is either mapped onto the class
        // that absorbed it, offered as a choice where two classes carry its talent tree, or left as
        // a deliberate deletion. What must never happen is one of them silently going missing.
        const retired = ["Assassin", "Charlatan", "Corporate Agent", "Enforcer", "Gladiator",
            "Improviser", "Infiltrator", "Master Privateer", "Medic", "Military Engineer", "Outlaw",
            "Pathfinder", "Saboteur", "Shaper", "Spy", "Vanguard"];
        const missing = retired.filter(name =>
            !entries.some(e => e.from.type === "class" && e.from.name === name));
        assert.deepEqual(missing, [], "retired prestige classes with no alias entry");
    });

    test("the ambiguous prestige classes ask rather than guess", () => {
        const asks = name => entries.find(e => e.from.type === "class" && e.from.name === name)?.choose
            ?.map(o => o.name).sort();
        assert.deepEqual(asks("Assassin"), ["Agent", "Operative"]);
        assert.deepEqual(asks("Spy"), ["Agent", "Operative"]);
        assert.deepEqual(asks("Master Privateer"), ["Agent", "Melee Duelist"]);
    });

    test("routes both merged classes to Smuggler", () => {
        const target = name => entries.find(e => e.from.type === "class" && e.from.name === name)?.to?.name;
        assert.equal(target("Scoundrel"), "Smuggler");
        assert.equal(target("Scout"), "Smuggler");
    });
});
