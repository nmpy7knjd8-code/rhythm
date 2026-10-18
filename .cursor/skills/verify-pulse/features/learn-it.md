# Learn it

The Learn it tab teaches the section that is playing: section pills, the bar strip, a sticky practice bar (Slower/Faster in 5% steps, Steps, Loop; Play is the sheet header's, always visible above the scroller), bar notation with the count (the count-in number overlays it), steps that build the part up layer by layer, a practice tempo ladder, speed trainer, count-in/click/voice, and limb mute/solo. Sections where the drums sit out show "No drums here" and a button to the next drum section.

## Sub-features

- `learn-lesson` every section builds a sound lesson (unit invariants over all songs).
- `learn-silent` a section without drums shows "No drums here" and `Go to <next drum section>`.
- `learn-steps` Steps opens "Step 1 of N"; Next/Previous walk unique titles ending on "The full part".
- `learn-sync` the amber step lights when the note is heard.
- `learn-names` section pills show clean names (no `[A]`, no `- 8 bars`).
- `learn-bar` the practice bar sits above the notation, sticks while scrolling, and its controls work.
- `learn-layout` every control is 44 px or more, the count-in moves nothing, "About this section" (summary + kit) starts collapsed.
- `learn-progress` settings persist in localStorage (`pulse.learn.v1`); a whole-section loop of the full part records the best tempo; 'Best N%, when' at the right of the grey meter line under '<section> · bar N' (no layout shift on first save) and 'Review <section>: N%, N days ago' under the pills. Mutes and solos are not kept.
- `learn-trainer` speed trainer: From / To / Climb / Loops selects; starts at From, climbs only after that many full loops (first bar round to first bar at one tempo), stops at To.
- `learn-callresp` 'I play, you play': bars alternate between the part and the click alone ('Listen' / 'Your turn: play this bar').
- `learn-visual` screenshot baselines for 6 songs x idle / steps / playing.

## How to get to it (user POV)

- Open the player sheet, tap `Learn it`, tap a section pill (or let it follow playback).

## Driving it with verify.sh and Playwright

Preconditions:

- Doctor is all ok.

- **Lesson quality.** Run `verify.sh unit`. `# fail 0`; a failure lists `song #section "name": problem` lines.
- **Silent section.** `tests/e2e/learn.spec.ts` "a section without drums...": Schism section 0 shows `No drums here`, no `Steps` button; tapping `Go to ...` selects that pill (`aria-pressed=true`) and the notation appears.
- **Steps.** Same spec, "repeated beats...": Come Together `Chorus`, tap `Steps`, walk `Next` until disabled; titles are unique and end with `The full part`.
- **Practice bar and layout.** `tests/e2e/layout.spec.ts`: toolbar `Practice` above the notation and pinned to the scroller top after scrolling 900 px; `Slower` makes `95%` and moves the `Practice tempo` slider; `Loop` toggles `aria-pressed`; no button under 44x44; notation and step card keep their y while the count-in number shows.
- **Progress.** `tests/e2e/progress.spec.ts`: Chop Suey section 0 (one bar) at 95% records `Best 95%, today` and it survives a reload; saving the first best leaves the notation where it was; a step does not count; Count-in persists for every song, a mute does not persist; a seeded two-day-old record shows `Review Verse 1: 85%, 2 days ago` and tapping it opens Verse 1. Store logic: `tests/memory.test.ts` (part of `verify.sh unit`).
- **Trainer and call-and-response.** `tests/e2e/trainer.spec.ts`: Chop Suey section 0 with From 80, To 90, Climb +5, Loops ×1 stays 80% inside the first bar, then 85%, 90%, `At 90%.`, never past; Back in Black Verse 1 with `I play, you play` schedules drum strokes only in alternate bars and clicks in the others (observed by wrapping `__pulseEngine.play`/`click`), and shows `Your turn: play this bar`. With both on, a heard bar and the played bar after it count as one loop, so the climb lands on a heard bar (`L80, Y80, L85`).
- **Screenshots.** `npx playwright test visual` (local only). Fails on any unmasked pixel change over 0.2%.
- **Sync.** Run `verify.sh learn-sync`. Every row `ok`, final `sync ok`.

## Gotchas

- Progress lives in the browser profile; a fresh Playwright context starts empty. Seed it with `page.addInitScript` writing `pulse.learn.v1` when a journey needs history.

- `getByRole('dialog')` finds nothing while the sheet is closed (it is `aria-hidden`); use `[role=dialog]`.
- Section index != pill text; look the pill up by text when the index matters.
- The lesson test loads songs with its own loader (`load()` in `tests/learn.test.ts`), mirroring `loadSongBars`; a new field in the song files may need adding there too.
