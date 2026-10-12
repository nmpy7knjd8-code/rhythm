import { chromium } from 'playwright'
const URL = 'https://nmpy7knjd8-code.github.io/rhythm/'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
const p = await ctx.newPage(); const S = n => p.screenshot({ path: `/workspace/screenshots/${n}.png` })
await p.goto(URL + '?v=' + Date.now() + '#/library', { waitUntil: 'networkidle' }); await p.waitForTimeout(500)
console.log('menu button present:', await p.locator('[aria-label="Menu"]').count(), '| nav links:', (await p.locator('nav a[href^="#/"]').allInnerTexts()).join(', '))
const txt = await p.locator('main').innerText(); console.log('Songs has generic/reference:', /generic|\(reference\)|Afrobeat groove/i.test(txt))
console.log('h1 align:', await p.locator('h1').evaluate(e => getComputedStyle(e.parentElement).textAlign))
console.log('nav rows:', new Set(await p.locator('nav div a').evaluateAll(as => as.map(a => Math.round(a.getBoundingClientRect().top)))).size, '| Black Page:', /Black Page/.test(txt), '| pills:', await p.getByRole('button', { name: 'Virtuoso', exact: true }).count())
await S('v5-library-songs')
await p.getByRole('button', { name: /^Styles/ }).click(); await p.waitForTimeout(400)
const genres = await p.locator('[role=tablist][aria-label=Genres] button').allInnerTexts(); console.log('genres:', genres.join(' | '))
console.log('styles shown for first genre:', await p.locator('main article').count()); await S('v5-styles-genres')
await p.locator('[role=tablist][aria-label=Genres] button').nth(2).click(); await p.waitForTimeout(300); console.log('after picking', genres[2], ':', await p.locator('main article').count())
// swipe tests
const cdp = await ctx.newCDPSession(p)
const swipe = async (x, y, dist, steps, ms) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + dist * i / steps }] }); await p.waitForTimeout(ms) } await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(450) }
const open = async () => { if (await hidden() === 'false') await p.keyboard.press('Escape'); await p.waitForTimeout(350); await p.locator('[aria-label="Browse rhythms"]').click(); await p.waitForTimeout(450) }
const hidden = () => p.locator('[role=dialog]').getAttribute('aria-hidden')
await open(); await S('v5-sheet'); let hb = await p.locator('[role=dialog] .touch-none').boundingBox()
await swipe(hb.x + 200, hb.y + hb.height - 15, 60, 6, 16); console.log('slow 60px drag from tab row -> closed:', await hidden())
await open(); hb = await p.locator('[role=dialog] .touch-none').boundingBox()
await swipe(hb.x + 120, hb.y + 25, 30, 3, 8); console.log('quick 30px flick on title -> closed:', await hidden())
await open(); const c = await p.locator('[role=dialog] .overflow-y-auto').boundingBox()
await swipe(c.x + 150, c.y + 80, 120, 8, 16); console.log('pull-down on content at scrollTop 0 -> closed:', await hidden())
await open(); await p.locator('[role=dialog] .overflow-y-auto').evaluate(e => e.scrollTop = 300); const c2 = await p.locator('[role=dialog] .overflow-y-auto').boundingBox()
await swipe(c2.x + 150, c2.y + 80, 120, 8, 16); console.log('drag down while scrolled -> closed (expect false):', await hidden(), 'scrollTop', await p.locator('[role=dialog] .overflow-y-auto').evaluate(e => e.scrollTop))
await b.close()
