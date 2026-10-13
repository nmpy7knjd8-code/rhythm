// Anesthetize at 390 px: every variant label (h2/m2/f2...) must sit inside its note bar, including half-height (soft) bars.
import { chromium, devices } from 'playwright'
const U = process.argv[2] || 'https://nmpy7knjd8-code.github.io/rhythm/'
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const c = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } }); const p = await c.newPage()
await p.goto(U, { waitUntil: 'networkidle' })
await p.evaluate(async () => { await window.__pulseLoadSong('anesthetize', 0) }); await p.click('button[aria-label="Browse rhythms"]'); await p.waitForTimeout(600)
await p.evaluate(async () => { const e = window.__pulseEngine; await e.start(); e.setBpm(e.songBaseBpm * 3) })
let checked = 0, soft = 0, bad = 0, shot = false
for (let k = 0; k < 40; k++) {
  await p.waitForTimeout(250)
  const r = await p.$$eval('span[title]', els => els.filter(el => el.textContent).map(el => {
    const bar = el.previousElementSibling?.previousElementSibling ?? null, cell = el.parentElement.getBoundingClientRect(), l = el.getBoundingClientRect()
    const bars = [...el.parentElement.children].filter(x => x.style.height && x !== el && !x.title)[0]
    const bb = bars?.getBoundingClientRect()
    return { txt: el.textContent, softBar: bb ? bb.height < cell.height * 0.8 : false, inside: bb ? (l.top + l.height / 2 >= bb.top - 0.5 && l.top + l.height / 2 <= bb.bottom + 0.5) : true, labelVisible: l.bottom <= cell.bottom + 0.5 && l.top >= cell.top - 0.5 }
  }))
  for (const x of r) { checked++; if (x.softBar) soft++; if (!x.inside || !x.labelVisible) bad++ }
  if (!shot && r.some(x => x.softBar)) { shot = true; const el = await p.$('span[title]'); await el.evaluate(e => e.scrollIntoView({ block: 'center' })); const bx = await el.evaluate(e => { const r = e.closest('.flex-1.flex').parentElement.parentElement.getBoundingClientRect(); return { x: 0, y: Math.max(0, r.top - 10), width: 390, height: Math.min(300, r.height + 20) } }); await p.screenshot({ path: '/tmp/variant-soft.png' }) }
}
console.log({ checked, soft, bad }); await b.close()
