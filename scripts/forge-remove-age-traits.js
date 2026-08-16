/**
 * Run as a GM, in a Script macro or the F12 console.
 *
 * Removes the six age-category traits (Child / Young adult / Adult / Middle age / Old /
 * Venerable) from every actor in the world, plus any unlinked tokens on any scene. Species used
 * to grant all six at once, and their ability modifiers stacked - STR -10, CON -10, DEX -8,
 * INT/WIS/CHA +1 - so removing them restores correct ability scores.
 *
 * Safe to run more than once; it only touches actors that still have them.
 */
(async () => {
  const AGE_TRAITS = ["Child", "Young adult", "Adult", "Middle age", "Old", "Venerable"];
  const report = [];

  // Matches on type as well as name so a same-named non-trait item is never removed.
  const ageTraitIds = (actor) =>
    actor.items.filter((i) => i.type === "trait" && AGE_TRAITS.includes(i.name)).map((i) => i.id);

  const strip = async (actor, label) => {
    const ids = ageTraitIds(actor);
    if (!ids.length) return 0;
    await actor.deleteEmbeddedDocuments("Item", ids);
    report.push(`${label}: removed ${ids.length}`);
    return ids.length;
  };

  let total = 0;
  for (const actor of game.actors) total += await strip(actor, actor.name);

  // Unlinked tokens keep their own copy of the actor's items, so the world sweep misses them.
  for (const scene of game.scenes) {
    for (const token of scene.tokens) {
      if (token.actorLink || !token.actor) continue;
      total += await strip(token.actor, `[${scene.name}] ${token.name}`);
    }
  }

  const summary = total
    ? `Removed ${total} age trait(s) across ${report.length} actor(s)/token(s).`
    : "No age traits found - nothing to do.";
  console.log(summary, report);
  ui.notifications.info(summary);
})();
