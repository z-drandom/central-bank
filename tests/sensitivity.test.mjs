import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/model/sim.js';
import { tornado, TARGETS } from '../src/model/sensitivity.js';

test('敏感度：结果与直接重算一致，且只含上游参数', () => {
  const sim = new Sim();
  for (const [target] of TARGETS) {
    const r = tornado(sim.graph, sim.inputs, target, { limit: 1000 });
    const up = new Set(sim.graph.upstream(target));
    for (const row of r.rows) {
      assert.ok(up.has(row.id), `${row.id} 不在 ${target} 上游`);
      const direct = sim.graph.compute({ ...sim.inputs, [row.id]: sim.inputs[row.id] + row.step })[target] - sim.values[target];
      assert.ok(Math.abs(direct - row.up) < 1e-9 * Math.max(1, Math.abs(direct)));
    }
    assert.ok(r.rows.length > 0, `${target} 没有敏感参数`);
  }
});

test('敏感度：2026 赤字率在"赤字率锚定"下只受目标赤字率影响', () => {
  const sim = new Sim({ c26: 'rate' });
  const r = tornado(sim.graph, sim.inputs, 'drate26', { limit: 1000 });
  assert.deepEqual(r.rows.map((x) => x.id), ['dr26']);
  const s2 = new Sim({ c26: 'spend' });
  const r2 = tornado(s2.graph, s2.inputs, 'drate26', { limit: 1000 });
  assert.ok(r2.rows.length > 10, '支出锚定下，赤字率受很多参数影响');
});
