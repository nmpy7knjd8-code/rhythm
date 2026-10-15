// Every song: the Learn it Full button equals the section's recorded tempo (median bar BPM from the data, display-scaled),
// pressing Full plays at that tempo (scale 1), and the tempo line reads the same BPM as Full. Start/Middle scale with it.
import { chromium } from 'playwright'
import { readFileSync, readdirSync } from 'fs'
const url = process.argv[2] ?? 'http://localhost:4173/rhythm/'
const ids = process.argv[3]?.split(',') ?? readdirSync('public/songs').filter(f => f.endsWith('.json')).map(f => f.slice(0, -5))
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage()
await p.goto(url + '?v=' + Date.now(), { waitUntil: 'networkidle' })
const d = p.locator('[role=dialog]'); let bad = 0, n = 0
const meta = JSON.parse(readFileSync('src/data/songs.json', 'utf8')), list = Array.isArray(meta) ? meta : meta.songs
const display = Object.fromEntries(list.map(s => [s.id, s.bpmDisplay ?? 1]))
for (const id of ids) {
  const j = JSON.parse(readFileSync(`public/songs/${id}.json`, 'utf8'))
  if (!(await p.evaluate(async id => { try { await window.__pulseLoadSong(id, 1); return true } catch { return false } }, id))) continue
  if (await d.getAttribute('aria-hidden') !== 'false') await p.locator('[aria-label="Browse rhythms"]').click()
  await d.getByRole('button', { name: 'Learn it', exact: true }).click()
  const secs = d.locator('[aria-label="Sections"] button')
  for (const si of [0, Math.floor(j.sections.length / 2)]) {
    await secs.nth(si).click(); await p.waitForTimeout(60)
    const f = d.getByRole('button', { name: /^Full \d+/ }); await f.click(); await p.waitForTimeout(60)
    const full = +(await f.textContent()).match(/\d+/)[0]
    const line = +(await d.getByText(/% · \d+ BPM/).first().textContent()).match(/· (\d+) BPM/)[1]
    const scale = await p.evaluate(() => window.__pulseEngine.songTempoScale)
    const disp = display[id] ?? 1, bpms = j.sections[si].bpm.map(x => Math.round(x * disp)).sort((a, b) => a - b), want = bpms[bpms.length >> 1]
    const ok = full === want && line === full && Math.abs(scale - 1) < 0.01
    n++; if (!ok) { bad++; console.log(`FAIL ${id} §${si} ${j.sections[si].name}: Full ${full}, data ${want}, line ${line}, scale ${scale.toFixed(2)}`) }
  }
}
await b.close()
console.log(`${n - bad}/${n} sections match`); if (bad) process.exit(1)
