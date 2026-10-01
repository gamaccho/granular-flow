import { defineConfig, devices } from '@playwright/test';

const builtUrl = process.env.AFTERTOUCH_PREVIEW_URL || process.env.AFTERTOUCH_CONNECTED_URL;

export default defineConfig({
  testDir: './tests/browser',
  timeout: 30000,
  workers: 1,
  use: {
    baseURL: builtUrl || 'http://127.0.0.1:5173',
    channel: process.env.CI ? 'chromium' : 'chrome',
    launchOptions: { args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: builtUrl ? undefined : {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
