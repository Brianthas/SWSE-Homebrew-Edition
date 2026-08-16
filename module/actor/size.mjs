import {sizeArray} from "../common/constants.mjs";

export function isOversized(actorSize, itemSize) {
    return compareSizes(actorSize, itemSize) > 1;
}

/**
 *
 * @param size1
 * @param size2
 * @returns {number}
 */
export function compareSizes(size1, size2) {
    if (size1?.name) {
        size1 = size1.name
    }
    if (size2?.name) {
        size2 = size2.name
    }

    return sizeArray.indexOf(size2) - sizeArray.indexOf(size1);
}

/**
 *
 * @param size {string|{name:string}}
 * @param modifier {number}
 * @returns {string}
 */
export function changeSize(size, modifier) {
    if (size?.name) {
        size = size.name
    }

    let index = sizeArray.indexOf(size) + modifier;

    if(index<0){
        index=0;
    }
    if(index>=sizeArray.length){
        index=sizeArray.length-1;
    }
    return sizeArray[index];
}
//TODO idk why this is here and not part of item.  i'll look at it later
export function getSize(actor) {
    if(actor.items) {
        for (let item of actor.items || []) {
            if (sizeArray.includes(item.name)) {
                return item.name;
            }
        }
    } else if(actor.stripping){
        let strippings = Object.values(actor.stripping).filter(stripping => stripping.enabled && stripping.value).map(stripping => stripping.label)

        if(strippings.includes("Make Weapon Colossal")){
            return "Colossal";
        }
        if(strippings.includes("Make Weapon Gargantuan")){
            return "Gargantuan";
        }
        if(strippings.includes("Make Weapon Huge")){
            return "Huge";
        }
        if(strippings.includes("Make Weapon Large")){
            return "Large";
        }
        if(strippings.includes("Make Weapon Medium")){
            return "Medium";
        }
        if(strippings.includes("Make Weapon Small")){
            return "Small";
        }
        if(strippings.includes("Make Weapon Tiny")){
            return "Tiny";
        }
    }
    return actor.system.size
}

export function getGridSizeFromSize(size) {
    switch (size) {
        // Fine/Diminutive/Tiny/Small all share Medium's "1 square" character fighting space
        // per the homebrew size table (SIZE_CHANGES, constants.mjs) - SWSE, unlike some other
        // systems, doesn't shrink a player-scale token's grid footprint below Medium; size
        // differences below Medium show up in Stealth/unarmed damage/Reflex Defense instead.
        case "Fine":
        case "Diminutive":
        case "Tiny":
        case "Small":
        case "Medium":
            return 1;
        case "Large":
            return 2;
        case "Huge":
            return 3;
        case "Gargantuan":
            return 4;
        case "Colossal":
            return 6;
    }
}

// Fine/Diminutive/Tiny/Small keep Medium's 1x1 grid footprint (see getGridSizeFromSize) since
// that's the real SWSE rule, but a Small character's token looking exactly as big as a Medium
// one on the grid reads wrong at the table - this shrinks the token's *texture* within its
// still-1x1 square (doesn't touch width/height, so movement/reach/collision are unaffected).
export function getTokenTextureScaleFromSize(size) {
    switch (size) {
        case "Fine":
            return 0.25;
        case "Diminutive":
            return 0.4;
        case "Tiny":
            return 0.6;
        case "Small":
            return 0.8;
        default:
            return 1;
    }
}