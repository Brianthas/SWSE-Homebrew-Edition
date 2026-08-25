import {SWSEItem} from "../item/item.mjs";
import SWSEActor from "../actor/actor.mjs";

/**
 * @param actorData          the actor payload, including system.providedItems
 * @param returnFailures     resolve to {actor, failures} rather than the actor
 * @param [options.suppressDialog]  answer no choice prompts and skip anything that asks. Interactive
 *   callers want the prompt; a bulk build must never stop on one, because nobody is watching to
 *   click it and the whole run stalls on a single creature.
 */
export async function processActor(actorData, returnFailures = false, {suppressDialog = false} = {}) {
    // Snapshot providedItems BEFORE the create. `providedItems` is a declared field on Items but
    // not on the actor DataModel, and Actor.create() cleans the object it is handed IN PLACE, so
    // reading actorData.system.providedItems afterwards yields undefined. That made this function
    // create an actor with zero items and report zero failures - a silent no-op.
    let providedItems = actorData.system?.providedItems ?? [];

    let actors = await SWSEActor.create([actorData]);
    if (!(actors && actors.length === 1)) {
        // Actor.create does not throw on a DataModel validation failure, it logs and returns an
        // empty array, so this branch is the only signal the caller gets. Say which actor and why
        // out loud: silently returning nothing here cost a bulk import two creatures whose only
        // symptom was a crash three calls further on.
        console.error(`SWSE: could not create actor "${actorData?.name}" (type ${actorData?.type}, `
            + `size ${actorData?.system?.size}) - Actor.create rejected the payload.`, actorData);
        return {actor: undefined, failures: []};
    }
    let actor = actors[0];
    let choiceAnswers = [];
    const size = actor.system.size;
    choiceAnswers.push(size);
    actor.prepareData();
    actor.skipPrepare = true;
    actor.suppressDialog = suppressDialog;
    const failures = await actor.addItems({
        skipPrerequisite: true,
        generalAnswers: choiceAnswers,
        isUpload: true,
        suppressWarnings: true,
        items: providedItems,
        returnFailures: true
    });

    actor.suppressDialog = suppressDialog;
    actor.skipPrepare = false;
    await actor.prepareData();



    // if(!actor.hasAnyOf([
    //     {finalName: "Colossal (Cruiser)", type: "trait"},
    //     {finalName: "Colossal (Station)", type: "trait"},
    //     {finalName: "Colossal", type: "trait"},
    //     {finalName: "Gargantuan", type: "trait"},
    //     {finalName: "Huge", type: "trait"},
    //     {finalName: "Large", type: "trait"},
    //     {finalName: "Medium", type: "trait"},
    //     {finalName: "Small", type: "trait"},
    //     {finalName: "Tiny", type: "trait"},
    //     {finalName: "Diminutive", type: "trait"},
    //     {finalName: "Fine", type: "trait"}])){
    //
    //     await actor.sheet._onDropItem(null, {name: size, type: "trait", answers:[]})
    // }

    // if(!actor.species){
    //
    //     await actor.sheet._onDropItem(null, {name: size, type: "trait", answers:[]})
    // }
    // Beasts printed with more Reflex than this system derives get the difference as Natural Armor.
    // `expected` is only ever set by the old units-cl-* actor JSON, so for any other caller the
    // subtraction is NaN and nothing should happen - but NaN slipped through the truthiness check
    // often enough to matter, and _onDropItem then opened "Choose amount of Natural Armor to add"
    // and waited for a click that a bulk import is never going to give it. Guard the arithmetic,
    // and suppress the dialog so a rejected pre-answer skips the trait instead of hanging.
    if (actor.isBeast) {
        const expected = Number(actor.defense?.reflex?.expected);
        const derived = Number(actor.defense?.reflex?.total);
        const proposedArmor = (Number.isFinite(expected) && Number.isFinite(derived)) ? expected - derived : 0;
        if (proposedArmor > 0) {
            const previousSuppress = actor.suppressDialog;
            // Always suppressed here regardless of the caller: this trait is inferred rather than
            // asked for, so a prompt about it is never something a GM expects.
            actor.suppressDialog = true;
            try {
                await actor.sheet._onDropItem(null, {name: "Natural Armor", type: "trait", answers: [proposedArmor]});
            } catch (e) {
                console.warn("SWSE: could not add Natural Armor to an imported beast", e);
            } finally {
                actor.suppressDialog = previousSuppress;
            }
        }
    }

    if(returnFailures){
        return {actor, failures};
    }
    return actor;
}
export async function processItem(itemData) {
    let items = await SWSEItem.create([itemData]);
    if (!(items && items.length === 1)) {
        return;
    }
    let item = items[0];
    for(let effect of item.effects){
        for(let link of effect.flags.swse.linkData || []){
            let groupedEffects = item.effects.filter(effect => effect.flags.swse.group === link.group)
            for (const e of groupedEffects) {
                await e.addLinks(effect, link.type.toLowerCase());
            }
            //console.log(effect)
        }
        //delete effect.flags.swse.linkData
    }
    return item;
}

export async function getFile(jsonImport) {
    let response = await fetch(jsonImport);
    if (response.status === 404) {
        return;
    }
    return response;
}

export function clearEmptyCompendiums(){
    for(const pack of game.packs.filter(pack => pack.index.size === 0)){
        try{

            pack.deleteCompendium()
        } catch (e) {
            console.warn(e)
        }
    }
}

async function importCompendium(jsonImport, forceRefresh) {
    let response = await getFile(jsonImport);

    if(!response){
        console.warn("no content");
        return;
    }

    const content = await response.json();



    const compendiumName = content.name.replace(" ", "-").replace(" ", "-");
    const entity = content.type;

    let pack = await game.packs.get(`world.${compendiumName.toLowerCase()}`);

    let toks = pack?.metadata.name.split("-");
    let version = toks ? toks[toks?.length - 1] : 0;
    if (!pack || (!isNaN(version) ? parseInt(version) : 0) < content.version || forceRefresh) {
        if (pack) {
            await pack.deleteCompendium()
        }
    } else {
        return;
    }

    let collection = await CompendiumCollection.createCompendium({
        label: compendiumName.toLowerCase(),
        name: compendiumName.toLowerCase(),
        type: entity,
        version: content.version
    });

    // await new Compendium(collection, {label: compendiumName, entity: entity, version: content.version})
    pack = await game.packs.get(`world.${compendiumName.toLowerCase()}`);
    //pack.metadata.version = content.version;

    if (!pack) {
        return;
    }

    console.log(`Generating ${compendiumName}... ${content.entries.length} entries`);
    ui.notifications.info(`Updating ${compendiumName}... ${content.entries.length} entries`);

    let failedItems = [];
    if ('Item' === entity) {
        for (let itemData of content.entries) {
            const item = await processItem(itemData);

            await collection.importDocument(item);
            item.delete();
        }
        // let items = await SWSEItem.create(content.entries);
        // for (let item of items) {
        //     for(let effect of item.effects){
        //         for(let link of effect.flags.swse.linkData || []){
        //             let groupedEffects = item.effects.filter(effect => effect.flags.swse.group === link.group)
        //             for (const e of groupedEffects) {
        //                 await e.addLinks(effect, link.type.toLowerCase());
        //             }
        //             console.log(effect)
        //         }
        //         //delete effect.flags.swse.linkData
        //     }
        //     await collection.importDocument(item);
        //     item.delete();
        // }
    } else if ('Actor' === entity) {
        for (let actorData of content.entries) {
            const {actor, failures} = await processActor(actorData, true);
            failedItems.push(...failures)
            if(!actor){
                continue;
            }
            await collection.importDocument(actor);
            if(actor.warnings && actor.warnings.length > 0){
                console.warn(actor, actor.warnings)
            }


            await actor.delete();
        }
    }
    
    failedItems = failedItems.map(i => `${i.name} : ${i.type}`).filter((value, index, self) => self.indexOf(value) === index);

    console.log(failedItems);
    // await pack.createEntity(content.entries);
    //Promise.all(promises).then(() => {
    console.log(`Done Generating ${compendiumName}... ${content.entries.length} entries`);
    ui.notifications.info(`Done Updating ${compendiumName}... ${content.entries.length} entries`);
//});
}

export const deleteEmptyCompendiums = async function () {
    await game.packs.forEach(p => {
        if (p.index.size === 0) {
            p.delete();
        }
    });
}

export const generateCompendiums = async function (forceRefresh = false, type = "Item") {
    console.log("Generating Compendiums...")
    let response;
    try {
        response = await fetch("systems/swse/raw_export/manifest.json");
    } catch (e) {
        console.error(e);
        return;
    }

    if (response.status === 404) {
        return;
    }
    const content = await response.json();

    for (const file of content.files) {
        await importCompendium(file, forceRefresh);
    }
    console.log("End Generation")
}