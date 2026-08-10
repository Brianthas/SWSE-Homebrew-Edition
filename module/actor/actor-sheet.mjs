import {
    applyRollMode,
    attackOptions,
    filterItemsByTypes,
    getCleanListFromCSV,
    getParentByHTMLClass,
    linkEffects,
    numericOverrideOptions,
    onCollapseToggle,
    toChat,
    unique
} from "../common/util.mjs";
import {titleCase} from "../common/helpers.mjs";
import {characterActorTypes, vehicleActorTypes, ACTIVE_EFFECT_MODES} from "../common/constants.mjs";
import {KNOWN_ATTRIBUTE_KEYS} from "../common/known-attribute-keys.mjs";
import {bindKeyAutocomplete} from "../common/autocomplete.mjs";
import {addSubCredits, transferCredits} from "./credits.mjs";
import {SWSECompendiumDirectory} from "../compendium/compendium-directory.mjs";
import {onChangeControl, onEffectControl, onSpanTextInput, onToggle} from "../common/listeners.mjs";
import {getDefaultDataByType} from "../common/classDefaults.mjs";
import {CompendiumWeb} from "../compendium/compendium-web.mjs";
import SWSEActor from "./actor.mjs";
import {getInheritableAttribute} from "../attribute-helper.mjs";
import {makeAttack} from "./attack/attackDelegate.mjs";
import {Attack, CUSTOM_ATTACK_PREFIX} from "./attack/attack.mjs";
import {buildRollContent} from "../common/chatMessageHelpers.mjs";


// noinspection JSClosureCompilerSyntax

function getRollFromDataSet(dataset) {
    if (dataset.roll) {
        return dataset.roll;
    }
    if (dataset.key) {
        return this.object.resolvedVariables.get(dataset.key)
    }
    if (dataset.variable) {
        return this.object.resolvedVariables.get(dataset.variable)
    }
}

function getLabelFromDataSet(dataset) {
    if (dataset.label) {
        return dataset.label;
    }
    if (dataset.key) {
        return this.object.resolvedLabels.get(dataset.key)
    }
    if (dataset.variable) {
        return this.object.resolvedLabels.get(dataset.variable)
    }
}

/**
 *
 * @param dataset
 * @return {[]}
 */
function getNotesFromDataSet(dataset) {
    let notes;
    if (dataset.notes) {
        notes =  dataset.notes;
    } else if (dataset.key) {
        notes =  this.object.resolvedNotes.get(dataset.key)
    } else if (dataset.variable) {
        notes = this.object.resolvedNotes.get(dataset.variable)
    }
    if(notes){
        if(!Array.isArray(notes)){
            notes = [notes]
        }
        return notes;
    }
    return [];
}



/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */

export class SWSEActorSheet extends foundry.appv1.sheets.ActorSheet {
    constructor(...args) {
        super(...args);
        this._pendingUpdates = {};
        //this.options.submitOnChange = false;
    }


    /** @override */
    static get defaultOptions() {

        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["swse", "sheet", "actor"],
            width: 1000,
            height: 900,
            tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "summary"}],
            debug: false
        });
    }

    get template() {
        const path = "systems/swse/templates/actor";

        let type = this.actor?.type;
        if (type === 'character') {
            return `${path}/actor-sheet.hbs`;
        }
        if (type === 'npc') {
            return `${path}/actor-sheet.hbs`;
        }
        if (type === 'vehicle') {
            return `${path}/vehicle-sheet.hbs`;
        }
        if (type === 'npc-vehicle') {
            return `${path}/vehicle-sheet.hbs`;
        }
        if (type === 'beast') {
            return `${path}/beast-sheet.hbs`;
        }

        return `${path}/actor-sheet.hbs`;
    }

    /* -------------------------------------------- */

    /** @override */
    getData(options={}) {
        let data = super.getData(options);
        data.modes = Object.entries(ACTIVE_EFFECT_MODES).reduce((obj, e) => {
            obj[e[1]] = game.i18n.localize("EFFECT.MODE_" + e[0]);
            return obj;
        }, {})
        data.knownAttributeKeys = KNOWN_ATTRIBUTE_KEYS;
        return data;
    }


    /** @override */
    activateListeners(html) {
        super.activateListeners(html);


        //should this be moved to a nonSubmittal method?
        html.find(".collapse-toggle").on("click", event => onCollapseToggle(event))

        // Everything below here is only needed if the sheet is editable
        if (!this.isEditable) return;


        html.find(".toggle").on("click", onToggle.bind(this))
        bindKeyAutocomplete(html, ".known-attribute-key-input", KNOWN_ATTRIBUTE_KEYS);
        // fixed:true — same clipping issue as the attack-button menu below.
        new foundry.applications.ux.ContextMenu(html[0], ".numeric-override", numericOverrideOptions(this.actor), {jQuery: false, fixed: true})
        //new ContextMenu(html, `[data-action="attack-more"]`, numericOverrideOptions(this.actor))

        // fixed:true — without it the menu is positioned as a normal absolutely-positioned
        // child of the button, which gets clipped by the sheet's own scrollable container
        // whenever the button sits near the window edge (the compact attack card's roll
        // button always does). fixed mode escapes that clipping.
        new foundry.applications.ux.ContextMenu(html[0], `.attack-button`, attackOptions(this.actor), {jQuery: false, fixed: true})


        html.find("span.text-box.item-attribute").on("click", (event) => {
            onSpanTextInput.call(this, event, this._adjustItemAttributeBySpan.bind(this), "text");
        });
        // Add general text box (span) handler
        html.find("span.text-box.direct").on("click", (event) => {
            onSpanTextInput.call(this, event, this._adjustActorPropertyBySpan.bind(this), "text");
        });
        html.find("span.text-box.item-action").on("click", (event) => {
            onSpanTextInput.call(this, event, this._performItemAction.bind(this), "text");
        });
        // html.find("input.input").on("keyup", (event) => {
        //
        //     if (event.code === 'Enter' || event.code === 'NumpadEnter') {
        //         this._adjustActorPropertyBySpan.bind(this)
        //
        //     }
        // });
        // html.find("input.plain").on("keypress", (event) => {
        //     if (event.code === 'Enter' || event.code === 'NumpadEnter') {
        //         event.stopPropagation();
        //         //if (!changed) {
        //         this._onSubmit(event);
        //         //}
        //     }
        // });

        // html.find("input.direct").on("click", (event) => {
        //     this._pendingUpdates['data.classesfirst'] = event.target.value;
        // });

        // crew controls
        html.find(".crew-control").click(this._onCrewControl.bind(this));

        // Item Dragging
        html.find(".draggable").each((i, li) => {
            if (li.classList.contains("inventory-header")) return;
            li.setAttribute("draggable", true);
            li.addEventListener("dragstart", (ev) => this._onDragStart(ev), false);
        });

        html.find("div.attack").each((i, div) => {
            div.setAttribute("draggable", true);
            div.addEventListener("dragstart", (ev) => this._onDragStart(ev), false);
            //div.addEventListener("click", (ev) => this._onActivateItem(ev), false);
        });

        // Force Powers list: drag-and-drop reordering. Bound directly on each row (rather than
        // relying on the sheet's default whole-form drop pipeline) so stopPropagation() can keep
        // a reorder-drop from also falling through to _onDropItem's compendium/equip-slot logic.
        html.find(".force-power-sortable").on("dragover", (ev) => ev.preventDefault());
        html.find(".force-power-sortable").on("drop", (ev) => this._onSortForcePower(ev));

        // Same drag-to-reorder for any item-list.hbs list opted in via sortable=<type>.
        html.find(".item-sortable").on("dragover", (ev) => ev.preventDefault());
        html.find(".item-sortable").on("drop", (ev) => this._onSortItemList(ev));
        html.find(".item-sortable").each((i, li) => {
            li.addEventListener("dragstart", (ev) => this._onDragStart(ev), false);
        });

        /// combine
        html.find("button.attack").each((i, div) => {
            //div.setAttribute("draggable", true);
            //div.addEventListener("dragstart", (ev) => this._onDragStart(ev), false);
            div.addEventListener("click", (ev) => this._onMakeAttack(ev), false);
        });
        html.find("#fullAttack").on("click", (ev) => this._onMakeAttack(ev, Attack.TYPES.FULL_ATTACK));
        // A plain click now opens the same "Attack with Bonus" dialog the right-click context
        // menu already offers (Attack/Damage Bonus + Normal/Advantage/Disadvantage) — that's
        // the primary way to add a situational modifier or roll with advantage/disadvantage,
        // not an opt-in extra. Ctrl/Alt-held click stays as a fast-path that skips the dialog
        // and rolls immediately with Advantage/Disadvantage, for a quick reroll.
        html.find('[data-action="singleAttack"]').on("click", (ev) => {
            if (ev.ctrlKey || ev.metaKey || ev.altKey) {
                return this._onMakeAttack(ev);
            }
            return attackOptions(this.actor)[0].callback(ev.currentTarget);
        });
        ///


        html.find("#selectWeight").on("click", () => this._unavailable());
        html.find("#selectHeight").on("click", () => this._unavailable());

        html.find(".rollAbilities").on("click", async event => this._selectAttributeScores(event, this, {}, true));
        html.find(".assignStandardArray").on("click", async event => this._selectAttributeScores(event, this, CONFIG.SWSE.Abilities.standardScorePackage, false));
        html.find(".assignAttributePoints").on("click", event => this._assignAttributePoints(event, this));
        //html.find(".assignManual").on("click", async event => this._selectAttributesManually(event, this));
        //html.find(".assignSemiManual").on("click", async event => this._selectAttributesManually(event, this));
        html.find(".leveledAttributeBonus").each((i, button) => {
            button.addEventListener("click", (event) => this._selectAttributeLevelBonuses(event, this));
        })

        //TODO merge these using data-action and data-type
        // Add Inventory Item
        html.find('.item-create').click(this._onItemCreate.bind(this));
        // Delete Inventory Item
        html.find('.item-delete').click(this._onItemDelete.bind(this));
        html.find('.item-duplicate').click(this._onDuplicate.bind(this))

        // Rollable abilities.
        html.find('.rollable').click(this._onRoll.bind(this));
        html.find('[data-action="roll-with-bonus-toggle"]').click(this._onRollWithBonusToggle.bind(this));
        // _onToggleSecondWind is already a generic "write this checkbox's checked state to
        // data-name" handler despite its name — reused as-is rather than duplicating it.
        html.find('[data-action="toggle-roll-bonus-prompt"]').click(this._onToggleSecondWind.bind(this));

        //html.find('[data-action="compendium"]').click(this._onOpenCompendium.bind(this));
        html.find('[data-action="compendium"]').click(SWSECompendiumDirectory.viewCompendiumItemsByFilter.bind(this));
        html.find('[data-action="compendium-web"]').click((e) => {
            let target = e.currentTarget
            let type = target.dataset.type
            let providerSource = target.dataset.providerSource
            if (type) {
                type = type.split(",").map(t => t.trim())
            }
            let webFilters = {};

            if (providerSource) {
                webFilters['provider-filter'] = providerSource
            }

            new CompendiumWeb({type, webFilters}).render(!0)
        });
        html.find('[data-action="view"]').click(this._onItemEdit.bind(this));
        html.find('[data-action="delete"]').click(this._onItemDelete.bind(this));
        html.find('[data-action="credit"]').click(this._onCredit.bind(this));
        html.find('[data-action="shield"]').click(this._onShield.bind(this));
        html.find('[data-action="decrease-quantity"]').click(this._onDecreaseItemQuantity.bind(this));
        html.find('[data-action="increase-quantity"]').click(this._onIncreaseItemQuantity.bind(this));
        html.find('[data-action="toggle-use"]').click(this._onToggleUse.bind(this));
        html.find('[data-action="equip"]').click(this._onEquipToggle.bind(this));
        html.find('[data-action="cycle-slot-type"]').click(this._onCycleSlotType.bind(this));
        html.find('[data-action="toggle-integrated"]').click(this._onToggleIntegrated.bind(this));
        html.find('[data-action="add-custom-attack"]').click(this._onAddCustomAttack.bind(this));
        html.find('[data-action="edit-custom-attack"]').click(this._onEditCustomAttack.bind(this));
        html.find('[data-action="delete-custom-attack"]').click(this._onDeleteCustomAttack.bind(this));
        html.find('[data-action="combat-toggle"]').click(this._onCombatToggle.bind(this));
        html.find('[data-action="ability-override"]').on("change", this._onAbilityOverrideChange.bind(this));
        html.find('[data-action="damage-ability-override"]').on("change", this._onDamageAbilityOverrideChange.bind(this));
        html.find('[data-action="hands-override"]').on("change", this._onHandsOverrideChange.bind(this));
        html.find('[data-action="toggle-second-wind"]').click(this._onToggleSecondWind.bind(this));
        // First Aid uses the same generic "write this checkbox to data-name" behaviour;
        // it previously had no handler at all, so its pips silently never persisted.
        html.find('[data-action="long-rest"]').click(this._onLongRest.bind(this));
        html.find('[data-action="first-aid"]').click(this._onFirstAid.bind(this));
        html.find('[data-action="end-of-combat"]').click(this._onEndOfCombat.bind(this));
        // Runs before the form's own change handler, so a clamped value is what gets submitted.
        html.find('input.defense-assign').on("change", this._onDefensePointChange.bind(this));
        // Classes tab: manual per-level HP entry (the Roll/Average buttons reuse .rollable below).
        html.find('input[data-action="update-level-attribute"]').on("change", this._performItemAction.bind(this));
        html.find('[data-action="create"]').click(this._onCreateNewItem.bind(this));
        html.find('[data-action="quickCreate"]').on("keyup", this._onQuickCreate.bind(this));
        html.find('[data-action="to-chat"]').click(this._onToChat.bind(this));
        html.find('[data-action="change-control"]').click(onChangeControl.bind(this));
        html.find('[data-action="age"]').on("click", event => this._selectAge(event, this));

        html.find('[data-action="level-up-bonus"]').click(this._onAddLevelUpBonus.bind(this));
        html.find('[data-action="effect-control"]').click(onEffectControl.bind(this));
        html.find('[data-action="gender"]').on("click", event => this._selectGender(event, this));
        html.find('[data-action="remove-class-level"]').on("click", event => this.removeClassLevel(event, this));

        //item actions
        html.find('[data-action="create-follower"]').click(this._onCreateFollower.bind(this));
        html.find('[data-action="open-actor"]').click(this._onOpenActor.bind(this));
        html.find('[data-action="block"]').click(this._onBlockDeflect.bind(this));
        html.find('[data-action="deflect"]').click(this._onBlockDeflect.bind(this));
        html.find('[data-action="reset-deflection-count"]').click(this.resetDeflection.bind(this));



        //CLEANUP PROMPTS
        html.find('[data-action="remove-leaked-level-effects"]').click((e) => {
            Dialog.prompt({
                title: 'Are you sure you want to perform this cleanup?',
                content: 'A long lived bug was creating additional copies of level effects.  There should be no reason to keep these unless you are doing custom scripting around them.',
                callback: () => {
                    const effectIds = this.object.effects.filter(effect => effect.flags.swse.isLevel).map(effect => effect.id)
                    this.object.deleteEmbeddedDocuments("ActiveEffect", effectIds);
                }
            })
        });
        html.find('[data-action="remove-fire-mode-effects"]').click((e) => {
            Dialog.prompt({
                title: 'Are you sure you want to perform this cleanup?',
                content: 'A long lived bug was creating additional copies of Fire Mode effects.  There should be no reason to keep these unless you are doing custom scripting around them.',
                callback: () => {
                    const effectIds = this.object.effects.filter(effect => effect.flags.swse.group === "Fire Mode").map(effect => effect.id)
                    this.object.deleteEmbeddedDocuments("ActiveEffect", effectIds);
                }
            })
        });
        html.find('[data-action="remove-vehicleBaseType"]').click(async (e) => {
            let items = this.object.itemTypes['vehicleBaseType'];

            const ids = [];
            for (let item of items) {
                await this.object.applyVehicleAttributes(item);
                ids.push(item.id);

            }
            this.object.deleteEmbeddedDocuments("Item", ids);
        });

        html.find('[data-action="item-warning"]').click(async (e) => {
            let target = e.currentTarget
            let item = target.dataset.item
            this.actor.items.get(item)?.resolveWarning(e)
        })

        //html.find()
    }

    async resetDeflection(){
        const update = {"system.deflectCount": 0}
        this.object.safeUpdate(update);
    }

    async _onBlockDeflect(event){
        event.preventDefault();
        event.stopPropagation();
        const dataset = event.currentTarget.dataset

        const deflectCount = this.object.system.deflectCount || 0;

        let formula = getRollFromDataSet.call(this,{key: "@UseTheForce"})

        if(deflectCount > 0){
            formula = `${formula} - ${deflectCount * 5}`;
        }

        let roll = new Roll(formula, this.actor.system);
        const rollResult = await roll.roll();

        const context = {rollResult};
        let itemFlavor = "";
        const notes = [];
        const flavor = dataset.label

        let content = buildRollContent(formula, roll, notes, itemFlavor);
        await toChat(content, this.object, flavor, context);

        const update = {"system.deflectCount": deflectCount + 1}
        this.object.safeUpdate(update);
    }

    async _onOpenActor(event){
        event.preventDefault();
        event.stopPropagation();

        const a = event.currentTarget;
        const actorId = a.dataset.actorId;
        const actor = game.actors.get(actorId)

        actor.sheet.render(true)
    }

    async _onCreateFollower(event){
        event.preventDefault();
        event.stopPropagation();
        console.log("Create Follower");

        const a = event.currentTarget;
        const itemId = a.dataset.itemId;

        const sourceItem = this.object.items.find(item => item._id === itemId);

        const system = {
            follower: true
        };
        if(this.object.system.test) {
            system.test = true;
        }


        const follower = await SWSEActor.create({
            name: this.object.name + "'s Follower",
            type: "character",
            img: "artwork/character-profile.jpg",
            system: system
        })

        const provided = getInheritableAttribute({entity: this.object, attributeKey: "followerProvides"})

        provided.push(...getInheritableAttribute({entity: sourceItem, attributeKey: "followerCreationProvides"}))

        await follower.addProvided(provided)

        let followerTrait = (await follower.addItems({
            returnAdded: true, items: [
                {name: "Follower", type: "trait", system: {changes: [{key: "follower", value: true}]}}
            ]
        }))[0];

        await this.object.addActorLink(follower, "follower", itemId, {skipReciprocal: true});
        await follower.addActorLink(this.object, "leader", followerTrait.id, {skipReciprocal: true});

        follower.sheet.render(!event.skipRender)

        return follower;
    }




    _performItemAction(event) {
        const target = $(event.currentTarget)
        const value = event.currentTarget.value;
        const context = target.data("context")

        if (target.data("action") === "update-level-attribute") {

            this.updateItemEffectAttribute(value, target.data("item"), parseInt(target.data("level")), target.data("attribute"), context);
        }
    }

    updateItemEffectAttribute(value, itemId, level, attributeKey, context = undefined) {

        if (context === "health" && game.settings.get("swse", "enableNotificationsOnHealthChange")) {
            let content = `${game.user.name} has changed level ${level} health to ${value}`

            toChat(content, this.object)
        }

        const classObject = this.document.items.get(itemId);
        const levelEffect = classObject.level(level);
        let change = levelEffect.changes.find(change => change.key === attributeKey)
        let data = {};

        data.changes = levelEffect.changes;
        if (!change) {
            change = {key: attributeKey, mode: 2, value}
            data.changes.push(change);
        } else {
            change.value = value;
        }
        levelEffect.safeUpdate(data);
        this._render()
    }

    _onToChat(event) {
        event.preventDefault();
        event.stopPropagation();
        const a = event.currentTarget;
        const type = a.dataset.actionType;

        let content = "";
        switch (type) {
            case "defense":
                let defense = this.actor.system.defense;
                content += `<h3>Defenses</h3>`

                for (let value of Object.values(defense)) {
                    content += this.defenseToTableRow(value)
                }

                content += `<tr><th>Damage Threshold</th><td>${defense.damageThreshold.total}</td></tr>`
                content += `<tr><th>Damage Reduction</th><td>${defense.damageReduction}</td></tr>`

                let bonusString = ""
                for (let bonus of defense.situationalBonuses) {
                    bonusString += bonus;
                }

                content = `<table>${content}</table><ol>${bonusString}</ol>`

                break;
        }
        // toChat() posts silently (a sound plays, but there's no visible confirmation) — if the
        // Chat sidebar tab isn't already the active one, clicking Share looked like it did
        // nothing at all. Switch to it so the shared content is immediately visible.
        const result = toChat(content, this.object);
        ui.sidebar.activateTab("chat");
        return result;
    }


    _onCreateNewItem(event) {
        let itemType = $(event.currentTarget).data("action-type")

        this.actor.createEmbeddedDocuments('Item', [{
            name: `New ${itemType}`,
            type: itemType,
            data: getDefaultDataByType(itemType)
        }]);
    }

    _onQuickCreate(event) {
        if (!(event.code === "Enter" || event.code === "NumpadEnter")) {
            return;
        }
        event.stopPropagation();
        let element = $(event.currentTarget);
        let itemType = element.data("action-type");
        const defaultDataByType = getDefaultDataByType(itemType);

        this.actor.createEmbeddedDocuments('Item',
            getCleanListFromCSV(element[0].value).map(name => {
                return {
                    name: name,
                    type: itemType,
                    data: defaultDataByType
                }
            }));
    }

    _onCredit(event) {
        let type = $(event.currentTarget).data("action-type")

        if ('add' === type || 'sub' === type) {
            addSubCredits(type, this.actor);
        } else if ('transfer' === type) {
            transferCredits(this.actor);
        }
    }

    async _onShield(event) {
        event.stopPropagation();
        const type = $(event.currentTarget).data("action-type");
        switch (type) {
            case 'plus':
                this.object.changeShields(5);
                break;
            case 'minus':
                this.object.changeShields(-5);
                break;
            case 'toggle':
                let ids = this.object.effects
                    .filter(effect => effect.icon?.includes("/shield.svg")).map(effect => effect.id)
                if (ids.length === 0) {
                    let statusEffect = CONFIG.statusEffects.find(e => e.id === "shield")
                    await this.object.activateStatusEffect(statusEffect);
                } else {
                    await this.object.deleteEmbeddedDocuments("ActiveEffect", ids);
                }
                break;
        }
    }

    _onDuplicate(event) {
        const li = $(event.currentTarget).parents(".item");
        let itemToDuplicate = this.object.items.get(li.data("itemId"));

        this._onDropItem(event, {item: itemToDuplicate, duplicate: true})
    }

    /** @inheritdoc */
    _onDragStart(event) {
        super._onDragStart(event);
        let dragData = JSON.parse(event.dataTransfer.getData("text/plain") || "{}");

        const elem = event.currentTarget;

        dragData.variable = elem.dataset.variable;
        dragData.label = elem.dataset.label;
        dragData.uuid = elem.dataset.uuid
        if (elem.dataset.data) {
            dragData.data = JSON.parse(elem.dataset.data)
        }

        if (elem.dataset.type && !dragData.type) {
            dragData.type = elem.dataset.type
        }

        if(elem.dataset.attackKey){
            dragData.attackKeys = [elem.dataset.attackKey]
        } else if(elem.dataset.attackKeys){
            dragData.attackKeys = elem.dataset.attackKeys
        }
        dragData.img = elem.dataset.img;
        dragData.itemId = elem.dataset.itemId;
        dragData.providerId = elem.dataset.providerId;
        dragData.actorId = this.actor.id;
        dragData.actorName = this.actor.name;
        dragData.attacks = elem.dataset.attacks ? JSON.parse(unescape(elem.dataset.attacks)) : [];
        if (this.actor.isToken) {
            dragData.sceneId = canvas.scene.id;
            dragData.tokenId = this.actor.token.id;
        }

        if (dragData.attacks.length > 0) {
            dragData.type = 'attack';
        }

        dragData.sourceContainer = getParentByHTMLClass(event, "item-container");
        dragData.draggableId = event.target.id;


        if (elem.dataset.effectId) {
            dragData.effectId = elem.dataset.effectId
            dragData.effectUuid = elem.dataset.uuid
            dragData.type = "ActiveEffect";
        }

        event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
    }

    _onDragOver(ev) {
        ev.preventDefault();
        ev.dataTransfer.dropEffect = "move";
    }

    _onDragEndMovable(ev) {
        ev.preventDefault();
        // Get the id of the target and add the moved element to the target's DOM
        const data = JSON.parse(ev.dataTransfer.getData("text/plain"));
        if (ev.target.children.length === 0 && ev.target.classList.contains("container")) {
            ev.target.appendChild(document.getElementById(data.draggableId));
        }
    }

    async _selectAge(event, sheet) {
        let options = this.buildAgeDialog(sheet);
        await Dialog.prompt(options);
    }

    async _selectGender(event, sheet) {
        let options = this.buildGenderDialog(sheet);
        await Dialog.prompt(options);
    }

    buildAgeDialog(sheet) {
        let age = sheet.actor.system.details.age ? parseInt(sheet.actor.system.details.age) : 0;
        let ageEffects = filterItemsByTypes(sheet.actor.items.values(), ["trait"])
            .map(trait => {
                //let prereqs = trait.system.prerequisite.filter(prereq => );
                let prereq = this._prerequisiteHasTypeInStructure(trait.system.prerequisite, 'AGE')
                if (prereq) {
                    return {
                        name: trait.name,
                        low: parseInt(prereq.low),
                        high: prereq.high ? parseInt(prereq.high) : -1,
                        text: prereq.text
                    }
                }
                return undefined;
            }).filter(trait => !!trait)

        ageEffects.sort(
            (a, b) => a.low - b.low);

        let traits = '';
        for (let effect of ageEffects) {
            let current = age >= effect.low && (age <= effect.high || effect.high === -1) ? ' current' : '';
            traits += `<div class="flex-grow ageRange${current}" data-low="${effect.low}" data-high="${effect.high}">${effect.name}: ${effect.text}</div>`;
        }
        if (traits === '') {
            traits = `<div>This species has no traits related to age.</div>`;
        }
        let content = `<p>Enter your age. Adults have no modifiers:</p><input class="range" id="age" placeholder="Age" type="number" value="${age}"/><div>${traits}</div>`

        return {
            title: "Age Selection",
            content: content,
            callback: async (html) => {
                let key = html.find("#age")[0].value;
                sheet.object.setAge(key);
            },
            render: async (html) => {
                let ageInput = html.find("#age");
                this.moveAgeCursor(html);
                ageInput.on("input", () => {
                    this.moveAgeCursor(html);
                })
            }
        };
    }


    buildGenderDialog(sheet) {
        let sex = sheet.actor.system.details.sex ? sheet.actor.system.details.sex : "";
        let gender = sheet.actor.system.details.gender ? sheet.actor.system.details.gender : "";
        let searchString = "GENDER";
        let genderEffects = filterItemsByTypes(sheet.actor.items.values(), ["trait"])
            .filter(trait => this._prerequisiteHasTypeInStructure(trait.system.prerequisite, searchString)).map(trait => {
                let prerequisite = this._prerequisiteHasTypeInStructure(trait.system.prerequisite, searchString)

                return {
                    gender: prerequisite.text,
                    name: trait.data.finalName
                }
            })

        genderEffects.sort(
            (a, b) =>
                a.gender <
                b.gender ? 1 : -1);

        let traits = '';
        for (let effect of genderEffects) {
            let current = gender.toLowerCase() === effect.gender ? ' current' : '';
            traits += `<div class="flex-grow gender${current}" data-gender="${effect.gender}" >${effect.gender}: ${effect.name}</div>`;
        }
        if (traits === '') {
            traits = `<div>This species has no traits related to sex.</div>`;
        }

        let content = `<p>Enter your sex, some species have traits tied to sex.  Optionally, enter your gender. If included it will be displayed throughout your sheet instead of sex.</p>
<input class="range" id="sex" type="text" placeholder="Sex" value="${sex}">
<input class="range" id="gender" type="text" placeholder="Gender" value="${gender}">
<div>${traits}</div>`

        return {
            title: "Gender Selection",
            content: content,
            callback: async (html) => {
                sheet.actor.setGender(html.find("#sex")[0].value, html.find("#gender")[0].value);
            },
            render: async (html) => {
                let genderInput = html.find("#sex");
                this.moveGenderCursor(html);
                genderInput.on("input", () => {
                    this.moveGenderCursor(html);
                })
            }
        };
    }

    moveAgeCursor(html) {
        let age = parseInt(html.find("#age")[0].value);
        let rangeDivs = html.find(".ageRange")
        for (let div of rangeDivs) {
            let low = parseInt($(div).data("low"));
            let high = parseInt($(div).data("high"));

            if (div.classList.contains("cursor")) {
                div.classList.remove("cursor")
            }
            if (age >= low && (age <= high || high === -1)) {
                div.classList.add("cursor")
            }
        }
    }

    moveGenderCursor(html) {
        let gender = html.find("#sex")[0].value;
        let rangeDivs = html.find(".gender")
        for (let div of rangeDivs) {
            if (div.classList.contains("cursor")) {
                div.classList.remove("cursor")
            }
            if (gender.toLowerCase() === $(div).data('gender').toLowerCase()) {
                div.classList.add("cursor")
            }
        }
    }

    getPointBuyTotal() {
        game.settings.get("swse", "homebrewAdjustPointBuy")

        if (this.actor.isDroid) {
            return game.settings.get("swse", "homebrewAdjustPointBuyDroid") ?? CONFIG.SWSE.Abilities.droidPointBuyTotal;
        }
        return game.settings.get("swse", "homebrewAdjustPointBuy") ?? CONFIG.SWSE.Abilities.defaultPointBuyTotal;
    }

    updateTotal(html) {
        let values = this.getTotal(html);

        html.find(".adjustable-total").each((i, item) => {
            item.innerHTML = values.total
        })
        html.find(".attribute-total").each((i, item) => {
            let att = item.dataset.attribute
            item.innerHTML = parseInt(values[att]) + parseInt(item.dataset.bonus);
        })
    }

    getTotal(html) {
        let abilityCost = CONFIG.SWSE.Abilities.abilityCost;
        let response = {};
        let total = 0;
        html.find(".adjustable-value").each((i, item) => {
            total += abilityCost[item.innerHTML];
            response[item.dataset["label"]] = item.innerHTML;
        })
        response.total = total;
        return response;
    }

//TODO WTF
//     _updateObject(event, formData) {
//         // Update from elements with 'data-name'
//         {
//             const elems = this.element.find("*[data-name]");
//             let changedData = {};
//             for (const el of elems) {
//                 const name = el.dataset.name;
//                 let value;
//                 if (el.nodeName === "INPUT") {
//                     switch (el.type) {
//                         case "checkbox":
//                             value = el.checked;
//                             break;
//                         default:
//                             value = el.value;
//                     }
//                 } else if (el.nodeName === "SELECT") value = el.options[el.selectedIndex].value;
//
//                 if (el.dataset.dtype === "Number") value = Number(value);
//                 else if (el.dataset.dtype === "Boolean") value = Boolean(value);
//
//                 if (foundry.utils.getProperty(this.actor, name) !== value) {
//                     changedData[name] = value;
//                 }
//             }
//
//             for (let [k, v] of Object.entries(changedData)) {
//                 formData[k] = v;
//             }
//         }
//
//         // Add pending updates
//         for (let [k, v] of Object.entries(this._pendingUpdates)) {
//             formData[k] = v;
//         }
//         this._pendingUpdates = {};
//
//         return super._updateObject(event, formData);
//     }

    _updateObject(event, formData){
        return super._updateObject(event, formData);
    }

    async _onChangeInput(event) {
        let element = $(event.currentTarget);
        let action = element.data("action");
        ///should we skip letting the sheet acknowledge the change?
        if(["effect-control"].includes(action)){
            return;
        }

        super._onChangeInput(event);
    }

    _adjustActorPropertyBySpan(event) {
        event.preventDefault();
        event.stopPropagation();
        const el = event.currentTarget;

        this._mouseWheelAdd(event.originalEvent, el);
        const value = el.tagName.toUpperCase() === "INPUT" ? Number(el.value) : Number(el.innerText);

        let name = el.getAttribute("name");
        if (el.dataset.name) {
            name = el.dataset.name;
        }

        if (name) {
            let updateTarget = this.actor;
            if (el.dataset.item) {
                updateTarget = this.actor.items.get(el.dataset.item)
            }
            let data = {};
            data[name] = value;
            updateTarget.safeUpdate(data);
        }

        // Update on lose focus
        if (event.originalEvent instanceof MouseEvent) {
            if (!this._submitQueued) {
                $(el).one("mouseleave", (event) => {
                    this._onSubmit(event);
                });
            }
        } else this._onSubmit(event);
    }

    _adjustItemAttributeBySpan(event) {
        event.preventDefault();
        event.stopPropagation();
        const el = event.currentTarget;

        this._mouseWheelAdd(event.originalEvent, el);
        const value = el.tagName.toUpperCase() === "INPUT" ? Number(el.value) : Number(el.innerText);

        // let name = el.getAttribute("name");
        // if (el.dataset.name) {
        //     name = el.dataset.name;
        // }
        let item = el.getAttribute("item");
        if (el.dataset.item) {
            item = el.dataset.item;
        }
        let itemAttribute = el.getAttribute("itemAttribute");
        if (el.dataset.itemAttribute) {
            itemAttribute = el.dataset.itemAttribute;
        }

        if (item) {
            let updateTarget = this.actor.items.get(item);
            updateTarget.setAttribute(itemAttribute, value);
        }

        // Update on lose focus
        if (event.originalEvent instanceof MouseEvent) {
            if (!this._submitQueued) {
                $(el).one("mouseleave", (event) => {
                    this._onSubmit(event);
                });
            }
        } else this._onSubmit(event);
    }

    _mouseWheelAdd(event, el) {
        const isInput = el.tagName.toUpperCase() === "INPUT";

        if (event && event instanceof WheelEvent) {
            const value = (isInput ? parseFloat(el.value) : parseFloat(el.innerText)) || 0;
            if (Number.isNaN(value)) return;

            const increase = -Math.sign(event.deltaY);
            const amount = parseFloat(el.dataset.wheelStep) || 1;

            if (isInput) {
                el.value = value + amount * increase;
            } else {
                el.innerText = (value + amount * increase).toString();
            }
        }
    }

    async _onDropActor(event, data) {
        event.preventDefault();
        event.stopPropagation();
        if (!this.actor.isOwner) return false;

        if (!vehicleActorTypes.includes(this.actor.type)) {
            return;
        }
        let actor = fromUuidSync(data.uuid);
        if (!characterActorTypes.includes(actor.type)) {
            return;
        }
        let targetItemContainer = getParentByHTMLClass(event, "vehicle-station");

        if (targetItemContainer === null) {
            return;
        }

        const position = $(targetItemContainer).data('position');
        const slot = $(targetItemContainer).data('slot');
        if (!position) {
            console.error("no position associated with the activated crew slot")
            return;
        }

        if (position === 'Astromech Droid') {
            if (actor.species.name !== 'Astromech Droid' && actor.species.name !== '2nd-Degree Droid Model') {
                this.onlyAllowsAstromechsDialog();
                return;
            }
        }

        //if (!this.object.crewMembers.find(crewMember => crewMember.position === postion && crewMember.slot === slot)) {
        //await this.removeCrewFromPositions(actor, actor.id, crewPositions);
        //await this.object.removeActorLink(actor)
        await this.object.addActorLink(actor, position, slot);
        //}
    }

    async _onDropItem(ev, data) {
        if (ev) ev.preventDefault();
        if (!this.actor.isOwner) return false;

        if(ev){
            //first check if the item being dropped is dropped on an item on the list.
            const itemOnSheet = getParentByHTMLClass(ev, "acceptsTemplates")
            if(itemOnSheet){
                const item = this.object.items.get(itemOnSheet.dataset.itemId);
                const response = await item.handleDroppedItem(data, {silent: true});
                if(response.success){
                    return true; //make this return the modified items
                }
            }
        }



        //the dropped item has an owner
        if (data.actorId) {
            if (data.actorId === this.actor.id) {
                await this.moveExistingItemWithinActor(data, ev);
                return true; //make this return the modified items
            } else {
                //TODO implement logic for dragging to another character sheet
                let sourceActor = game.actors.find(actor => actor.id === data.actorId);
                const itemId = data.itemId;
                data = sourceActor.items.contents.find(i => i.id === itemId)

                await sourceActor.removeItem(itemId)
            }
        }

        if(data.modifier){
            let toks = data.modifier.split(":");
            data[toks[0]] = toks[1];
        }

        return await this.object.addItems({
            newFromCompendium: true,
            answers: data.answers,
            items: [data], returnAdded: true
        });
    }

    async _onDropActiveEffect(event, data) {
        let targetEffect = getParentByHTMLClass(event, "effect")
        if (targetEffect) {
            let droppedItem;
            try {
                droppedItem = JSON.parse(event.dataTransfer.getData("text/plain"));
            } catch (err) {
                console.error(`Parsing error: ${event.dataTransfer.getData("text/plain")}`)
                return false;
            }
            droppedItem.targetEffectUuid = targetEffect.dataset.uuid;
            if (droppedItem.effectUuid && droppedItem.targetEffectUuid) {
                linkEffects.call(this.item, droppedItem.effectUuid, droppedItem.targetEffectUuid);
                return false;
            }
        }


        const effect = await ActiveEffect.implementation.fromDropData(data);
        if (!this.actor.isOwner || !effect) return false;
        if (this.actor.uuid === effect.parent?.uuid) return false;
        return ActiveEffect.create(effect.toObject(), {parent: this.actor});
    }

    _onAddLevelUpBonus(event) {
        if (this.object.isHeroic) {
            this.object.addItems({items: [{name: "Heroic Ability Score Level Bonus", type: "trait"}]})
        } else {
            this.object.addItems({items: [{name: "Nonheroic Ability Score Level Bonus", type: "trait"}]})
        }
    }

    async moveExistingItemWithinActor(data, ev) {
        if (data.modId) {
            let movedItem = this.actor.items.get(data.modId);
            let parentItem = this.actor.items.get(data.itemId);
            await parentItem.revokeOwnership(movedItem);
        } else {
            //equip/unequip workflow
            let targetItemContainer = getParentByHTMLClass(ev, "item-container");

            if (targetItemContainer == null) {
                return;
            }
            const containerId = $(targetItemContainer).data("containerId");
            let itemId = data.itemId;
            let item = this.object.items.get(itemId);

            //This type does not allow weapon systems
            let equipTypes = ["equipped", "installed"];
            let weaponSystemOnlyTypes = ["pilotInstalled"];
            let gunnerPositions = this.actor.gunnerPositions || [];
            weaponSystemOnlyTypes.push(...gunnerPositions.filter(e => !!e.id).map(e => e.id).filter(unique));

            let unequipTypes = ["unequipped", "uninstalled"];


            if (unequipTypes.includes(containerId)) {
                await this.object.unequipItem(itemId, ev);
            } else if (containerId === "new-gunner") {
                if (item.system.subtype.toLowerCase() !== "weapon systems") {
                    this.onlyAllowsWeaponsDialog();
                    return;
                }
                //let types = this.object.system.equippedIds.filter(e => e.type.startsWith("gunnerInstalled")).map(e => e.type === "gunnerInstalled" ? 0 : parseInt(e.type.replace("gunnerInstalled", ""))).filter(unique);
                let types = this.object.getEquipTypes().filter(e => !!e);
                let equipType;
                for (let i = 0; i <= types.length; i++) {
                    equipType = `gunnerInstalled${i}`;
                    if (!types.includes(equipType)) {
                        break;
                    }
                }
                await this.object.equipItem(itemId, equipType, {event: ev, offerOverride: true});

            } else if (equipTypes.includes(containerId)) {
                if (item.system.subtype.toLowerCase() === "weapon systems") {
                    this.onlyAllowsWeaponsDialog(false);
                } else {
                    await this.object.equipItem(itemId, containerId, {event: ev});
                }
            } else if (weaponSystemOnlyTypes.includes(containerId)) {
                if (item.system.subtype.toLowerCase() === "weapon systems") {
                    await this.object.equipItem(itemId, containerId, {event: ev, offerOverride: true});
                } else {
                    this.onlyAllowsWeaponsDialog();
                }
            } else {
                //ui.notifications.
                console.warn(`${containerId} is an unknown equip type`)
            }
        }
    }


    /* -------------------------------------------- */

    /**
     * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
     * @param {Event} event   The originating click event
     * @private
     */
    _onItemCreate(event) {
        event.preventDefault();
        event.stopPropagation();

        const header = event.currentTarget;
        // Get the type of item to create.
        const type = header.dataset.type;
        // Grab any data associated with this control.
        const data = foundry.utils.duplicate(header.dataset);
        // Initialize a default name.
        const name = `New ${type.capitalize()}`;
        // Prepare the item object.
        const itemData = {
            name: name,
            type: type,
            system: data
        };
        // Remove the type from the dataset since it's in the itemData.type prop.
        delete itemData.data["type"];

        // Finally, create the item!
        return this.actor.createEmbeddedDocuments('Item', [itemData]);
    }

    /**
     * Handle clickable rolls.
     * @param {Event} event   The originating click event
     * @private
     */
    async _onRoll(event) {
        event.preventDefault();
        event.stopPropagation();
        const element = event.currentTarget;

        const dataset = element.dataset;
        dataset.type;  //lets you know if it's a roll for a thing
        const item = dataset.item || dataset.itemId; //lets you know if there's an item aassociated with the roll.
        const level = dataset.level;
        const context = dataset.context
        const changeKey = dataset.itemAttribute;
        const name = dataset.name;
        const variable = dataset.key || dataset.variable
        const rawFormula = getRollFromDataSet.call(this, dataset);

        if (!rawFormula) return;
        let label = getLabelFromDataSet.call(this, dataset);
        let notes = getNotesFromDataSet.call(this, dataset);

        // Ctrl/Cmd-click for Advantage, Alt-click for Disadvantage — same fast-path modifier
        // keys as the Attack roll button/BAB/Grapple badges. Only meaningful for d20-based
        // rolls (skills etc.); non-d20 rolls sharing this generic handler just ignore it since
        // applyRollMode only rewrites a leading "1d20".
        const advantageMode = (event.ctrlKey || event.metaKey) ? "advantage" : event.altKey ? "disadvantage" : undefined;

        let flavor = label ? `${this.object.name} rolls for ${label}!` : '';
        if (advantageMode && rawFormula.trim().startsWith("1d20")) {
            flavor += advantageMode === "advantage" ? " (Advantage)" : " (Disadvantage)";
        }

        let exceptionalSkills = getInheritableAttribute({entity: this.object, attributeKey: "exceptionalSkill", reduce:"VALUES_TO_LOWERCASE"})

        const exceptionalSkill = exceptionalSkills.includes(label)

        // Homebrew skill substitution: a talent/feat may let another skill's modifier stand in for
        // this one, usually only for SOME uses of it, so ask rather than assume. "Always"
        // substitutions are already baked into the skill's value in skills.mjs and never reach here.
        const substitutions = (this.object.getSkillSubstitutions?.(label) || []).filter(s => !s.always);
        if (substitutions.length) {
            const chosen = await this.#promptSkillSubstitution(label, substitutions);
            if (chosen === null) return;      // cancelled
            if (chosen) {
                // Skills are keyed by display name ("Use the Force"), so match case-insensitively.
                const skills = this.object.system.skills || {};
                const key = Object.keys(skills).find(k => k.toLowerCase() === chosen.toLowerCase());
                const sub = key ? skills[key] : undefined;
                if (sub && typeof sub.value === "number") {
                    return this.#rollSubstitutedSkill(sub, chosen, label, advantageMode);
                }
            }
        }

        for (let formula of rawFormula.split(",")) {

            if (!!variable && variable.startsWith('@initiative') && game.combat) {
                await this.object.rollInitiative({
                    createCombatants: false,
                    rerollInitiative: true
                    //,initiativeOptions: {formula: formula}
                })

                return;
            }

            formula = formula.trim().startsWith("1d20") ? applyRollMode(formula, advantageMode) : formula;

            let roll = new Roll(formula, this.actor.system);
            await roll.roll();
            if(exceptionalSkill){
                for (const die of roll.dice) {
                    if(die.faces === 20 && die.total > 1 && die.total < 8){
                        const difference = 8 - die.total
                        roll._total = roll._total + difference;
                        die.results = [{result:8, active: true}]
                        notes.push("Exceptional Skill")
                    }
                }
            }

            if (changeKey) {
                if (item && level) {
                    this.updateItemEffectAttribute(roll.total, item, parseInt(level), changeKey, context);
                } else if (item) {
                    let updateTarget = this.actor.items.get(item);
                    updateTarget.setAttribute(changeKey, roll.total);
                }
            } else if (name) {
                let updateCandidate = this.actor;
                if (item) {
                    updateCandidate = this.actor.items.get(item);
                }

                const newVar = {};
                newVar[name] = roll.total;
                updateCandidate.safeUpdate(newVar);
            } else {
                const context = {rollResult: roll};
                let itemFlavor = "";
                if (item) {
                    let activeItem = this.actor.items.get(item);
                    if(activeItem) {
                        itemFlavor = activeItem.getRollFlavor(roll.total);
                    }
                }

                let content = buildRollContent(formula, roll, notes, itemFlavor);
                await toChat(content, this.object, flavor, context);
            }
        }
    }

    async _onCrewControl(event) {
        event.preventDefault();
        event.stopPropagation();
        const a = event.currentTarget;

        // Delete race
        if (a.classList.contains("crew-remove")) {
            const uuid = $(a).data("uuid");
            let actor = fromUuidSync(uuid);
            await this.object.removeActorLink(actor);
        }
    }

    _onOpenCompendium(event) {
        event.preventDefault();
        event.stopPropagation();
        const a = event.currentTarget;
        const target = a.dataset.actionTarget;
        let newVar = game.packs.filter(pack => pack.collection.startsWith(target))[0];
        //console.log(newVar)
        newVar.render(true);
    }

    /**
     * Handle deleting an existing Owned Item for the Actor
     * @param {Event} event   The originating click event
     * @private
     */
    async _onItemDelete(event) {
        event.preventDefault();
        event.stopPropagation();
        const button = event.currentTarget;
        if (button.disabled) return;

        let itemId = event.currentTarget.dataset.itemId
        if (!itemId) {
            const li = event.currentTarget.closest(".item");
            itemId = li.dataset.itemId;
        }
        let itemToDelete = this.actor.items.get(itemId);
        if (game.keyboard.downKeys.has("Shift")) {
            await this.object.removeItem(itemId);
        } else {
            button.disabled = true;

            let title = `Are you sure you want to delete ${itemToDelete.finalName}`;
            await Dialog.confirm({
                title: title,
                content: title,
                yes: async () => {
                    await this.object.removeItem(itemId);
                    button.disabled = false
                },
                no: () => (button.disabled = false),
            });
        }
    }

    async removeClassLevel(event, sheet) {
        event.preventDefault();
        event.stopPropagation();
        const button = event.currentTarget;
        if (button.disabled) return;

        const li = $(button).closest(".item");

        let itemId = li.data("itemId");
        let itemToDelete = this.actor.items.get(itemId);
        if (game.keyboard.downKeys.has("Shift") || game.keyboard.downKeys.has("ShiftLeft")) {
            await this.object.removeClassLevel(itemId);
        } else {
            button.disabled = true;

            let title = `Are you sure you want to delete ${itemToDelete.finalName}`;
            await Dialog.confirm({
                title: title,
                content: title,
                yes: async () => {
                    await this.object.removeClassLevel(itemId);
                    button.disabled = false
                },
                no: () => (button.disabled = false),
            });
        }
    }

    /**
     * Handle editing an existing Owned Item for the Actor
     * @param {Event} event   The originating click event
     * @private
     */
    _onItemEdit(event) {
        event.preventDefault();
        event.stopPropagation();
        let itemId = event.currentTarget.dataset.itemId
        if (!itemId) {
            const li = event.currentTarget.closest(".item");
            itemId = li.dataset.itemId;
        }
        const item = this.actor.items.get(itemId);
        item.sheet.render(true);
    }

    _onDecreaseItemQuantity(event) {
        event.preventDefault();
        event.stopPropagation();
        let itemId = event.currentTarget.dataset.itemId
        if (!itemId) {
            const li = event.currentTarget.closest(".item");
            itemId = li.dataset.itemId;
        }
        const item = this.actor.items.get(itemId);
        item.decreaseQuantity();
    }

    _onIncreaseItemQuantity(event) {
        event.preventDefault();
        event.stopPropagation();
        let itemId = event.currentTarget.dataset.itemId
        if (!itemId) {
            const li = event.currentTarget.closest(".item");
            itemId = li.dataset.itemId;
        }
        const item = this.actor.items.get(itemId);
        item.increaseQuantity();
    }

    _onToggleUse(event) {
        event.preventDefault();
        event.stopPropagation();
        let toggle = event.currentTarget.checked
        let key = event.currentTarget.dataset.name
        const li = event.currentTarget.closest(".item");
        const item = this.actor.items.get(li.dataset.itemId);
        item.toggleUse(key, toggle)
    }

    /**
     * Equipment tab: the compact per-row equip toggle, replacing the old drag-between-panels
     * flow as the primary way to equip/unequip (drag still works too, unchanged).
     */
    _onEquipToggle(event) {
        event.preventDefault();
        event.stopPropagation();
        let itemId = event.currentTarget.dataset.itemId;
        if (!itemId) {
            const li = event.currentTarget.closest(".item");
            itemId = li.dataset.itemId;
        }
        const item = this.actor.items.get(itemId);
        // Some items carry the literal string "unequipped" rather than null/"" for their
        // unequipped state, which is truthy in JS — check the actual value, not truthiness.
        if (item.system.equipped === "equipped") {
            this.actor.unequipItem(itemId);
        } else {
            this.actor.equipItem(itemId, "equipped", {event});
        }
    }

    /**
     * Equipment tab: cycles an item's Light/Kit slot category (none -> Light -> Kit -> none).
     * Writes the lightSlotCost/kitSlotCost change directly onto this item instance — the same
     * attribute keys slots.mjs already reads, so no new schema field is needed. Auto-populated
     * items (already carrying one of these keys from the compendium) start mid-cycle.
     */
    _onCycleSlotType(event) {
        event.preventDefault();
        event.stopPropagation();
        let itemId = event.currentTarget.dataset.itemId;
        if (!itemId) {
            const li = event.currentTarget.closest(".item");
            itemId = li.dataset.itemId;
        }
        const item = this.actor.items.get(itemId);
        const existing = item.system.changes || [];
        const changes = existing.filter(c => c.key !== "lightSlotCost" && c.key !== "kitSlotCost");

        // A migrated weapon/equipment item's Light/Kit cost lives in a real typed field, not
        // system.changes — item.slotType (item.mjs) already checks that first; cycling needs to
        // match that same precedence and clear it, or a stale typed-field value keeps applying
        // underneath whatever this pushes onto changes[], silently doubling the slot cost (SUM
        // reduce adds both together).
        const currentType = item.slotType;
        const updateData = {"system.changes": changes};
        if (item.system.lightSlotCost) updateData["system.lightSlotCost"] = null;
        if (item.system.kitSlotCost) updateData["system.kitSlotCost"] = null;

        if (currentType === null) {
            changes.push({mode: 2, value: 1, key: "lightSlotCost"});
        } else if (currentType === "light") {
            changes.push({mode: 2, value: 1, key: "kitSlotCost"});
        }
        // else was Kit -> cycles back to none (already stripped/cleared above)

        item.safeUpdate(updateData);
    }

    /**
     * Equipment tab: toggles an item as "Integrated" (surgically built-in rather than just
     * carried) — doubles that item's own Light/Kit slot cost (slots.mjs reads slotCostMultiplier
     * per-item). Same direct-write-to-changes pattern as _onCycleSlotType, no schema field needed.
     */
    _onToggleIntegrated(event) {
        event.preventDefault();
        event.stopPropagation();
        let itemId = event.currentTarget.dataset.itemId;
        if (!itemId) {
            const li = event.currentTarget.closest(".item");
            itemId = li.dataset.itemId;
        }
        const item = this.actor.items.get(itemId);
        const existing = item.system.changes || [];
        const isIntegrated = existing.some(c => c.key === "slotCostMultiplier");
        const changes = existing.filter(c => c.key !== "slotCostMultiplier");

        if (!isIntegrated) {
            changes.push({mode: 2, value: 2, key: "slotCostMultiplier"});
        }

        item.safeUpdate({"system.changes": changes});
    }

    /**
     * Attacks panel: opens a dialog to define a new custom attack that isn't tied to any
     * equipped item (e.g. Grapple) — persisted on the actor (system.customAttacks), wrapped by
     * CustomAttackItem (custom-attack-item.mjs) so it flows through the same Attack pipeline —
     * bonuses, advantage/disadvantage, etc. — as a real weapon.
     */
    async _onAddCustomAttack(event) {
        event.preventDefault();
        event.stopPropagation();
        await this._customAttackDialog();
    }

    /**
     * Attacks panel: edits an existing custom attack (click its name).
     */
    async _onEditCustomAttack(event) {
        event.preventDefault();
        event.stopPropagation();
        const attackKey = event.currentTarget.dataset.attackKey;
        const id = attackKey.slice(CUSTOM_ATTACK_PREFIX.length);
        const existing = (this.actor.system.customAttacks || []).find(c => c.id === id);
        if (!existing) return;
        await this._customAttackDialog(existing);
    }

    /**
     * Attacks panel: deletes a custom attack.
     */
    async _onDeleteCustomAttack(event) {
        event.preventDefault();
        event.stopPropagation();
        const attackKey = event.currentTarget.dataset.attackKey;
        const id = attackKey.slice(CUSTOM_ATTACK_PREFIX.length);
        const customAttacks = (this.actor.system.customAttacks || []).filter(c => c.id !== id);
        await this.actor.safeUpdate({"system.customAttacks": customAttacks});
    }

    /**
     * Shared add/edit dialog for a custom attack. `existing` present edits that entry in place;
     * absent creates a new one with a fresh id.
     */
    async _customAttackDialog(existing) {
        const abilities = [
            {value: "", label: "Auto (Strength/Dexterity)"},
            {value: "str", label: "Strength"},
            {value: "dex", label: "Dexterity"},
            {value: "con", label: "Constitution"},
            {value: "int", label: "Intelligence"},
            {value: "wis", label: "Wisdom"},
            {value: "cha", label: "Charisma"}
        ];
        const abilityOptions = abilities.map(a => `<option value="${a.value}" ${existing?.ability === a.value ? "selected" : ""}>${a.label}</option>`).join("");

        const content = `<div>
    <div class="medium labeled-input">
        <label for="custom-attack-name" class="text">Name</label>
        <input class="input" id="custom-attack-name" type="text" value="${existing?.name || "Grapple"}" autofocus/>
    </div>
    <div class="medium labeled-input">
        <label for="custom-attack-ability" class="text">Ability</label>
        <select class="input" id="custom-attack-ability">${abilityOptions}</select>
    </div>
    <div class="medium labeled-input">
        <label for="custom-attack-damage-die" class="text">Damage Die</label>
        <input class="input" id="custom-attack-damage-die" type="text" value="${existing?.damageDie || ""}" placeholder="blank = natural unarmed damage"/>
    </div>
    <div class="medium labeled-input">
        <label for="custom-attack-damage-type" class="text">Damage Type</label>
        <input class="input" id="custom-attack-damage-type" type="text" value="${existing?.damageType || ""}" placeholder="e.g. Bludgeoning"/>
    </div>
    <div class="medium labeled-input">
        <label class="text"><input type="checkbox" id="custom-attack-proficient" ${existing?.proficient !== false ? "checked" : ""}/> No proficiency penalty (e.g. Grapple)</label>
    </div>
    <div class="medium labeled-input">
        <label for="custom-attack-notes" class="text">Notes</label>
        <input class="input" id="custom-attack-notes" type="text" value="${existing?.notes || ""}" placeholder="optional"/>
    </div>
</div>`;

        const result = await Dialog.prompt({
            title: existing ? `Edit Custom Attack — ${existing.name}` : "Add Custom Attack",
            content,
            label: existing ? "Save" : "Add",
            callback: (html) => ({
                name: html.find("#custom-attack-name").val()?.trim() || "Custom Attack",
                ability: html.find("#custom-attack-ability").val() || "",
                damageDie: html.find("#custom-attack-damage-die").val()?.trim() || "",
                damageType: html.find("#custom-attack-damage-type").val()?.trim() || "",
                proficient: html.find("#custom-attack-proficient").is(":checked"),
                notes: html.find("#custom-attack-notes").val()?.trim() || ""
            }),
            rejectClose: false,
        });
        if (!result) return;

        const customAttacks = [...(this.actor.system.customAttacks || [])];
        if (existing) {
            const idx = customAttacks.findIndex(c => c.id === existing.id);
            if (idx >= 0) customAttacks[idx] = {...existing, ...result};
        } else {
            customAttacks.push({id: foundry.utils.randomID(), ...result});
        }
        await this.actor.safeUpdate({"system.customAttacks": customAttacks});
    }

    /**
     * Attacks panel: toggles a situational combat bonus (Sneak Attack, etc.) on/off. Persisted
     * on the actor, actor-global (governs every weapon's roll at once) — distinct from
     * `system.toggles`, which is pure UI expand/collapse state, not a roll-affecting modifier.
     */
    _onCombatToggle(event) {
        event.preventDefault();
        event.stopPropagation();
        const toggleId = event.currentTarget.dataset.toggleId;
        const current = this.actor.system.combatToggles?.[toggleId] || false;
        this.actor.safeUpdate({[`system.combatToggles.${toggleId}`]: !current});
    }

    /**
     * Attacks panel: persists a weapon's ability-override choice (Str/Dex/Wis/Cha, or a
     * lightsaber technique) directly on the item, so it's the baseline for every roll with that
     * weapon rather than a one-off dialog pick.
     */
    _onAbilityOverrideChange(event) {
        event.preventDefault();
        const itemId = event.currentTarget.dataset.itemId;
        const item = this.actor.items.get(itemId);
        if (!item) {
            return;
        }
        item.safeUpdate({"system.abilityOverride": event.currentTarget.value});
    }

    /**
     * Asks which skill to roll when a talent/feat allows a substitution. Defaults to the
     * substitute (that's why you took the talent), but the base skill stays available because most
     * substitutions only cover some applications of the skill — the scope note, where the talent
     * gives one, is shown next to the option.
     *
     * @return {Promise<string|undefined|null>} chosen substitute skill, undefined for the base
     *         skill, or null if cancelled.
     */
    async #promptSkillSubstitution(label, substitutions) {
        const name = f => `sub-${foundry.utils.randomID()}`;
        const group = name();
        const rows = [
            `<div><label><input type="radio" name="${group}" value=""/> ${titleCase(label)} <span class="notes">(normal)</span></label></div>`,
            ...substitutions.map((s, i) => {
                const scope = s.scope ? ` <span class="notes">— ${s.scope}</span>` : "";
                const src = s.sourceDescription ? ` <span class="notes">(${s.sourceDescription})</span>` : "";
                return `<div><label><input type="radio" name="${group}" value="${s.source}" ${i === 0 ? "checked" : ""}/> ${s.source}${src}${scope}</label></div>`;
            })
        ].join("");

        return Dialog.prompt({
            title: `Roll ${titleCase(label)}`,
            content: `<p>Which skill do you want to roll?</p>${rows}`,
            label: "Roll",
            callback: (html) => {
                const el = html[0] ?? html;
                const picked = el.querySelector(`input[name="${group}"]:checked`);
                return picked?.value || undefined;
            },
            rejectClose: false,
        });
    }

    /**
     * Rolls a substituted skill, labelled so the chat card says which skill actually got rolled
     * and what it stood in for.
     */
    async #rollSubstitutedSkill(subSkill, subName, targetLabel, advantageMode) {
        let formula = `1d20 + ${subSkill.value}`;
        if (advantageMode) formula = applyRollMode(formula, advantageMode);
        let flavor = `${this.object.name} rolls ${subName} for ${titleCase(targetLabel)}!`;
        if (advantageMode) flavor += advantageMode === "advantage" ? " (Advantage)" : " (Disadvantage)";
        const roll = await new Roll(formula).roll();
        return roll.toMessage({speaker: ChatMessage.getSpeaker({actor: this.object}), flavor});
    }

    /**
     * Damage-side counterpart of _onAbilityOverrideChange. Blank means "same as attack", which is
     * how the attack pipeline resolves it (see Attack##getDamageAbilityChoice).
     */
    _onDamageAbilityOverrideChange(event) {
        event.preventDefault();
        const itemId = event.currentTarget.dataset.itemId;
        const item = this.actor.items.get(itemId);
        if (!item) {
            return;
        }
        item.safeUpdate({"system.damageAbilityOverride": event.currentTarget.value});
    }

    /**
     * Attacks panel: persists a weapon's handedness choice (1H/2H), same pattern as
     * _onAbilityOverrideChange — only shown for weapons that genuinely support a choice.
     */
    _onHandsOverrideChange(event) {
        event.preventDefault();
        const itemId = event.currentTarget.dataset.itemId;
        const item = this.actor.items.get(itemId);
        if (!item) {
            return;
        }
        item.safeUpdate({"system.handsOverride": event.currentTarget.value});
    }

    _onToggleSecondWind(event) {
        event.preventDefault();
        event.stopPropagation();
        let toggle = event.currentTarget.checked
        let key = event.currentTarget.dataset.name
        let data = {};
        data[key] = toggle
        this.actor.safeUpdate(data)
        //const li = event.currentTarget.closest(".item");
        // const item = this.actor.items.get(li.dataset.itemId);
        // item.toggleUse(key, toggle)
    }

    /**
     * Homebrew: Defense points are a hard cap, unlike most of this sheet's advisory
     * limits. Clamps an assignment to the per-Defense maximum and to whatever is left
     * in that pool, correcting the input in place so the form submits the legal value.
     */
    _onDefensePointChange(event) {
        const input = event.currentTarget;
        // "level10" before "level1" in the alternation — regex tries alternatives left-to-right
        // and stops at the first match, not the longest, so against a "...level10" field name
        // "level1" (a literal prefix of "level10") would otherwise match first and silently
        // truncate the captured pool, making every level10 field get checked against the level1
        // pool's spend instead of its own.
        const match = /defensePoints\.(\w+)\.(level10|level1)/.exec(input.name || "");
        if (!match) return;

        const [, defense, pool] = match;
        const budget = this.actor.system.defense?.pointBudget ?? {};
        const perDefenseMax = budget.perDefenseMax ?? 2;
        const poolMax = (pool === "level1" ? budget.level1Max : budget.level10Max) ?? 4;

        const requested = parseInt(input.value, 10);
        let value = Number.isNaN(requested) ? 0 : Math.max(0, Math.min(perDefenseMax, requested));

        const pools = this.actor.system.defense?.defensePoints ?? {};
        const spentElsewhere = ["fortitude", "reflex", "will"]
            .filter(name => name !== defense)
            .reduce((sum, name) => sum + (pools[name]?.[pool] || 0), 0);

        const remaining = Math.max(0, poolMax - spentElsewhere);
        value = Math.min(value, remaining);

        if (value !== requested) {
            input.value = value;
            const reason = requested > perDefenseMax
                ? `no more than ${perDefenseMax} may go into a single Defense`
                : `only ${remaining} point${remaining === 1 ? "" : "s"} left in that pool`;
            ui.notifications.warn(`Defense points: ${reason}.`);
        }
    }

    /**
     * Homebrew: a long rest restores everything that refreshes daily — hit points to
     * full, Force Points to the character's per-day allotment, and Second Wind uses.
     * Destiny Points are deliberately untouched: they're a running total that is lost
     * when spent, not a daily resource.
     */
    async _onLongRest(event) {
        event.preventDefault();
        event.stopPropagation();

        const actor = this.actor;
        const confirmed = await Dialog.confirm({
            title: "Long Rest",
            content: `<p>Restore <b>${actor.name}</b> to full hit points and Force Points, and reset Second Wind uses?</p>`,
            defaultYes: true
        });
        if (!confirmed) return;

        const data = {
            "system.health.value": actor.system.health.max,
            "system.forcePoints.quantity": actor.forcePointsPerDay
        };

        for (const key of Object.keys(actor.system.toggles?.secondWinds ?? {})) {
            data[`system.toggles.secondWinds.${key}`] = false;
        }
        await actor.safeUpdate(data);
        ui.notifications.info(`${actor.name} completed a long rest.`);
    }

    /**
     * Homebrew: Force Powers' "Used?" pip refreshes at the end of combat, not daily
     * like Force Points/Second Wind, so it gets its own reset button on the Force tab.
     */
    async _onEndOfCombat(event) {
        event.preventDefault();
        event.stopPropagation();

        const actor = this.actor;
        const updates = actor.powers
            .filter(power => power.system.uses?.[0])
            .map(power => ({_id: power.id, "system.uses.0": false}));
        if (updates.length === 0) return;

        await actor.updateEmbeddedDocuments("Item", updates);
        ui.notifications.info(`${actor.name}'s Force Powers refreshed for the end of combat.`);
    }

    /**
     * Reorders the Force Powers list on drop, matching Foundry's standard item-sort idiom
     * (performIntegerSort against the target's `sort` field).
     */
    async _onSortForcePower(event) {
        return this.#sortItemWithin(event, ".force-power-sortable", (source) =>
            this.actor.powers.filter(p => p.id !== source.id));
    }

    /**
     * Same drag-to-reorder for any list rendered by item-list.hbs with `sortable=<type>`
     * (Feats, Talents). Siblings are scoped to the same data-sort-group, so reordering a feat
     * can't renumber talents rendered from the same partial on the same tab.
     */
    async _onSortItemList(event) {
        const group = event.currentTarget.dataset.sortGroup;
        return this.#sortItemWithin(event, ".item-sortable", (source) =>
            this.actor.items.filter(i => i.id !== source.id && i.type === source.type
                && (!group || i.type === group)));
    }

    /**
     * Shared drag-to-reorder: resolve the dragged + dropped-on items, then write new `sort`
     * values. Bound per-row (rather than relying on the sheet-wide drop pipeline) so
     * stopPropagation keeps a reorder from also falling through to _onDropItem's
     * compendium/equip-slot handling.
     */
    async #sortItemWithin(event, rowSelector, siblingsFor) {
        event.preventDefault();
        event.stopPropagation();

        let data;
        try {
            data = JSON.parse((event.originalEvent ?? event).dataTransfer.getData("text/plain"));
        } catch (e) {
            return;
        }
        if (data.actorId !== this.actor.id) return;

        const source = this.actor.items.get(data.itemId);
        const dropTarget = event.currentTarget.closest(rowSelector);
        const target = dropTarget ? this.actor.items.get(dropTarget.dataset.itemId) : null;
        if (!source || !target || source.id === target.id) return;
        if (source.type !== target.type) return;

        const siblings = siblingsFor(source);
        const sortUpdates = foundry.utils.performIntegerSort(source, {target, siblings});
        const updateData = sortUpdates.map(u => ({_id: u.target.id, ...u.update}));
        await this.actor.updateEmbeddedDocuments("Item", updateData);
    }

    /**
     * Homebrew: First Aid heals Healing Hit Die (the highest hit die among classes taken)
     * + Con modifier + character level, plus a GM/player-entered bonus (e.g. a skill check
     * result), capped at max HP.
     */
    async _onFirstAid(event) {
        event.preventDefault();
        event.stopPropagation();

        const actor = this.actor;
        const healingDie = actor.highestClassHitDie;
        if (!healingDie) {
            ui.notifications.warn(`${actor.name} has no class levels to determine a Healing Hit Die.`);
            return;
        }

        const bonus = await Dialog.prompt({
            title: "First Aid",
            content: `<p>Rolling ${healingDie} + Con modifier + character level. Enter any additional bonus to add on top (e.g. a skill check result):</p>
                       <input type="number" name="bonus" value="0" autofocus/>`,
            label: "Roll",
            callback: (html) => Number(html.find('[name="bonus"]').val()) || 0,
            rejectClose: false,
        });
        if (bonus === null || bonus === undefined) return;

        const roll = new Roll(`${healingDie} + @con + @level + @bonus`, {
            con: actor.system.abilities.con.mod,
            level: actor.characterLevel,
            bonus
        });
        await roll.toMessage({
            speaker: ChatMessage.getSpeaker({actor}),
            flavor: "First Aid"
        });

        const previousValue = actor.system.health.value;
        const newValue = Math.min(previousValue + roll.total, actor.system.health.max);
        await actor.safeUpdate({"system.health.value": newValue});
        ui.notifications.info(`${actor.name} recovered ${newValue - previousValue} hit points from First Aid.`);
    }

    /**
     * Base Attack Bonus / Grapple (Summary tab): rolls immediately by default, same as any
     * other .rollable — but if the roll's own .roll-bonus-toggle checkbox is checked, prompts
     * for a one-off situational bonus first (e.g. a flanking or cover modifier) instead,
     * same UX as First Aid's bonus prompt.
     */
    async _onRollWithBonusToggle(event) {
        event.preventDefault();
        event.stopPropagation();

        const element = event.currentTarget;
        const label = element.dataset.label;
        const baseFormula = element.dataset.formula;
        const toggle = element.closest('.field-roll')?.querySelector('.roll-bonus-toggle');

        // Ctrl/Cmd-click for Advantage, Alt-click for Disadvantage — same fast-path modifier
        // keys as the Attack roll button, overridable below via the bonus-prompt dialog's own
        // Advantage/Normal/Disadvantage buttons if the toggle is checked.
        let advantageMode = (event.ctrlKey || event.metaKey) ? "advantage" : event.altKey ? "disadvantage" : undefined;

        let formula = baseFormula;
        if (toggle?.checked) {
            // Same dnd5e-modeled shape as the Attack-with-Bonus dialog (util.mjs) — a
            // "Configuration" fieldset around the bonus field, then Advantage/Normal/
            // Disadvantage as three separate buttons instead of a radio group.
            const readResult = (html) => Number(html.find('[name="bonus"]').val()) || 0;
            const content = `<fieldset>
    <legend>Configuration</legend>
    <div class="medium labeled-input">
        <label class="text">Additional Bonus</label>
        <input class="input" type="number" name="bonus" value="0" autofocus/>
    </div>
</fieldset>`;
            const result = await Dialog.wait({
                title: label,
                content,
                buttons: {
                    advantage: {label: "Advantage", callback: (html) => ({bonus: readResult(html), rollMode: "advantage"})},
                    normal: {label: "Normal", callback: (html) => ({bonus: readResult(html), rollMode: "normal"})},
                    disadvantage: {label: "Disadvantage", callback: (html) => ({bonus: readResult(html), rollMode: "disadvantage"})}
                },
                default: "normal",
                callback: () => null
            });
            if (!result) return;
            if (result.bonus) formula = `${baseFormula} + ${result.bonus}`;
            advantageMode = result.rollMode !== "normal" ? result.rollMode : undefined;
        }

        formula = applyRollMode(formula, advantageMode);

        const roll = new Roll(formula, this.actor.system);
        await roll.roll();
        let flavor = `${this.actor.name} rolls for ${label}!`;
        if (advantageMode === "advantage") flavor += " (Advantage)";
        if (advantageMode === "disadvantage") flavor += " (Disadvantage)";
        await roll.toMessage({
            speaker: ChatMessage.getSpeaker({actor: this.actor}),
            flavor
        });
    }

    /**
     *
     * @param event
     * @param sheet {SWSEActorSheet}
     * @param scores
     * @param canReRoll
     * @returns {Promise<void>}
     * @private
     */
    async _selectAttributeScores(event, sheet, scores, canReRoll) {
        if (Object.keys(scores).length === 0) {
            let existingValues = sheet.actor.getAttributeBases();

            scores = {str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8};
            for (let val of Object.keys(existingValues)) {
                scores[val] = existingValues[val];
            }
        }

        let data = {
            canReRoll,
            abilities: CONFIG.SWSE.Abilities.droidSkip,
            isDroid: sheet.actor.isDroid,
            scores,
            formula: CONFIG.SWSE.Abilities.defaultAbilityRoll
        };
        const template = `systems/swse/templates/dialog/roll-and-standard-array.hbs`;

        let content = await renderTemplate(template, data);

        let response = await Dialog.confirm({
            title: "Assign Ability Scores",
            content: content,
            yes: (html) => {
                let response = {str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8};
                html.find(".container").each((i, item) => {
                    let ability = $(item).data("ability");
                    let value = 8;
                    if (item.innerText) {
                        value = parseInt(item.innerText);
                    }
                    if (ability) {
                        response[ability] = value;
                    }
                })
                return response;
            },
            no: () => {

            },
            render: (html) => {
                html.find(".movable").each((i, item) => {
                    item.setAttribute("draggable", true);
                    item.addEventListener("dragstart", (ev) => this._onDragStart(ev), false);
                });

                html.find(".container").each((i, item) => {
                    item.addEventListener("drop", (ev) => this._onDragEndMovable(ev), false);
                });

                if (canReRoll) {
                    html.find("#reRoll").each((i, button) => {
                        button.addEventListener("click", () => {
                            let rollFormula = CONFIG.SWSE.Abilities.defaultAbilityRoll;
                            html.find(".movable").each(async (i, item) => {
                                let roll = await new Roll(rollFormula).roll();
                                let title = "";
                                for (let term of roll.terms) {
                                    for (let result of term.results) {
                                        if (title !== "") {
                                            title += ", "
                                        }
                                        if (result.discarded) {
                                            title += `(Ignored: ${result.result})`
                                        } else {
                                            title += result.result
                                        }

                                    }
                                }
                                item.title = title;
                                item.innerHTML = roll.total;
                            });
                        })
                    })
                }
            }
        });
        if (response) {
            await sheet.object.setAttributes(response);
        }
    }

    /**
     *
     * @param event
     * @param sheet {SWSEActorSheet}
     * @returns {Promise<void>}
     * @private
     */
    async _selectAttributesManually(event, sheet) {
        let existingValues = sheet.actor.attributes;
        let combined = {};
        for (let val of Object.keys(existingValues)) {
            combined[val] = {val: existingValues[val].base, skip: existingValues[val].skip};
        }

        let data = {
            availablePoints: sheet.getPointBuyTotal(),
            abilityCost: CONFIG.SWSE.Abilities.abilityCost,
            abilities: combined,
            isDroid: sheet.actor.isDroid
        };
        const template = `systems/swse/templates/dialog/manual-attributes.hbs`;

        let content = await renderTemplate(template, data);

        let response = await Dialog.confirm({
            title: "Assign Ability Score Points",
            content: content,
            yes: async (html) => {
                let response = {};
                html.find(".adjustable-value").each((i, item) => {
                    response[$(item).data("label")] = item.value;
                })
                return response;
            }
        });
        if (response) {
            sheet.actor.setAttributes(response);
        }

    }

    /**
     *
     * @param event
     * @param sheet {SWSEActorSheet}
     * @returns {Promise<void>}
     * @private
     */
    async _selectAttributeLevelBonuses(event, sheet) {
        let level = $(event.currentTarget).data("level");
        let bonus = sheet.object.getAttributeLevelBonus(level);

        let combined = {};
        for (let val of Object.keys(CONFIG.SWSE.Abilities.droidSkip)) {
            combined[val] = {val: bonus[val], skip: CONFIG.SWSE.Abilities.droidSkip[val]};
        }

        let availableBonuses = [false];
        if (this.actor.isHeroic) {
            availableBonuses = [false, false];
        }
        for (let i = 0; i < availableBonuses.length - Object.values(bonus).filter(b => b === 1).length; i++) {
            availableBonuses[i] = true;
        }

        let data = {
            abilityCost: CONFIG.SWSE.Abilities.abilityCost,
            abilities: combined,
            isDroid: sheet.actor.isDroid,
            availableBonuses
        };
        const template = `systems/swse/templates/dialog/level-attribute-bonus.hbs`;

        let content = await renderTemplate(template, data);

        let response = await Dialog.confirm({
            title: "Assign Ability Score Points",
            content: content,
            yes: async (html) => {
                let response = {};
                html.find(".container").each((i, item) => {
                    let ability = $(item).data("ability");
                    let value = null;
                    if (item.innerText) {
                        value = parseInt(item.innerText);
                    }
                    if (ability) {
                        response[ability] = value;
                    }
                })
                return response;
            },
            render: (html) => {
                html.find(".movable").each((i, item) => {
                    item.setAttribute("draggable", true);
                    item.addEventListener("dragstart", (ev) => this._onDragStart(ev), false);
                });

                html.find(".container").each((i, item) => {
                    item.addEventListener("drop", (ev) => this._onDragEndMovable(ev), false);
                });
            }
        });
        if (response) {
            sheet.object.setAttributeLevelBonus(level, response);
        }
    }

    /**
     *
     * @param event
     * @param sheet {SWSEActorSheet}
     * @returns {Promise<void>}
     * @private
     */
    async _assignAttributePoints(event, sheet) {
        let existingValues = sheet.object.attributeBases;
        let bonuses = sheet.object.attributeBonuses;
        let combined = {};
        for (let val of Object.keys(existingValues)) {
            combined[val] = {val: existingValues[val], skip: CONFIG.SWSE.Abilities.droidSkip[val], bonus: bonuses[val]};
        }

        let data = {
            availablePoints: sheet.getPointBuyTotal(),
            abilityCost: CONFIG.SWSE.Abilities.abilityCost,
            abilities: combined,
            isDroid: sheet.actor.isDroid
        };
        const template = `systems/swse/templates/dialog/point-buy.hbs`;

        let content = await renderTemplate(template, data);

        let response = await Dialog.confirm({
            title: "Assign Ability Score Points",
            content: content,
            yes: (html) => {
                let response = {};
                html.find(".adjustable-value").each((i, item) => {
                    response[$(item).data("label")] = parseInt(item.innerHTML);
                })
                return response;
            },
            render: (html) => {
                sheet.updateTotal(html);

                html.find(".adjustable-plus").on("click", (event) => {
                    const parent = $(event.currentTarget).parents(".adjustable");
                    const valueContainer = parent.children(".adjustable-value");
                    valueContainer.each((i, item) => {
                        item.innerHTML = parseInt(item.innerHTML) + 1;
                        if (parseInt(item.innerHTML) > 18 || sheet.getTotal(html).total > sheet.getPointBuyTotal()) {
                            item.innerHTML = parseInt(item.innerHTML) - 1;
                        }
                    });
                    sheet.updateTotal(html);
                });
                html.find(".adjustable-minus").on("click", (event) => {
                    const parent = $(event.currentTarget).parents(".adjustable");
                    const valueContainer = parent.children(".adjustable-value");
                    valueContainer.each((i, item) => {
                        item.innerHTML = parseInt(item.innerHTML) - 1;
                        if (parseInt(item.innerHTML) < 8) {
                            item.innerHTML = parseInt(item.innerHTML) + 1;
                        }
                    });
                    sheet.updateTotal(html);
                });
            }
        });
        if (response) {
            sheet.object.setAttributes(response);
        }
    }

    _unavailable() {
        Dialog.prompt({
            title: "Sorry this content isn't finished.",
            content: "Sorry, this content isn't finished.  if you have an idea of how you think it should work please let me know.",
            callback: () => {
            }
        })
    }

    _prerequisiteHasTypeInStructure(prereq, type) {
        if (!prereq) {
            return false;
        }
        if (prereq.type === type) {
            return prereq;
        }
        if (prereq.children) {
            for (let child of prereq.children) {
                let prerequisiteHasTypeInStructure = this._prerequisiteHasTypeInStructure(child, type);
                if (prerequisiteHasTypeInStructure) {
                    return prerequisiteHasTypeInStructure;
                }
            }
        }
        return false;
    }

    async _onMakeAttack(ev, type = Attack.TYPES.SINGLE_ATTACK){
        // Ctrl/Cmd-click for Advantage, Alt-click for Disadvantage — same fast-path keyboard
        // modifiers as the standard d20-system convention, no dialog needed for the common case.
        const advantageMode = (ev.ctrlKey || ev.metaKey) ? "advantage" : ev.altKey ? "disadvantage" : undefined;
        if(ev.currentTarget.dataset.attackKeys){
            let keys = ev.currentTarget.dataset.attackKeys.split(",").map(k => k.trim())
            await makeAttack({actorUUID: this.object.uuid, type: Attack.TYPES.FULL_ATTACK, attackKeys:[keys], advantageMode});
        } else {
            await makeAttack({actorUUID: this.object.uuid, type: type, attackKeys:[ev.currentTarget.dataset.attackKey], advantageMode});
        }

    }

    _onActivateItem(ev) {

    }

    onlyAllowsWeaponsDialog(weaponOnly = true) {
        if (this.object.suppressDialog) {
            return;
        }
        if (weaponOnly) {
            new Dialog({
                title: "Weapon Systems Only",
                content: `This slot only allows weapon systems to be added at this time.`,
                buttons: {
                    ok: {
                        icon: '<i class="fas fa-check"></i>',
                        label: 'Ok'
                    }
                }
            }).render(true);
        } else {

            new Dialog({
                title: "Weapon Systems Not Allowed",
                content: `This slot does not allow weapon systems to be added at this time.`,
                buttons: {
                    ok: {
                        icon: '<i class="fas fa-check"></i>',
                        label: 'Ok'
                    }
                }
            }).render(true);
        }
    }

    onlyAllowsAstromechsDialog() {
        new Dialog({
            title: "Astromech Droids Only",
            content: `This slot only allows Astromech droids and other 2nd-Degree droids to be added at this time.`,
            buttons: {
                ok: {
                    icon: '<i class="fas fa-check"></i>',
                    label: 'Ok'
                }
            }
        }).render(true);
    }

    defenseToTableRow(value) {
        const strings = Object.keys(value);
        let rows = []
        if (strings.includes('name') && strings.includes('total')) {
            rows.push(`<tr><th>${value.name}</th><td>${value.total}</td></tr>`)
            for (let defenseModifier of value.defenseModifiers || []) {
                rows.push(this.defenseToTableRow(defenseModifier))
            }
        }
        return rows.join("");
    }
}



