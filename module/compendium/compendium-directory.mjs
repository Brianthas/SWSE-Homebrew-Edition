import {SWSECompendiumBrowser} from "./compendium-browser.mjs";

/**
 * Not currently registered as the active sidebar compendium tab (core's own CompendiumDirectory is
 * what actually renders) — this class only exists today to host viewCompendiumItemsByFilter, which
 * actor-sheet.mjs calls directly as a static utility. If it's ever registered as the real sidebar
 * tab, note that ApplicationV2 makes ContextMenu.create() throw immediately — use
 * `new foundry.applications.ux.ContextMenu(...)` instead, matching the pattern in actor-sheet.mjs.
 */
export class SWSECompendiumDirectory extends (foundry.applications.sidebar.tabs.CompendiumDirectory ?? CompendiumDirectory)
{
    static viewCompendiumItemsByFilter(event){
        let element = $(event.currentTarget);
        let filterString = element.data("filter")
        let type = element.data("type")
        let pack = element.data("pack")
        let actionModifier = element.data("action-modifier")

        if(game.settings.get("swse", "enableAdvancedCompendium")) {
            new SWSECompendiumBrowser({filterString, type, pack, actionModifier})._render(true);
        } else {
            let found = game.packs.get(pack);

            if(found){
                found.render(true);
                return;
            }

            let packName
            if(pack){
                packName = pack.split(".")[1]
            }
            if(!packName && filterString){
                packName = filterString.split(":")[1].split(/(?=[A-Z])/).join("-").toLowerCase()
            }

            found = game.packs.find(p => p.metadata.name.includes(packName));
            if(found){

                found.render(true);
            } else {
                console.warn("could not find appropriate pack " + packName)
            }
        }
    }
}