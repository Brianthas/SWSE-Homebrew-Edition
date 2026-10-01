// Who an attack card's Apply button reaches, and with how much.

const MISSED = ["Miss", "Automatic Miss"];

/**
 * PF2e-style: the tokens selected on the map when the button is clicked take the attack's damage.
 * With nothing selected, the targets recorded when the attack was rolled do instead: those it hit
 * take their damage, a missed one takes nothing, and an area attack's near miss ("Half Damage")
 * takes half. Heal reaches every recorded target.
 *
 * Half and Double scale the amount before the target's own reduction and immunities apply
 * (SWSEActor#applyDamage).
 *
 * A card rolled before this redesign has no `base`: it records no damage type or lightsaber flag,
 * so it applies to its roll-time targets only, as it always did, and selected tokens are ignored.
 *
 * @param type {"damage"|"half"|"double"|"heal"}
 * @param selected {SWSEActor[]} actors of the tokens selected on the map
 * @param summaries {{uuid: string, result: string, damage: number, damageType: string, lightsaber: boolean}[]} targets from the roll
 * @param base {{damage: number, damageType: string, lightsaber: boolean}|null} the roll's damage, for selected tokens
 * @param resolveActor {function(string): SWSEActor|undefined}
 * @return {{actor: SWSEActor, amount: number, damageType: string, lightsaber: boolean}[]}
 */
export function planApplications(type, {selected = [], summaries = [], base = null, resolveActor = () => undefined} = {}) {
    const scale = amount => {
        const n = Number(amount) || 0;
        return type === "half" ? Math.floor(n / 2) : type === "double" ? n * 2 : n;
    };
    if (base && selected.length > 0) {
        return selected.map(actor => ({actor, amount: scale(base.damage), damageType: base.damageType ?? "", lightsaber: !!base.lightsaber}));
    }
    return summaries
        .filter(s => type === "heal" || !MISSED.includes(s.result))
        .map(s => ({
            actor: resolveActor(s.uuid),
            amount: scale(s.result === "Half Damage" && type !== "heal" ? Math.floor((Number(s.damage) || 0) / 2) : s.damage),
            damageType: s.damageType ?? "",
            lightsaber: !!s.lightsaber
        }))
        .filter(application => !!application.actor);
}
