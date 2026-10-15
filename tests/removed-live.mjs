// Removed songs are gone everywhere: Songs count, artist bubbles, song cards, Lens "In Pulse"; shuffle draws only from what remains.
import { chromium } from 'playwright'
const url = process.argv[2] ?? 'http://localhost:4173/rhythm/'
const gone = ['Meeting of the Spirits', 'Fred', 'The Heaviest Matter of the Universe', 'Bleed', 'Too Many Puppies', 'Those Damned Blue-Collar Tweekers', 'Frizzle Fry', 'Aja', 'Amen, Brother', 'Stratus', 'Manic Depression']
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage({ viewport: { width: 390, height: 844 } })
await p.goto(url + '?v=' + Date.now(), { waitUntil: 'networkidle' }); await p.waitForTimeout(800)
const r = await p.evaluate(gone => {
  const count = [...document.querySelectorAll('button')].map(x => x.textContent).find(t => /^Songs · /.test(t))
  const bubbles = [...document.querySelectorAll('#artists button')].map(x => x.textContent)
  const titles = [...document.querySelectorAll('article h2')].map(x => x.textContent)
  return { count, emptyArtists: bubbles.filter(a => /Mahavishnu|Tony Williams|Gojira|Meshuggah|Winstons|Billy Cobham|Steely Dan|Hendrix/.test(a)), goneCards: titles.filter(t => gone.includes(t)) }
}, gone)
const pool = new Set()
for (let i = 0; i < 6; i++) { await p.click('button[aria-label="Shuffle songs"]'); await p.waitForTimeout(1200)
  for (const x of await p.locator('button[aria-label^="Remove "][aria-label$=" from queue"]').evaluateAll(n => n.map(e => e.getAttribute('aria-label')))) pool.add(x) }
r.queuedGone = [...pool].filter(x => gone.some(g => x === `Remove ${g} from queue`))
await p.goto(url + '#/lens'); await p.waitForTimeout(1200)
r.lensMentions = await p.evaluate(() => document.body.innerText.includes('Billy Cobham'))
console.log(JSON.stringify(r))
await b.close()
