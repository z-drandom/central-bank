import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
await page.goto(pathToFileURL('/home/user/central-bank/dist/index.html').href + '#overview', { waitUntil: 'domcontentloaded' });
for (const tab of ['overview', 'y25', 'b26', 'debt', 'fb', 'proj', 'sens', 'play', 'book']) {
  await page.evaluate((t) => __fiscal.go(t), tab);
  if (process.env.NOBLUR) await page.addStyleTag({ content: '.top{backdrop-filter:none!important}' });
  if (process.env.NOCHG) await page.addStyleTag({ content: '#changes{display:none!important}' });
  const ms = await page.evaluate(async () => {
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) {
      __fiscal.set('t_vat', 60000 + i * 100);
      await new Promise((r) => requestAnimationFrame(() => r()));
    }
    return (performance.now() - t0) / 20;
  });
  const compute = await page.evaluate(() => { const t0 = performance.now(); for (let i = 0; i < 50; i++) __fiscal.sim.recompute(); return (performance.now() - t0) / 50; });
  console.log(tab.padEnd(9), `每次拖动 ${ms.toFixed(1)} ms（含一帧等待）`, `纯计算 ${compute.toFixed(2)} ms`);
}
await browser.close();
