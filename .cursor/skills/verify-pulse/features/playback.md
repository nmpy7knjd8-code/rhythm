# Playback

Every song in the library plays from the first bar to the last and wraps, scheduling exactly the hits written in its data file, in order, once.

## Sub-features

- `play-all` all songs play through at 8x.
- `play-one` a single song (or a comma list) after a data change.

## How to get to it (user POV)

- Pick a song in the library and press Play.

## Driving it with verify.sh

Preconditions:

- Doctor is all ok.

- **All songs.** Run `verify.sh playthrough`. One `ok` row per song (`bars N/N wrapped=true hits ... dup=0`), final `all songs played through`.
- **Some songs.** Run `verify.sh playthrough killing,change`.

## Gotchas

- Takes several minutes for the full library; it runs 6 pages in parallel.
- The hit count allows skipped duplicates (`+N skipped`); `dup` must be 0.

## Sync with the sound (audio delay)
- The highlight follows `engine.heardNow()` = context time − `engine.latency()`: the browser's reported output + base latency, read from the **native** AudioContext (`src/engine/clock.ts`; Tone's standardized-audio-context wrapper hides `outputLatency`), plus the sound route's delay.
- Route and delay live in `src/midi/kit.ts` (`pulse.kit.v1`, `delays` per route; Bluetooth starts at 200 ms, cable/device at 0). The same delay shifts kit scoring.
- UI: "Sync with the sound" (`src/ui/sync.tsx`) at the end of Now playing and in Learn it (inside Kit settings when the kit panel is open): route picker, Tap along (20 clicks, tap or hit a pad), −/+ 10 ms.
- Tests: `tests/clock.test.ts` (wrapper vs native, Safari 0 latency, route delay); `tests/e2e/sync.spec.ts` (Bluetooth adds 200 ms in both tabs, nudge, tap-along measures ~180 ms and persists per route). `learn-sync`/`nowplaying-sync` measure against `engine.latency()`.
- Headless can't hear: the real device delay is only known from a calibration on that device.
