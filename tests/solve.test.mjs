import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/model/sim.js';
import { goalSeek } from '../src/model/solve.js';

test('反向求解：线性关系精确命中', () => {
  const sim = new Sim();
  const r = goalSeek(sim.graph, sim.inputs, { target: 'drate26', goal: 0.05, param: 'dr26' });
  assert.ok(r.ok);
  assert.ok(Math.abs(r.x - 0.05) < 1e-9);
  // 让中央本级"其它"回到原预算：减收之后用赤字率补
  sim.set('g_nom', 0.03);
  const r2 = goalSeek(sim.graph, sim.inputs, { target: 'oth26', goal: 6996.25, param: 'dr26' });
  assert.ok(r2.ok);
  const v = sim.graph.compute({ ...sim.inputs, dr26: r2.x });
  assert.ok(Math.abs(v.oth26 - 6996.25) < 1e-4);
});

test('反向求解：非线性目标（2035 负债率）也能命中；不可达与不在上游时给出原因', () => {
  const sim = new Sim();
  const r = goalSeek(sim.graph, sim.inputs, { target: 'p_d_2035', goal: 0.9, param: 'pdr' });
  assert.ok(r.ok);
  const v = sim.graph.compute({ ...sim.inputs, pdr: r.x });
  assert.ok(Math.abs(v.p_d_2035 - 0.9) < 1e-8);
  assert.equal(goalSeek(sim.graph, sim.inputs, { target: 'p_d_2035', goal: 0.1, param: 'pdr' }).ok, false);
  assert.match(goalSeek(sim.graph, sim.inputs, { target: 'drate26', goal: 0.05, param: 'f2_land' }).reason, /上游/);
});
