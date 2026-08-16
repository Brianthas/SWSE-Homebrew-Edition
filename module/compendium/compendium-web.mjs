import {getIndexEntriesByTypes} from "./compendium-util.mjs";
import {meetsPrerequisites} from "../prerequisite.mjs";
import {SimpleCache} from "../common/simple-cache.mjs";

export class CompendiumWeb extends Application {

    static _pattern = /\s\([\w#\s]*\)/
    static _payloadPattern = new RegExp(CompendiumWeb._pattern, "g");

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            template: "systems/swse/templates/compendium/compendium-web.hbs",
            // A real id, not null. The custom `get id()` below stringifies whatever this is straight
            // into the window's DOM id, so `null` produced the literal element id "null" - and V1's
            // element getter resolves a not-yet-rendered app by `$("#" + this.id)`, meaning it would
            // happily latch onto any other element in the world with id="null". The single-window
            // behaviour that id sharing gives us is intentional and unchanged: opening a web while one
            // is already up re-renders that window rather than stacking a second heavy copy.
            id: "swse-compendium-web",
            popOut: true,
            width: 700,
            height: 1400,
            classes: ["web", "swse"],
            resizable: true,
            baseApplication: "CompendiumWeb"
        });
    }

    constructor(...args) {
        super(...args);

        this.cache = new SimpleCache()
    }

    /**
     * Build the filters and draw the web once our content is on the screen.
     *
     * This used to be a global `Hooks.on("renderApplication")` registered in the constructor, which
     * was never torn down: every web window opened left another permanent listener behind, so the
     * render of every application in the world ran a growing pile of callbacks that only existed to
     * check an appId and bail. activateListeners is the per-instance equivalent - core calls it after
     * each render of *this* application, and it dies with the window.
     */
    activateListeners(html) {
        super.activateListeners(html);

        // Core passes activateListeners the inner content element, whereas the old hook received the
        // outer window element. Prefer this.element so the filter lookups below keep searching from
        // the exact same root they always have.
        this.setupWeb(this.element ?? html);
    }

    async setupWeb(target) {
        this.options.homebrewEnabled = game.settings.get("swse", "enableHomebrewContent");
        this.target = target;

        this.types = this.options?.types ?? ['feat', 'talent'];

        await this.addFilters(target, this.types)
        await this.populateFiltersFromArguments(target, this.options);
        await this.renderWeb(null, target, this.types);

        //currently disabled.  will allow arrows to be drawn in the future
        // const start = Date.now()
        // this.drawArrows(target).then(() => console.log( Date.now() - start))
    }

    /**
     *
     * @type {[{mutation: function(*): function(*): void,
     *          multiple: boolean,
     *          name: string,
     *          options: function(): [{display: string, value: string}],
     *          selector: string,
     *          type: string}]}
     */
    filters = [
        {
            type: "select",
            multiple: false,
            selector: "provider-filter",
            name: "Filter by Provider Source",
            mutation: (value) => {
                return (index) => {
                    index.hide ||= !index.possibleProviders?.includes(value);
                }
            },
            options: async (types) => {
                return [...await getIndexEntriesByTypes.call(this, types)].flatMap(([key, item]) => item.system.possibleProviders).distinct().filter(i => !!i).map(book => {
                    return {value: book, display: book}
                });
            }
        },
        {
            type: "select",
            multiple: false,
            selector: "species-filter",
            name: "Filter by species",
            mutation: (value, exclude) => {
                return (index) => {
                    if (exclude) {
                        if(value){
                            index.hide ||= index.species?.includes(value);
                        } else {
                            index.hide ||= !index.species;
                        }
                    } else {
                        index.hide ||= !index.species?.includes(value);
                    }
                }
            },
            options: async (types) => {

                return [...await getIndexEntriesByTypes.call(this, types)].flatMap(([key, item]) => CompendiumWeb.getPrerequisitesByType(item.system.prerequisite, ["SPECIES"])).map(p => p.requirement).distinct().map(s => {
                    return {display: s, value: s}
                })

                //return SPECIES;
            },
            allowExclude: true
        },
        {
            type: "select",
            multiple: false,
            selector: "actor-filter",
            name: "Filter out by actor stats",
            mutation: (value) => {
                return (index) => {
                    const actor = game.actors.get(value)
                    index.hide ||= !(meetsPrerequisites(actor, index.prerequisite)).doesFail;

                    for (const item of actor.items) {
                        if(item.name === index.name){
                            index.hasItem = true;
                            break;
                        }
                    }
                }
            },
            options: () => {
                return game.actors.filter(a => a.canUserModify(game.user, 'update')).map(a => {
                    return {value: a.id, display: a.name}
                });
            }
        },
        {
            type: "number",
            multiple: false,
            selector: "base-attack-bonus-filter",
            name: "Filter by Base Attack Bonus",
            mutation: (value) => {
                return (index) => {
                    index.hide ||= !(index.baseAttackBonus <= parseInt(value));
                }
            }
        },
        {
            type: "select",
            multiple: false,
            selector: "book-filter",
            name: "Filter by Book",
            mutation: (value, exclude) => {
                return (index) => {
                    if (exclude) {
                        index.hide ||= index.book === value;
                    } else {
                        index.hide ||= index.book !== value;
                    }
                }
            },
            options: async (types) => {
                return [...await getIndexEntriesByTypes.call(this, types)].map(([key, item]) => item.system.source).distinct().filter(i => !!i).map(book => {
                    return {
                        value: book,
                        display: book.replace("Star Wars Saga Edition", "SWSE").replace("Clone Wars Saga Edition", "CWSE")
                    }
                });
            },
            allowExclude: true
        },
        {
            type: "boolean",
            multiple: false,
            selector: "homebrew-filter",
            name: "Filter out Homebrew",
            mutation: (value) => {
                return (index) => {
                    if (value) {
                        index.hide ||= index.homebrew;
                    }
                }
            }
        },
        {
            type: "text",
            multiple: false,
            selector: "name-filter",
            name: "Filter by Name",
            mutation: (value) => {
                return (index) => {
                    index.hide ||= !(index.name.toLowerCase().includes(value.toLowerCase()) || (index.talentTree && index.talentTree.toLowerCase().includes(value.toLowerCase())));
                }
            }
        }
    ]

    getCached(key, fn) {
        if (!this.cache) {
            return fn();
        }
        return this.cache.getCached(key, fn)
    }

    async renderWeb(e, target, types) {
        let items = await getIndexEntriesByTypes.call(this, types)

        const dependencyMap = new Map()
        const invertedDependencyMap = new Map();
        const itemFilterMeta = new Map();

        const rootItems = [];

        for (const item of items.values()) {

            itemFilterMeta.set(item.uuid, this.getMeta(item, target))
            const prerequisites = CompendiumWeb.getPrerequisitesByType(item.system.prerequisite, types)

            if (prerequisites && prerequisites.length > 0) {
                //dependencyMap[item.name] = prerequisites;
                for (const prerequisite of prerequisites) {
                    const requiredItem = this.getItemByPrerequisite(prerequisite, items);
                    if (requiredItem && item) {
                        if (invertedDependencyMap.has(requiredItem.uuid)) {
                            invertedDependencyMap.get(requiredItem.uuid).push(item.uuid)
                        } else {
                            invertedDependencyMap.set(requiredItem.uuid, [item.uuid])
                        }

                        if (dependencyMap.has(item.uuid)) {
                            dependencyMap.get(item.uuid).push(requiredItem.uuid)
                        } else {
                            dependencyMap.set(item.uuid, [requiredItem.uuid])
                        }
                    }
                }
            } else {
                rootItems.push(item);
            }
        }


///combine getmeta with this filtering block in the future.  for now it works and i want to release  perfect is enemy of good and all that


        for (const filter of this.filters) {
            const input = target.find(`.${filter.selector}.value`);
            const value = filter.type === "boolean" ? input.is(":checked") : input.val()
            let exclude = target.find(`.${filter.selector}.exclude`).is(":checked")
            if (value || exclude) {
                const test = filter.mutation(value, exclude);
                [...itemFilterMeta].map(([key, meta]) => meta).forEach(test);
            }
        }

        const skipLinking = [...invertedDependencyMap]
            .filter(([key, values]) => values && values.filter(value => this.shouldDraw(value, itemFilterMeta, invertedDependencyMap)).length > 10)
            .map(([key, values]) => key)

        this.pruneBisections(invertedDependencyMap)

        const rootUuids = rootItems.map(r => r.uuid);
        const groupedIds = []
        const groups = []

        for (const rootUuid of rootUuids) {
            if (groupedIds.includes(rootUuid) || skipLinking.includes(rootUuid)) {
                continue;
            }

            const groupNodes = [rootUuid]

            let children = invertedDependencyMap.get(rootUuid)
            if (!children) {
                groups.push({groupNodes})
                continue;
            }

            let newNodes = children;
            while (newNodes.length > 0) {
                let activeNodes = newNodes;
                newNodes = [];
                for (const activeNode of activeNodes) {
                    if (groupedIds.includes(activeNode)) {
                        continue;
                    }
                    const shouldLink = !skipLinking.includes(activeNode);
                    if (shouldLink) {
                        groupedIds.push(activeNode)
                    }
                    groupNodes.push(activeNode)
                    if (dependencyMap.has(activeNode)) {
                        newNodes.push(...dependencyMap.get(activeNode))
                    }
                    if (invertedDependencyMap.has(activeNode) && shouldLink) {
                        newNodes.push(...invertedDependencyMap.get(activeNode))
                    }
                }
            }

            groups.push({groupNodes: groupNodes.distinct()})
        }

        const depths = new Map()
        let deepestBranch = 0;
        for (const group of groups) {
            for (const groupNode of group.groupNodes) {
                const depth = this.getDepth(groupNode, dependencyMap);
                depths.set(groupNode, depth)

                deepestBranch = Math.max(deepestBranch, depth)
            }
        }

        const root = target.find(".web-viewer");
        root.empty()
        let groupNumber = 0;
        for (const group of groups) {
            root.append(await this.createGroup(group.groupNodes, deepestBranch, depths, items, groupNumber, invertedDependencyMap, itemFilterMeta))
            groupNumber = groupNumber + 1
        }
    }

    getMeta(item) {
        const bab = this.getBabRequirement(item);
        const speciesPrerequisites = this.getSpeciesRequirement(item);


        return {
            uuid: item.uuid,
            name: item.name,
            possibleProviders: item.system.possibleProviders,
            book: item.system.source,
            homebrew: item.isHomeBrew,
            baseAttackBonus: bab,
            species: speciesPrerequisites,
            talentTree: item.system.talentTree,
            prerequisite: item.system.prerequisite
        };
    }

    getDepth(groupNode, dependencyMap) {
        const children = dependencyMap.get(groupNode);
        if (!children || children.length === 0) {
            return 0;
        }
        return Math.max(...children.map(child => this.getDepth(child, dependencyMap))) + 1
    }

    /**
     *
     * @param prerequisite
     * @param items
     * @return {*}
     */
    getItemByPrerequisite(prerequisite, items) {
        let key = `${prerequisite.type.toUpperCase()}:${prerequisite.requirement}`;
        if (!items.has(key)) {
            let payloadFree = prerequisite.requirement.replace(CompendiumWeb._payloadPattern, "");
            key = `${prerequisite.type.toUpperCase()}:${payloadFree}`;
        }
        return items.get(key);
    }

    getSpeciesRequirement(item) {
        return CompendiumWeb.getPrerequisitesByType(item.system.prerequisite, ["SPECIES"]).map(p => p.requirement);
    }

    getBabRequirement(item) {
        const babPrerequisites = CompendiumWeb.getPrerequisitesByType(item.system.prerequisite, ["BASE ATTACK BONUS"])

        let babs = babPrerequisites.map(p => parseInt(p.requirement));
        babs.push(0)
        return Math.max(...babs);
    }

    async createGroup(grouping, deepestLevel, levels, items, groupNumber, invertedDependencyMapping, metaMapping) {
        const itemsByLevel = [];
        let shouldDrawGroup = false;
        for (const groupingElement of grouping) {
            if (!(this.shouldDraw(groupingElement, metaMapping, invertedDependencyMapping))) continue;

            shouldDrawGroup = true;
            const level = levels.get(groupingElement);
            if (itemsByLevel[level]) {
                itemsByLevel[level].push(groupingElement);
            } else {
                itemsByLevel[level] = [groupingElement]
            }
        }

        if (!shouldDrawGroup) {
            return;
        }

        for (let i = 0; i < itemsByLevel.length; i++) {
            for (let j = 0; j < itemsByLevel[i].length; j++) {

            }
        }


        const webGroup = $(`<div class="web-group"></div>`);
        for (const level of itemsByLevel) {

            const webLevel = $(`<div class="web-level"></div>`);
            for (let uuid of level) {
            //for (const uuid of itemsByLevel[i] || []) {
                //const uuid = itemsByLevel[i][j]
                if(uuid){
                    const invertedDependencies = invertedDependencyMapping.get(uuid) || []
                    webLevel.append(this.getItemBlock(await fromUuid(uuid), groupNumber, invertedDependencies, metaMapping.get(uuid)))
                } else {

                    webLevel.append( $(`<div class="web-item"></div>`));
                }
            }

            webGroup.append(webLevel);
        }
            const wrapper = $(`<div class="web-grouper" ><div style="width: 0; height: 0"><canvas class="web-canvas" style="overflow: visible"></canvas></div></div>`)
            wrapper.append(webGroup)
            return wrapper;


    }

    shouldDraw(uuid, metaMapping, invertedDependencyMapping) {
        const meta = metaMapping.get(uuid);
        if (!meta.hide) {
            return true;
        }
        for (const mapping of invertedDependencyMapping.get(uuid) || []) {
            if (this.shouldDraw(mapping, metaMapping, invertedDependencyMapping)) {
                return true;
            }
        }
        return false;
    }

    getItemBlock(item, groupNumber, invertedDependencies = [], metaData) {
        const img = $(`<img src="${item.img}" alt="${item.name}">`);
        // const itemBlock = $(`<div class="icon"></div>`);

        img.attr("title", item.system.prerequisite?.text)
        img.attr("draggable", "true")
        img.attr("id", `${item.uuid.replaceAll("\.", "-")}-${groupNumber}`);
        img.addClass(`${item.uuid.replaceAll("\.", "-")}-${groupNumber}`);
        if (invertedDependencies && invertedDependencies.length > 0) {
            img.attr("data-draw-to", invertedDependencies.map(d => `${d.replaceAll("\.", "-")}-${groupNumber}`).join(","))
            img.addClass("mappable")

        }
        img.attr("data-uuid", item.uuid)
        img.on("dragstart", (event) => this._onDragStart(event))
        img.on("dblclick", (event) => item.sheet.render(true))
        img.addClass(item.type)

        const itemArea = $(`<div class="web-item"></div>`);
        itemArea.append(img)
        if (item.type === "talent") {
            itemArea.append($(`<div class="text talent">${item.system.talentTree}:</div>`))
        }
        itemArea.append($(`<div class="text">${item.name}</div>`))

        if(metaData.hasItem){
            itemArea.addClass("owned");
        }

        return itemArea;
    }

    _onDragStart(event) {
        const dataTransfer = event.dataTransfer || event.originalEvent.dataTransfer
        let dragData = JSON.parse(dataTransfer.getData("text/plain") || "{}");
        dragData.uuid = event.currentTarget.dataset.uuid
        dragData.type = "Item"

        dataTransfer.setData("text/plain", JSON.stringify(dragData));
    }

    static getPrerequisitesByType(prerequisite, type = []) {
        if (!prerequisite) {
            return [];
        }

        const prerequisites = [];
        if (type.map(t => t.toLowerCase()).includes(prerequisite.type.toLowerCase())) {
            prerequisites.push(prerequisite);
        } else if (prerequisite.children) {
            for (const child of prerequisite.children) {
                prerequisites.push(...CompendiumWeb.getPrerequisitesByType(child, type))
            }
        }
        return prerequisites;
    }

    get id() {
        return `${this.options.id}${this._original ? "-popout" : ""}`;
    }

    async getData(options = {}) {
        return {
            cssId: this.id,
            cssClass: this.options.classes.join(" "),
            user: game.user
        };
    }
    async populateFiltersFromArguments(target, options) {

        if (options.webFilters) {
            for (const webFilter of Object.entries(options.webFilters)) {

                const input = target.find(`.${webFilter[0]}`);
                input.val(webFilter[1]);
            }
        }

        if(!options.homebrewEnabled){
            const input = target.find(`.homebrew-filter`);
            input.prop('checked', true);
            input.prop('disabled', true);
        }
    }

    async addFilters(target, types) {
        const root = target.find(".web-filters");
        root.empty()
        for (const filter of this.filters) {
            root.append(await this.createFilter(filter, target, types))
        }
    }

    /**
     *
     * @param filter
     * @param target
     * @param {string} filter.type the type of filter it will be
     * @param {Array.<{value: string, display: string}>} filter.options things that the user can select
     * @param {boolean} filter.multiple selections can the user choose multiple?
     * @param {string} filter.selector the class that this filter object will use to find  the created element.
     *
     * @return {jQuery|HTMLElement}
     */
    async createFilter(filter, target, types) {
        let filterComponent;
        switch (filter.type) {
            case "select":
                filterComponent = $(`<select></select>`)

                if (filter.multiple) {
                    filterComponent.attr("multiple", true)
                }

                filterComponent.append($(`<option value=""> -- </option>`))

                for (const option of (await filter.options(types)).sort((a, b) => a.display > b.display ? 1 : -1) || []) {
                    filterComponent.append($(`<option value="${option.value}">${option.display}</option>`))
                }
                filterComponent.on("change", (event) => this.renderWeb(event, target, this.types))
                break;
            case "number":
                filterComponent = $(`<input type="number">`)

                filterComponent.on("change", (event) => this.renderWeb(event, target, this.types))
                break;
            case "text":
                filterComponent = $(`<input type="text">`)

                filterComponent.on("change", (event) => this.renderWeb(event, target, this.types))
                break;
            case "boolean":
                filterComponent = $(`<input type="checkbox">`)

                filterComponent.on("change", (event) => this.renderWeb(event, target, this.types))
                break;
            default:
                filterComponent = $(`<div>unsupported filter type</div>`)
        }
        const containerId = `${filter.selector}`

        filterComponent.addClass(filter.selector)
        filterComponent.addClass("value")
        filterComponent.attr("id", containerId)

        const container = $(`<div class="labeled-input"><label for="${containerId}">${filter.name}</label></div>`);

        container.append(filterComponent)

        const topContainer = $(`<div class="flex-row flex"></div>`);
        topContainer.append(container)
        if (filter.allowExclude) {
            const excludeComponent = $(`<input type="checkbox" class="${filter.selector} exclude">`)
            excludeComponent.on("change", (event) => this.renderWeb(event, target, this.types))

            const excludeContainer = $(`<div class="labeled-input"><label>exclude</label></div>`);
            excludeContainer.append(excludeComponent)
            topContainer.append(excludeContainer)
        }

        return topContainer;
    }

    async drawArrows(target) {



        const grouper = target.find(".web-grouper")

        grouper.each((index, grouperElement) => {
            const grouper = $(grouperElement)
            const found = grouper.find(".mappable")
            const webviewer = target
            const webCanvas = grouper.find(".web-canvas")
            webCanvas.attr("width", webviewer.width())
            webCanvas.attr("height", webviewer.height())

            const ctx = webCanvas[0].getContext("2d");


            //const arrows = $(`<div class="arrows"></div>`)
            for (const from of found) {
                let drawto = from.dataset.drawTo?.split(",")
                for (const drawtoElement of drawto) {
                    const to = $(target.find(`#${drawtoElement}`))[0]
                    if (to) {
                        this.drawLine(webCanvas[0], ctx, from, to)

                        //this.connect(from, to, "black", 2)
                        //console.log(`<svg width="500" height="500"><line x1="${from.offsetLeft}" y1="${from.offsetTop }" x2="${to.offsetLeft }" y2="${to.offsetTop}" stroke="black"/></svg>`)
                        //arrows.append($(`<svg><line x1="${from.offsetLeft}" y1="${from.offsetTop }" x2="${to.offsetLeft }" y2="${to.offsetTop}" stroke="black"/></svg>`))
                        //new LeaderLine(from, to)
                    }
                }
            }
            //webviewer.append(arrows)

        })


        for (const grouperElement of grouper) {

        }


    }

    drawLine(canvas, ctx, from, to) {
        const canvasXOffset = $(canvas).offset().left;
        const canvasYOffset = $(canvas).offset().top;
        const fromX = $(from).width()/2 + $(from).offset().left - canvasXOffset;
        const fromY = $(from).height()/2 + $(from).offset().top - canvasYOffset;
        ctx.moveTo(fromX, fromY);
        const toX = $(to).width()/2 + $(to).offset().left - canvasXOffset;
        const toY = $(to).height()/2 + $(to).offset().top - canvasYOffset;
        ctx.lineTo(toX, toY);
        ctx.stroke();
    }

    pruneBisections(invertedDependencyMap) {
        const keys = invertedDependencyMap.keys();
        for (const key of keys) {
            const bisected = this.findBisected(key, invertedDependencyMap);
            if(bisected.length > 0){
                const existing = invertedDependencyMap.get(key);
                invertedDependencyMap.set(key, existing.filter(dep => !bisected.includes(dep)))
                //console.log(invertedDependencyMap.get(key), bisected, existing)
            }
        }
    }

    findBisected(key, invertedDependencyMap) {
        const bisected = [];
        const deps = invertedDependencyMap.get(key);
        for (const dep of deps) {
            if(this.isBisected(key, dep, invertedDependencyMap)){
                bisected.push(dep);
            }
        }

        return bisected;
    }

    isBisected(key, dep, invertedDependencyMap) {
        const nonChildrenDescendents = this.allNonChildDescendents(key, invertedDependencyMap)

        return nonChildrenDescendents.includes(dep);
    }

    allNonChildDescendents(key, invertedDependencyMap) {
        const descendents = [];
        for (const child of invertedDependencyMap.get(key)) {
            descendents.push(...this.getDescendents(child, invertedDependencyMap))
        }


        return descendents;
    }

    getDescendents(key, invertedDependencyMap) {
        const descendents = [];
        const children = invertedDependencyMap.get(key);
        if(children){
            descendents.push(...children)
            for (const child of children) {
                descendents.push(...this.getDescendents(child, invertedDependencyMap))
            }
        }
        return descendents;
    }
}

// Marks the container we inject into the compendium sidebar so a re-render can find and drop the
// previous set before adding a new one.
const WEB_BUTTON_CONTAINER_CLASS = "swse-web-buttons";

// One array per row. The combined web has to chew through both compendium types and is noticeably
// slow, so it gets a row to itself; the two cheaper single type webs share the row below it.
const WEB_BUTTON_ROWS = [
    [
        {cssClass: "feat-web-button", tooltip: "SWSE.TALENT_AND_FEAT_WEB", label: "Talent and Feat Web", types: ["feat", "talent"]}
    ],
    [
        {cssClass: "feat-web-button", tooltip: "SWSE.FEAT_WEB", label: "Feat Web", types: ["feat"]},
        {cssClass: "talent-web-button", tooltip: "SWSE.TALENT_WEB", label: "Talent Web", types: ["talent"]}
    ]
]

export function initializeCompendiumButtons() {
    Hooks.on("renderCompendiumDirectory", (function (e, t) {
        // core's CompendiumDirectory is ApplicationV2 in V14. The hook now passes a raw HTMLElement,
        // not jQuery, so wrap it once here to keep the jQuery-based button code below working unchanged.
        t = $(t);

        // ApplicationV2 re-renders in place: _replaceHTML only swaps the elements core registered as
        // [data-application-part], so anything we add outside those survives a re-render untouched.
        // Adding unconditionally therefore stacked another three buttons every time the sidebar
        // re-rendered (creating or deleting a folder, a pack updating, world reload), which is why the
        // list kept creeping. Clearing our own container first makes this idempotent wherever it landed.
        t.find(`.${WEB_BUTTON_CONTAINER_CLASS}`).remove();

        const container = $(`<div class="${WEB_BUTTON_CONTAINER_CLASS}"></div>`);
        for (const row of WEB_BUTTON_ROWS) {
            // action-buttons flexrow are core's own header classes, so these inherit the spacing and
            // font size of the Create Compendium / Create Folder row they sit under.
            const rowElement = $(`<div class="action-buttons flexrow"></div>`);
            for (const {cssClass, tooltip, label, types} of row) {
                const button = $(`<button type="button" class="${cssClass} constant-button" data-tooltip="${tooltip}"><b class="button-text">${label}</b></button>`);
                button.on("click", (function () {
                    new CompendiumWeb({types}).render(!0)
                }))
                rowElement.append(button)
            }
            container.append(rowElement)
        }

        // Home is the directory header, directly under core's create buttons. Falling back to the root
        // element keeps the buttons reachable rather than silently vanishing if core ever renames the
        // header markup.
        const headerActions = t.find(".directory-header .header-actions").first();
        if (headerActions.length) {
            headerActions.after(container)
        } else {
            t.append(container)
        }
    }))
}