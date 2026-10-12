import { chromium } from 'playwright'
const URL = 'https://nmpy7knjd8-code.github.io/rhythm/'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await p.goto(URL + '?v=' + Date.now() + '#/theory', { waitUntil: 'networkidle' }); await p.waitForTimeout(500)
console.log('theory order:', (await p.locator('main section h2').allInnerTexts()).join(' > '))
console.log('combo buttons:', (await p.locator('main section').evaluateAll(ss => ss.filter(s => /Play all/.test(s.innerText)).map(s => s.id))).join(', '))
await p.screenshot({ path: '/workspace/screenshots/v10-theory.png' })
await p.goto(URL + '?v=' + Date.now() + '#/library', { waitUntil: 'networkidle' }); await p.waitForTimeout(500)
console.log('library order:', await p.evaluate(() => { const els = [...document.querySelectorAll('main *')]; const i = s => els.findIndex(s); return { tabs: i(e => /^Songs · /.test(e.textContent ?? '') && e.tagName === 'BUTTON'), bubbles: i(e => e.getAttribute?.('aria-label') === 'Artists'), request: i(e => e.getAttribute?.('aria-label') === 'Request a song') } }))
await p.screenshot({ path: '/workspace/screenshots/v10-library.png' })
await b.close()
