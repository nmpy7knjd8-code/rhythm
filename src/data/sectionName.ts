/**
 * Section names as the tab wrote them, minus transcriber bookkeeping: rehearsal marks ("[A] Verse", "[P'] Post-Chorus"),
 * a name wrapped in brackets ("[Outro]"; a bare "[B]" reads "Section B"), a trailing bar count ("Chorus - 8 bars"), and a trailing bracket note, kept as "(Guitar Solo 2)". The bar strip already shows length.
 */
export function cleanSectionName(name: string): string {
  const out = name.trim()
    .replace(/^\[([A-Z])\]$/, 'Section $1')
    .replace(/^\[([^\]]+)\]$/, '$1')
    .replace(/^\[[^\]]{1,3}\]\s*/, '')
    .replace(/\s*-\s*\d+\s+bars?$/i, '')
    .replace(/\s\[([^\]]+)\]$/, ' ($1)')
    .trim()
  return out || name.trim()
}
