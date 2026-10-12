import { chromium } from 'playwright'
const URL = process.argv[2] ?? 'https://nmpy7knjd8-code.github.io/rhythm/'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
const p = await ctx.newPage(); await p.goto(URL + '?v=' + Date.now(), { waitUntil: 'networkidle' })
const cdp = await ctx.newCDPSession(p)
const touch = async (x, y, dx, dy, steps = 10) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / steps, y: y + dy * i / steps }] }); await p.waitForTimeout(16) } await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(450) }
const hidden = () => p.locator('[role=dialog]').getAttribute('aria-hidden')
const open = async t => { if (await hidden() === 'false') { await p.keyboard.press('Escape'); await p.waitForTimeout(350) } await p.locator('[aria-label="Browse rhythms"]').click(); await p.waitForTimeout(400); await p.getByRole('button', { name: t, exact: true }).click(); await p.waitForTimeout(300) }
await open('Sound')
const sl = await p.locator('input[aria-label=Tempo]').boundingBox(); const bpm0 = await p.locator('input[aria-label=Tempo]').inputValue()
await touch(sl.x + sl.width * 0.3, sl.y + sl.height / 2, 120, 40)
console.log('tempo slider drag (right + 40px down): sheet closed =', await hidden(), '| bpm', bpm0, '->', await p.locator('input[aria-label=Tempo]').inputValue())
await touch(sl.x + sl.width * 0.6, sl.y + sl.height / 2, -20, 150)
console.log('slider dragged mostly downward 150px: sheet closed =', await hidden())
const c = await p.locator('[role=dialog] .overflow-y-auto').boundingBox()
await touch(c.x + 30, c.y + 10, 0, 150); console.log('Sound tab: pull down on blank content 150px -> closed =', await hidden(), '(expect false)')
await open('Now playing'); const c2 = await p.locator('[role=dialog] .overflow-y-auto').boundingBox()
await touch(c2.x + 150, c2.y + 60, 0, 50); console.log('Now playing: 50px content pull -> closed =', await hidden(), '(expect false)')
await touch(c2.x + 150, c2.y + 60, 0, 120); console.log('Now playing: 120px content pull -> closed =', await hidden(), '(expect true)')
await open('Sound'); const h = await p.locator('[role=dialog] .touch-none').boundingBox()
await touch(h.x + 120, h.y + 25, 0, 45, 5); console.log('header 45px drag on Sound -> closed =', await hidden(), '(expect true)')
await open('Sound'); await p.screenshot({ path: '/workspace/screenshots/v6-sound-slider.png' })
await b.close()
