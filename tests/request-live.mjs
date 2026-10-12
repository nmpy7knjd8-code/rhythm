import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await p.goto('https://nmpy7knjd8-code.github.io/rhythm/?v=' + Date.now() + '#/library', { waitUntil: 'networkidle' }); await p.waitForTimeout(400)
await p.locator('input[placeholder="Request a song"]').fill('Test request: please ignore')
p.on('requestfailed', r => console.log('FAILED', r.url(), r.failure()?.errorText)); p.on('console', m => console.log('console', m.text().slice(0, 200))); p.on('request', r => { if (r.url().includes('web3forms')) console.log('REQ', r.method(), r.url()) })
const [resp] = await Promise.all([p.waitForResponse(r => r.url().includes('web3forms.com'), { timeout: 20000 }), p.getByRole('button', { name: 'Send' }).click()])
console.log('web3forms', resp.status(), (await resp.text()).slice(0, 200)); await p.waitForTimeout(600)
console.log('inline thanks shown:', await p.locator('text=Thanks, request sent').count())
await p.screenshot({ path: '/workspace/screenshots/v7-request-sent.png' }); await b.close()
