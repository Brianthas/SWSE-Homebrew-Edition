/**
 * Base TypeDataModel for Item system data.
 *
 * V14 deprecates the legacy template.json auto-inferred schema (removed in V16) in favor of
 * explicit TypeDataModel classes registered via CONFIG.Item.dataModels. Without one, item system
 * data silently resets to template.json's bare defaults on every prepareData() pass after the
 * first - this class (and the per-type classes built on it) is the fix.
 */
export default class ItemSystemDataModel extends foundry.abstract.TypeDataModel {
    /**
     * Item type that this system data model represents (e.g. "weapon", "armor").
     * @type {string}
     */
    static _systemType;
}
