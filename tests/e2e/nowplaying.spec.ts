import { expect, test } from '@playwright/test'
import { openSong } from './app'

test('tapping the playing section strip jumps to that bar, and section names are buttons', async ({ page }) => {
  const d = await openSong(page, 'killing', 'Now playing')
  await d.getByRole('button', { name: 'Play' }).first().click()
  const strip = d.getByRole('slider', { name: /^Bar in / })
  await expect(strip).toHaveCount(1)
  const bars = Number(await strip.getAttribute('aria-valuemax'))
  const box = (await strip.boundingBox())!
  await strip.click({ position: { x: box.width * (bars - 0.5) / bars, y: box.height / 2 } })
  await expect(strip).toHaveAttribute('aria-valuenow', String(bars))
  await d.getByRole('button', { name: 'Jump to Chorus' }).first().click()
  await expect(d.getByRole('slider', { name: 'Bar in Chorus' })).toBeVisible()
})
