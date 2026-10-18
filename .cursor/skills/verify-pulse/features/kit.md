# Electronic kit (Web MIDI)

Learn it can listen to an electronic drum kit over USB MIDI (Chrome and Edge on Android and desktop; Safari has no Web MIDI, so the UI hides there). Code: `src/midi/` (pure: pad map, scorer, calibration, output clock; `kit.ts` holds the connection and saved settings in localStorage `pulse.kit.v1`) and `src/ui/kit.tsx` (scoring hook, readout, settings).

## Sub-features

- `kit-connect` a small `Connect kit` pill in Learn it's options row; tapping it asks for MIDI and opens `Kit settings`. A kit already allowed connects silently and only the readout appears.
- `kit-map` Nitro Pro default notes (user guide §5.2) plus General MIDI; any zone of a drum is that drum (hat open/half/closed, snare head/rim, crash/china), toms stay apart. `Set up pads` learns your own notes.
- `kit-score` each heard note (engine timeline -> `getOutputTimestamp` -> performance.now) is matched to hits by `MIDIMessageEvent.timeStamp` minus the calibrated offset: within 30 ms `On time`, up to 100 ms `← Early` / `Late →` (window capped at half the gap to the same drum's neighbours), else missed; a hit near another drum's note is `Wrong drum`. Marks sit under the notes (blue ←, green •, rose →, grey ×); an off-grid stroke (roll, 32nd) of that drum in the step never overwrites the on-step note's mark (`src/midi/marks.ts`). One fixed-height readout line, so nothing moves while playing.
- `kit-voices` only what you're meant to play is expected: soloed voices, else the muted ones (you fill them in), else everything, within Hands/Feet only (`scoredVoices` in `src/midi/map.ts`). Drums Pulse still plays are never missed.
- `kit-route` `Pulse sound`: Aux cable (recommended), this device, Bluetooth; each keeps its own offset.
- `kit-calibrate` 24 clicks, hit any pad with each; median of (hit − heard click) after the first 4, strays dropped.
- `kit-loop` a whole-section loop gets `Last loop N%` (on time 1, early/late 0.5, miss 0) and the section's best is kept.
- `kit-trainer` with a kit connected the speed trainer counts only loops scoring 85%+ (`PASS` in `src/midi/score.ts`); the hint reads `at 85%+`.
- `kit-wait` `Wait mode` (kit only): playback stops, the amber cursor sits on the next note and the readout says `Hit Hi-hat + Kick`; it moves on once every drum of that note is hit (any order), `Wrong drum: …` otherwise; wraps in the loop or section; pressing Play leaves it.
- `kit-remote` Tom 1 + Tom 2 + kick within 80 ms start playback while stopped (never stops it, so a fill can't). Melodics uses a similar combo.

## How to prove

- Unit: `tests/midi.test.ts` (in `verify.sh unit`): note map, note-on parsing, verdicts, matching, windows, wrong drum, sweep, calibration median, scored voices, mark priority.
- Browser: `tests/e2e/kit.spec.ts` with the fake kit in `tests/e2e/kit.ts` (`mockKit` replaces `navigator.requestMIDIAccess` before load; `hitNext(page, deltaMs)` stamps a hit relative to the next due note from `window.__pulseScorer`, read-only). Covers connect, auto-connect, On time/Early/Late/Wrong drum with marks and no layout shift, calibration to 120 ms and scoring with it (and it survives reload), a perfect loop = 100% + best, pad setup, that each note's due time agrees with the engine's heard clock within 15 ms, the trainer holding at 80% through silent loops then climbing once played, wait mode (wrong drum holds, the right drums advance; only the scored voices are waited for), and the remote combo (starts when stopped, ignored while playing).
- Axe: `a11y.spec.ts` "Learn it with a kit".
- Real kit (manual): Chrome on Android/desktop, kit USB-B to the device, Local on, open Learn it, `Connect kit`, allow MIDI, calibrate, play.
