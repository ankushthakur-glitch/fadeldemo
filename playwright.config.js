// Playwright config — DEV TOOLING ONLY.
// Nothing in /css or /js imports anything from here. Delete /tests and
// /node_modules and the prototype still opens fine from index.html.
//
// What this file sets up, in plain language:
//  - a tiny static web server so tests can visit the screens over http://
//  - Chromium only (we don't need three browsers to check a design system)
//  - screenshots that look identical every run, so a diff means a real change

import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: './tests/specs',

  // Where visual-regression baselines live. Keeping them out of testDir
  // means the spec folder stays readable.
  snapshotPathTemplate: './tests/screenshots/{testFileName}/{arg}{ext}',

  // A failing test should never be "flaky-passed" into green.
  forbidOnly: true,
  retries: 0,
  workers: 1, // deterministic screenshots beat raw speed here
  reporter: [['html', { outputFolder: 'tests/report', open: 'never' }], ['list']],

  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    headless: true,
    // deviceScaleFactor 2 = retina-quality captures, so small type and
    // 1px borders are actually inspectable in the diff images.
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  expect: {
    toHaveScreenshot: {
      /*
       * 0.001, not the 0.01 you might reach for first.
       *
       * On a full-page screenshot, text is a small share of the pixels. At
       * 0.01 a genuine change — every patient name switching from oxblood to
       * blue — moved well under 1% of pixels, so the test PASSED and the
       * baseline was never rewritten. The stored image silently drifted out
       * of date while the suite stayed green.
       *
       * With animations disabled and a fixed viewport there is almost no
       * legitimate pixel noise, so this can be tight. If it ever goes flaky,
       * find the source of the noise rather than raising this number.
       */
      maxDiffPixelRatio: 0.001,
      animations: 'disabled',
      caret: 'hide',
      scale: 'device',
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], deviceScaleFactor: 2 },
    },
  ],

  webServer: {
    command: `npx --yes http-server . -p ${PORT} -c-1 --silent`,
    // gallery.html, not index.html: the root redirects to the sign-in page,
    // and a readiness probe should settle on a page rather than follow a hop.
    url: `http://127.0.0.1:${PORT}/gallery.html`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
