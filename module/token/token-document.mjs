export class SWSETokenDocument extends TokenDocument {
    getBarAttribute(barName, options = {}) {
        // An unlinked token is prepared with its scene at world load, before its synthetic actor
        // exists; core returns null for that case, and reading through a null actor here threw
        // "Failed data preparation for Scene...Token" first.
        this.actor?.health;
        this.actor?.shields;
        return super.getBarAttribute(barName, options);
    }
}