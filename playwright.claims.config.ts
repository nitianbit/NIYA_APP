import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: '**/*.real-api.ts', workers: 1, fullyParallel: false,
  timeout: 45_000, use: { baseURL: 'http://127.0.0.1:4175', headless: true, trace: 'retain-on-failure' },
  projects: [ { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } } ],
  webServer: [
    { command: 'npm --prefix ../niya_backend run build && node ../niya_backend/dist/testing/regression-server.js',
      url: 'http://127.0.0.1:4176/__test/fixture', timeout: 120_000, reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 15_000 } },
    { command: 'npm run dev -- --host 127.0.0.1 --port 4175 --strictPort', url: 'http://127.0.0.1:4175',
      env: { VITE_API_BASE_URL: 'http://127.0.0.1:4176' }, reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 } },
  ],
});
