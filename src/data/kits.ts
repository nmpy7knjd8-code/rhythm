import type { Kit, KitVoice, Voice } from '../engine/types'

/** Synth cymbals / extra voices for kits that don't define them. Every kit gets all voices. */
const SYNTH_EXTRA: Partial<Record<Voice, KitVoice>> = {
  crash1: { kind: 'metal', pitch: 340, tone: 7.3, decay: 1.6, gain: 0.1 },
  crash2: { kind: 'metal', pitch: 290, tone: 6.1, decay: 2.0, gain: 0.1 },
  china: { kind: 'metal', pitch: 380, tone: 11.2, decay: 1.2, gain: 0.09 },
  rideBell: { kind: 'metal', pitch: 900, tone: 2.3, decay: 0.9, gain: 0.12 },
  pedal: { kind: 'noise', tone: 6000, decay: 0.05, gain: 0.25 },
  tomMid: { kind: 'membrane', pitch: 125, decay: 0.4, pitchDecay: 0.03 },
}
function withCymbals(v: Partial<Record<Voice, KitVoice>>): Record<Voice, KitVoice> {
  const out = { ...SYNTH_EXTRA, ...v } as Record<Voice, KitVoice>
  for (const k of Object.keys(out) as Voice[]) if (out[k].kind === 'sample' && !out[k].fallback) out[k] = { ...out[k], fallback: SYNTH_EXTRA[k] }
  return out
}

export const KITS: Kit[] = [
  { id: 'acoustic', name: 'Acoustic kit', blurb: 'Recorded samples (Salamander Drumkit by Alexander Holm), with velocity layers and round-robin.', voices: withCymbals({
    low: { kind: 'sample', layers: [{vel: 0.45, files: ['low_p_1.mp3', 'low_p_4.mp3']}, {vel: 0.8, files: ['low_f_2.mp3', 'low_f_6.mp3']}, {vel: 1, files: ['low_ff_3.mp3', 'low_ff_8.mp3']}], gain: 1, fallback: { kind: 'membrane', pitch: 50, decay: 0.4, pitchDecay: 0.05, gain: 1.1 } },
    back: { kind: 'sample', layers: [{vel: 0.4, files: ['back_ghost_2.mp3', 'back_ghost_5.mp3', 'back_ghost_7.mp3', 'back_ghost_9.mp3', 'back_ghost_10.mp3']}, {vel: 0.8, files: ['back_mp_3.mp3', 'back_mp_8.mp3', 'back_mp_5.mp3', 'back_mp_11.mp3', 'back_mp_13.mp3']}, {vel: 1, files: ['back_ff_2.mp3', 'back_ff_6.mp3', 'back_ff_4.mp3', 'back_ff_8.mp3', 'back_ff_9.mp3']}], gain: 1, fallback: { kind: 'noise', tone: 3000, decay: 0.18, pitch: 190, gain: 0.8 } },
    tick: { kind: 'sample', layers: [{vel: 0.6, files: ['tick_p_3.mp3', 'tick_p_9.mp3', 'tick_p_15.mp3', 'tick_p_6.mp3', 'tick_p_12.mp3']}, {vel: 1, files: ['tick_f_4.mp3', 'tick_f_10.mp3', 'tick_f_16.mp3', 'tick_f_7.mp3', 'tick_f_13.mp3']}], gain: 0.6, fallback: { kind: 'noise', tone: 8000, decay: 0.04, gain: 0.35 } },
    open: { kind: 'sample', layers: [{vel: 0.6, files: ['open_p_2.mp3']}, {vel: 1, files: ['open_f_1.mp3', 'open_f_3.mp3']}], gain: 0.55, fallback: { kind: 'noise', tone: 7000, decay: 0.3, gain: 0.3 } },
    pedal: { kind: 'sample', layers: [{vel: 1, files: ['pedal_mp_2.mp3', 'pedal_mp_7.mp3']}], gain: 0.6 },
    ride: { kind: 'sample', layers: [{vel: 0.7, files: ['ride_mp_2.mp3', 'ride_mp_5.mp3']}, {vel: 1, files: ['ride_ff_1.mp3', 'ride_ff_3.mp3']}], gain: 0.55, fallback: { kind: 'metal', pitch: 420, tone: 5.1, decay: 0.5, gain: 0.12 } },
    rideBell: { kind: 'sample', layers: [{vel: 1, files: ['rideBell_f_2.mp3', 'rideBell_f_4.mp3']}], gain: 0.55 },
    crash1: { kind: 'sample', layers: [{vel: 0.6, files: ['crash1_p_2.mp3']}, {vel: 1, files: ['crash1_ff_2.mp3', 'crash1_ff_4.mp3']}], gain: 0.6 },
    crash2: { kind: 'sample', layers: [{vel: 0.6, files: ['crash2_p_1.mp3']}, {vel: 1, files: ['crash2_ff_3.mp3', 'crash2_ff_6.mp3']}], gain: 0.6 },
    china: { kind: 'sample', layers: [{vel: 1, files: ['china_ff_2.mp3', 'china_ff_5.mp3']}], gain: 0.5 },
    tomHi: { kind: 'sample', layers: [{vel: 0.6, files: ['tomHi_p_2.mp3', 'tomHi_p_5.mp3']}, {vel: 1, files: ['tomHi_ff_3.mp3', 'tomHi_ff_7.mp3']}], gain: 1, fallback: { kind: 'membrane', pitch: 160, decay: 0.35, pitchDecay: 0.03 } },
    tomLo: { kind: 'sample', layers: [{vel: 0.6, files: ['tomLo_mp_2.mp3', 'tomLo_mp_6.mp3']}, {vel: 1, files: ['tomLo_ff_2.mp3', 'tomLo_ff_5.mp3']}], gain: 1, fallback: { kind: 'membrane', pitch: 95, decay: 0.45, pitchDecay: 0.03 } },
    accent: { kind: 'sample', layers: [{vel: 1, files: ['accent_f_2.mp3', 'accent_f_6.mp3']}], gain: 0.8, fallback: { kind: 'noise', tone: 2500, decay: 0.05, pitch: 900, gain: 0.5 } },
    bell: { kind: 'sample', layers: [{vel: 0.6, files: ['bell_mp_2.mp3']}, {vel: 1, files: ['bell_ff_3.mp3', 'bell_ff_6.mp3']}], gain: 0.5, fallback: { kind: 'metal', pitch: 800, tone: 3.2, decay: 0.2, gain: 0.12 } },
    tomMid: { kind: 'sample', rate: 1.22, layers: [{ vel: 0.6, files: ['tomLo_mp_2.mp3', 'tomLo_mp_6.mp3'] }, { vel: 1, files: ['tomLo_ff_2.mp3', 'tomLo_ff_5.mp3'] }], fallback: { kind: 'membrane', pitch: 125, decay: 0.4, pitchDecay: 0.03 } },
    shaker: { kind: 'noise', tone: 9000, decay: 0.05, gain: 0.25 },
  }) },
  { id: 'electronic', name: 'Electronic', blurb: 'Drum-machine style: boomy kick, clap, tight hats.', voices: withCymbals({
    low: { kind: 'membrane', pitch: 42, decay: 0.8, pitchDecay: 0.08, gain: 1.2 },
    back: { kind: 'noise', tone: 1500, decay: 0.22, gain: 0.9 },
    tick: { kind: 'noise', tone: 10000, decay: 0.025, gain: 0.4 },
    open: { kind: 'noise', tone: 9000, decay: 0.22, gain: 0.3 },
    ride: { kind: 'metal', pitch: 600, tone: 8, decay: 0.3, gain: 0.1 },
    tomHi: { kind: 'membrane', pitch: 180, decay: 0.3, pitchDecay: 0.1 },
    tomLo: { kind: 'membrane', pitch: 90, decay: 0.4, pitchDecay: 0.1 },
    accent: { kind: 'metal', pitch: 1500, tone: 1.5, decay: 0.05, gain: 0.15 },
    shaker: { kind: 'noise', tone: 11000, decay: 0.04, gain: 0.3 },
    bell: { kind: 'metal', pitch: 560, tone: 1.4, decay: 0.15, gain: 0.15 } }) },
  { id: 'frame', name: 'Frame / shamanic drum', blurb: 'Recorded large drum struck with a beater (VSCO 2 CE, CC0): center boom, higher edge tones, wood rim, jingles and rattle.', voices: withCymbals({
    low: { kind: 'sample', layers: [{vel:0.4,files:['../vsco/bdrumnewhit_v1_rr1.mp3','../vsco/bdrumnewhit_v1_rr2.mp3']},{vel:0.75,files:['../vsco/bdrumnewhit_v3_rr1.mp3','../vsco/bdrumnewhit_v3_rr2.mp3','../vsco/bdrumnewhit_v5_rr1.mp3']},{vel:1,files:['../vsco/bdrumnewhit_v7_rr1.mp3','../vsco/bdrumnewhit_v7_rr2.mp3','../vsco/bdrumnewhit_v5_rr2.mp3']}], gain: 1.2 },
    tomLo: { kind: 'sample', layers: [{vel:0.4,files:['../vsco/bdrumnewhit_v1_rr1.mp3','../vsco/bdrumnewhit_v1_rr2.mp3']},{vel:0.75,files:['../vsco/bdrumnewhit_v3_rr1.mp3','../vsco/bdrumnewhit_v3_rr2.mp3','../vsco/bdrumnewhit_v5_rr1.mp3']},{vel:1,files:['../vsco/bdrumnewhit_v7_rr1.mp3','../vsco/bdrumnewhit_v7_rr2.mp3','../vsco/bdrumnewhit_v5_rr2.mp3']}], gain: 1.2, rate: 0.82 },
    tomMid: { kind: 'sample', layers: [{vel:0.4,files:['../vsco/bdrumnewhit_v1_rr1.mp3','../vsco/bdrumnewhit_v1_rr2.mp3']},{vel:0.75,files:['../vsco/bdrumnewhit_v3_rr1.mp3','../vsco/bdrumnewhit_v3_rr2.mp3','../vsco/bdrumnewhit_v5_rr1.mp3']},{vel:1,files:['../vsco/bdrumnewhit_v7_rr1.mp3','../vsco/bdrumnewhit_v7_rr2.mp3','../vsco/bdrumnewhit_v5_rr2.mp3']}], gain: 1, rate: 1.3 },
    tomHi: { kind: 'sample', layers: [{vel:0.4,files:['../vsco/bdrumnewhit_v1_rr1.mp3','../vsco/bdrumnewhit_v1_rr2.mp3']},{vel:0.75,files:['../vsco/bdrumnewhit_v3_rr1.mp3','../vsco/bdrumnewhit_v3_rr2.mp3','../vsco/bdrumnewhit_v5_rr1.mp3']},{vel:1,files:['../vsco/bdrumnewhit_v7_rr1.mp3','../vsco/bdrumnewhit_v7_rr2.mp3','../vsco/bdrumnewhit_v5_rr2.mp3']}], gain: 0.9, rate: 1.7 },
    back: { kind: 'sample', layers: [{vel:0.4,files:['../vsco/bdrumnewhit_v1_rr1.mp3','../vsco/bdrumnewhit_v1_rr2.mp3']},{vel:0.75,files:['../vsco/bdrumnewhit_v3_rr1.mp3','../vsco/bdrumnewhit_v3_rr2.mp3','../vsco/bdrumnewhit_v5_rr1.mp3']},{vel:1,files:['../vsco/bdrumnewhit_v7_rr1.mp3','../vsco/bdrumnewhit_v7_rr2.mp3','../vsco/bdrumnewhit_v5_rr2.mp3']}], gain: 0.9, rate: 2.1 },
    accent: { kind: 'sample', layers: [{vel:0.6,files:['../vsco/logdrumhi_medm_v1_rr1.mp3']},{vel:1,files:['../vsco/logdrumhi_medm_v3_rr2.mp3']}], gain: 0.7 },
    tick: { kind: 'sample', layers: [{vel:0.6,files:['../vsco/tamb1_hit_v1_rr1.mp3']},{vel:1,files:['../vsco/tamb1_hit_v2_rr2.mp3']}], gain: 0.5 },
    open: { kind: 'sample', layers: [{vel:1,files:['../vsco/sleighbells_hit_v1_rr1.mp3','../vsco/sleighbells_hit_v1_rr2.mp3']}], gain: 0.5 },
    shaker: { kind: 'sample', layers: [{vel:1,files:['../vsco/tamb1_shake_v1_rr1.mp3','../vsco/tamb1_shake_v1_rr2.mp3']}], gain: 0.5 },
    ride: { kind: 'sample', layers: [{vel:1,files:['../vsco/sleighbells_hit_v1_rr2.mp3','../vsco/sleighbells_hit_v1_rr1.mp3']}], gain: 0.4 },
    bell: { kind: 'sample', layers: [{vel:0.6,files:['../vsco/logdrumlo_medm_v2_rr1.mp3']},{vel:1,files:['../vsco/logdrumlo_medm_v3_rr2.mp3']}], gain: 0.7 } }) },
  { id: 'latin', name: 'Latin hand percussion', blurb: 'Recorded congas (tumba, conga, quinto), heel-toe taps, high quinto as bongo, clave, cowbell, guiro, timbale-style snares-off drum (VSCO 2 CE, CC0).', voices: withCymbals({
    low: { kind: 'sample', layers: [{vel:0.45,files:['../vsco/tumba_hitn_v1_rr1.mp3']},{vel:0.8,files:['../vsco/tumba_hitn_v2_rr2.mp3','../vsco/tumba_hitn_v3_rr1.mp3']},{vel:1,files:['../vsco/tumba_hitn_v3_rr2.mp3','../vsco/tumba_hitn_v3_rr1.mp3']}], gain: 1 },
    tomLo: { kind: 'sample', layers: [{vel:0.45,files:['../vsco/conga_hitn_v1_rr1.mp3']},{vel:0.8,files:['../vsco/conga_hitn_v2_rr2.mp3','../vsco/conga_hitn_v3_rr1.mp3']},{vel:1,files:['../vsco/conga_hitn_v3_rr2.mp3','../vsco/conga_hitn_v3_rr1.mp3']}], gain: 1 },
    tomMid: { kind: 'sample', layers: [{vel:0.45,files:['../vsco/quinto_hitn_v1_rr1.mp3']},{vel:0.8,files:['../vsco/quinto_hitn_v2_rr2.mp3','../vsco/quinto_hitn_v3_rr1.mp3']},{vel:1,files:['../vsco/quinto_hitn_v3_rr2.mp3']}], gain: 1 },
    tomHi: { kind: 'sample', layers: [{vel:0.45,files:['../vsco/quinto_hitn_v1_rr1.mp3']},{vel:0.8,files:['../vsco/quinto_hitn_v2_rr2.mp3']},{vel:1,files:['../vsco/quinto_hitn_v3_rr2.mp3','../vsco/quinto_hitn_v3_rr1.mp3']}], gain: 0.9, rate: 1.55 },
    back: { kind: 'sample', layers: [{vel:0.5,files:['../vsco/snare2_hitsn_v3_rr1.mp3']},{vel:0.8,files:['../vsco/snare2_hitsn_v7_rr1.mp3']},{vel:1,files:['../vsco/snare2_hitsn_v9_rr2.mp3']}], gain: 0.8, rate: 1.3 },
    tick: { kind: 'sample', layers: [{vel:1,files:['../vsco/conga_tap1_v1_rr1.mp3','../vsco/conga_tap1_v1_rr2.mp3','../vsco/tumba_tap1_v1_rr1.mp3','../vsco/quinto_tap1_v1_rr2.mp3']}], gain: 0.8 },
    accent: { kind: 'sample', layers: [{vel:0.5,files:['../vsco/claves1_hit_v1_rr1.mp3']},{vel:1,files:['../vsco/claves1_hit_v3_rr1.mp3','../vsco/claves1_hit_v3_rr2.mp3']}], gain: 0.6 },
    bell: { kind: 'sample', layers: [{vel:0.4,files:['../vsco/cowbell1_hit_v1_rr1.mp3']},{vel:0.75,files:['../vsco/cowbell1_hit_v2_rr2.mp3']},{vel:1,files:['../vsco/cowbell1_hit_v4_rr1.mp3','../vsco/cowbell1_hit_v4_rr2.mp3']}], gain: 0.55 },
    ride: { kind: 'sample', layers: [{vel:0.6,files:['../vsco/cowbell1_hit_v2_rr2.mp3']},{vel:1,files:['../vsco/cowbell1_hit_v4_rr1.mp3']}], gain: 0.45 },
    open: { kind: 'sample', layers: [{vel:1,files:['../vsco/guiro_hit_v1_rr1.mp3','../vsco/guiro_hit_v1_rr2.mp3']}], gain: 0.6 },
    shaker: { kind: 'sample', layers: [{vel:1,files:['../vsco/tamb1_shake_v1_rr1.mp3','../vsco/tamb1_shake_v1_rr2.mp3']}], gain: 0.45 } }) },
  { id: 'tuned', name: 'Tuned toms', blurb: 'Six pitched membranes for melodic playing (Kit as Pitch).', voices: withCymbals({
    low: { kind: 'membrane', pitch: 65.4, decay: 0.7, pitchDecay: 0.03, gain: 1.1 },
    tomLo: { kind: 'membrane', pitch: 98, decay: 0.55, pitchDecay: 0.02 },
    tomHi: { kind: 'membrane', pitch: 130.8, decay: 0.5, pitchDecay: 0.02 },
    back: { kind: 'membrane', pitch: 164.8, decay: 0.45, pitchDecay: 0.015 },
    accent: { kind: 'membrane', pitch: 196, decay: 0.4, pitchDecay: 0.015 },
    bell: { kind: 'membrane', pitch: 261.6, decay: 0.35, pitchDecay: 0.01 },
    tick: { kind: 'noise', tone: 8000, decay: 0.04, gain: 0.35 },
    open: { kind: 'noise', tone: 7000, decay: 0.3, gain: 0.3 },
    ride: { kind: 'metal', pitch: 420, tone: 5.1, decay: 0.5, gain: 0.12 },
    shaker: { kind: 'noise', tone: 9000, decay: 0.05, gain: 0.25 } }) },
]

/** Variants of the recorded acoustic kit: the same Salamander samples, re-pitched (playback rate) and re-balanced. */
function variant(id: string, name: string, blurb: string, rate: Partial<Record<Voice, number>>, gain: Partial<Record<Voice, number>>): Kit {
  const base = KITS[0].voices, voices = { ...base }
  for (const v of Object.keys(base) as Voice[]) {
    const r = rate[v] ?? 1, g = gain[v] ?? 1
    if (r !== 1 || g !== 1) voices[v] = { ...base[v], rate: (base[v].rate ?? 1) * r, gain: (base[v].gain ?? 1) * g }
  }
  return { id, name, blurb, voices }
}
const CYM: Voice[] = ['crash1', 'crash2', 'china', 'ride', 'rideBell']
const each = (vs: Voice[], x: number) => Object.fromEntries(vs.map(v => [v, x])) as Partial<Record<Voice, number>>
KITS.splice(1, 0,
  variant('acoustic-big', 'Big prog kit', 'For Tool-style prog: deep, tuned-down toms, a crisp high snare, large darker cymbals with more level, punchy kick. Re-pitched Salamander Drumkit samples.',
    { tomHi: 0.84, tomMid: 0.84, tomLo: 0.8, back: 1.1, low: 0.94, ...each(CYM, 0.92) },
    { tomHi: 1.1, tomMid: 1.1, tomLo: 1.15, low: 1.15, back: 1.05, ...each(CYM, 1.15) }),
  variant('acoustic-vintage', 'Warm vintage kit', 'Warmer, lower-tuned late-60s/70s character: fatter snare, rounder kick, darker and quieter cymbals and hats. Re-pitched Salamander Drumkit samples.',
    { back: 0.9, low: 0.96, tomHi: 0.93, tomMid: 0.93, tomLo: 0.93, tick: 0.94, open: 0.94, pedal: 0.94, ...each(CYM, 0.9) },
    { tick: 0.85, open: 0.85, ...each(CYM, 0.8) }),
)

// Level trims (dB), applied to per-kit copies so shared synth voices/fallbacks are trimmed exactly once per kit:
// rim/cross-stick -3 dB, open hi-hat -3.5 dB, crash 2 -3 dB. Closed hat and pedal unchanged.
const TRIM_DB: Partial<Record<Voice, number>> = { accent: -3, open: -3.5, crash2: -3, rideBell: -3 }
for (const k of KITS) for (const [v, db] of Object.entries(TRIM_DB) as [Voice, number][]) {
  const kv = k.voices[v]; if (!kv) continue
  const f = 10 ** (db / 20)
  k.voices[v] = { ...kv, gain: (kv.gain ?? 1) * f, fallback: kv.fallback && { ...kv.fallback, gain: (kv.fallback.gain ?? 1) * f } }
}
