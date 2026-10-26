import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    channel: 'chrome',
    trace: 'off',
    screenshot: 'on',
    video: 'off',
    headless: true,
  },
  projects: [
    {
      name: 'Mobile 375px',
      use: {
        viewport: { width: 375, height: 667 },
        extraHTTPHeaders: {
          'x-test-ip': '10.0.1.1',
        },
      },
    },
    {
      name: 'Tablet 768px',
      use: {
        viewport: { width: 768, height: 1024 },
        extraHTTPHeaders: {
          'x-test-ip': '10.0.2.1',
        },
      },
    },
    {
      name: 'Desktop 1280px',
      use: {
        viewport: { width: 1280, height: 800 },
        extraHTTPHeaders: {
          'x-test-ip': '10.0.3.1',
        },
      },
    },
  ],
});
