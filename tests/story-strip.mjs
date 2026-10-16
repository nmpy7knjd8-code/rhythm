// Story strip at 390px: five scene blocks over 18 bar cells follow playback, a tap seeks on the next beat; Drummers list has no dividers or chevrons.
import { chromium } from 'playwright'
const url = process.argv[2] ?? 'http://localhost:4173/rhythm/'
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })).newPage()
const fail = []; const check = (n, ok, x = '') => { console.log(`${ok ? 'ok' : 'FAIL'} ${n}${x ? ' · ' + x : ''}`); if (!ok) fail.push(n) }
const SCENES = ['Introduce', 'Establish', 'Develop', 'Interact / climax', 'Release']
const NOTE_INTRO = 'Hats alone: set the subdivision. The listener learns the "clock" before anything else.'
const NOTE_KICK = 'The kick enters on 1 and 3: now there is weight and a sense of the downbeat.'
const NOTE_ESTABLISH = 'Snare backbeat completes the core triangle (low / high / time). Leave space for a singer.'
const NOTE_FILL = 'Fill: break the loop, falling pitch, signal the arrival.'
const AMBER = 'rgb(255, 176, 0)'
const GROUP = '[role=group][aria-label="A drum part in five scenes"]'

await p.goto(url + '?v=' + Date.now() + '#/story', { waitUntil: 'networkidle' })
const group = p.locator(GROUP)
await group.waitFor()
const strip = () => p.evaluate(({ GROUP, AMBER }) => {
  const g = document.querySelector(GROUP)
  const amber = [...g.querySelectorAll('[data-bar]')].filter(c => getComputedStyle(c).backgroundColor === AMBER)
  return {
    amber: amber.map(c => c.dataset.bar),
    amberBlockCurrent: amber.map(c => c.closest('button').getAttribute('aria-current')),
    current: [...g.querySelectorAll('button[aria-current="true"]')].map(x => x.textContent),
    caption: g.nextElementSibling.textContent,
    playing: window.__pulseEngine.playing,
  }
}, { GROUP, AMBER })
const until = async (ok, ms) => { const t0 = Date.now(), seen = []; let s
  do { s = await strip(); seen.push(s); if (ok(s)) break; await p.waitForTimeout(40) } while (Date.now() - t0 < ms)
  return { s, seen, ms: Date.now() - t0, hit: ok(s) } }

const buttons = group.getByRole('button')
check('five scene buttons', await buttons.count() === 5, String(await buttons.count()))
for (const n of SCENES) check(`scene button named exactly "${n}"`, await group.getByRole('button', { name: n, exact: true }).count() === 1)
check('scenes in story order', JSON.stringify(await buttons.allTextContents()) === JSON.stringify(SCENES), JSON.stringify(await buttons.allTextContents()))
const bars = await group.locator('[data-bar]').evaluateAll(cs => cs.map(c => c.dataset.bar))
check('18 bar cells numbered 0-17 in order', JSON.stringify(bars) === JSON.stringify(Array.from({ length: 18 }, (_, i) => String(i))), JSON.stringify(bars))
const layout = await p.evaluate(GROUP => {
  const box = r => ({ l: r.left, r: r.right, t: r.top, b: r.bottom })
  return { scrollWidth: document.documentElement.scrollWidth, scenes: [...document.querySelector(GROUP).querySelectorAll(':scope > button')].map(btn => {
    const range = document.createRange(); range.selectNodeContents(btn.firstElementChild)
    return { name: btn.firstElementChild.textContent, box: box(btn.getBoundingClientRect()), rects: [...range.getClientRects()].map(box) }
  }) }
}, GROUP)
const inside = (q, o) => q.l >= o.l - 0.5 && q.r <= o.r + 0.5 && q.t >= o.t - 0.5 && q.b <= o.b + 0.5
const meet = (a, c) => a.l < c.r && c.l < a.r && a.t < c.b && c.t < a.b
for (const sc of layout.scenes) check(`label "${sc.name}" inside its block`, sc.rects.length > 0 && sc.rects.every(q => inside(q, sc.box)), JSON.stringify(sc))
const overlaps = layout.scenes.flatMap((x, i) => layout.scenes.slice(i + 1).filter(y => x.rects.some(q => y.rects.some(r => meet(q, r)))).map(y => `${x.name}/${y.name}`))
check('no two labels overlap', overlaps.length === 0, overlaps.join(', '))
check('no horizontal overflow at 390px', layout.scrollWidth <= 390, String(layout.scrollWidth))
const idle = await strip()
check('idle: no amber cell', idle.amber.length === 0, JSON.stringify(idle.amber))
check('idle: caption empty', idle.caption === '', JSON.stringify(idle.caption))

await p.getByRole('button', { name: 'Play the 18-bar example', exact: true }).click()
const first = await until(s => s.amber.length === 1, 2000)
check('play: one amber cell within 2 s', first.hit, JSON.stringify(first.s))
check('play: its block is current', first.s.amberBlockCurrent[0] === 'true', JSON.stringify(first.s))
check('play: caption is the first Introduce note', first.s.caption === NOTE_INTRO, JSON.stringify(first.s.caption))

const kick = await until(s => s.caption === NOTE_KICK, 8000)
check('caption changes inside Introduce to the kick note', kick.hit, JSON.stringify(kick.s))
check('Introduce stays current on the kick note', JSON.stringify(kick.s.current) === '["Introduce"]', JSON.stringify(kick.s.current))
check('kick note shows on bar 2', JSON.stringify(kick.s.amber) === '["2"]', JSON.stringify(kick.s.amber))

await p.evaluate(() => { window.__pulseEngine.trace = [] })
await group.getByRole('button', { name: 'Establish', exact: true }).click()
const est = await until(s => JSON.stringify(s.amber) === '["4"]', 2000)
check('Establish tap lands on bar 4 within 2 s', est.hit, `${est.ms} ms ${JSON.stringify(est.s)}`)
check('Establish caption', est.s.caption === NOTE_ESTABLISH, JSON.stringify(est.s.caption))
check('transport kept playing through the seek', est.seen.every(s => s.playing), est.seen.map(s => s.playing ? 1 : 0).join(''))
const crash = await p.evaluate(() => window.__pulseEngine.trace.some(h => h.voice === 'crash1' && h.bar === 4))
check('Establish landing plays the crash on bar 4', crash)
await p.screenshot({ path: '/tmp/story-strip.png' })

await group.getByRole('button', { name: 'Develop', exact: true }).click()
const fill = await until(s => s.caption === NOTE_FILL, 8000)
check('caption changes inside Develop to the fill note', fill.hit, `${fill.ms} ms ${JSON.stringify(fill.s)}`)
check('fill note shows on bar 11', JSON.stringify(fill.s.amber) === '["11"]', JSON.stringify(fill.s.amber))
check('Develop stays current on the fill note', JSON.stringify(fill.s.current) === '["Develop"]', JSON.stringify(fill.s.current))

await p.locator('button[aria-label="Stop"]').first().click()
const stopped = await until(s => s.amber.length === 0 && s.caption === '', 1500)
check('stop clears the amber cell', stopped.s.amber.length === 0, JSON.stringify(stopped.s))
check('stop empties the caption', stopped.s.caption === '', JSON.stringify(stopped.s.caption))

await group.getByRole('button', { name: 'Interact / climax', exact: true }).click()
const climax = await until(s => JSON.stringify(s.amber) === '["12"]', 2000)
check('tap while stopped starts at bar 12 within 2 s', climax.hit && climax.s.playing, `${climax.ms} ms ${JSON.stringify(climax.s)}`)
await p.locator('button[aria-label="Stop"]').first().click()

await p.evaluate(() => { location.hash = '/lens' })
await p.locator('main h1', { hasText: 'Drummers' }).waitFor()
const list = await p.evaluate(() => {
  const alpha = c => { const m = c.match(/[\d.]+/g) ?? []; return m.length >= 4 ? +m[3] : 1 }
  const rows = [...document.querySelectorAll('main ul li')]
  const btns = rows.map(li => li.querySelector('button'))
  return {
    rows: rows.length,
    borders: rows.filter(li => { const s = getComputedStyle(li); return parseFloat(s.borderTopWidth) > 0 || parseFloat(s.borderBottomWidth) > 0 }).length,
    chevron: document.querySelector('main').textContent.includes('\u203a'),
    nameColors: [...new Set(btns.map(x => getComputedStyle(x.querySelector('span.text-lg')).color))],
    bandAlphas: btns.map(x => alpha(getComputedStyle(x.querySelector('span:nth-child(2)')).color)),
    gaps: btns.slice(1).map((x, i) => Math.round((x.getBoundingClientRect().top - btns[i].getBoundingClientRect().bottom) * 10) / 10),
    imgs: document.querySelectorAll('main img').length,
    firstName: btns[0]?.querySelector('span.text-lg').textContent,
  }
})
check('drummers list has rows', list.rows > 1, String(list.rows))
check('no row has a top or bottom border', list.borders === 0, String(list.borders))
check('no chevron in the list', !list.chevron)
check('names use the default bone color', JSON.stringify(list.nameColors) === '["rgb(244, 241, 234)"]', JSON.stringify(list.nameColors))
check('bands are dimmed', list.bandAlphas.every(a => a < 1), JSON.stringify(list.bandAlphas))
check('rows are separated by a gap', list.gaps.every(g => g > 0), JSON.stringify(list.gaps))
check('no images in the list', list.imgs === 0, String(list.imgs))
await p.locator('main ul li button').first().click()
await p.waitForFunction(() => /^#\/lens\/[^/]+$/.test(location.hash), null, { timeout: 2000 }).catch(() => {})
const detail = await p.evaluate(() => ({ hash: location.hash, h1: document.querySelector('main h1')?.textContent }))
const id = detail.hash.replace(/^#\/lens\//, '')
check('first row opens that drummer', /^#\/lens\/[^/]+$/.test(detail.hash) && detail.h1 === list.firstName, `${detail.hash} id=${id} h1=${detail.h1}`)

await b.close()
if (fail.length) { console.log('FAILED', fail.join(', ')); process.exit(1) }
console.log('story strip ok')
