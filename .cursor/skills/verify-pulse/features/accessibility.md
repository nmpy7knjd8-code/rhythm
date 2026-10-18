# Accessibility

The main states pass an axe WCAG 2.2 A/AA + best-practice scan with no serious or critical findings: Learn it idle, steps open, playing, a section without drums, and Now playing while playing. The player sheet is a named dialog (named by the song title).

## Sub-features

- `a11y-learn` the four Learn it states.
- `a11y-np` Now playing while playing.

## How to get to it (user POV)

- Any screen reader or keyboard user opening the player sheet.

## Driving it with Playwright

Preconditions:

- Doctor is all ok.

- **Scan.** Run `verify.sh e2e` (or `npx playwright test a11y`). Each state attaches `<state>-axe.txt` with every finding (minor/moderate too) to `playwright-report/`; serious or critical ones fail the test.

## Gotchas

- Moderate findings (e.g. heading order) are reported, not failed; read the attachment before claiming "no findings".
