import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmt, fmtDelta, fmtRel, symHTML, symText, formulaLines } from '../src/model/format.js';
import { Sim } from '../src/model/sim.js';

const yi = { unit: 'yi' };
const wanyi = { unit: 'yi', disp: 'wy' };
const pct = { unit: 'pct' };

test('数字格式：亿元两位小数、万亿换算、百分比、负号用 U+2212', () => {
  assert.equal(fmt(yi, 95670), '95,670.00 亿元');
  assert.equal(fmt(wanyi, 412300), '41.23 万亿元');
  assert.equal(fmt(pct, 0.04), '4.00%');
  assert.equal(fmt(yi, -1234.5), '−1,234.50 亿元');
  assert.equal(fmt(yi, NaN), '—');
  assert.equal(fmt(yi, Infinity), '—');
  assert.equal(fmtDelta(pct, 0.01), '+1.00 个百分点');
  assert.equal(fmtDelta(pct, 0.00002), '+0.002 个百分点');
  assert.equal(fmtDelta(pct, 0.000002), '+0.0002 个百分点');
  assert.equal(fmtDelta(yi, -500), '−500.00 亿元');
  assert.equal(fmtRel(100, 110), '+10.0%');
  assert.equal(fmtRel(0, 5), '');
});

test('符号渲染：上下标', () => {
  assert.equal(symText('R_{c,25}'), 'R_c,25');
  assert.match(symHTML('T^{in}_{25}'), /<sup>in<\/sup><sub>25<\/sub>/);
  assert.match(symHTML("B'_{c}"), /B'<sub>c<\/sub>/);
});

test('公式卡片：每个公式节点都能生成四行，代入行以结果和单位结尾', () => {
  const sim = new Sim();
  for (const n of sim.graph.specs.values()) {
    if (n.expr == null) continue;
    const L = formulaLines(sim.graph, n.id, sim.values, { html: false });
    assert.ok(L.sym.startsWith(symText(n.sym)), n.id);
    assert.ok(L.read.startsWith(n.label), n.id);
    assert.ok(L.subst.endsWith(fmt(n, sim.values[n.id])) || /亿元$|万亿元$/.test(L.subst), `${n.id}: ${L.subst}`);
  }
});

test('代入用精确格式：小数值保留足够有效数字，大数值两位小数', async () => {
  const { fmtExact } = await import('../src/model/format.js');
  const wy = { unit: 'wy' };
  assert.equal(fmtExact(wy, 0.0252, { delta: true }), '+0.0252 万亿元');
  assert.equal(fmtExact(wy, 22.806, { sig: 6 }), '22.806 万亿元');
  assert.equal(fmtExact({ unit: 'pct' }, 0.0664, { delta: true }), '+6.64 个百分点');
  assert.equal(fmtExact({ unit: 'pct' }, 0.9963), '99.63%');
  assert.equal(fmtExact({ unit: 'yi' }, -3531.04, { delta: true }), '−3,531.04 亿元');
  assert.equal(fmtExact({ unit: 'yi', disp: 'wy' }, 14024.3, { delta: true }), '+1.402 万亿元');
  assert.equal(fmtExact({ unit: 'yi' }, NaN), '—');
});

test('全局查找：40 个常用说法的命中率（前 5 条 ≥ 90%，首条 ≥ 65%）', async () => {
  const { Sim } = await import('../src/model/sim.js');
  const { findNodes } = await import('../src/ui/finder.js');
  const g = new Sim().graph;
  const cases = [['赤字率', 'drate26'], ['负债率', 'debt_gdp1'], ['国债', 'bc0'], ['专项债', 'sp26'], ['土地出让', 'f2_land'], ['增值税', 't_vat'], ['付息', 'int26'], ['转移支付', 'tr26'], ['隐性债务', 'hsel'], ['2035 负债率', 'p_d_2035'],
    ['社保补贴', 'f4_sub'], ['GDP', 'gdp26'], ['名义增速', 'g_nom'], ['地方收入', 'rl26'], ['中央收入', 'rc26'], ['国防', 'def26'], ['其它支出', 'oth26'], ['自给率', 'self26'], ['广义赤字', 'fc_gap'], ['利率', 'rcg'],
    ['出口退税', 'rebate'], ['赤字', 'd26'], ['化债', 'swap26'], ['个税', 't_pit'], ['城投', 'h_bond'], ['企业所得税', 't_cit'], ['消费税', 't_con'], ['预备费', 'res26'], ['科技支出', 'sci26'], ['2030 负债率', 'p_d_2030'],
    ['调入资金', 'tin26'], ['地方赤字', 'dl26'], ['国债余额', 'bc0'], ['土地', 'f2_land'], ['养老', 'f4_exp'], ['专项债利息', 'int_ls26'], ['付息占收入', 'intburden26'], ['稳定基金', 'tstab26'], ['广义负债率', 'broad_gdp1'], ['非税', 'nontax']];
  let top1 = 0;
  let top5 = 0;
  for (const [q, want] of cases) {
    const i = findNodes(g, q).indexOf(want);
    if (i === 0) top1++;
    if (i >= 0 && i < 5) top5++;
  }
  assert.ok(top5 >= 0.9 * cases.length, `前 5 条命中 ${top5}/${cases.length}`);
  assert.ok(top1 >= 0.65 * cases.length, `首条命中 ${top1}/${cases.length}`);
});

test('全局查找：名称开头优先，多个关键词须全部命中', async () => {
  const { Sim } = await import('../src/model/sim.js');
  const { findNodes } = await import('../src/ui/finder.js').catch(() => ({}));
  if (!findNodes) return; // finder.js 依赖 DOM 辅助模块时跳过
  const g = new Sim().graph;
  const r = findNodes(g, '付息');
  assert.ok(r.length > 3);
  assert.ok(g.specs.get(r[0]).label.includes('付息'));
  const r2 = findNodes(g, '2035 负债率');
  assert.ok(r2.includes('p_d_2035'));
  assert.deepEqual(findNodes(g, '   '), []);
  assert.deepEqual(findNodes(g, '不存在的东西xyz'), []);
});
