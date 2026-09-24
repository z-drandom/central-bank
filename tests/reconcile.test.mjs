import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/model/sim.js';
import { reconcile, RECONCILE } from '../src/model/reconcile.js';
import { MODE_OPTIONS } from '../src/model/specs.js';

test('基线逐项复现四张图的数字', () => {
  const sim = new Sim();
  const rows = reconcile(sim.values);
  const bad = rows.filter((r) => !r.ok);
  assert.equal(bad.length, 0, bad.map((r) => `${r.img} ${r.label}: 期望 ${r.expected} 实际 ${r.actual}`).join('\n'));
  assert.ok(RECONCILE.length >= 90, `对账项 ${RECONCILE.length}`);
});

test('每一种平衡规则组合下，基线都复现原图', () => {
  const keys = Object.keys(MODE_OPTIONS);
  // 逐个规则切换（其余保持默认），外加若干组合
  const combos = [];
  for (const k of keys) for (const v of Object.keys(MODE_OPTIONS[k].options)) combos.push({ [k]: v });
  combos.push({ c26: 'spend', l26: 'spend', y25: 'transfer', fb1: 'spend', fb2: 'ratio', fb4: 'gap', proj: 'spend' });
  combos.push({ c26: 'rate', absorb: 'transfer', l26: 'spend' });
  combos.push({ c26: 'stab', l26: 'spend', scope: 'broad' });
  for (const modes of combos) {
    const sim = new Sim(modes);
    const bad = reconcile(sim.values).filter((r) => !r.ok);
    assert.equal(bad.length, 0, `${JSON.stringify(modes)}: ${bad.map((r) => r.label).join(', ')}`);
  }
});

test('图②"地方赤字较 2025 年持平"：dl26 = dl25', () => {
  const sim = new Sim();
  assert.equal(sim.values.dl26, sim.values.dl25);
});

test('图③的国防支出就是 2025 年中央国防支出（国防全在中央本级）', () => {
  const sim = new Sim();
  assert.ok(Math.abs(sim.values.e_def * 1.07 - 19095.61) < 1, '17,846.65 × 1.07 ≈ 19,095.61');
});

test('2025 年全国付息 13,491 可以拆成中央约 8,191 + 地方约 5,300', () => {
  const sim = new Sim();
  assert.ok(Math.abs(sim.values.b_int25 - 8191.1) < 1);
  assert.ok(Math.abs(sim.values.int25l - 5299.9) < 1);
});
