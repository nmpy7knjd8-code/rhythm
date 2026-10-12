import { chromium } from 'playwright'
const URL = 'https://nmpy7knjd8-code.github.io/rhythm/'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } })
await p.goto(URL + '?v=' + Date.now() + '#/story', { waitUntil: 'networkidle' }); await p.waitForTimeout(500)
const sec = async h => p.locator(`section:has(h2:text("${h}")) li`).allInnerTexts()
console.log('Drum journeys:', (await sec('Drum journeys')).map(t => t.split('\n')[0]).join(' | '))
console.log('Style studies:', (await sec('Style studies')).map(t => t.split('\n')[0]).join(' | '))
await p.goto(URL + '?v=' + Date.now() + '#/library', { waitUntil: 'networkidle' }); await p.getByRole('button', { name: /^Styles/ }).click(); await p.waitForTimeout(300)
const tabs = await p.locator('main button').allInnerTexts(); const t = tabs.find(x => /Trance/.test(x)); if (t) { await p.getByRole('button', { name: t }).click(); await p.waitForTimeout(300) }
console.log('Trance & pulse styles:', (await p.locator('main article h2, main article h3').allInnerTexts()).join(' | '))
console.log('any theta/shaman/Harner text on Styles:', /theta|shaman|harner/i.test(await p.locator('main').innerText()))
await b.close()
