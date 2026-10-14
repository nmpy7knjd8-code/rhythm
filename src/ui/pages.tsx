import { useMemo, useState } from 'react'
import { RHYTHMS, PATTERNS } from '../data/rhythms'
import { STORY_ARRANGEMENT } from '../data/story'
import { ARTISTS } from '../data/artists'
import { THEORY } from '../data/theory'
import { SONGS as ALL_SONGS, type Song } from '../data/songs'
import { shownBpm } from '../data/songs'
// Original multi-section drum journeys live on the Story page, not in Songs.
const isJourney = (s: Song) => s.raw.id.startsWith('j-')
/** Songs tab = real recorded songs only (transcribed parts); generic style pieces and references go to Story. */
export const isRealSong = (s: Song) => !!s.raw.transcription && !isJourney(s) && !/Traditional/i.test(s.raw.artist) && !/\(reference\)|generic/i.test(s.raw.song)
const SONGS = ALL_SONGS.filter(isRealSong)
const JOURNEYS = ALL_SONGS.filter(isJourney)
const STUDIES = ALL_SONGS.filter(s => !isRealSong(s) && !isJourney(s))
import LENS from '../data/lens-deep.json'
import STORY from '../data/story-deep.json'
import { videosFor, type Video } from '../data/videos'
import type { Pattern, Voice } from '../engine/types'
import { PITCHED, noteName, midiToHz } from '../engine/pitch'
import { TUNING_PRESETS, PITCH_TEXT, PITCH_PATTERNS } from '../data/pitch'
import { LoadButtons, usePlayer, StepGrid, SongForm } from './player'

const H1 = ({ t, sub, center, tight }: { t: React.ReactNode; sub: string; center?: boolean; tight?: boolean }) => <header className={`${tight ? 'mb-7' : 'mb-14'} rise ${center ? 'text-center' : ''}`}><h1 className="text-[34px] leading-[1.1] font-semibold tracking-[-0.025em]">{t}</h1><p className={`${tight ? 'mt-3' : 'mt-4'} ${tight ? 'text-[15px] max-w-[42ch]' : 'text-[17px] max-w-[34ch]'} text-bone/60 leading-relaxed ${center ? 'mx-auto' : ''}`}>{sub}</p></header>
const Tag = ({ c }: { c: string }) => <span className="eyebrow">{c}</span>

export function Library() {
  const [tab, setTab] = useState<'styles' | 'songs'>('songs')
  return <>
    <H1 center tight t={<>Groove <span className="text-amber">Library</span></>} sub="Hear and visualize isolated drum tracks from your favorite songs or learn different styles, each with notes on how they feel and why. Play one, then add layers." />
    <div className={`${tab === 'songs' ? 'mb-4' : 'mb-12'} flex justify-center`}><div className="inline-flex p-0.5 rounded-full bg-white/[0.05]">{(['songs', 'styles'] as const).map(t => <button key={t} onClick={() => setTab(t)} className={`h-9 px-5 rounded-full text-sm capitalize transition-all duration-200 ${tab === t ? 'bg-bone text-ink' : 'text-bone/60'}`}>{t === 'songs' ? `Songs · ${SONGS.length}` : `Styles · ${RHYTHMS.length}`}</button>)}</div></div>
    {tab === 'styles' ? <Styles /> : <Songs />}
  </>
}

function Styles() {
  const fams0 = [...new Set(RHYTHMS.map(r => r.family))]
  // Trance & pulse (theta pulse, Harner tempo, rattle drone) used to open the page; it now sits at the end.
  const fams = [...fams0.filter(f => f !== 'Trance & pulse'), ...fams0.filter(f => f === 'Trance & pulse')]
  const [fam, setFam] = useState(fams[0])
  return <>
    <div className="-mx-6 px-6 mb-8 flex gap-x-5 overflow-x-auto whitespace-nowrap [scrollbar-width:none]" role="tablist" aria-label="Genres">
      {fams.map(f => <button key={f} role="tab" aria-selected={fam === f} onClick={() => setFam(f)} className={`py-1 text-lg shrink-0 ${fam === f ? 'text-amber' : 'text-bone/80'}`}>{f}</button>)}
    </div>
    {fams.filter(f => f === fam).map(f => <section key={f} className="mb-16 rise">
      {RHYTHMS.filter(r => r.family === f).map(r => <article key={r.pattern.id} className="mt-6 pb-10 border-b border-line last:border-0">
        <h2 className="text-xl font-medium tracking-tight">{r.pattern.name}</h2>
        <p className="mt-2.5 text-bone/80 leading-relaxed">{r.effect}</p>
        <p className="mt-2 text-bone/55 leading-relaxed text-[15px]">{r.why}</p>
        {r.evidence !== 'established' && <Note line={`Evidence: ${r.evidence}`} more={r.evidenceNote} />}
        {r.evidence === 'established' && r.evidenceNote && <Note line="Evidence: established" more={r.evidenceNote} />}
        <LoadButtons pattern={r.pattern} />
        {r.tryLayering && <p className="mt-3 text-xs text-mute">Try layering: {r.tryLayering.map(id => PATTERNS[id].name).join(', ')}</p>}
      </article>)}
    </section>)}</>
}

function SongButtons({ song }: { song: Song }) {
  const P = usePlayer()
  return <div className="flex items-center gap-1.5 mt-4 whitespace-nowrap">
    <button className="btn-primary !px-3.5" onClick={async () => { await P.loadSong(song); await P.toggle() }}><span className="inline-block w-0 h-0 border-y-[5px] border-y-transparent border-l-[8px] border-l-current" /> Play song</button>
    <button className="btn-ghost !px-3.5" onClick={async () => { P.load(song.pattern); if (!P.playing) await P.toggle() }}>Loop groove</button>
    <QueueButton song={song} />
    <span className="ml-auto pl-1 text-[11px] text-mute tabular-nums">{shownBpm(song, song.raw.bpm)} BPM</span>
  </div>
}

/** Small "add to queue" button: shows ✓ briefly after adding. */
export function QueueButton({ song }: { song: Song }) {
  const P = usePlayer(); const [done, setDone] = useState(false)
  const n = P.queue.filter(q => q.raw.id === song.raw.id).length
  return <button aria-label={`Add ${song.raw.song} to queue`} title="Add to queue" onClick={() => { P.enqueue(song); setDone(true); setTimeout(() => setDone(false), 900) }}
    className={`relative w-10 h-10 grid place-items-center rounded-full border border-white/[0.08] text-[15px] leading-none active:scale-90 transition ${done ? 'text-amber border-amber/40' : 'text-bone/60 hover:text-bone'}`}>
    {done ? '✓' : <QueueIcon />}{n > 0 && !done && <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-0.5 rounded-full bg-amber text-ink text-[9px] font-semibold grid place-items-center">{n}</span>}
  </button>
}
export const QueueIcon = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 4h8M2 8h8M2 12h5M12 9v5M9.5 11.5h5" /></svg>

const REQ_PH = 'Request a song (added in minutes)'
function RequestSong() {
  const [text, setText] = useState(''); const [hp, setHp] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); const t = text.trim(); if (!t) return
    if (hp) { setState('sent'); return } // honeypot filled: a bot, drop silently
    setState('sending')
    try {
      // Web3Forms public access key for pulse-requests@mail.grokbot.com (safe to embed; it only routes mail to that inbox)
      const key = (import.meta.env.VITE_WEB3FORMS_KEY as string | undefined) || 'a45bacf4-ef38-4d5b-96a3-0a160015941f'
      // FormData + only safelisted headers = a "simple" CORS request, so no preflight is needed
      const fd = new FormData()
      for (const [k2, v] of Object.entries({ access_key: key, subject: `Pulse song request: ${t}`, from_name: 'Pulse', request: t })) fd.append(k2, v)
      const r = await fetch('https://api.web3forms.com/submit', { method: 'POST', headers: { Accept: 'application/json' }, body: fd })
      const j = await r.json().catch(() => ({})) as { success?: string | boolean }
      if (!r.ok || String(j.success) === 'false') throw new Error(String(r.status))
      setState('sent'); setText('')
    } catch { setState('error') }
  }
  return <form onSubmit={submit} className="mb-10 mx-auto max-w-sm">
    <input type="text" name="_honey" tabIndex={-1} autoComplete="off" aria-hidden="true" value={hp} onChange={e => setHp(e.target.value)} className="hidden" />
    <div className="flex gap-2">
      <input className="req-input flex-1 min-w-0 h-10 px-3 rounded-xl bg-white/[0.05] border border-white/[0.06] text-[16px] placeholder:text-mute outline-none focus:border-amber/60" placeholder={REQ_PH} aria-label="Request a song" value={text} onChange={e => { setText(e.target.value); setState('idle') }} />
      <button disabled={!text.trim() || state === 'sending'} className="h-10 px-3 rounded-xl bg-amber text-ink text-sm font-medium disabled:opacity-30">{state === 'sending' ? '…' : 'Send'}</button>
    </div>
    {state === 'sent' && <p className="mt-1.5 text-[11px] text-amber">Thanks, request sent.</p>}
    {state === 'error' && <p className="mt-1.5 text-[11px] text-mute">Couldn't send. Try again in a moment.</p>}
  </form>
}

const POPULAR = ['The Beatles', 'Led Zeppelin', 'Nirvana', 'AC/DC', 'The Police', 'Foo Fighters', 'Van Halen', 'Red Hot Chili Peppers', 'Aerosmith', 'Rush', 'Tool', 'Toto', 'Phil Collins', 'Iron Maiden', 'The Who', 'Black Sabbath', 'Metallica', 'System of a Down', 'Dream Theater', 'A Perfect Circle', 'Paul Simon', 'James Brown', 'Benny Goodman Orchestra', 'The Jimi Hendrix Experience', 'Porcupine Tree', 'Meshuggah', 'Gojira', 'The Surfaris', 'Chic', 'Weather Report', 'Mahavishnu Orchestra']

/** Smooth-scroll so the artist group lands 80 px from the top; re-aim as lazy content above shifts the layout. */
function scrollToArtist(id: string) {
  const aim = (behavior: ScrollBehavior) => { const el = document.getElementById(id); if (!el) return
    window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 80), behavior }) }
  aim('smooth'); let n = 0
  // re-aim while lazy content above shifts the layout; stop as soon as it settles or the user touches/scrolls
  const stop = () => { clearInterval(t); for (const ev of ['touchstart', 'wheel', 'keydown', 'pointerdown'] as const) window.removeEventListener(ev, stop) }
  for (const ev of ['touchstart', 'wheel', 'keydown', 'pointerdown'] as const) window.addEventListener(ev, stop, { passive: true })
  const t = setInterval(() => { const off = Math.abs((document.getElementById(id)?.getBoundingClientRect().top ?? 80) - 80)
    if (++n > 12 || off < 2) { stop(); return } if (n % 3 === 0) aim(off > 600 ? 'smooth' : 'auto') }, 250)
}

/** Only lower or partial confidence gets a per-song note; the Songsterr credit lives in the page note. */
const lowConf = (c?: string) => { const r = (c ?? '').replace(/^transcribed \(Songsterr community tab\);?\s*/i, '').trim(); return r ? r.charAt(0).toUpperCase() + r.slice(1) : '' }

function Songs() {
  // artist groups shuffled on each visit; songs inside a group keep their order
  const list = useMemo(() => {
    const groups = new Map<string, typeof SONGS>()
    for (const s of SONGS) { const k = s.raw.artist; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(s) }
    const g = [...groups.values()]
    for (let i = g.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [g[i], g[j]] = [g[j], g[i]] }
    return g.flat()
  }, [])
  // most songs in Pulse first, then broad popularity
  const artists = useMemo(() => { const n = new Map<string, number>(); for (const s of list) n.set(s.raw.artist, (n.get(s.raw.artist) ?? 0) + 1)
    const pop = (a: string) => { const i = POPULAR.indexOf(a); return i < 0 ? 999 : i }
    return [...n.keys()].sort((x, y) => n.get(y)! - n.get(x)! || pop(x) - pop(y) || x.localeCompare(y)) }, [list])
  const [allArtists, setAllArtists] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const slug = (a: string) => 'artist-' + a.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const P = usePlayer()
  const pickArtist = () => { const n = document.getElementById('artists'); n?.scrollIntoView({ behavior: 'smooth', block: 'center' }); n?.querySelector('button')?.focus({ preventScroll: true }) }
  return <div className="rise">
    <div className="mb-5 flex justify-center">
      <button onClick={pickArtist} className="h-[42px] px-6 rounded-full text-base bg-white/[0.05] border border-white/[0.22] text-bone/80">Choose an artist</button>
    </div>
    <nav id="artists" aria-label="Artists" className={`scroll-mt-24 mx-auto max-w-md flex flex-wrap justify-center gap-1 overflow-hidden ${allArtists ? '' : 'max-h-[108px]'}`}>
      {artists.map(a => <button key={a} onClick={() => { setPicked(a); scrollToArtist(slug(a)) }}
        className={`h-6 px-2.5 rounded-full text-[12px] leading-none border transition-colors ${picked === a ? 'border-amber/60 text-amber bg-amber/[0.08]' : 'border-white/[0.07] bg-white/[0.035] text-bone/70 hover:text-amber hover:border-amber/40'}`}>{a}</button>)}
    </nav>
    <div className="mt-1 mb-4 text-center"><button onClick={() => setAllArtists(v => !v)} className="text-[11px] text-mute hover:text-amber">{allArtists ? 'Fewer' : 'More artists'}</button></div>
    <RequestSong />
    <div className="-mt-2 mb-6 flex justify-center">
      <button aria-label="Shuffle songs" onClick={() => void P.shuffle(list.filter(isRealSong))} className="h-[42px] pl-6 pr-1 rounded-full text-base bg-white/[0.05] border border-white/[0.22] text-bone/80 flex items-center gap-3">
        or shuffle
        <span className="w-[34px] h-[34px] rounded-full bg-amber text-ink grid place-items-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22M18 2l4 4-4 4M2 6h1.9c1.5 0 2.9.9 3.6 2.2M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8M18 14l4 4-4 4" /></svg>
        </span>
      </button>
    </div>
    <Note className="mb-8" line="Simplified drum-part transcriptions, for learning." more="Drum parts transcribed from Songsterr community tabs, simplified for learning. Drum part only: no audio or lyrics. Songs with lower confidence or partial tabs are marked on their cards. Details on the About page." />
    {list.map((s, i) => <article key={s.raw.id} id={i === 0 || list[i - 1].raw.artist !== s.raw.artist ? slug(s.raw.artist) : undefined} className="scroll-mt-20 mb-10 pb-10 border-b border-line last:border-0">
      <div className="flex items-baseline justify-between gap-3"><h2 className="text-xl font-medium tracking-tight">{s.raw.song}</h2><span className="text-xs text-mute tabular-nums shrink-0">{s.raw.timeSig}</span></div>
      <p className="mt-1 text-sm text-bone/60">{s.raw.artist} · {s.raw.drummer}{s.raw.category === 'Virtuoso' && <span className="ml-2 text-[10px] uppercase tracking-wider text-amber/70">Virtuoso</span>}</p>
      {lowConf(s.raw.confidence) && <p className="mt-0.5 text-[11px] text-mute">{lowConf(s.raw.confidence)}</p>}
      {s.raw.feel && <p className="mt-3 text-bone/80 leading-relaxed">{s.raw.feel}</p>}
      {s.raw.whyItWorks && <p className="mt-2 text-[15px] text-bone/55 leading-relaxed">{s.raw.whyItWorks}</p>}
      <StepGrid pattern={s.pattern} current={-1} />
      <SongButtons song={s} />
      <details className="mt-3"><summary className="text-xs text-mute cursor-pointer">Form · {s.sections.length} sections · {s.sections.reduce((n, x) => n + x.bars, 0)} bars</summary><SongForm song={s} />{s.raw.formNote && <Note line="Form is approximate." more={s.raw.formNote} />}</details>
      {s.fills.length > 0 && <p className="mt-2 text-xs text-mute">Includes {s.fills.length === 1 ? 'a fill' : `${s.fills.length} fills`}, available under Fill in the player.</p>}
      {s.raw.source && <a href={s.raw.source} target="_blank" rel="noreferrer" className="mt-2 block text-xs text-mute underline underline-offset-2">Reference</a>}
    </article>)}
  </div>
}

type StoryPara = { text: string; sources?: string[]; confidence?: string }
type StoryBeat = { songId: string; barStart: number; barEnd: number; label: string; note?: string }
type StoryChapter = { id: string; title: string; summary: string; sections?: { h: string; paragraphs: StoryPara[] }[]; examples?: StoryBeat[]; studies?: { songId: string; title: string; arc: string; beats: StoryBeat[]; notes?: StoryPara[] }[] }
const SRC = Object.fromEntries((STORY.sources as { id: string; url: string }[]).map(x => [x.id, x.url]))
function Cite({ p }: { p: StoryPara }) {
  if (!p.sources?.length && !p.confidence) return null
  return <span className="block mt-1 text-[11px] text-mute">{p.confidence && <>confidence: {p.confidence}</>}{p.sources?.map(id => <a key={id} href={SRC[id]} target="_blank" rel="noreferrer" className="ml-2 underline underline-offset-2">{SRC[id] ? decodeURIComponent(SRC[id].replace(/^https?:\/\/(www\.)?/, '').split('/').slice(-1)[0] || SRC[id]).replace(/_/g, ' ') : id}</a>)}</span>
}
function BeatRow({ b }: { b: StoryBeat }) {
  const P = usePlayer(); const sg = ALL_SONGS.find(x => x.raw.id === b.songId)
  if (!sg) return null
  const live = P.song?.raw.id === b.songId && P.playing && P.songBar >= b.barStart - 1 && P.songBar <= b.barEnd - 1
  return <li className="py-2.5 flex items-start gap-3">
    <button aria-label={`Play ${b.label}, bars ${b.barStart}–${b.barEnd}`} onClick={() => live ? P.toggle() : P.playRange(sg, b.barStart - 1, b.barEnd)} className={`mt-0.5 w-8 h-8 shrink-0 rounded-full grid place-items-center text-[11px] ${live ? 'bg-amber text-ink' : 'bg-white/[0.08] text-bone/85'}`}>{live ? '■' : '▶'}</button>
    <div className="min-w-0"><p className="text-sm"><span className="font-medium">{b.label}</span> <span className="text-[11px] text-mute tabular-nums">{b.barStart === b.barEnd ? `bar ${b.barStart}` : `bars ${b.barStart}–${b.barEnd}`}</span></p>{b.note && <p className="mt-0.5 text-sm text-bone/60 leading-relaxed">{b.note}</p>}</div>
  </li>
}
function StoryChapters() {
  const chapters = STORY.chapters as StoryChapter[]
  const [ci, setCi] = useState(0); const ch = chapters[ci]
  const quotes = STORY.quotes as { quote: string; speaker: string; source: string; via?: string; confidence?: string; note?: string }[]
  return <section className="mb-14">
    <div className="-mx-6 px-6 mb-8 flex gap-x-5 overflow-x-auto whitespace-nowrap [scrollbar-width:none]" role="tablist" aria-label="Chapters">
      {chapters.map((c, i) => <button key={c.id} role="tab" aria-selected={ci === i} onClick={() => setCi(i)} className={`py-1 text-[15px] shrink-0 ${ci === i ? 'text-amber' : 'text-bone/80'}`}>{i + 1}. {c.title}</button>)}
      <button role="tab" aria-selected={ci === chapters.length} onClick={() => setCi(chapters.length)} className={`py-1 text-[15px] shrink-0 ${ci === chapters.length ? 'text-amber' : 'text-bone/80'}`}>In their words</button>
    </div>
    {ch ? <article key={ch.id} className="rise">
      <h2 className="text-xl font-medium tracking-tight">{ch.title}</h2>
      <p className="mt-2 text-bone/60 leading-relaxed">{ch.summary}</p>
      {ch.sections?.map(sec => <div key={sec.h} className="mt-8"><h3 className="font-medium">{sec.h}</h3>
        {sec.paragraphs.map((p, i) => <p key={i} className="mt-2.5 text-bone/75 leading-relaxed">{p.text}<Cite p={p} /></p>)}</div>)}
      {!!ch.examples?.length && <div className="mt-10"><h3 className="text-[11px] uppercase tracking-[0.14em] text-mute">Hear it</h3><ul className="mt-1 divide-y divide-line">{ch.examples.map((b, i) => <BeatRow key={i} b={b} />)}</ul></div>}
      {ch.studies?.map(st => <div key={st.songId + st.title} className="mt-10"><h3 className="font-medium">{st.title}</h3><p className="mt-1 text-sm text-bone/60">{st.arc}</p>
        <ul className="mt-2 divide-y divide-line">{st.beats.map((b, i) => <BeatRow key={i} b={b} />)}</ul>
        {st.notes?.map((p, i) => <p key={i} className="mt-2 text-sm text-bone/60 leading-relaxed">{p.text}<Cite p={p} /></p>)}</div>)}
      <div className="mt-10 flex justify-between text-sm">
        {ci > 0 ? <button onClick={() => setCi(ci - 1)} className="text-bone/70">← {chapters[ci - 1].title}</button> : <span />}
        <button onClick={() => setCi(ci + 1)} className="text-bone/70 text-right">{ci + 1 < chapters.length ? chapters[ci + 1].title : 'In their words'} →</button>
      </div>
    </article> : <article className="rise space-y-8">{quotes.map((q, i) => <figure key={i}><blockquote className="text-bone/85 leading-relaxed">“{q.quote}”</blockquote>
      <figcaption className="mt-1.5 text-[11px] text-mute">— {q.speaker}, {q.source}{q.via && <> · <a href={q.via} target="_blank" rel="noreferrer" className="underline underline-offset-2">via</a></>}{q.confidence && <> · confidence: {q.confidence}</>}</figcaption></figure>)}</article>}
  </section>
}

export function Story() {
  const { loadArrangement, loadSong, toggle, playing, section, arrangement } = usePlayer()
  return <>
    <H1 t={STORY.title} sub={STORY.subtitle} />
    <button className="h-11 px-5 rounded-full bg-amber text-ink text-sm font-medium mb-10" onClick={async () => { loadArrangement(STORY_ARRANGEMENT); await toggle() }}>{playing && arrangement ? 'Restart example' : 'Play the 18-bar example'}</button>
    <ol className="mb-14 space-y-3">{STORY_ARRANGEMENT.sections.map((s, i) => <li key={i} className={`text-sm ${arrangement && section === i ? 'text-amber' : 'text-bone/60'}`}><span className="font-medium">{s.name}</span> · {s.bars} bars. {s.note}</li>)}</ol>
    <StoryChapters />
    {JOURNEYS.length > 0 && <section className="mb-10"><h2 className="text-lg font-medium">Drum journeys</h2>
      <p className="mt-2 text-bone/70 leading-relaxed">Original multi-section pieces that put these ideas to work over a few minutes each.</p>
      <ul className="mt-4 divide-y divide-line">{JOURNEYS.map(j => <li key={j.raw.id} className="py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0"><p className="font-medium truncate">{j.raw.song}</p><p className="text-xs text-mute">{j.sections.length} sections · {j.sections.reduce((n, x) => n + x.bars, 0)} bars</p></div>
        <button aria-label={`Play ${j.raw.song}`} onClick={async () => { await loadSong(j); await toggle() }} className="w-10 h-10 rounded-full bg-white/[0.08] grid place-items-center">▶</button>
      </li>)}</ul></section>}
    {STUDIES.length > 0 && <section className="mb-10"><h2 className="text-lg font-medium">Style studies</h2>
      <p className="mt-2 text-bone/70 leading-relaxed">Generic grooves in the style of an era or player, and reference pulses. Not transcriptions of specific recordings.</p>
      <ul className="mt-4 divide-y divide-line">{STUDIES.map(j => <li key={j.raw.id} className="py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0"><p className="font-medium truncate">{j.raw.song}</p><p className="text-xs text-mute">{j.sections.length} sections · {j.sections.reduce((n, x) => n + x.bars, 0)} bars</p></div>
        <button aria-label={`Play ${j.raw.song}`} onClick={async () => { await loadSong(j); await toggle() }} className="w-10 h-10 rounded-full bg-white/[0.08] grid place-items-center">▶</button>
      </li>)}</ul></section>}
  </>
}


function VideoEmbed({ v }: { v: Video }) {
  const [play, setPlay] = useState(false)
  const [broken, setBroken] = useState(false)
  if (broken) return null
  return <figure className="mt-5">
    <div className="relative aspect-video rounded-2xl overflow-hidden bg-white/[0.04] border border-white/[0.06]">
      {play ? <iframe className="absolute inset-0 w-full h-full" src={`https://www.youtube-nocookie.com/embed/${v.videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`} title={v.title} loading="lazy" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        : <button onClick={() => setPlay(true)} className="group absolute inset-0 w-full h-full" aria-label={`Play video: ${v.title}`}>
          <img src={`https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`} alt="" loading="lazy" className="w-full h-full object-cover opacity-80 transition-opacity duration-300 group-hover:opacity-100"
            onError={() => setBroken(true)} onLoad={e => { if ((e.target as HTMLImageElement).naturalWidth <= 120) setBroken(true) }} />
          <span className="absolute inset-0 grid place-items-center"><span className="w-14 h-14 rounded-full bg-ink/70 backdrop-blur grid place-items-center transition-transform duration-200 group-active:scale-90"><span className="ml-1 w-0 h-0 border-y-[9px] border-y-transparent border-l-[14px] border-l-bone" /></span></span>
        </button>}
    </div>
    <figcaption className="mt-2 text-xs text-mute">{v.title} · {v.channel}{v.uploadType ? ` · ${v.uploadType}` : ''}</figcaption>
  </figure>
}

export function Lens({ id, go }: { id?: string; go: (h: string) => void }) {
  const a = ARTISTS.find(x => x.id === id)
  if (!a) return <>
    <H1 t="Drummer's Lens" sub="How these drummers create feeling and tell a story with the kit." />
    <ul className="divide-y divide-line">{ARTISTS.map(x => <li key={x.id}><button onClick={() => go(`lens/${x.id}`)} className="w-full -mx-3 px-3 py-4 text-left flex items-center gap-3 rounded-lg transition-colors hover:bg-white/[0.03] active:bg-white/[0.06]" style={{ width: 'calc(100% + 1.5rem)' }}><span className="min-w-0 flex-1"><span className="block text-lg leading-snug">{x.name}</span><span className="block mt-0.5 text-[13px] text-bone/45 leading-snug">{x.band.split(/\s*;\s*/).map(b => b[0].toUpperCase() + b.slice(1)).join(' · ')}</span></span><span aria-hidden className="text-bone/30 text-xl leading-none">›</span></button></li>)}</ul>
  </>
  return <>
    <button onClick={() => go('lens')} className="text-sm text-bone/50 mb-8">← Drummer's Lens</button>
    <H1 t={a.name} sub={`${a.band.split(/\s*;\s*/).map(b => b[0].toUpperCase() + b.slice(1)).join(' · ')} · ${a.era}`} />
    {videosFor(a.name).length > 0 && <section className="mb-12"><Tag c="Watch" />{videosFor(a.name).map(v => <VideoEmbed key={v.videoId} v={v} />)}</section>}
    {a.technique.length > 0 && <section className="mb-10"><Tag c="Technique" /><ul className="mt-3 space-y-3 text-bone/75 leading-relaxed">{a.technique.map(t => <li key={t}>{t}</li>)}</ul></section>}
    {a.feeling && <section className="mb-10"><Tag c="Feeling" /><p className="mt-3 text-bone/75 leading-relaxed">{a.feeling}</p></section>}
    <DeepLens name={a.name} />
    {a.storytelling && <section className="mb-12"><Tag c="Storytelling" /><p className="mt-3 text-bone/75 leading-relaxed">{a.storytelling}</p></section>}
    <InPulse name={a.name} />
    {a.tryThis.length > 0 && <section><Tag c="Try this" />{a.tryThis.map(t => <div key={t.pattern.id} className="mt-5"><h3 className="font-medium">{t.pattern.name}</h3><p className="mt-1 text-sm text-bone/60">{t.note}</p><LoadButtons pattern={t.pattern} /></div>)}
      <Note className="mt-8" line="Simplified illustrations, not transcriptions." /></section>}
  </>
}

/** Songs in the library played by this drummer, each with a play button. */
function InPulse({ name }: { name: string }) {
  const { loadSong, toggle, playing } = usePlayer()
  const list = ALL_SONGS.filter(x => x.raw.drummer === name)
  if (!list.length) return null
  return <section className="mb-12"><Tag c="In Pulse" />
    <ul className="mt-3 divide-y divide-line">{list.map(j => <li key={j.raw.id} className="py-3 flex items-center gap-3">
      <button aria-label={`Play ${j.raw.song}`} onClick={async () => { await loadSong(j); if (!playing) await toggle() }} className="w-9 h-9 shrink-0 rounded-full bg-white/[0.08] grid place-items-center text-sm">▶</button>
      <span className="min-w-0"><span className="block truncate">{j.raw.song}</span><span className="block text-xs text-bone/50 truncate">{j.raw.artist} · {shownBpm(j, j.raw.bpm)} BPM</span></span></li>)}</ul></section>
}

/** Songs in Pulse that show a theory idea, each with a play button. */
function TheorySongs({ refs }: { refs: { id: string; note: string }[] }) {
  const { loadSong, toggle, playing } = usePlayer()
  const list = refs.map(r => ({ r, s: ALL_SONGS.find(x => x.raw.id === r.id) })).filter(x => x.s)
  if (!list.length) return null
  return <div className="mt-6"><span className="block text-[11px] uppercase tracking-wider text-mute">Hear it in Pulse</span>
    <ul className="mt-1 divide-y divide-line">{list.map(({ r, s }) => <li key={r.id} className="py-2.5 flex items-center gap-3">
      <button aria-label={`Play ${s!.raw.song}`} onClick={async () => { await loadSong(s!); if (!playing) await toggle() }} className="w-8 h-8 shrink-0 rounded-full bg-white/[0.08] grid place-items-center text-xs">▶</button>
      <span className="min-w-0 text-sm leading-snug"><span className="text-bone/85">{s!.raw.song}</span><span className="text-bone/45"> · {r.note}</span></span></li>)}</ul></div>
}

export function Theory() {
  const { load, toggle, playing } = usePlayer()
  const loadAll = async (ps: Pattern[]) => { ps.forEach((p, i) => load(p, i > 0)); if (!playing) await toggle() }
  const NO_COMBO = new Set<string>() // different meters: stacking them makes no musical sense
  return <>
    <H1 t="Theory" sub="The ideas underneath rhythm, from meter to tension and release. Every concept has a pattern you can play." />
    <nav className="mb-14 flex flex-wrap gap-x-4 gap-y-2 text-sm text-bone/50">{THEORY.map(c => <a key={c.id} href={`#/theory`} onClick={e => { e.preventDefault(); document.getElementById(c.id)?.scrollIntoView({ behavior: 'smooth' }) }}>{c.title.split(':')[0]}</a>)}</nav>
    {THEORY.map(c => <section key={c.id} id={c.id} className="mb-16 scroll-mt-6">
      <h2 className="text-xl font-medium">{c.title}</h2>
      <p className="mt-3 text-bone/75 leading-relaxed">{c.body}</p>
      {c.count && <p className="mt-4 text-[15px] leading-relaxed text-bone/70"><span className="block text-[11px] uppercase tracking-wider text-mute mb-1">Count it</span>{c.count}</p>}
      {c.points && <ul className="mt-4 space-y-2 text-[15px] leading-relaxed text-bone/65 list-disc pl-5 marker:text-bone/30">{c.points.map(t => <li key={t}>{t}</li>)}</ul>}
      <p className="mt-4 text-sm text-bone/50">{c.listen}</p>
      {c.patterns.map(p => <div key={p.id} className="mt-5"><h3 className="text-sm font-medium">{p.name}</h3><LoadButtons pattern={p} /></div>)}
      {c.patterns.length > 1 && c.combo !== false && !NO_COMBO.has(c.id) && <button className="mt-4 text-sm text-amber" onClick={() => loadAll(c.patterns)}>Play all {c.patterns.length} together →</button>}
      {c.songs && <TheorySongs refs={c.songs} />}
    </section>)}
  </>
}

export function Pitch() {
  const { tuning, setTuning, kitId, setKit } = usePlayer()
  const [preset, setPreset] = useState<string | null>(null)
  const pick = (id: string) => { const p = TUNING_PRESETS.find(x => x.id === id)!; setPreset(id); setTuning(p.tuning); if (!kitId.startsWith('acoustic')) setKit('acoustic') }
  const nudge = (v: Voice, d: number) => { const base = tuning[v] ?? TUNING_PRESETS[0].tuning[v]!; setTuning({ ...TUNING_PRESETS[0].tuning, ...tuning, [v]: base + d }); setPreset(null) }
  const LABEL: Record<string, string> = { low: 'Kick', tomLo: 'Floor tom', tomHi: 'Low tom', back: 'Mid tom', accent: 'High tom', bell: 'Top tom' }
  return <>
    <H1 t="Kit as pitch" sub="Drums have pitch, though not as precisely as a piano. Tune each voice to a note and the kit can play a melody." />
    {PITCH_TEXT.slice(0, 4).map(t => <section key={t.h} className="mb-10"><h2 className="text-lg font-medium">{t.h}</h2><p className="mt-2 text-bone/70 leading-relaxed">{t.p}</p></section>)}
    <section className="mb-12">
      <h2 className="text-lg font-medium">Tune the kit</h2>
      <p className="mt-2 text-sm text-bone/50">{PITCH_TEXT[4].p}</p>
      <div className="mt-5 flex flex-wrap gap-2">{TUNING_PRESETS.map(p => <button key={p.id} onClick={() => pick(p.id)} className={`h-9 px-3 rounded-full text-xs ${preset === p.id ? 'bg-bone text-ink' : 'border border-line text-bone/70'}`}>{p.name}</button>)}
        <button onClick={() => { setTuning({}); setPreset(null) }} className="h-9 px-3 text-xs text-bone/40">Reset</button></div>
      {preset && <p className="mt-3 text-sm text-bone/60">{TUNING_PRESETS.find(p => p.id === preset)!.note}</p>}
      <ul className="mt-6 divide-y divide-line">{[...PITCHED].reverse().map(v => { const m = tuning[v]; return (
        <li key={v} className="flex items-center gap-3 py-3">
          <span className="flex-1 text-sm">{LABEL[v]}</span>
          <span className="w-24 text-right text-sm tabular-nums">{m !== undefined ? <>{noteName(m)} <span className="text-bone/40">{midiToHz(m).toFixed(1)} Hz</span></> : <span className="text-bone/40">kit default</span>}</span>
          <button aria-label="down a semitone" onClick={() => nudge(v, -1)} className="w-9 h-9 rounded-full border border-line">−</button>
          <button aria-label="up a semitone" onClick={() => nudge(v, 1)} className="w-9 h-9 rounded-full border border-line">+</button>
        </li>) })}</ul>
      <p className="mt-3 text-xs text-bone/40">Tuning pitch-shifts the recorded acoustic kit (and works on any kit you pick).</p>
    </section>
    <section><Tag c="Melodic patterns" />{PITCH_PATTERNS.map(p => <div key={p.id} className="mt-5"><h3 className="text-sm font-medium">{p.name}</h3><LoadButtons pattern={p} /></div>)}
      <p className="mt-6 text-sm text-bone/50">See also the <a href="#/lens/carey" className="text-amber">Danny Carey</a> lens page.</p></section>
  </>
}

export function About() {
  return <>
    <H1 t="About" sub="Pulse is a companion to Muse: a place to hear, layer and understand rhythm." />
    <section className="mb-12"><Tag c="Acoustic samples" />
      <p className="mt-3 text-bone/75 leading-relaxed">The acoustic kit uses the <a className="underline underline-offset-2" href="https://archive.org/details/SalamanderDrumkit" target="_blank" rel="noreferrer">Salamander Drumkit</a> by <strong className="font-medium">Alexander Holm</strong>. Its README licenses it under <a className="underline underline-offset-2" href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer">CC BY-SA 3.0</a>, and in 2022 the author <a className="underline underline-offset-2" href="https://rytmenpinne.wordpress.com/sounds-and-such/salamander-drumkit/" target="_blank" rel="noreferrer">declared it public domain</a>. The samples here are adapted: trimmed, shortened with fades, mono, 96 kbps MP3. They are shared under CC BY-SA 3.0 with credit to the author. Two velocity layers and two or three round-robin takes per voice. They load only when the acoustic kit first plays.</p>
    </section>
    <section className="mb-12"><Tag c="Frame and Latin kits" /><p className="mt-3 text-bone/75 leading-relaxed">The frame/shamanic and Latin hand percussion kits use recordings from the <a className="underline underline-offset-2" href="https://github.com/sgossner/VSCO-2-CE" target="_blank" rel="noreferrer">Versilian Studios Chamber Orchestra 2 Community Edition</a> by Versilian Studios (Sam Gossner), released under CC0 1.0 (public domain). Sounds used: concert bass drum (struck with a beater, pitched for edge tones), log drums, tambourine, sleigh bells, tumba, conga, quinto, claves, cowbell, guiro and a snares-off snare as a timbale stand-in. VSCO 2 CE has no bongos, cajón, shaker, timbales or bodhrán, so the high quinto stands in for bongo and the tambourine shake for shaker. The electronic and tuned kits are synthesized in the browser with Tone.js.</p></section>
    <section className="mb-12"><Tag c="Song patterns" /><p className="mt-3 text-bone/75 leading-relaxed">Song grooves are approximate, simplified transcriptions of the drum part only, for education. They include no audio or lyrics.</p></section>
    <section className="mb-12"><Tag c="Video" /><p className="mt-3 text-bone/75 leading-relaxed">Videos are embedded from YouTube in privacy-enhanced mode (youtube-nocookie.com). Nothing loads until you tap play.</p></section>
    <section><Tag c="Code" /><p className="mt-3 text-bone/75 leading-relaxed"><a className="underline underline-offset-2" href="https://github.com/nmpy7knjd8-code/rhythm" target="_blank" rel="noreferrer">github.com/nmpy7knjd8-code/rhythm</a></p></section>
  </>
}

/** One-line muted caveat with an optional "more" toggle for the details. */
function Note({ line, more, className = '' }: { line: string; more?: string; className?: string }) {
  const [open, setOpen] = useState(false)
  return <p className={`mt-2 text-[11px] text-mute leading-snug ${className}`}>{line}{more && <> <button className="underline underline-offset-2" onClick={() => setOpen(o => !o)}>{open ? 'less' : 'more'}</button>{open && <span className="block mt-1">{more}</span>}</>}</p>
}

type Claim = { claim: string; source_url: string }
type Quote = { quote: string; topic?: string; source_title?: string; publication?: string; date?: string; url: string }
const DEEP_SECTIONS: [string, string][] = [['signature_techniques', 'Signature techniques'], ['feel', 'Feel'], ['arranging', 'Arranging & storytelling'], ['influences', 'Influences'], ['gear', 'Gear'], ['impact', 'Impact']]
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return 'source' } }
function DeepLens({ name }: { name: string }) {
  const d = (LENS as unknown as { drummers: (Record<string, Claim[] | Quote[] | string>)[] }).drummers.find(x => x.name === name)
  if (!d) return null
  const quotes = (d.quotes as Quote[] | undefined) ?? []
  return <>
    {DEEP_SECTIONS.map(([k, label]) => { const cs = (d[k] as Claim[] | undefined) ?? []; return cs.length > 0 && <section key={k} className="mb-10"><Tag c={label} />
      <ul className="mt-3 space-y-3 text-bone/75 leading-relaxed">{cs.map(c => <li key={c.claim}>{c.claim} <a href={c.source_url} target="_blank" rel="noreferrer" className="text-[11px] text-mute underline underline-offset-2">{host(c.source_url)}</a></li>)}</ul></section> })}
    {quotes.length > 0 && <section className="mb-10"><Tag c="In their words" />
      {quotes.map(q => <figure key={q.quote} className="mt-6 pl-4 border-l border-amber/50"><blockquote className="text-[17px] leading-relaxed text-bone/90">“{q.quote}”</blockquote>
        <figcaption className="mt-1.5 text-[11px] text-mute"><a href={q.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">{[q.publication, q.date].filter(Boolean).join(', ') || host(q.url)}</a></figcaption></figure>)}</section>}
  </>
}
