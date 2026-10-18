# Now playing

The Now playing tab shows the bar being heard as a step grid (lit step follows the audio) above the song form: one row per section with a strip of colour blocks (one colour per distinct bar pattern). The playing section's strip is a slider: tap a block to jump to that bar. Section names are `Jump to <section>` buttons; `Loop <section>` toggles a section loop.

## Sub-features

- `np-sync` step grid and bar ring stay within ~10 ms of the heard audio, no drift, also after seek, loop and tempo change.
- `np-jump` `Jump to <section>` moves playback; the `Bar in <section>` slider jumps to a bar.
- `np-loop` `Loop <section>` loops it.

## How to get to it (user POV)

- Open the player sheet, tap `Now playing`, press `Play`.

## Driving it with verify.sh and Playwright

Preconditions:

- Doctor is all ok; the box is otherwise idle for the sync check.

- **Sync.** Run `verify.sh nowplaying-sync`. Rows `ok` with median/p95/drift; final `sync ok`.
- **Jump.** `tests/e2e/nowplaying.spec.ts`: Killing in the Name, Play, tap the last block of the `Bar in ...` slider, its `aria-valuenow` becomes the last bar; `Jump to Chorus` makes `Bar in Chorus` appear.

## Gotchas

- The bar ring is the `span.ring-amber` inside `[role=slider]`; only the playing section's strip is interactive.
- A lone sync FAIL on a busy box is usually noise; rerun once before investigating.
