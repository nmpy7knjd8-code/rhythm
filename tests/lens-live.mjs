import { chromium, devices } from 'playwright'
const b = await chromium.launch(); const c = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } }); const p = await c.newPage()
const U='https://nmpy7knjd8-code.github.io/rhythm/'
await p.goto(U+'#/lens'); await p.waitForTimeout(2500)
const names = await p.$$eval('ul li button span.text-lg', e => e.map(x => x.textContent)); console.log('list', names.length, names.join(', '))
for (const id of ['dolmayan','porcaro','grohl','krupa','gadd','twilliams']) {
  await p.goto(U+'#/lens/'+id); await p.waitForTimeout(1500)
  const r = await p.evaluate(() => ({ h: document.querySelector('h1')?.textContent, quotes: document.querySelectorAll('blockquote').length, inpulse: [...document.querySelectorAll('li span.block.truncate')].map(x=>x.textContent).filter((_,i)=>i%2==0), overflow: document.documentElement.scrollWidth > 390 }))
  console.log(id, JSON.stringify(r))
  if (id==='porcaro') await p.screenshot({ path: '/tmp/porcaro.png', fullPage: true })
}
await p.goto(U+'#/lens/porcaro'); await p.waitForTimeout(1500); await p.click('button[aria-label="Play Africa"]'); await p.waitForTimeout(3000)
console.log('playing', await p.evaluate(() => window.__pulseEngine?.isPlaying?.() ?? window.__pulseEngine?.playing))
await b.close()
