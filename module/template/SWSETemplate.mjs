// Historical Foundry MeasuredTemplate default cone angle, preserved since V14 has no
// equivalent CONFIG entry now that MeasuredTemplate has been removed.
const CONE_ANGLE_DEFAULT = 53.13;

function buildShapeData(target) {
    const distance = canvas.dimensions.distancePixels;
    const size = (target.size ?? 1) * distance;

    switch (target.shape) {
        case "cone":
            return {type: "cone", x: 0, y: 0, radius: size, angle: CONE_ANGLE_DEFAULT};
        case "rect":
            return {type: "rectangle", x: 0, y: 0, width: size, height: size};
        case "circle":
        default:
            return {type: "circle", x: 0, y: 0, radius: size};
    }
}

export default class SWSETemplate {
    /**
     * Interactively places one Region per target.count for the given attack.
     * @param {Attack} attack
     * @return {Promise<RegionDocument[]>} the placed regions (placements the user cancelled are omitted)
     */
    static async fromAttack(attack) {
        const target = attack.template ?? {};
        if (!target.shape) return [];

        const count = target.count || 1;
        const regions = [];
        for (let i = 0; i < count; i++) {
            const region = await canvas.regions.placeRegion({
                name: attack.name,
                color: game.user.color,
                shapes: [buildShapeData(target)],
                flags: {swse: {cleanUp: !!target.cleanUp}}
            }, {
                allowRotation: !target.disableRotation
            });
            if (region) regions.push(region);
        }
        return regions;
    }
}
