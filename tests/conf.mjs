import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } })
await p.goto('https://nmpy7knjd8-code.github.io/rhythm/?v=' + Date.now() + '#/library', { waitUntil: 'networkidle' })
const t = await p.locator('main').innerText()
console.log('Songsterr lines on cards:', (t.match(/transcribed \(Songsterr community tab\)/g) || []).length)
console.log('low/partial notes:', (t.match(/^(Low: .*|Partial)$/gm) || []).join(' | '))
await p.getByRole('button', { name: 'more' }).first().click(); await p.waitForTimeout(300)
console.log('note:', (await p.locator('main').innerText()).match(/Drum parts transcribed from Songsterr[^.]*\./)?.[0])
await b.close()
