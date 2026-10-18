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
