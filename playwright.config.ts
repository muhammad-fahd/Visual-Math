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
  // Port 3100, so a developer's own server on 3000 is never reused (it would lack VM_HARNESS). The
  // harness page of the scene frame exists only for this server (Story 2.3).
  webServer: {
    command: 'npm run start -- -p 3100',
    url: 'http://localhost:3100',
    timeout: 120_000,
    // Never reuse: a stale server on 3100 would lack VM_HARNESS or hold an old build.
    reuseExistingServer: false,
    env: { VM_HARNESS: '1' },
  },
  use: { baseURL: 'http://localhost:3100' },
  projects,
});
