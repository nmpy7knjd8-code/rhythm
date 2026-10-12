import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await b.newPage()
const html = (size, scale) => `<html><body style="margin:0;background:#000;width:${size}px;height:${size}px;display:grid;place-items:center">
<div style="display:flex;align-items:center;gap:${size * 0.045 * scale}px;font-family:Inter,'Inter Display',sans-serif;font-weight:600;letter-spacing:-0.02em;color:#f4f1ea;font-size:${size * 0.25 * scale}px">
<span style="width:${size * 0.085 * scale}px;height:${size * 0.085 * scale}px;border-radius:50%;background:#ffb000;display:inline-block"></span>Pulse</div></body></html>`
for (const [name, size, scale] of [['apple-touch-icon', 180, 1], ['icon-192', 192, 1], ['icon-512', 512, 1], ['icon-maskable-512', 512, 0.78]]) {
  await p.setViewportSize({ width: size, height: size }); await p.setContent(html(size, scale)); await p.waitForTimeout(150)
  await p.screenshot({ path: `public/icons/${name}.png` })
}
await b.close()
