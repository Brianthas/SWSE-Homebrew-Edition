# SWSE-Homebrew-Edition

Fork of the Star Wars Saga Edition system for Foundry. Root `CLAUDE.md` and `RULES.md` apply here
too; what follows is release mechanics and fork-specific traps recorded in `Mistakes.MD`.

Rules questions go to <https://swse.fandom.com/wiki/Star_Wars_Saga_Edition_Wikia> for RAW and
<http://tovec.wikidot.com/episode-vii> for Bryan's homebrew, which outranks RAW. Do not infer
mechanics from the fork's own code or data.

## Codebase-wide sweeps

**Search `module_test/` alongside `module/`.** Quench tests register during the `init` hook, so it
is live code, not dead weight, and a deprecation sweep that skips it leaves half the job undone.

## ApplicationV2

When migrating a `renderX` hook, fixing the argument type is only half of it. **V2 re-renders in
place and will not clean up after you**, so any DOM injection must be idempotent: remove your own
previous container before appending. Skipping this filled a user's compendium sidebar with dozens
of dead duplicate buttons during normal use.

## Cutting a release

Sequence: bump `version` in `system.json` and point its `download` URL at the new tag's asset, copy
`system.json` to the live Foundry copy, commit as "Bump to vX.Y.Z", tag `vX.Y.Z`, push both, then
`gh release create` with the zip attached, then delete the staging directory.

Release title is `vX.Y.Z - short summary`; notes are prose with `###` headings explaining the
user-facing change and its root cause.

The zip is `swse-homebrew-edition-vX.Y.Z.zip`, containing a single wrapper folder
`SWSE-Homebrew-Edition-vX.Y.Z/` holding exactly `css`, `icon`, `lang`, `module`, `packs`,
`templates`, `system.json`, `template.json`. No `scss`, `scripts`, `module_test`, `node_modules`,
`package.json`, `gulpfile.js` or markdown docs.

**Two exclusions that are easy to get wrong, because both live inside `packs/`:**

1. **`packs/_source/` does not ship.** It is the tracked JSON that compiles into the LevelDB packs
   via `npm run packs:pack` - build input, not content. Including it takes the download from 26 MB
   to 37 MB. Note the inversion against every other directory here: the compiled packs are
   gitignored local artifacts while `_source` is what git tracks, so "what is in git" is exactly
   the wrong instinct for deciding what ships.
2. **Only the packs `system.json` declares ship.** As of v1.4.6 three compiled directories on disk
   were undeclared leftovers: `force-regimes` (the real one is `force-regimens`),
   `starship-maneuvers`, and a URL-encoded `vehicle-base%20types`. Foundry never loads undeclared
   directories. v1.4.5 shipped the last one by accident.

Windows notes: `Compress-Archive` fails on the staged tree (MAX_PATH) - use
`C:\Windows\System32\tar.exe -a -c -f out.zip <folder>`. And a Unix-style `/c/Users/...` path handed
to node or PowerShell gets rooted at `C:\c\`, so pass `C:/Users/...` instead.

Verify after publishing: the raw manifest URL reports the new version, and the release download URL
returns HTTP 200. Then delete the staged tree and the zip.

## Editor type checking and lint

`jsconfig.json` points at `fvtt-types`, which npm installs as an alias of
`@league-of-foundry-developers/foundry-vtt-types`, so `game`, `CONFIG` and `Hooks` resolve in the
editor and a mistyped document key is flagged instead of failing silently in Foundry.

`checkJs` is off. Turning it on across `module/`, `module_test/` and `scripts/` reports 1811 errors,
765 of them "property does not exist", concentrated in `module/actor/actor-sheet.mjs`,
`module/actor/actor.mjs` and `module/item/item.mjs`. Opt a single file in with `// @ts-check` on
line 1.

`eslint.config.mjs` is flat config on eslint 10, run with `npm run lint`. It reads 153 files, 148
of them `.mjs`. Check that number when a run looks clean: eslint 8 with `.eslintrc.json` linted
only `.js` when handed a directory, so it read 5 files, reported one error, and silently skipped
the entire module.

`no-undef` is off because fvtt-types checks globals more accurately than a hand-maintained list.
Style rules that fire in the hundreds here (`no-case-declarations`, `no-extra-boolean-cast`) are
demoted to warnings so that every error is something that can misbehave at runtime. Current run:
0 errors, 218 warnings. Keep the error count at zero; the warnings are a separate cleanup.

## Tests

`npm test` runs `node --test` over `module_test/**/*.test.mjs`: 96 tests, 94 passing. The two
failures are in `module_test/actor.test.mjs`, which asserts `firstAid.perDay` and
`forcePoints.quantity` against the mock actor in `module_test/setup.mjs` and has never passed.

`module_test/setup.mjs` hand-rolls the Foundry globals the module graph touches at import time.
Anything reaching a new part of that graph will fail on an undefined global rather than on an
assertion; add the stub rather than working around it. The list of what is needed comes from
`grep -rho "foundry.applications.[A-Za-z0-9_.]*" module/`.

The 17 files under `module_test/quench/` register Quench batches and only execute inside a running
Foundry world. Under `node --test` they import cleanly and contribute no assertions, so a green
`npm test` says nothing about them.
