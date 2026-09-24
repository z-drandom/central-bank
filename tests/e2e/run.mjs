// 端到端测试：在真实浏览器里打开打包后的单文件，逐页操作并检查。
// 运行：npm run build && npm run e2e
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const URL = pathToFileURL(resolve('dist/index.html')).href;
const exe = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe });
let failures = 0;
let passes = 0;

async function newPage(opts = {}) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, ...opts });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_/.test(m.text())) errors.push(m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  page.errors = errors;
  return page;
}

async function t(name, fn) {
  try {
    await fn();
    passes++;
    console.log(`ok - ${name}`);
  } catch (e) {
    failures++;
    console.log(`not ok - ${name}\n  ${e.message.split('\n').join('\n  ')}`);
  }
}

const text = (page, sel) => page.locator(sel).first().innerText();

await t('每个标签页都能打开且无脚本错误', async () => {
  const page = await newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  const tabs = await page.locator('.tab').count();
  assert.equal(tabs, 9);
  for (let i = 0; i < tabs; i++) {
    await page.locator('.tab').nth(i).click();
    await page.waitForTimeout(80);
    const h2 = await text(page, '.view-head h2');
    assert.ok(h2.length > 4, `第 ${i} 个标签页标题为空`);
  }
  assert.deepEqual(page.errors, []);
  await page.close();
});

await t('基线：顶栏指标与原图一致', async () => {
  const page = await newPage();
  await page.goto(URL + '#b26', { waitUntil: 'domcontentloaded' });
  const kpis = await page.locator('.kpi-v').allInnerTexts();
  assert.equal(kpis[0], '4.00%');
  const ledger = await page.locator('.ledger').first().innerText();
  for (const s of ['95,670.00', '50,900.00', '1,000.00', '2,500.00', '150,070.00']) assert.ok(ledger.includes(s), `中央来源行缺少 ${s}`);
  await page.close();
});

await t('拖动滑杆：数值、传导链、角标随之更新', async () => {
  const page = await newPage();
  await page.goto(URL + '#y25', { waitUntil: 'domcontentloaded' });
  const range = page.locator('#rg-t_vat');
  await range.evaluate((el) => { el.value = String(62052); el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(120);
  const val = await page.locator('#in-t_vat').inputValue();
  assert.equal(val, '62,052');
  const sum = await text(page, '.changes-head .sum');
  assert.match(sum, /你改了 1 个参数/);
  const rows = await page.locator('.chg').count();
  assert.ok(rows > 10, `传导链只有 ${rows} 行`);
  const badge = await page.locator('#tab-b26 .badge').innerText();
  assert.ok(Number(badge) > 0, '2026 页角标应显示变化数');
  const v = await page.evaluate(() => __fiscal.v.tin25 - __fiscal.b.tin25);
  assert.ok(Math.abs(v - 6895) < 1e-6, `调入资金应 +6,895，实际 ${v}`);
  assert.deepEqual(page.errors, []);
  await page.close();
});

await t('点数字打开公式卡片，含公式/读法/代入，Esc 关闭', async () => {
  const page = await newPage();
  await page.goto(URL + '#b26', { waitUntil: 'domcontentloaded' });
  await page.locator('.ledger [data-node="ec26"]').first().click();
  await page.waitForTimeout(300);
  assert.ok(await page.locator('.drawer.open').isVisible());
  const body = await text(page, '.drawer-body');
  for (const k of ['公式', '读法', '代入', '由谁决定', '影响谁']) assert.ok(body.includes(k), `卡片缺少"${k}"`);
  assert.ok(body.includes('150,070.00'), '代入行应含结果');
  // 点上游跳转
  await page.locator('.drawer .rel li button').first().click();
  await page.waitForTimeout(100);
  assert.ok(!(await page.locator('.drawer-head button').first().isDisabled()), '返回按钮应可用');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  assert.equal(await page.locator('.drawer.open').count(), 0);
  await page.close();
});

await t('切换平衡规则不改变当前数字', async () => {
  const page = await newPage();
  await page.goto(URL + '#b26', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => __fiscal.set('g_nom', 0.03));
  await page.waitForTimeout(80);
  const before = await page.evaluate(() => ({ ...__fiscal.v }));
  await page.locator('.mode .seg button', { hasText: '支出锚定' }).first().click();
  await page.waitForTimeout(120);
  const after = await page.evaluate(() => ({ ...__fiscal.v }));
  for (const k of ['e26', 'd26', 'ec26', 'el26', 'oth26', 'gov1']) assert.ok(Math.abs(before[k] - after[k]) < 1e-6, `${k} 变了`);
  const pressed = await page.locator('.mode .seg button[aria-pressed="true"]').allInnerTexts();
  assert.ok(pressed.includes('支出锚定'));
  assert.deepEqual(page.errors, []);
  await page.close();
});

await t('情景按钮与全部复原', async () => {
  const page = await newPage();
  await page.goto(URL + '#fb', { waitUntil: 'domcontentloaded' });
  await page.locator('.presets .chip', { hasText: '土地出让收入 −30%' }).click();
  await page.waitForTimeout(120);
  const land = await page.evaluate(() => __fiscal.v.f2_land);
  assert.ok(Math.abs(land - 6.09) < 1e-9);
  assert.ok((await page.locator('.fb-box.changed').count()) > 3, '四本账图中应高亮变化的框');
  await page.locator('button', { hasText: '全部复原' }).click();
  await page.waitForTimeout(120);
  const n = await page.evaluate(() => __fiscal.sim.changedIds().length);
  assert.equal(n, 0);
  await page.close();
});

await t('挑战：开始 → 任务卡出现 → 按参考解达成', async () => {
  const page = await newPage();
  await page.goto(URL + '#play', { waitUntil: 'domcontentloaded' });
  await page.locator('.ch-card', { hasText: '减收之年' }).locator('button', { hasText: '开始挑战' }).click();
  await page.waitForTimeout(150);
  assert.ok(await page.locator('.tracker').isVisible(), '任务卡应出现');
  assert.match(page.url(), /#b26$/);
  assert.ok((await page.locator('.tracker .goal.miss').count()) > 0);
  await page.evaluate(() => { __fiscal.set('dr26', 0.0421); __fiscal.set('tl26', 19500); });
  await page.waitForTimeout(150);
  assert.equal(await page.locator('.tracker .goal.miss').count(), 0);
  assert.ok(await page.locator('.tracker .stamp').isVisible(), '应出现"达成"印章');
  await page.close();
});

await t('先猜后算：作答后显示模型计算与公式', async () => {
  const page = await newPage();
  await page.goto(URL + '#play', { waitUntil: 'domcontentloaded' });
  await page.locator('.quiz-opt').first().click();
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.quiz-opt.right').count(), 1);
  const exp = await text(page, '.quiz-exp');
  assert.match(exp, /模型计算/);
  assert.ok(await page.locator('#quiz .fx-table').isVisible());
  assert.equal(await page.evaluate(() => __fiscal.sim.changedIds().length), 0, '沙盒计算不应改动主状态');
  await page.close();
});

await t('公式手册：搜索与对账', async () => {
  const page = await newPage();
  await page.goto(URL + '#book', { waitUntil: 'domcontentloaded' });
  assert.ok((await page.locator('.gloss-item').count()) >= 20, '默认显示名词解释');
  await page.locator('.gloss-item .chip').first().click();
  await page.waitForTimeout(250);
  assert.ok(await page.locator('.drawer.open').isVisible(), '名词里的数字可打开公式卡片');
  await page.keyboard.press('Escape');
  await page.locator('[data-k="fx"]').click();
  await page.fill('#fx-search', '付息');
  await page.waitForTimeout(100);
  assert.ok((await page.locator('.fx-item').count()) >= 3);
  await page.locator('[data-k="rec"]').click();
  const p = await text(page, '[data-k="rec"]');
  assert.ok(p);
  const bad = await page.locator('td.bad').count();
  assert.equal(bad, 0, '对账不应有失败项');
  await page.close();
});

await t('传导路径图可以渲染', async () => {
  const page = await newPage();
  await page.goto(URL + '#b26', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => __fiscal.set('rcg', 0.03));
  await page.locator('.changes .seg button', { hasText: '路径图' }).click();
  await page.waitForTimeout(120);
  assert.ok((await page.locator('.changes svg g[data-node]').count()) > 5);
  assert.deepEqual(page.errors, []);
  await page.close();
});

await t('手机宽度：页面不出现横向滚动', async () => {
  const page = await newPage({ viewport: { width: 390, height: 844 } });
  for (const tab of ['overview', 'y25', 'b26', 'debt', 'fb', 'proj', 'sens', 'play', 'book']) {
    await page.goto(URL + '#' + tab, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(80);
    const { sw, w } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
    assert.ok(sw <= w + 1, `${tab} 页横向溢出：${sw} > ${w}`);
  }
  assert.deepEqual(page.errors, []);
  await page.close();
});

await t('深色模式：背景为深色，文字为浅色', async () => {
  const page = await newPage({ colorScheme: 'dark' });
  await page.goto(URL + '#overview', { waitUntil: 'domcontentloaded' });
  const { bg, fg } = await page.evaluate(() => ({ bg: getComputedStyle(document.body).backgroundColor, fg: getComputedStyle(document.body).color }));
  const lum = (c) => { const [r, g, b] = c.match(/\d+/g).map(Number); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  assert.ok(lum(bg) < 60, `背景太亮：${bg}`);
  assert.ok(lum(fg) > 180, `文字太暗：${fg}`);
  await page.close();
});

await t('撤销 / 重做', async () => {
  const page = await newPage();
  await page.goto(URL + '#b26', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => __fiscal.set('dr26', 0.05));
  await page.waitForTimeout(800);
  await page.evaluate(() => __fiscal.setMode('c26', 'spend'));
  await page.waitForTimeout(100);
  await page.locator('button[aria-label="撤销"]').click();
  assert.equal(await page.evaluate(() => __fiscal.sim.modes.c26), 'rate');
  assert.ok(Math.abs((await page.evaluate(() => __fiscal.v.dr26)) - 0.05) < 1e-12);
  await page.locator('button[aria-label="撤销"]').click();
  assert.ok(Math.abs((await page.evaluate(() => __fiscal.v.dr26)) - 0.04) < 1e-12);
  await page.keyboard.press('Control+Shift+Z');
  assert.ok(Math.abs((await page.evaluate(() => __fiscal.v.dr26)) - 0.05) < 1e-12);
  await page.close();
});

await t('情景：存 A、复制代码、按代码载入后数值一致', async () => {
  const page = await newPage();
  await page.goto(URL + '#overview', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { __fiscal.set('t_vat', 60000); __fiscal.setMode('fb4', 'gap'); __fiscal.set('f4_exp', 9.9); });
  await page.waitForTimeout(100);
  await page.locator('button', { hasText: '当前存为 A' }).click();
  await page.locator('button', { hasText: '复制当前情景代码' }).click();
  await page.waitForTimeout(100);
  const code = await page.locator('#scen-code').inputValue();
  assert.match(code, /^FS1\./);
  const before = await page.evaluate(() => ({ ...__fiscal.v }));
  await page.locator('button', { hasText: '全部复原' }).click();
  assert.equal(await page.evaluate(() => __fiscal.sim.changedIds().length), 0);
  await page.locator('#scen-code').fill(code);
  await page.locator('button', { hasText: '按代码载入' }).click();
  await page.waitForTimeout(100);
  const after = await page.evaluate(() => ({ ...__fiscal.v }));
  for (const k of ['rev25', 'rc26', 'f4_sub', 'f1_other', 'p_d_2035']) assert.equal(after[k], before[k], k);
  const cellA = await page.locator('#scenarios tbody tr').first().locator('td').nth(2).innerText();
  assert.notEqual(cellA.trim(), '—', '情景 A 列应有数值');
  assert.deepEqual(page.errors, []);
  await page.close();
});

await t('讲解模式：逐步切页、高亮、文字含现算数字', async () => {
  const page = await newPage();
  await page.goto(URL + '#overview', { waitUntil: 'domcontentloaded' });
  await page.locator('.story-card', { hasText: '赤字 → 债务 → 利息' }).locator('button').click();
  await page.waitForTimeout(200);
  assert.ok(await page.locator('.narrator').isVisible());
  assert.match(page.url(), /#b26$/);
  assert.ok((await page.locator('#main .hl').count()) > 0, '应高亮相关数字');
  const txt = await page.locator('.nar-text').innerText();
  assert.match(txt, /14,725/);
  for (let i = 0; i < 4; i++) { await page.locator('.narrator .btn.primary').click(); await page.waitForTimeout(120); }
  assert.match(page.url(), /#proj$/);
  assert.equal(await page.evaluate(() => __fiscal.v.pdr), 0.05);
  await page.locator('.narrator .btn', { hasText: '上一步' }).click();
  await page.waitForTimeout(120);
  assert.equal(await page.evaluate(() => __fiscal.v.pdr), 0.04, '后退应撤回上一步的改动');
  assert.deepEqual(page.errors, []);
  await page.close();
});

await t('公式实验室：输入表达式得到三行公式', async () => {
  const page = await newPage();
  await page.goto(URL + '#book', { waitUntil: 'domcontentloaded' });
  await page.locator('[data-k="lab"]').click();
  await page.fill('#lab-expr', 'own26 / ec26');
  await page.waitForTimeout(100);
  const out = await page.locator('#lab-expr').evaluate((el) => el.closest('.sheet').innerText);
  assert.match(out, /30\.27%/);
  assert.match(out, /代入/);
  await page.fill('#lab-expr', 'nope + 1');
  await page.waitForTimeout(100);
  assert.match(await page.locator('#lab-expr').evaluate((el) => el.closest('.sheet').innerText), /找不到变量/);
  assert.deepEqual(page.errors, []);
  await page.close();
});

await t('反向求解：求出参数值并可一键应用', async () => {
  const page = await newPage();
  await page.goto(URL + '#sens', { waitUntil: 'domcontentloaded' });
  await page.selectOption('#gs-target', 'drate26');
  await page.waitForTimeout(80);
  await page.selectOption('#gs-param', 'dr26');
  await page.fill('#gs-goal', '4.5');
  await page.locator('#gs-solve').click();
  await page.waitForTimeout(80);
  await page.locator('button', { hasText: '应用这个值' }).click();
  await page.waitForTimeout(120);
  const v = await page.evaluate(() => __fiscal.v.drate26);
  assert.ok(Math.abs(v - 0.045) < 1e-8, `赤字率应为 4.5%，实际 ${v}`);
  assert.deepEqual(page.errors, []);
  await page.close();
});

await t('复制本次分析：剪贴板被拒时退回可选中的文本框；? 打开快捷键帮助', async () => {
  const page = await newPage();
  await page.goto(URL + '#b26', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) } }); __fiscal.set('dr26', 0.05); });
  await page.waitForTimeout(300);
  const btn = page.locator('button', { hasText: '复制本次分析' });
  await btn.click();
  await btn.click();
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.copy-area').count(), 1, '重复点击不应堆出多个文本框');
  const txt = await page.locator('.copy-area').inputValue();
  assert.match(txt, /赤字率/);
  assert.match(txt, /FS1\./);
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('?');
  await page.waitForTimeout(80);
  assert.ok(await page.locator('.help').isVisible(), '? 应打开帮助');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);
  assert.equal(await page.locator('.help').isVisible(), false);
  assert.deepEqual(page.errors, []);
  await page.close();
});

await t('双参数相图：切预设、点格子应用两个参数（含规则）、撤销、键盘移动', async () => {
  const page = await newPage();
  await page.goto(URL + '#sens', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#phase svg rect[class^="phc-"]').count(), 31 * 31);
  await page.locator('#phase [data-p="oth"]').click();
  await page.waitForTimeout(200);
  assert.equal(await page.locator('#ph-target').inputValue(), 'oth26');
  assert.match(await page.locator('#phase .ph-math').innerText(), /2,243\.81/);
  assert.ok(await page.locator('#phase .ph-ref').count() > 0, '应画出"其它 = 0"的参考线');
  // 点右上角格子：名义增速 8%、赤字率 5%
  const box = await page.locator('#phase svg').boundingBox();
  await page.mouse.move(box.x + box.width - 16, box.y + 30);
  await page.waitForTimeout(80);
  assert.match(await page.locator('#phase .ph-read').innerText(), /比当前/);
  await page.mouse.click(box.x + box.width - 16, box.y + 30);
  await page.waitForTimeout(250);
  const v = await page.evaluate(() => ({ g: __fiscal.v.g_nom, d: __fiscal.v.dr26 }));
  assert.ok(Math.abs(v.g - 0.08) < 1e-12 && Math.abs(v.d - 0.05) < 1e-12, JSON.stringify(v));
  await page.locator('button[aria-label="撤销"]').click();
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => __fiscal.v.g_nom), 0.05);
  // 预设 rg 使用"支出增速不变"：不改变当前规则，直到应用
  await page.locator('#phase [data-p="rg"]').click();
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => __fiscal.sim.modes.proj), 'rate');
  assert.match(await page.locator('#phase').innerText(), /与你当前的规则不同/);
  await page.locator('#phase svg').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => __fiscal.sim.modes.proj), 'spend');
  assert.ok(await page.evaluate(() => __fiscal.v.pg) > 0.045);
  assert.deepEqual(page.errors, []);
  await page.close();
});

await t('总览：传导回放逐站点亮，改参数后自动停止', async () => {
  const page = await newPage();
  await page.goto(URL + '#overview', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => __fiscal.set('t_vat', 60000));
  await page.waitForTimeout(300);
  const step = page.locator('.ov-play button', { hasText: '逐站' });
  await step.click();
  assert.equal(await page.locator('#main svg.ov-playing').count(), 1);
  assert.equal(await page.locator('#main .ov-reached').count(), 1);
  assert.match(await page.locator('.ov-cap').innerText(), /图③ 2025 年执行/);
  await step.click();
  assert.match(await page.locator('.ov-cap').innerText(), /×\(1 \+ g\)/);
  await step.click();
  assert.equal(await page.locator('#main .ov-reached').count(), 3);
  await page.evaluate(() => __fiscal.set('t_vat', 61000));
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#main svg.ov-playing').count(), 0, '状态变了应停止回放');
  assert.deepEqual(page.errors, []);
  await page.close();
});

await t('测验：交互项题可答，载入情景后打开对应相图，且可撤销回做题前', async () => {
  const page = await newPage();
  await page.goto(URL + '#play', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => __fiscal.set('t_vat', 65000));
  await page.waitForTimeout(200);
  for (let i = 0; i < 12; i++) await page.locator('button', { hasText: '下一题' }).click();
  assert.equal(await page.getByText('名义增速从 5% 提到 7%').count(), 1);
  await page.locator('.quiz-opt', { hasText: '再加一个交互项' }).click();
  assert.match(await page.locator('.quiz-exp').innerText(), /答对了/);
  await page.locator('button', { hasText: '在沙盘里看这个情景' }).click();
  await page.waitForTimeout(500);
  assert.match(page.url(), /#sens$/);
  assert.equal(await page.locator('#ph-target').inputValue(), 'oth26');
  assert.equal(await page.evaluate(() => __fiscal.v.dr26), 0.05);
  assert.equal(await page.evaluate(() => __fiscal.v.t_vat), 68947, '题目情景从原图基线出发');
  await page.locator('button[aria-label="撤销"]').click();
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => __fiscal.v.t_vat), 65000, '撤销应回到做题前');
  assert.deepEqual(page.errors, []);
  await page.close();
});

await t('龙卷风图的前两名一键放进相图', async () => {
  const page = await newPage();
  await page.goto(URL + '#sens', { waitUntil: 'domcontentloaded' });
  await page.selectOption('#sens-target', 'self26');
  await page.waitForTimeout(300);
  const first = await page.locator('.tor-row').first().getAttribute('data-node');
  const second = await page.locator('.tor-row').nth(1).getAttribute('data-node');
  await page.locator('#sens-top2').click();
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#ph-target').inputValue(), 'self26');
  assert.equal(await page.locator('#ph-x').inputValue(), first);
  assert.equal(await page.locator('#ph-y').inputValue(), second);
  assert.equal(await page.locator('#phase .chip.on').count(), 0, '自选组合不应高亮预设');
  assert.deepEqual(page.errors, []);
  await page.close();
});

await t('公式卡片：改两个参数后给出 Shapley 归因，合计等于总变化', async () => {
  const page = await newPage();
  await page.goto(URL + '#b26', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { __fiscal.setMany({ dr26: 0.05, g_nom: 0.07 }); });
  await page.waitForTimeout(200);
  await page.evaluate(() => __fiscal.openCard('oth26'));
  await page.waitForTimeout(200);
  const txt = await page.locator('.shap').innerText();
  assert.match(txt, /按你改的 2 个参数归因/);
  assert.match(txt, /\+14,865\.24/);
  assert.match(txt, /\+3,141\.71/);
  assert.match(txt, /\+280\.48/);
  await page.evaluate(() => __fiscal.openCard('dr26'));
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.shap').count(), 0, '输入参数的卡片不应有归因');
  assert.deepEqual(page.errors, []);
  await page.close();
});

await t('双目标求解：示例求出两个参数，应用后两个目标同时达到', async () => {
  const page = await newPage();
  await page.goto(URL + '#sens', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  await page.locator('#solve2 .chip', { hasText: '地方多花 2,000 亿' }).click();
  await page.waitForTimeout(200);
  assert.match(await page.locator('#solve2').innerText(), /两个目标同时达到/);
  const before = await page.evaluate(() => ({ el: __fiscal.v.el26, oth: __fiscal.v.oth26 }));
  await page.locator('#solve2 button', { hasText: '同时应用这两个值' }).click();
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => ({ el: __fiscal.v.el26, oth: __fiscal.v.oth26, dr: __fiscal.v.dr26, gdp: __fiscal.v.gdp26 }));
  assert.ok(Math.abs(after.el - before.el - 2000) < 1e-4, `地方支出应 +2000：${after.el - before.el}`);
  assert.ok(Math.abs(after.oth - before.oth) < 1e-4, '其它支出不变');
  assert.ok(Math.abs(after.dr - (0.04 + 2000 / after.gdp)) < 1e-9);
  // 奇异情形：两个分税比例对自给率和中央收入作用成比例
  await page.selectOption('#s2-t0', 'self26');
  await page.selectOption('#s2-t1', 'rc26');
  await page.selectOption('#s2-p0', 's_vat');
  await page.selectOption('#s2-p1', 's_cit');
  await page.fill('#s2-g0', '55');
  await page.locator('#solve2 button', { hasText: '求解' }).click();
  await page.waitForTimeout(150);
  assert.match(await page.locator('#solve2').innerText(), /方向相同/);
  assert.deepEqual(page.errors, []);
  await page.close();
});

await t('影响矩阵：点格子显示路径分解，链式法则与直接重算一致', async () => {
  const page = await newPage();
  await page.goto(URL + '#sens', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  await page.locator('td[data-pair="t_vat|r26"]').click();
  await page.waitForTimeout(150);
  const txt = await page.locator('#matrix .paths').innerText();
  assert.match(txt, /共有 3 条公式路径/);
  assert.match(txt, /= \+7,040\.44 亿元；直接重算 = \+7,040\.44 亿元/);
  assert.equal(await page.locator('.drawer.open').count(), 0, '点格子不应打开公式卡片');
  await page.locator('td[data-pair="g_nom|debt_gdp1"]').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  assert.match(await page.locator('#matrix .paths h4').innerText(), /2026年名义GDP增速 → /);
  await page.locator('#matrix .paths button[aria-label="关闭路径分解"]').click();
  assert.equal(await page.locator('#matrix .paths').isVisible(), false);
  // 参数卡片里也能追踪
  await page.evaluate(() => __fiscal.openCard('g_nom'));
  await page.waitForTimeout(150);
  await page.selectOption('.drawer select[aria-label="选择要追踪的关键结果"]', 'oth26');
  await page.waitForTimeout(150);
  assert.match(await page.locator('.drawer .paths').innerText(), /直接重算 = \+1,500\.74 亿元/);
  assert.deepEqual(page.errors, []);
  await page.close();
});

await t('讲解"两个旋钮一起拧"：打开卡片看归因，最后落到相图', async () => {
  const page = await newPage();
  await page.goto(URL + '#overview', { waitUntil: 'domcontentloaded' });
  await page.locator('.story-card', { hasText: '两个旋钮一起拧' }).locator('button').click();
  await page.waitForTimeout(200);
  for (let i = 0; i < 3; i++) { await page.locator('.narrator .btn.primary').click(); await page.waitForTimeout(200); }
  assert.match(await page.locator('.nar-text').innerText(), /Shapley/);
  assert.equal(await page.locator('.drawer.open').count(), 1, '第 4 步应打开"其它"的卡片');
  assert.match(await page.locator('.drawer .shap').innerText(), /按你改的 2 个参数归因/);
  await page.locator('.narrator .btn.primary').click();
  await page.waitForTimeout(400);
  assert.match(page.url(), /#sens$/);
  assert.equal(await page.locator('#phase .chip.on').getAttribute('data-p'), 'oth');
  assert.deepEqual(page.errors, []);
  await page.close();
});

await t('规则对比表：显示六种规则，点列头切换规则', async () => {
  const page = await newPage();
  await page.goto(URL + '#b26', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => __fiscal.set('g_nom', 0.03));
  await page.waitForTimeout(400);
  assert.equal(await page.locator('.rules-tbl thead .chip').count(), 6);
  await page.locator('.rules-tbl thead .chip', { hasText: '稳定基金兜底' }).click();
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => __fiscal.sim.modes.c26), 'stab');
  assert.deepEqual(page.errors, []);
  await page.close();
});

await t('事件卡：抽卡、用对冲方案后目标回到原图水平', async () => {
  const page = await newPage();
  await page.goto(URL + '#play', { waitUntil: 'domcontentloaded' });
  await page.locator('button', { hasText: '抽一张事件卡' }).click();
  await page.waitForTimeout(150);
  assert.ok((await page.locator('.event-card .fix').count()) >= 1);
  await page.locator('.event-card .fix button').first().click();
  await page.waitForTimeout(200);
  const n = await page.evaluate(() => __fiscal.sim.changedInputs().length);
  assert.ok(n >= 2, '应同时施加冲击和对冲');
  assert.deepEqual(page.errors, []);
  await page.close();
});

await browser.close();
console.log(`\n# pass ${passes}\n# fail ${failures}`);
process.exit(failures ? 1 : 0);
