/**
 * The statblock importer's UI: fetch or paste a wiki statblock, review exactly what it will do,
 * then create the actor.
 *
 * The review step is the point of the whole thing. The units-cl-* compendia this replaces were
 * bulk-imported with no report and no gate: 94.6% of those 2317 actors carried at least one dead
 * reference, and nobody found out until the thing was needed at the table. Nothing is created here
 * until the GM has seen what resolved, what a house rule dropped, and what could not be found.
 */
import {parseStatblock} from "./statblock-parser.mjs";
import {mapStatblock, finalizeImportedActor, buildDivergenceReport, applyPins} from "./statblock-mapper.mjs";
import {buildCompendiumResolver, listCandidates, fetchWikitext, loadAliases, rememberAliases} from "./statblock-resolver.mjs";
import {processActor} from "../compendium/generation.mjs";
import {buildImprovisedItem} from "./statblock-improvise.mjs";
import {skills} from "../common/constants.mjs";

const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;

/**
 * Dropdown value meaning "build this from what the statblock printed".
 *
 * A sentinel rather than a type:name pair, because every other option names something that already
 * exists in a pack and this one names something that does not exist yet.
 */
const IMPROVISE = "__improvise__";

export class StatblockImportApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "swse-statblock-import",
        classes: ["swse", "statblock-import"],
        position: {width: 720, height: 700},
        window: {title: "Import Statblock from Wiki", resizable: true, icon: "fa-solid fa-file-import"},
        actions: {
            parse: StatblockImportApp.prototype._onParse,
            back: StatblockImportApp.prototype._onBack,
            confirm: StatblockImportApp.prototype._onConfirm,
            finish: StatblockImportApp.prototype._onFinish
        }
    };

    static PARTS = {
        body: {template: "systems/swse/templates/import/statblock-import.hbs", scrollable: [""]}
    };

    /** "input" until a statblock has been parsed, then "review". */
    #step = "input";
    #input = "";
    #error = null;
    #busy = false;
    #block = null;
    #actorData = null;
    #report = null;
    #candidatesByRow = new Map();
    #actor = null;
    #divergence = [];
    #importNotes = [];

    async _prepareContext() {
        // Booleans rather than an {{#if (eq ...)}} in the template: this system registers no `eq`
        // helper of its own (module/common/helpers.mjs) and no other template relies on one.
        const context = {
            isInput: this.#step === "input",
            isReview: this.#step === "review",
            isDivergence: this.#step === "divergence",
            input: this.#input,
            error: this.#error,
            busy: this.#busy
        };
        if (this.#step === "divergence") {
            context.actorName = this.#actor?.name;
            context.divergence = this.#divergence;
            context.anyDifference = this.#divergence.some(row => row.differs);
            context.importNotes = this.#importNotes;
            return context;
        }
        if (this.#step !== "review") return context;

        const report = this.#report;
        context.actorName = this.#actorData.name;
        context.actorType = this.#actorData.type;
        context.size = this.#actorData.system.size;
        context.cl = this.#actorData.system.details.cl;
        context.abilities = Object.entries(this.#actorData.system.abilities)
            .map(([key, value]) => ({key: key.toUpperCase(), value: value.base}));
        context.trainedSkills = Object.keys(this.#actorData.system.skills);

        context.counts = {
            mapped: report.mapped.length,
            dropped: report.dropped.length,
            unresolved: report.unresolved.length,
            collapsed: report.collapsed.length,
            choices: report.choices.length
        };
        context.choices = report.choices.map((row, index) => ({
            index, name: row.name, type: row.type, reason: row.reason, options: row.options
        }));
        context.mapped = report.mapped.map(row => ({
            ...row,
            changed: row.from !== row.to
        }));
        context.dropped = report.dropped;
        context.collapsed = report.collapsed;

        // Printed values are shown for reference only. They are RAW outputs and are deliberately
        // not written to the actor - see the header of statblock-mapper.mjs.
        context.printed = Object.entries(report.printed ?? {})
            .filter(([, value]) => value !== null && value !== undefined)
            .map(([key, value]) => ({key, value}));

        context.unresolved = [];
        for (const [index, row] of report.unresolved.entries()) {
            const groups = this.#candidatesByRow.get(index) ?? [];
            context.unresolved.push({index, name: row.name, type: row.type, reason: row.reason, groups});
        }
        return context;
    }

    /** Fetches (or reads) the statblock, parses it and maps it. Creates nothing. */
    async _onParse(event) {
        event?.preventDefault();
        const form = this.element.querySelector("form");
        this.#input = form?.elements?.source?.value ?? this.#input;
        this.#error = null;

        if (!this.#input.trim()) {
            this.#error = "Give a wiki page name, a wiki URL, or paste the statblock's wikitext.";
            return this.render();
        }

        this.#busy = true;
        await this.render();
        try {
            // Anything with a heading is already wikitext; anything else is a page to go fetch.
            const looksLikeWikitext = /==.*Statistics/i.test(this.#input);
            const wikitext = looksLikeWikitext ? this.#input : await fetchWikitext(this.#input);

            const block = parseStatblock(wikitext);
            if (!block) throw new Error('No "... Statistics" section found on that page.');
            if (block.isVehicle) {
                throw new Error(`"${block.name}" is a vehicle statblock. This importer builds `
                    + `characters and beasts; vehicles use a different sheet and a different set of `
                    + `fields (crew, cargo, consumables, no ability scores), so importing one here `
                    + `would produce a broken character. Build it from the Vehicle Base Types `
                    + `compendium instead.`);
            }

            // Shipped house rules plus whatever this world has learned from earlier imports.
            const aliases = await loadAliases();
            const resolve = await buildCompendiumResolver();
            const {actorData, report} = await mapStatblock(block, {resolve, aliases});

            // Pre-load substitution options for each unresolved row.
            this.#candidatesByRow = new Map();
            for (const [index, row] of report.unresolved.entries()) {
                this.#candidatesByRow.set(index, await listCandidates(row.candidates ?? [row.type]));
            }

            this.#block = block;
            this.#actorData = actorData;
            this.#report = report;
            this.#step = "review";
        } catch (e) {
            this.#error = e.message;
            console.error("SWSE statblock import failed to parse", e);
        } finally {
            this.#busy = false;
            await this.render();
        }
    }

    async _onBack(event) {
        event?.preventDefault();
        this.#step = "input";
        this.#error = null;
        await this.render();
    }

    /**
     * Applies the GM's substitutions, then creates the actor. This is the only method that writes
     * anything.
     */
    async _onConfirm(event) {
        event?.preventDefault();
        if (this.#busy) return;

        // Read the dropdowns BEFORE anything re-renders. Rendering rebuilds the form from
        // _prepareContext, which resets every select to its first option, so collecting the GM's
        // choices after flipping the busy flag would silently discard all of them.
        const actorData = foundry.utils.deepClone(this.#actorData);
        const substitutions = [];
        const improvised = [];
        for (const select of this.element.querySelectorAll("select[data-unresolved-index]")) {
            const value = select.value;
            if (!value) continue;                       // left as "Leave out"
            const row0 = this.#report.unresolved[Number(select.dataset.unresolvedIndex)];
            if (value === IMPROVISE) {
                // Built after the actor exists: this item is not in any pack, so it cannot go
                // through providedItems, which resolves entries by name.
                improvised.push(row0);
                continue;
            }
            const [type, ...rest] = value.split(":");
            const name = rest.join(":");
            const row = this.#report.unresolved[Number(select.dataset.unresolvedIndex)];

            if (type === "skill") {
                actorData.system.skills[name] = {trained: true};
            } else {
                actorData.system.providedItems.push({name, type, ...(row?.extra ?? {})});
            }
            substitutions.push({
                from: {type: row?.type ?? type, name: row?.name ?? name},
                to: {type, name},
                label: `${row?.name ?? "?"} -> ${name}`
            });
        }

        // Class choices for the retired prestige classes. Applied here, and deliberately NOT
        // passed to rememberAliases below: which class an Assassin becomes is a judgement about
        // this character, not a fact about the world, so remembering it would silently stop asking
        // and misclass every later import.
        const chosen = [];
        for (const select of this.element.querySelectorAll("select[data-choice-index]")) {
            if (!select.value) continue;
            const [type, ...rest] = select.value.split(":");
            const name = rest.join(":");
            const row = this.#report.choices[Number(select.dataset.choiceIndex)];
            const extra = row?.extra ?? {};

            // Several retired classes can land on the same replacement, and a class taken twice
            // must ADD its levels rather than appear twice. Same merge the mapper does for
            // Scoundrel and Scout both becoming Smuggler.
            const existing = actorData.system.providedItems.find(i => i.type === type && i.name === name);
            if (existing && type === "class") {
                existing.quantity = String(Number(existing.quantity ?? 1) + Number(extra.quantity ?? 1));
            } else {
                actorData.system.providedItems.push({name, type, ...extra});
            }
            chosen.push(`${row?.name ?? "?"} -> ${name}`);
        }

        this.#busy = true;
        await this.render();

        try {

            // The skills the payload asks for, captured before create() cleans the object.
            const wantedSkills = Object.keys(actorData.system.skills);

            const created = await processActor(actorData, true);
            // Read created.actor, never `created.actor ?? created`: processActor returns the
            // wrapper {actor: undefined, failures: []} when Actor.create rejects the payload, and
            // that object is truthy. The fallback therefore skipped this guard and handed a plain
            // object to finalizeImportedActor, turning a clear "could not be created" into a
            // confusing crash on actor.system.availableTrainedSkillCount.
            const actor = created.actor;
            if (!actor) throw new Error("The actor could not be created. Check the console for the validation error.");

            const notes = await finalizeImportedActor(actor, {
                system: {skills: Object.fromEntries(wantedSkills.map(name => [name, {trained: true}]))}
            }, {
                attacks: this.#block?.attacks ?? [],
                possessions: this.#block?.possessions ?? [],
                skills: skills(actor.type)
            });

            // Items this fork has no match for, that the GM chose to build from the printed text.
            const improvisedNotes = [];
            if (improvised.length) {
                const built = improvised.map(row => buildImprovisedItem(row, {skills: skills(actor.type)}));
                await actor.createEmbeddedDocuments("Item", built.map(b => b.payload));
                for (const b of built) {
                    improvisedNotes.push(`Built ${b.payload.name}`
                        + (b.applied.length ? ` with ${b.applied.join(", ")}` : " with no automatic bonuses")
                        + (b.leftover.length ? `; not automated: ${b.leftover.join("; ")}` : "")
                        + ".");
                }
                await actor.prepareData();
            }

            const failures = created.failures ?? [];
            // Remember the picks BEFORE reporting, so the count is accurate and so a later failure
            // in the divergence step cannot lose them.
            const remembered = await rememberAliases(substitutions, this.#actorData.name);

            this.#importNotes = [
                `Added ${actor.items.size} items.`,
                substitutions.length ? `Substituted: ${substitutions.map(s => s.label).join(", ")}.` : null,
                chosen.length ? `Class chosen: ${chosen.join(", ")}.` : null,
                remembered ? `Remembered ${remembered} substitution${remembered === 1 ? "" : "s"} for next time.` : null,
                ...improvisedNotes,
                failures.length ? `Could not add: ${failures.map(f => f.name ?? f).join(", ")}.` : null,
                ...notes
            ].filter(Boolean);

            if (failures.length) {
                ui.notifications.warn(`${actor.name}: could not add ${failures.map(f => f.name ?? f).join(", ")}.`,
                    {permanent: true});
            }
            console.log("SWSE statblock import:", {actor, report: this.#report, notes, failures});

            // The actor exists now, so the printed numbers can finally be compared against what
            // this fork derives. That comparison is the last step rather than a silent side effect.
            this.#actor = actor;
            this.#divergence = buildDivergenceReport(actor, this.#report.printed);
            this.#step = "divergence";
        } catch (e) {
            this.#error = e.message;
            console.error("SWSE statblock import failed", e);
        } finally {
            this.#busy = false;
            await this.render();
        }
    }

    /**
     * Applies whichever printed values the GM chose to pin, then hands over to the actor sheet.
     * Pinning nothing is the default and the common case: the derived numbers are the ones that
     * match this fork's rules.
     */
    async _onFinish(event) {
        event?.preventDefault();
        if (this.#busy) return;

        // Read the checkboxes before any re-render rebuilds the form and resets them.
        const chosen = [];
        for (const box of this.element.querySelectorAll("input[type=checkbox][data-pin-key]:checked")) {
            const row = this.#divergence.find(r => r.key === box.dataset.pinKey);
            if (row) chosen.push(row);
        }

        this.#busy = true;
        await this.render();
        try {
            const pinned = await applyPins(this.#actor, chosen);
            const message = pinned.length
                ? `${this.#actor.name} imported. ${pinned.join(", ")}.`
                : `${this.#actor.name} imported. All values derived from the house rules.`;
            ui.notifications.info(message);
            const actor = this.#actor;
            await this.close();
            actor.sheet.render(true);
        } catch (e) {
            this.#error = e.message;
            console.error("SWSE statblock import failed to pin values", e);
            this.#busy = false;
            await this.render();
        }
    }
}

/**
 * Adds the import button to the Actors sidebar.
 *
 * ApplicationV2 re-renders in place and only replaces its own registered parts, so anything added
 * outside them survives and would stack a fresh button on every re-render. Removing our own
 * container first is what keeps this idempotent - the compendium sidebar was filled with dozens of
 * dead duplicate buttons by skipping exactly this.
 */
const IMPORT_BUTTON_CLASS = "swse-statblock-import-button";

export function initializeStatblockImportButton() {
    Hooks.on("renderActorDirectory", (app, element) => {
        if (!game.user.isGM) return;
        const root = element instanceof HTMLElement ? element : element?.[0];
        if (!root) return;

        root.querySelectorAll(`.${IMPORT_BUTTON_CLASS}`).forEach(node => node.remove());

        const container = document.createElement("div");
        container.classList.add("action-buttons", "flexrow", IMPORT_BUTTON_CLASS);

        const button = document.createElement("button");
        button.type = "button";
        button.innerHTML = `<i class="fa-solid fa-file-import"></i> Import Statblock`;
        button.dataset.tooltip = "Import an NPC or beast from a SWSE wiki statblock";
        button.addEventListener("click", () => new StatblockImportApp().render(true));
        container.append(button);

        const headerActions = root.querySelector(".directory-header .header-actions");
        if (headerActions) headerActions.after(container);
        else root.prepend(container);
    });
}
