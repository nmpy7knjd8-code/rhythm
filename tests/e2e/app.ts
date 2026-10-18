import { expect, type Page } from '@playwright/test'

/** The player sheet (the one dialog). */
export const sheet = (page: Page) => page.locator('[role=dialog]') // hidden from the a11y tree while closed, so not getByRole

/** Load a song through the app's own loader and open the player sheet on `tab`. */
export async function openSong(page: Page, id: string, tab: 'Learn it' | 'Now playing' = 'Learn it') {
  await page.goto('./', { waitUntil: 'networkidle' })
  await page.evaluate(async id => {
    const w = window as unknown as { __pulseEngine: { stop(): void }; __pulseLoadSong(id: string, n: number): Promise<void> }
    w.__pulseEngine.stop(); await w.__pulseLoadSong(id, 1)
  }, id)
  const d = sheet(page)
  if (await d.getAttribute('aria-hidden') !== 'false') await page.getByLabel('Browse rhythms').click()
  await expect(d).toHaveAttribute('aria-hidden', 'false')
  await d.getByRole('button', { name: tab, exact: true }).click()
  return d
}

/** Pick a Learn it section by its pill index. */
export async function pickSection(page: Page, index: number) {
  await sheet(page).getByLabel('Sections').getByRole('button').nth(index).click()
}
