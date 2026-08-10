/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
import {getParentByHTMLClass, onCollapseToggle, toChat, toNumber} from "../common/util.mjs";
import {
    _adjustPropertyBySpan,
    onChangeControl,
    onEffectControl,
    onSpanTextInput,
    onToggle
} from "../common/listeners.mjs";
import {ACTIVE_EFFECT_MODES} from "../common/constants.mjs";
import {KNOWN_ATTRIBUTE_KEYS} from "../common/known-attribute-keys.mjs";
import {bindKeyAutocomplete} from "../common/autocomplete.mjs";

const {HandlebarsApplicationMixin} = foundry.applications.api;

export class SWSEItemSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2) {
    static DEFAULT_OPTIONS = {
        classes: ["swse", "sheet", "item"],
        position: {width: 520, height: 480},
        window: {resizable: true},
        form: {submitOnChange: true},
        actions: {
            "to-chat": SWSEItemSheet.prototype._onToChat,
            "item-warning": SWSEItemSheet.#onItemWarning,
            "class-control": SWSEItemSheet.prototype._onClassControl,
            "provided-item-control": SWSEItemSheet.prototype._onProvidedItemControl,
            "prerequisite-control": SWSEItemSheet.prototype._onPrerequisiteControl,
            "modifier-control": SWSEItemSheet.prototype._onModifierControl,
            "effect-control": onEffectControl,
            "change-control": onChangeControl,
            "toggle": onToggle,
            "collapse-toggle": SWSEItemSheet.#onCollapseToggle,
            "value-plus": SWSEItemSheet.#onValuePlus,
            "value-minus": SWSEItemSheet.#onValueMinus
        }
    };

    // Provided/Prerequisites/Stripping/Modifications/Modes/Levels used to be standalone tabs
    // here — none were dense enough to justify a whole tab, so they're now collapsible
    // sections on Summary instead (templates/item/parts/item-sections.hbs). Changes stays its
    // own tab for every type, including typed gear types — their leftover generic keys
    // (toHitModifier, proficiency bonuses, etc.) live there, same as pf2e keeps Rules Elements
    // separate from the main stat block rather than folding them in.
    static PARTS = {
        header: {template: "systems/swse/templates/item/parts/header.hbs"},
        tabs: {template: "templates/generic/tab-navigation.hbs"},
        summary: {
            template: "systems/swse/templates/item/parts/tab-summary.hbs",
            templates: ["systems/swse/templates/item/parts/summary.hbs"],
            scrollable: [""]
        },
        changes: {
            template: "systems/swse/templates/item/parts/tab-changes.hbs",
            templates: ["systems/swse/templates/change/change-list.hbs", "systems/swse/templates/change/change.hbs"],
            scrollable: [""]
        }
    };

    static TABS = {
        sheet: {
            tabs: [
                {id: "summary", label: "Summary"},
                {id: "changes", label: "Changes"}
            ],
            initial: "summary"
        }
    };

    /** V1-era compatibility alias — several shared listener helpers (module/common/listeners.mjs) still use
     * `this.object` as the document-being-edited, matching V1 DocumentSheet's alias for `this.document`. */
    get object() {
        return this.document;
    }

    /** @override — core's title builds a per-type prefix from CONFIG.Item.typeLabels, which SWSE never
     * populates (item types are titleCased ad-hoc, see the "options" Handlebars helper), so the default
     * would show the raw, untranslated localization key instead of a label. */
    get title() {
        return `${this.item.type.titleCase()}: ${this.item.name}`;
    }

    /** @override — only the tabs whose PART is actually present should show in the nav.
     * Changes now stays a tab for every type, including migrated gear types — their leftover
     * generic keys (toHitModifier, proficiency bonuses, etc.) live there, same as pf2e keeps
     * Rules Elements on their own tab rather than folded into the main stat block. */
    _configureRenderParts(options) {
        return super._configureRenderParts(options);
    }

    /** @override */
    _getTabsConfig(group) {
        const config = super._getTabsConfig(group);
        if (group !== "sheet" || !config) return config;
        const parts = this._configureRenderParts({});
        return {...config, tabs: config.tabs.filter(t => t.id in parts)};
    }

    /** @override */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.item = this.item;
        context.owner = this.item.isOwner;
        context.modes = Object.entries(ACTIVE_EFFECT_MODES).reduce((obj, e) => {
            obj[e[1]] = game.i18n.localize("EFFECT.MODE_" + e[0]);
            return obj;
        }, {});
        context.knownAttributeKeys = KNOWN_ATTRIBUTE_KEYS;
        return context;
    }

    /** @override */
    async _preparePartContext(partId, context) {
        context = await super._preparePartContext(partId, context);
        if (partId in context.tabs) context.tab = context.tabs[partId];
        return context;
    }

    /** @override */
    async _onRender(context, options) {
        await super._onRender(context, options);

        this.element.querySelectorAll("[data-action=direct-field]").forEach(el => {
            el.addEventListener("click", (event) => {
                onSpanTextInput.call(this, event, _adjustPropertyBySpan.bind(this), "text");
            });
        });

        // <select multiple> fields (e.g. weapon Damage Type, which some weapons legitimately
        // have two of) aren't submitOnChange-compatible with a plain StringField — the browser
        // reports an array, the schema expects a comma-joined string. Handled manually rather
        // than via the actions map since this is a change event, not a click.
        this.element.querySelectorAll("select[data-multi-select-name]").forEach(el => {
            el.addEventListener("change", () => {
                const name = el.dataset.multiSelectName;
                const values = Array.from(el.selectedOptions).map(o => o.value);
                this.item.safeUpdate({[name]: values.join(", ")});
            });
        });

        bindKeyAutocomplete(this.element, ".known-attribute-key-input", KNOWN_ATTRIBUTE_KEYS);
    }

    /* -------------------------------------------- */
    /*  Drag and Drop (extends ItemSheetV2's built-in DragDrop wiring)  */
    /* -------------------------------------------- */

    /** @override */
    _canDragStart(selector) {
        return true;
    }

    /** @override */
    _canDragDrop(selector) {
        return true;
    }

    /** @override */
    _onDragStart(event) {
        let dragData = {};
        const li = event.currentTarget;

        dragData.itemId = this.item.id;

        const owner = this.item.actor;
        if (owner) {
            dragData.owner = owner;
            dragData.actorId = owner.id;
            dragData.sceneId = owner.isToken ? canvas.scene?.id : null;
            dragData.tokenId = owner.isToken ? this.actor.token.id : null;
        }

        if (li.dataset.itemId) {
            dragData.modId = li.dataset.itemId;
            dragData.type = "Item";
        }

        if (li.dataset.effectId) {
            dragData.effectId = li.dataset.effectId;
            dragData.effectUuid = li.dataset.uuid;
            dragData.type = "ActiveEffect";
        }

        event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
    }

    /** @override */
    async _onDrop(event) {
        if (!this.item.canUserModify(game.user, 'update')) return false;
        let droppedItem;
        try {
            droppedItem = JSON.parse(event.dataTransfer.getData("text/plain"));
        } catch (err) {
            console.error(`Parsing error: ${event.dataTransfer.getData("text/plain")}`);
            return false;
        }
        let effect = getParentByHTMLClass(event, "effect");
        if (effect) {
            droppedItem.targetEffectUuid = effect.dataset.uuid;
        }
        await this.object.handleDroppedItem(droppedItem);
    }

    /* -------------------------------------------- */

    _onToChat(event, target) {
        event.preventDefault();
        const a = target;
        const itemId = a.dataset.actionItem;
        const actorId = a.dataset.actorId;
        const actionCompendium = a.dataset.actionCompendium;

        let item;

        if (actorId) {
            const actor = game.actors.get(actorId);
            item = actor.items.find(item => item._id === itemId);
        } else if (actionCompendium) {
            let compendium = game.packs.find(pack => pack.collection === actionCompendium);
            item = compendium.get(itemId);
        } else {
            item = game.items.get(itemId);
        }

        let content = item.description || item.system?.description;

        // toChat() posts silently (a sound plays, but there's no visible confirmation) — if the
        // Chat sidebar tab isn't already the active one, clicking Share looked like it did
        // nothing at all. Switch to it so the shared content is immediately visible.
        toChat(content, this.object.parent, item.name);
        ui.sidebar.activateTab("chat");
    }

    static #onItemWarning(event, target) {
        this.item.resolveWarning(event);
    }

    static #onCollapseToggle(event, target) {
        onCollapseToggle(event, target);
    }

    static #onValuePlus(event, target) {
        let name = target.getAttribute("name");
        const current = foundry.utils.getProperty(this.object, name);
        const update = {};
        const value = current + 1;
        const high = target.dataset.high !== undefined ? Number(target.dataset.high) : undefined;
        foundry.utils.setProperty(update, name, typeof high === "number" && !isNaN(high) ? Math.min(value, high) : value);
        this.object.safeUpdate(update);
    }

    static #onValueMinus(event, target) {
        let name = target.getAttribute("name");
        const current = foundry.utils.getProperty(this.object, name);
        const update = {};
        const value = current - 1;
        const low = target.dataset.low !== undefined ? Number(target.dataset.low) : undefined;
        foundry.utils.setProperty(update, name, typeof low === "number" && !isNaN(low) ? Math.max(value, low) : value);
        this.object.safeUpdate(update);
    }

    /* -------------------------------------------- */

    _canAttach(application) {
        if (!application) {
            return true;
        }
        application = (application + "").trim();

        let hasParens = this.hasParens(application);
        if (hasParens) {
            return this._canAttach(hasParens[1]);
        }

        let ors = this._findZeroDepth(application, " OR ");
        if (ors.length > 0) {
            for (let or of ors) {
                for (let i = or.start; i < or.end; i++) {
                    application = application.substring(0, i) + 'X' + application.substring(i + 1);
                }
            }

            let toks = application.split("XXXX");
            let isTruthy = false;
            for (let tok of toks) {
                isTruthy = isTruthy || this._canAttach(tok);
            }
            return isTruthy;
        }

        let ands = this._findZeroDepth(application, " AND ");
        if (ands.length > 0) {
            for (let or of ors) {
                for (let i = ands.start; i < ands.end; i++) {
                    application = application.substring(0, i) + 'X' + application.substring(i + 1);
                }
            }

            let toks = application.split("XXXXX");
            let isTruthy = true;
            for (let tok of toks) {
                isTruthy = isTruthy && this._canAttach(tok);
            }
            return isTruthy;
        }

        if (application === 'WEAPON') {
            return this.object.type === 'weapon';
        }
        if (application === 'ARMOR') {
            return this.object.type === 'armor';
        }
        if (application === 'ION') {
            return this.object.system.weapon.type === 'Energy (Ion)';
        }
        if (application === 'STUN') {
            return this.object.system.weapon.stun?.isAvailable;
        }
        return false;
    }

    hasParens(application) {
        if (!application.startsWith("(")) {
            return false;
        }
        let depth = 0;
        for (let i = 0; i < application.length; i++) {
            let char = application.charAt(i);
            if (char === '(') {
                depth++;
            } else if (char === ')') {
                depth--;
            }
            if (depth === 0) {
                return application.length - 1 === i;
            }

        }

        return false;
    }

    _findZeroDepth(term, search) {
        let found = [];
        let depth = 0;
        for (let i = 0; i < term.length; i++) {
            let char = term.charAt(i);
            if (char === '(') {
                depth++;
            } else if (char === ')') {
                depth--;
            } else if (term.substring(i).startsWith(search) && depth === 0) {
                found.push({start: i, end: i + search.length});
            }
        }
        return found;
    }

    createItemAttribute(attributeId, level, modeId) {
        let content = `<label>Key:
            <input id="key">
            </label>
            <br/>
        <label>Value:
            <input id="value">
            </label>
        `;

        foundry.applications.api.DialogV2.prompt({
            window: {title: "New Attribute"},
            content,
            ok: {
                callback: (event, button) => {
                    let key = button.form.querySelector("#key").value;
                    let value = button.form.querySelector("#value").value;

                    let updateData = {};
                    let data = updateData;
                    if (level) {
                        updateData.levels = {};
                        updateData.levels[level] = {};
                        updateData.levels[level].data = {};
                        data = updateData.levels[level].data;
                    }

                    if (modeId !== undefined) {
                        for (let tok of `${modeId}`.split(".")) {
                            data.modes = {};
                            data.modes[tok] = {};
                            data = data.modes[tok];
                        }
                    }

                    data.attributes = {};
                    data.attributes[attributeId] = {key, value};
                    this.item.updateData(updateData);
                }
            }
        });
    }

    createItemMode(modeId, level, parentModeId) {
        let content = `
        <label>Name:</label>
            <input id="name">
        <label>Group:</label>
            <input id="group">
        `;

        foundry.applications.api.DialogV2.prompt({
            window: {title: "New Mode"},
            content,
            ok: {
                callback: (event, button) => {
                    let name = button.form.querySelector("#name").value;
                    let group = button.form.querySelector("#group").value;

                    let updateData = {};
                    let data = updateData;
                    if (level) {
                        updateData.levels = {};
                        updateData.levels[level] = {};
                        data = updateData.levels[level];
                    }

                    if (parentModeId !== undefined) {
                        let toks = `${parentModeId}`.split(".");

                        for (let tok of toks) {
                            data.modes = {};
                            data.modes[tok] = {};
                            data = data.modes[tok];
                        }
                    }

                    data.modes = {};
                    data.modes[modeId] = {name, group, attributes: {}};
                    this.item.updateData(updateData);
                }
            }
        });
    }


    _onPrerequisiteControl(event, target) {
        let element = target;
        let path = element.dataset.path;

        let system = this.item.system || this.item._source.system;

        for (let tok of path.substring(5).split(".")) {
            if (!!system[tok]) {
                system = system[tok];
            }
        }

        let updateData = {};
        switch (element.dataset.type) {
            case 'remove-this-prerequisite':
                updateData[path] = null;
                break;
            case 'add-child-prerequisite':
                let maxKey = (Math.max(...Object.keys(system).map(k => toNumber(k))) || 0) + 1;
                let selectedKey = maxKey;
                for (let i = 0; i <= maxKey; i++) {
                    if (system[i] === undefined || system[i] === null) {
                        selectedKey = i;
                    }
                }
                if (path.endsWith("child")) {

                    updateData[`${path}`] = {};
                } else {
                    updateData[`${path}.${selectedKey}`] = {};
                }
                break;
        }
        this.item.safeUpdate(updateData);
    }

    _onModifierControl(event, target) {
        let element = target;
        let path = element.dataset.path;

        let system = this.item.system || this.item._source.system;

        for (let tok of path.substring(5).split(".")) {
            if (!!system[tok]) {
                system = system[tok];
            }
        }

        let updateData = {};
        switch (element.dataset.type) {
            case 'remove-this-modifier':
                updateData[path] = null;
                break;
            case 'add-modifier':
                let maxKey = (Math.max(...Object.keys(system).map(k => toNumber(k))) || 0) + 1;
                let selectedKey = maxKey;
                for (let i = 0; i <= maxKey; i++) {
                    if (system[i] === undefined || system[i] === null) {
                        selectedKey = i;
                    }
                }
                if (path.endsWith("child")) {

                    updateData[`${path}`] = {};
                } else {
                    updateData[`${path}.${selectedKey}`] = {};
                }
                break;
        }
        this.item.safeUpdate(updateData);
    }

    _onClassControl(event, target) {
        let element = target;

        let highestLevel = this.object.levels.map(c => c.flags.swse.level).reduce((a, b) => Math.max(a, b), 0);
        switch (element.dataset.type) {
            case "add-level":
                this.object.addClassLevel(highestLevel + 1);
                break;
            case "remove-level":
                this.object.removeClassLevel(highestLevel);
                break;
        }
    }

    _onProvidedItemControl(event, target) {
        let element = target;

        let system = this.object.system || this.object._source.system;
        let entityId = element.dataset.entityId;
        let updateData = {};
        switch (element.dataset.type) {
            case "delete-item":
                if (Array.isArray(system.providedItems)) {
                    system.providedItems.forEach((item, i) => updateData[`system.providedItems.${i}`] = item);
                }
                updateData[`system.providedItems.${entityId}`] = null;
                break;
            case "add-item":
                updateData[`system.providedItems`] = (Array.isArray(system.providedItems) ? system.providedItems : Object.values(system.providedItems || {})) || [];
                updateData[`system.providedItems`].push({name: "", type: "trait"});
                break;
        }
        this.object.safeUpdate(updateData);
    }


}
