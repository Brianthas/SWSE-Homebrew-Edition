/**
 * The per-player "Sheet Size" setting. Applied through Foundry's own application scale
 * (position.scale, rendered as transform: scale()), which enlarges text and layout together, so
 * nothing clips, and which both setPosition implementations already account for when keeping a
 * window on screen. Core Font Size cannot do this job: it sets the root font size, and most sheet
 * text is sized in px.
 */
export function sheetScale() {
    // Stored as a whole percentage (100-200).
    return (Number(game.settings.get("swse", "sheetScale")) || 100) / 100;
}

/**
 * The sheet's default width and height (AppV2 keeps them in options.position, AppV1 in options).
 * Used whenever the scale changes: the size a window was clamped to at one scale is wrong at
 * another, so a sheet squeezed to 960x540 to fit at 200% reopened at 960x540 at 100%.
 */
export function defaultSheetSize(app) {
    const {width, height} = app.options.position ?? app.options;
    return {width, height};
}

/**
 * Applies the current setting to SWSE sheets that are already open. AppV1 sheets live in
 * ui.windows, AppV2 sheets in foundry.applications.instances; both carry the "swse" and "sheet"
 * classes set in their default options. Width and height must be passed because AppV1 only
 * clamps a window to the viewport when they are given: without them a 1000px sheet at 200% ran
 * 2000px wide on a 1920px screen.
 */
export function rescaleOpenSheets() {
    const scale = sheetScale();
    const apps = [...Object.values(ui.windows), ...foundry.applications.instances.values()];
    for (const app of apps) {
        const classes = app.options?.classes ?? [];
        if (classes.includes("swse") && classes.includes("sheet") && app.rendered) {
            app.setPosition({scale, ...defaultSheetSize(app)});
        }
    }
}
