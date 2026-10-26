import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const viewports = [
  { name: 'mobile', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
];

const pagesToTest = [
  { name: 'home', path: '/' },
  { name: 'rooms', path: '/rooms' },
  { name: 'room-details', path: '/rooms/1' },
  { name: 'login', path: '/login' },
  { name: 'confirmation', path: '/booking/LS-2026-000001/confirmation' },
];

const resultsDir = path.resolve('screenshots/photo-audit');
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

async function verify() {
  const browser = await chromium.launch({ channel: 'chrome' });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('--- Starting Multi-Viewport Photo & Layout Audit ---');

  for (const vp of viewports) {
    console.log(`\nTesting Viewport: ${vp.name} (${vp.width}x${vp.height})`);
    await page.setViewportSize({ width: vp.width, height: vp.height });

    for (const p of pagesToTest) {
      try {
        await page.goto(`http://localhost:5173${p.path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(600); // Allow render settlement

        // 1. Check for horizontal overflow
        const { scrollWidth, innerWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));

        const hasNoOverflow = scrollWidth <= innerWidth;

        // 2. Check images presence
        const imageStats = await page.evaluate(() => {
          const imgs = Array.from(document.querySelectorAll('img'));
          return {
            totalImgs: imgs.length,
            loadedImgs: imgs.filter(img => img.naturalWidth > 0 || img.complete).length,
          };
        });

        // 3. Take screenshot
        const shotFile = path.join(resultsDir, `${vp.width}_${p.name}.png`);
        await page.screenshot({ path: shotFile, fullPage: false });

        console.log(`  ✓ ${p.name.padEnd(14)} [${vp.width}px]: noOverflow=${hasNoOverflow} (scroll:${scrollWidth}/inner:${innerWidth}), imgs: ${imageStats.loadedImgs}/${imageStats.totalImgs}`);
      } catch (err) {
        console.error(`  ✗ ${p.name.padEnd(14)} [${vp.width}px] Failed:`, err.message);
      }
    }
  }

  await browser.close();
  console.log('\n--- Verification Audit Complete ---');
}

verify().catch((err) => {
  console.error('Audit run failed:', err);
  process.exit(1);
});
