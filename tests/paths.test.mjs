import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/model/sim.js';
import { pathEffects } from '../src/model/paths.js';
import { MATRIX_ROWS, MATRIX_COLS } from '../src/model/matrix.js';

const close = (a, b, rel) => Math.abs(a - b) <= rel * Math.max(1e-12, Math.abs(a), Math.abs(b));

test('路径分解：全部路径之和 = 链式法则总导数 ≈ 小步长直接重算', () => {
  const sim = new Sim();
  const g = sim.graph;
  let checked = 0;
  for (const a of MATRIX_ROWS) {
    if (!g.isInput(a)) continue;
    for (const [b] of MATRIX_COLS) {
      const r = pathEffects(g, sim.values, a, b, { k: 100000 });
      if (!r) { assert.ok(!g.downstream(a).includes(b)); continue; }
      const sum = r.paths.reduce((s, p) => s + p.prod, 0);
      const mag = r.paths.reduce((s, p) => s + Math.abs(p.prod), 0); // 路径可能相互抵消，用绝对值之和作量级
      assert.ok(Math.abs(sum - r.total) <= 1e-9 * mag, `${a}→${b} 路径和 ${sum} vs 总导数 ${r.total}`);
      assert.equal(r.paths.length, r.count, `${a}→${b} 路径数`);
      const h = Math.max(Math.abs(sim.inputs[a]) * 1e-5, 1e-7);
      const direct = (g.compute({ ...sim.inputs, [a]: sim.inputs[a] + h })[b] - g.compute({ ...sim.inputs, [a]: sim.inputs[a] - h })[b]) / (2 * h);
      assert.ok(Math.abs(r.total - direct) <= 1e-4 * Math.max(mag, 1e-12), `${a}→${b}: 链式 ${r.total} vs 数值 ${direct}`);
      checked++;
    }
  }
  assert.ok(checked > 40, `检查了 ${checked} 对`);
});

test('路径分解：增值税 → 全国收入恰好 3 条路径，线性关系下与一步重算完全相等', () => {
  const sim = new Sim();
  const r = pathEffects(sim.graph, sim.values, 't_vat', 'r26');
  assert.equal(r.count, 3);
  const step = 6894.7;
  const direct = sim.graph.compute({ ...sim.inputs, t_vat: sim.inputs.t_vat + step }).r26 - sim.values.r26;
  assert.ok(close(r.total * step, direct, 1e-9));
  assert.equal(pathEffects(sim.graph, sim.values, 't_vat', 'fc_gap'), null, '2025 税收与 2021 四本账之间没有路径');
});
