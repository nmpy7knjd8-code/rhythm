import * as Tone from 'tone'

/** Spoken count clips (public/count/*.mp3), played as audio buffers at exact transport times. One voice at a time:
 *  a new word cuts the previous one, so fast counts never smear or queue. */
const WORDS = [...Array.from({ length: 19 }, (_, i) => String(i + 1)), 'e', 'and', 'ah', 'ta', 'trip', 'let', 'la', 'li']
const TOKEN: Record<string, string> = { '&': 'and', a: 'ah' }
export const countClip = (syllable: string) => { const w = TOKEN[syllable] ?? syllable; return WORDS.includes(w) ? w : null }

export class CountVoice {
  private clips = new Map<string, { buf: AudioBuffer; onset: number }>()
  private loading: Promise<void> | null = null
  private last: AudioBufferSourceNode | null = null
  private out: Tone.Gain
  constructor(dest: Tone.InputNode) { this.out = new Tone.Gain(0.9).connect(dest) }
  get ready() { return this.clips.size === WORDS.length }
  load(base: string) {
    return this.loading ??= Promise.all(WORDS.map(async w => {
      const ctx = Tone.getContext().rawContext as AudioContext
      const buf = await ctx.decodeAudioData(await (await fetch(`${base}count/${w}.mp3`)).arrayBuffer())
      // decoders may pad the start; begin each clip at its first audible sample
      const d = buf.getChannelData(0); let peak = 0; for (const x of d) peak = Math.max(peak, Math.abs(x))
      let i = 0; while (i < d.length && Math.abs(d[i]) < peak * 0.05) i++
      this.clips.set(w, { buf, onset: Math.max(0, i / buf.sampleRate - 0.001) })
    })).then(() => {}, err => { this.loading = null; throw err })
  }
  /** Speak `syllable` so its attack sounds at `time` (audio-context seconds). Returns false if there is no clip for it. */
  say(syllable: string, time: number) {
    const w = countClip(syllable), c = w && this.clips.get(w)
    if (!c) return false
    const ctx = Tone.getContext().rawContext as AudioContext
    const src = ctx.createBufferSource(); src.buffer = c.buf
    Tone.connect(src, this.out)
    try { this.last?.stop(time) } catch { /* already stopped */ }
    src.start(time, c.onset); this.last = src
    return true
  }
  /** Seconds from a clip's start to its attack (for tests). */
  onsetOf(syllable: string) { const w = countClip(syllable); return w ? this.clips.get(w)?.onset ?? null : null }
}
