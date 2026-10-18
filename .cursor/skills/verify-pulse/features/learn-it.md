# Learn it

The Learn it tab teaches the section that is playing: section pills, the bar strip, bar notation with the count, steps that build the part up layer by layer, a practice tempo ladder, speed trainer, count-in/click/voice, and limb mute/solo. Sections where the drums sit out show "No drums here" and a button to the next drum section.

## Sub-features

- `learn-lesson` every section builds a sound lesson (unit invariants over all songs).
- `learn-silent` a section without drums shows "No drums here" and `Go to <next drum section>`.
- `learn-steps` Steps opens "Step 1 of N"; Next/Previous walk unique titles ending on "The full part".
- `learn-sync` the amber step lights when the note is heard.
- `learn-names` section pills show clean names (no `[A]`, no `- 8 bars`).

## How to get to it (user POV)

- Open the player sheet, tap `Learn it`, tap a section pill (or let it follow playback).

## Driving it with verify.sh and Playwright

Preconditions:

- Doctor is all ok.

- **Lesson quality.** Run `verify.sh unit`. `# fail 0`; a failure lists `song #section "name": problem` lines.
- **Silent section.** `tests/e2e/learn.spec.ts` "a section without drums...": Schism section 0 shows `No drums here`, no `Steps` button; tapping `Go to ...` selects that pill (`aria-pressed=true`) and the notation appears.
- **Steps.** Same spec, "repeated beats...": Come Together `Chorus`, tap `Steps`, walk `Next` until disabled; titles are unique and end with `The full part`.
- **Sync.** Run `verify.sh learn-sync`. Every row `ok`, final `sync ok`.

## Gotchas

- `getByRole('dialog')` finds nothing while the sheet is closed (it is `aria-hidden`); use `[role=dialog]`.
- Section index != pill text; look the pill up by text when the index matters.
- The lesson test loads songs with its own loader (`load()` in `tests/learn.test.ts`), mirroring `loadSongBars`; a new field in the song files may need adding there too.
