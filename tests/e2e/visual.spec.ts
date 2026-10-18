import { expect, test, type Page } from '@playwright/test'
import { openSong, pickSection, sheet, transport } from './app'

// Learn it at 390 px: 6 songs x idle / steps open / playing. Anything that moves with the audio (lit notation cell,
// playing bar in the strip, the bar number) is masked. Baselines are this box's Chromium fonts, so CI skips @visual; run it through
// the verify skill. After an intended layout change: `npx playwright test visual --update-snapshots`, then look at the diffs.
const SONGS: [string, number][] = [['backinblack', 1], ['schism', 3], ['yyz', 1], ['billiejean', 1], ['killing', 1], ['fearinoculum', 2]]
const moving = (page: Page) => [sheet(page).getByRole('img', { name: 'Bar notation with the count under each beat' }), sheet(page).locator('[aria-label$=" bars"]'), sheet(page).getByText(/ · bar \d+$/)]
const shot = (page: Page, name: string) => expect(page).toHaveScreenshot(`${name}.png`, { mask: moving(page), animations: 'disabled', maxDiffPixelRatio: 0.002 })

for (const [id, section] of SONGS) {
  test(`@visual ${id} Learn it`, async ({ page }) => {
    const d = await openSong(page, id)
    await pickSection(page, section)
    await page.waitForTimeout(600) // the pill row's smooth auto-centre
    await shot(page, `${id}-idle`)
    const tb = d.getByRole('toolbar', { name: 'Practice' })
    await tb.getByRole('button', { name: 'Steps' }).click()
    await shot(page, `${id}-steps`)
    await transport(page, 'Play').click()
    await expect(transport(page, 'Stop')).toBeVisible()
    await page.waitForTimeout(600)
    await shot(page, `${id}-playing`)
  })
}
