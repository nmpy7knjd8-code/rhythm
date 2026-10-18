# Pulse verification map

The maintained source for proving Pulse's user-facing behaviour. Read this index, then use the feature file as the recipe.

## Baseline preconditions

- `verify.sh launch` has built `dist/` and serves it at `http://localhost:4173/rhythm/`; `verify.sh doctor` is all `ok`.
- Headless Chromium, 390x844, touch, `--autoplay-policy=no-user-gesture-required` (see `playwright.config.ts`).
- No seed data: songs ship in `public/songs/*.json` and `src/data/songs.json`. Practice choices are per browser context, so each Playwright test starts clean.
- Never drive a preview this run did not start.

## Driving conventions

- Load songs with `window.__pulseLoadSong(id, 1)`, open the sheet with `Browse rhythms`, then tap tabs and controls by role and accessible name.
- Prefer roles and names; `tests/e2e/app.ts` has the shared helpers.
- Read timing from `window.__pulseEngine` (timeline, audio clock); never set app state through it.

## Proof and skip reporting

- Capture the action and the resulting state: log rows with numbers, a 390 px screenshot for visual changes.
- Report a check you could not run with the command and the unmet precondition; do not count a different path as that check.

## Features

- [learn-it.md](learn-it.md): section lessons, steps, tempo ladder, practice tools.
- [now-playing.md](now-playing.md): step grid, form strip, jumping and looping, sync with the audio.
- [playback.md](playback.md): every song plays through correctly.
- [accessibility.md](accessibility.md): axe scan of the main states.
