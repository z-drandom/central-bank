// 截图工具：node tests/e2e/shot.mjs <tab> [width] [out] [--dark] [--eval "js"]
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const tab = args[0] ?? 'overview';
const width = Number(args[1] ?? 1400);
const out = args[2] ?? `screenshots/${tab}-${width}.png`;
const dark = args.includes('--dark');
const evalIdx = args.indexOf('--eval');
const script = evalIdx >= 0 ? args[evalIdx + 1] : null;
const full = !args.includes('--viewport');
const selIdx = args.indexOf('--sel');
const sel = selIdx >= 0 ? args[selIdx + 1] : null;

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width, height: 900 }, colorScheme: dark ? 'dark' : 'light', deviceScaleFactor: width < 600 ? 2 : 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
await page.goto(pathToFileURL(resolve('dist/index.html')).href + '#' + tab, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(400);
if (script) { await page.evaluate(script); await page.waitForTimeout(600); }
if (sel) await page.locator(sel).first().screenshot({ path: out });
else await page.screenshot({ path: out, fullPage: full });
const real = errors.filter((e) => !/ERR_(TOO_MANY_RETRIES|CERT|NAME|CONNECTION|TUNNEL|PROXY|FAILED)/.test(e));
console.log(out, real.length ? 'ERRORS:\n' + real.join('\n') : 'no errors');
await browser.close();
