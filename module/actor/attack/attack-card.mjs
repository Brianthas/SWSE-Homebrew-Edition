// What the attack and damage chat cards draw, built from a resolved attack (Attack#resolve) or a
// damage-only roll (Attack#resolveDamageOnly). The templates only lay this out.
import {diceText, modifierChips, naturalD20, summarizeRoll} from "../../common/roll-summary.mjs";

const FALLBACK_IMG = "icons/svg/sword.svg";

// First match wins: "Energy (Ion)" is Ion, not Energy.
const DAMAGE_TYPE_KEYS = [
    ["ion", "ion"], ["stun", "stun"], ["sonic", "sonic"], ["burn", "burn"], ["fire", "burn"],
    ["energy", "energy"], ["physical", "physical"], ["bludgeon", "physical"], ["pierc", "physical"], ["slash", "physical"]
];

/** A CSS-safe key for coloring a damage type's badge. */
export function damageTypeKey(type) {
    const text = `${type ?? ""}`.toLowerCase();
    return DAMAGE_TYPE_KEYS.find(([match]) => text.includes(match))?.[1] ?? "other";
}

const VERDICTS = {
    "Critical Hit!": {label: "Critical", key: "critical"},
    "Hit": {label: "Hit", key: "hit"},
    "Half Damage": {label: "Half", key: "half"},
    "Automatic Miss": {label: "Auto Miss", key: "miss"},
    "Miss": {label: "Miss", key: "miss"}
};

/** One roll as the card shows it: the total, the natural d20, chips and the dice. */
export function rollView(roll, {d20 = false, critical = false, fail = false} = {}) {
    const summary = summarizeRoll(roll);
    return {
        roll,
        total: roll?.total ?? roll?._total,
        natural: d20 ? naturalD20(summary) : undefined,
        critical,
        fail,
        chips: summary.complex ? [] : modifierChips(summary),
        dice: summary.complex ? summary.formula : diceText(summary)
    };
}

export function targetView(target) {
    const verdict = VERDICTS[target.result] ?? {label: target.result ?? "", key: "miss"};
    return {
        name: target.name,
        defense: target.defenseType && target.defense !== undefined ? `${target.defenseType} ${target.defense}` : "",
        conditionalDefenses: target.conditionalDefenses ?? [],
        verdict: verdict.label,
        verdictKey: verdict.key
    };
}

/** "Short range", or "Out of range" (Attack#getDistanceModifier's band names). */
export function rangeLabel(range) {
    if (!range) return "";
    return /range/i.test(range) ? range.charAt(0).toUpperCase() + range.slice(1) : `${range} range`;
}

/**
 * The button payload for applying this attack to tokens selected on the map: the damage before
 * anything a target's own defenses do, its type, and whether a lightsaber dealt it.
 */
function applyPayload(damage, damageType, lightsaber) {
    return JSON.stringify({damage: Number(damage) || 0, damageType: damageType ?? "", lightsaber: !!lightsaber});
}

/**
 * @param resolved {{rangeBreakdown: object[], attackSummaries: string}} Attack#resolve's result
 * @param attack {Attack}
 */
export function attackCardView(resolved, attack) {
    const item = attack.item;
    const bands = (resolved.rangeBreakdown ?? []).map(band => ({
        range: band.range,
        rangeLabel: rangeLabel(band.range),
        attack: rollView(band.attack, {d20: true, critical: band.critical, fail: band.fail}),
        damage: rollView(band.damage, {critical: band.critical}),
        damageMuted: !!band.fail,
        targets: (band.targets ?? []).map(targetView),
        notes: band.notes ?? []
    }));
    const damageType = resolved.rangeBreakdown?.[0]?.damageType ?? attack.type;
    return {
        name: attack.name,
        img: item?.img || FALLBACK_IMG,
        subtitle: item?.system?.subtype ?? "",
        damageType,
        damageTypeKey: damageTypeKey(damageType),
        critical: bands.some(b => b.attack.critical),
        fail: bands.length > 0 && bands.every(b => b.attack.fail),
        bands,
        hasTargets: bands.some(b => b.targets.length > 0),
        attackSummaries: resolved.attackSummaries ?? "[]",
        apply: applyPayload(bands[0]?.damage.total, damageType, attack.isLightsaberAttack),
        notesHTML: attack.notesHTML
    };
}

/**
 * @param resolved {{damage: Roll, critical: boolean, targets: object[], damageType: string, attackSummaries: string}} Attack#resolveDamageOnly's result
 * @param attack {Attack}
 */
export function damageOnlyCardView(resolved, attack) {
    const item = attack.item;
    return {
        name: attack.name,
        img: item?.img || FALLBACK_IMG,
        damageType: resolved.damageType,
        damageTypeKey: damageTypeKey(resolved.damageType),
        critical: !!resolved.critical,
        damage: rollView(resolved.damage, {critical: resolved.critical}),
        targets: resolved.targets ?? [],
        attackSummaries: resolved.attackSummaries ?? "[]",
        apply: applyPayload(resolved.damage?.total, resolved.damageType, attack.isLightsaberAttack),
        notesHTML: attack.notesHTML
    };
}

// The penalties a Full Attack put on every attack (attackDelegate.mjs fullAttackPenalties).
const ROUND_PENALTY_SOURCES = ["Dual Weapon", "Double Attack", "Triple Attack", "Multiple Attack Reduction"];

/** "−5 Dual Weapon, −5 Double Attack", read off the first attack's modifiers. */
export function roundPenaltyText(attacks) {
    return (attacks[0]?.options?.modifiers ?? [])
        .filter(m => ROUND_PENALTY_SOURCES.includes(m.source))
        .map(m => `${m.value < 0 ? "−" : "+"}${Math.abs(m.value)} ${m.source}`)
        .join(", ");
}
