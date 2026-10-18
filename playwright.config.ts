import { defineConfig, devices } from '@playwright/test'

const port = process.env.PW_PORT ?? '4173' // a second checkout can test side by side on another port

// Browser checks against the production build (`npm run build` first): `npm run test:e2e`.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  // screenshot baselines are rendered with this box's fonts; CI (other fonts) runs everything else
  grepInvert: process.env.CI ? /@visual/ : undefined,
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...devices['iPhone 13'],
    browserName: 'chromium',
    viewport: { width: 390, height: 844 },
    baseURL: `http://localhost:${port}/rhythm/`,
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
  webServer: {
    command: `npx vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}/rhythm/`,
    reuseExistingServer: !process.env.CI,
  },
})
