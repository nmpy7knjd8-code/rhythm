---
name: verify-pulse
description: Prove Pulse (the drum-groove web app in this repo, React + Vite + Tone.js, deployed to GitHub Pages) works the way a drummer uses it at 390 px - Learn it lessons, Now playing visuals in sync with the audio, every song playing through. Reach for it before merging any change to src/, public/songs/ or the lesson code, and whenever something about playback, Learn it or the song data looks off.
---

# Verify Pulse

Pulse is a single-page web app. The surface is the player sheet (`[role=dialog]`) with two tabs that matter most: **Learn it** (section lessons) and **Now playing** (step grid and form). Everything is static: `vite build` writes `dist/`, `vite preview` serves it at `http://localhost:4173/rhythm/`. No backend, no auth, no data dir; practice choices and best tempos live in the browser's localStorage (`pulse.learn.v1`).

Helper: `.cursor/skills/verify-pulse/verify.sh` (executable, works from any cwd). `verify.sh` with no argument prints its commands.

## Launch

```bash
.cursor/skills/verify-pulse/verify.sh launch
```

Runs `npm ci` if needed, installs Playwright's Chromium, `npm run build` (song validation, override checks, tsc, vite build), then starts `vite preview --port 4173 --strictPort` in the background with its pid in `.verify/preview.pid`, and runs doctor. Ready = doctor prints all `ok`. It refuses to start if something it didn't start already owns :4173. Teardown is `verify.sh stop`.

## Doctor

```bash
.cursor/skills/verify-pulse/verify.sh doctor
```

Read-only. Checks: the preview pid is ours and alive, `/rhythm/` answers, the served page is byte-identical to `dist/index.html` (right build), the JS bundle and a song file (`songs/killing.json`) load, and no file under `src/`, `public/` or `index.html` is newer than the build (stale build = rerun `launch`). Run it first whenever a check fails oddly.

## Drive

Every check drives the real build in headless Chromium at 390x844 (touch, autoplay allowed). Songs load through the app's own `window.__pulseLoadSong(id, 1)`; the sheet opens with the `Browse rhythms` button when it is closed; tabs are buttons named `Learn it` and `Now playing`.

| Command | What it proves | Pass rule |
|---|---|---|
| `verify.sh unit` | `npm run lint` (errors fail), then `tests/memory.test.ts` (saved progress store) and `tests/learn.test.ts`: every lesson of every song (1,441+) - no steps on sections without drums, unique step titles, steps are growing subsets that end on the full part with no note dropped, 60/80/100% tempo ladder, counts fill each bar, the feel sentence matches the counts, no tab markers in section names, no drummer names in prose | `# fail 0` |
| `verify.sh e2e` | `tests/e2e/*.spec.ts` (Playwright): Learn it journeys (no-drums section jumps on, numbered step titles, clean names), the practice bar (sticky, controls work, 44 px targets, count-in moves nothing, summary/kit collapsed), screenshot baselines (`visual.spec.ts`: 6 songs x idle/steps/playing, moving parts masked; local only), Now playing strip jump, axe WCAG 2.2 A/AA + best-practice scan of Learn idle / steps open / playing / silent section and Now playing | all passed; any serious or critical axe finding fails |
| `verify.sh learn-sync` | `tests/learn-sync.mjs`: the Learn it amber cell moves when the note is heard (audio-context clock, output + base latency, one frame) | `sync ok` |
| `verify.sh nowplaying-sync` | `tests/nowplaying-sync.mjs`: Now playing step grid and bar ring vs heard audio across dense, odd-meter and tempo-change songs, seek, loop, tempo change | `sync ok` |
| `verify.sh playthrough [id,id]` | `tests/playthrough.mjs`: each song (default all) at 8x reaches its last bar and wraps, schedules every hit in the data once, in bar order | `all songs played through` |
| `verify.sh all` | launch, doctor, all five checks, stop | `ALL CHECKS PASSED` |

Screenshot baselines live in `tests/e2e/__screenshots__/` and use this box's fonts, so CI skips `@visual` tests. After an intended layout change run `npx playwright test visual --update-snapshots` and look at every changed PNG before committing; a diff you did not intend is a regression.

Stable handles to use in new checks: `[role=dialog]` (sheet; hidden from the a11y tree while closed, so not `getByRole`), `getByLabel('Sections')` (Learn section pills, the active one has `aria-pressed=true`), `[aria-label$=" bars"] button` (Learn bar strip, `Learn bar N`), `getByRole('img', { name: 'Bar notation with the count under each beat' })`, `[data-s].bg-amber\/20` (lit step), the `Practice` toolbar (`getByRole('toolbar', { name: 'Practice' })`: `Play`/`Stop`, `Slower`, `Faster`, `Steps`, `Loop`), buttons `Next` / `Previous` / `Start NN` / `Middle NN` / `Full NN`, slider `Practice tempo`, Now playing `Jump to <section>` buttons and the playing section's `Bar in <section>` slider. Playwright helpers: `tests/e2e/app.ts` (`openSong`, `pickSection`, `sheet`).

## Evidence

Each run writes `.verify/<run>/<check>.log` (stdout+stderr of the check) and Playwright writes `playwright-report/` (axe findings attached per state, traces on failure in `test-results/`). A proof is the log lines (the per-song `ok`/`FAIL` rows with their numbers), not a summary. For a UI change also capture a 390 px screenshot of the changed state through the real path (load song, open tab, tap the control) and the state after the action. Exercise the real user path (buttons, sliders); `window.__pulseEngine` is fine for reading timing (timeline, audio clock), never for setting state the UI should set. Sync numbers are only meaningful on an otherwise idle box; rerun a lone FAIL before calling it a regression.

## Cleanup

```bash
.cursor/skills/verify-pulse/verify.sh stop
```

Kills only the pid in `.verify/preview.pid`, never by name. Evidence in `.verify/` and `playwright-report/` stays (both gitignored).

## Feature map

`features/README.md` indexes the user-facing features and how to prove each. Keep it honest when the app changes (`/maintain-verification-skill`).

## CI

`.github/workflows/test.yml` runs lint, `test:learn`, build and the Playwright suite on every pull request and every push to main; the Pages deploy also runs `test:learn` before it builds. The sync and playthrough checks need real audio timing and minutes of playback, so they run here, not in CI.
