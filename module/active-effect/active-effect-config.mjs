import {_onLinkControl} from "../common/listeners.mjs";

/**
 * Extend the base ActiveEffect config sheet (ApplicationV2, HandlebarsApplicationMixin(DocumentSheetV2) in core).
 * Adopts core's own details/duration/changes tabs unmodified, and adds one SWSE-specific tab: "links"
 * (linking effects to each other, via SWSEActiveEffect#addLink/#removeLink/#links).
 * @extends {ActiveEffectConfig}
 */
export class SWSEActiveEffectConfig extends foundry.applications.sheets.ActiveEffectConfig {
    static DEFAULT_OPTIONS = {
        classes: ["swse", "sheet", "effect"],
        actions: {
            "link-control": SWSEActiveEffectConfig.#onLinkControl
        }
    };

    static PARTS = {
        ...super.PARTS,
        links: {template: "systems/swse/templates/active-effect/links.hbs"}
    };

    static TABS = {
        sheet: {
            tabs: [...super.TABS.sheet.tabs, {id: "links", icon: "fas fa-link"}],
            initial: super.TABS.sheet.initial,
            labelPrefix: "EFFECT.TABS"
        }
    };

    /** V1-era compatibility alias - several shared listener helpers (module/common/listeners.mjs) still use
     * `this.object` as the document-being-edited, matching V1 DocumentSheet's alias for `this.document`. */
    get object() {
        return this.document;
    }

    /** @override */
    async _preparePartContext(partId, context) {
        context = await super._preparePartContext(partId, context);
        if (partId === "links") {
            context.links = this.document.links;
        }
        return context;
    }

    static #onLinkControl(event, target) {
        _onLinkControl.call(this, event, target);
    }
}
