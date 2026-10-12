import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await p.goto('https://nmpy7knjd8-code.github.io/rhythm/?v=' + Date.now() + '#/history', { waitUntil: 'networkidle' })
const links = p.locator('nav a[href^="#/"]:not([href="#/library"]:first-child)')
const r = await p.evaluate(() => { const row = document.querySelector('nav > div'); const as = [...row.querySelectorAll('a')]; const rr = row.getBoundingClientRect(), f = as[0].getBoundingClientRect(), l = as.at(-1).getBoundingClientRect()
  return { items: as.map(a => a.textContent).join(' | '), oneLine: new Set(as.map(a => Math.round(a.getBoundingClientRect().top))).size === 1, leftGap: Math.round(f.left - rr.left), rightGap: Math.round(rr.right - l.right), historyLinks: document.querySelectorAll('a[href="#/history"]').length, h1: document.querySelector('main h1')?.textContent } })
console.log(JSON.stringify(r)); await p.screenshot({ path: '/workspace/screenshots/v18-nav.png', clip: { x: 0, y: 0, width: 390, height: 140 } }); await b.close()
