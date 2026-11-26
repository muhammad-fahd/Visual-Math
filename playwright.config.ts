import { readFileSync } from 'node:fs';
import { defineConfig } from '@playwright/test';
import { matrixFromBrowserslist } from './tests/playwright-matrix';

const projects = matrixFromBrowserslist(readFileSync('browserslist', 'utf8')).map((p) => ({
  name: p.name,
  use: {
    browserName: p.browser,
    ...(p.channel ? { channel: p.channel } : {}),
    viewport: { width: p.width, height: p.height },
    isMobile: p.mobile,
    hasTouch: p.mobile,
  },
}));

export default defineConfig({
  testDir: 'tests/e2e',
  webServer: { command: 'npm run start', url: 'http://localhost:3000', timeout: 120_000, reuseExistingServer: !process.env.CI },
  use: { baseURL: 'http://localhost:3000' },
  projects,
});
