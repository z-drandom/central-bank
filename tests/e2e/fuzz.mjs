// 随机操作测试：在各页随机点击按钮、切换规则、设置参数，检查脚本错误与异常文本（NaN、undefined、Infinity）。
// 运行：node tests/e2e/fuzz.mjs [步数] [随机种子]
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const STEPS = Number(process.argv[2] ?? 300);
let seed = Number(process.argv[3] ?? 7);
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rnd() * a.length)];

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: pick([1400, 1100, 390]), height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/ERR_/.test(m.text())) errors.push(m.text()); });
page.on('dialog', (d) => d.dismiss());
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
await page.goto(pathToFileURL(resolve('dist/index.html')).href, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new Error('no')); });

const TABS = ['thin', 'overview', 'y25', 'b26', 'debt', 'fb', 'proj', 'sens', 'play', 'book'];
const log = [];
for (let i = 0; i < STEPS; i++) {
  const r = rnd();
  let act;
  try {
    if (r < 0.12) {
      act = `tab ${pick(TABS)}`;
      await page.evaluate((t) => __fiscal.go(t), act.slice(4));
    } else if (r < 0.35) {
      act = await page.evaluate((u) => {
        const ins = __fiscal.sim.graph.inputs().filter((n) => !n.fixed && n.range);
        const n = ins[Math.floor(u[0] * ins.length)];
        const [a, b] = n.range;
        const v = u[1] < 0.15 ? a : u[1] > 0.85 ? b : a + (b - a) * u[2];
        __fiscal.set(n.id, v);
        return `set ${n.id}=${v}`;
      }, [rnd(), rnd(), rnd()]);
    } else if (r < 0.45) {
      act = await page.evaluate((u) => {
        const keys = Object.keys(__fiscal.sim.modes);
        const k = keys[Math.floor(u[0] * keys.length)];
        const opts = { y25: ['deficit', 'transfer', 'cut'], c26: ['rate', 'spend', 'stab'], absorb: ['other', 'transfer', 'prop'], l26: ['deficit', 'spend'], scope: ['official', 'interest', 'broad'], fb1: ['deficit', 'spend'], fb2: ['cap', 'ratio'], fb4: ['fixed', 'gap'], proj: ['rate', 'spend'] }[k] ?? [];
        if (!opts.length) return 'mode skip';
        const v = opts[Math.floor(u[1] * opts.length)];
        __fiscal.setMode(k, v);
        return `mode ${k}=${v}`;
      }, [rnd(), rnd()]);
    } else if (r < 0.5) {
      act = pick(['undo', 'redo', 'reset']);
      await page.evaluate((a) => (a === 'undo' ? __fiscal.undo() : a === 'redo' ? __fiscal.redo() : __fiscal.resetAll()), act);
    } else {
      // 随机点一个可见按钮（排除会离开页面的链接）
      const btns = page.locator('#main button:visible, #main [data-node]:visible, .drawer button:visible, #main .chip:visible, #main svg[tabindex]:visible');
      const n = await btns.count();
      if (!n) { act = 'no buttons'; continue; }
      const k = Math.floor(rnd() * n);
      const el = btns.nth(k);
      act = `click ${(await el.evaluate((e) => (e.textContent || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 30)).catch(() => '?'))}`;
      await el.click({ timeout: 1500, trial: false }).catch(() => {});
      if (rnd() < 0.3) await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(40);
  } catch (e) {
    errors.push(`step ${i} (${act}): ${e.message.split('\n')[0]}`);
  }
  log.push(act);
  if (i % 25 === 24 || i === STEPS - 1) {
    await page.waitForTimeout(250);
    const bad = await page.evaluate(() => {
      const t = document.body.innerText;
      const m = t.match(/.{0,30}(NaN|undefined|Infinity|\[object Object\]).{0,30}/);
      return m ? m[0] : null;
    });
    if (bad) errors.push(`step ${i}: 页面出现异常文本「${bad}」（最近操作：${log.slice(-5).join(' | ')}）`);
  }
  if (errors.length) break;
}
await browser.close();
if (errors.length) {
  console.log('FAIL\n' + errors.join('\n') + '\n最近操作：\n' + log.slice(-12).join('\n'));
  process.exit(1);
}
console.log(`ok - ${STEPS} 步随机操作无错误`);
