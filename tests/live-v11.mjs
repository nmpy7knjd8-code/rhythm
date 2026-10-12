import { chromium } from 'playwright'
const URL = 'https://nmpy7knjd8-code.github.io/rhythm/'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await p.goto(URL + '?v=' + Date.now() + '#/library', { waitUntil: 'networkidle' }); await p.waitForTimeout(500)
await p.screenshot({ path: '/workspace/screenshots/v11-bubbles.png' }); console.log('nav height', await p.locator('nav[aria-label=Artists]').evaluate(e => e.offsetHeight)); const names = await p.locator('nav[aria-label=Artists] button').allInnerTexts()
for (const a of [names.at(-1), names.at(-6), 'Gojira', 'Benny Goodman Orchestra']) {
  await p.goto(URL + '?v=' + Date.now() + '#/library', { waitUntil: 'networkidle' }); await p.waitForTimeout(400)
  await p.getByText('More artists').click(); await p.locator('nav[aria-label=Artists] button', { hasText: a }).first().click(); await p.waitForTimeout(3500)
  const id = 'artist-' + a.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  console.log(a, 'top =', await p.evaluate(id => Math.round(document.getElementById(id).getBoundingClientRect().top), id), '| card:', (await p.locator('#' + id).innerText()).match(/\d+ BPM/)?.[0])
}
await b.close()
