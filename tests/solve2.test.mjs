import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/model/sim.js';
import { goalSeek2, SOLVE2_EXAMPLES, resolveGoals } from '../src/model/solve2.js';

const close = (a, b, rel = 1e-7) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));

test('双目标求解：示例都能解出，代回重算两个目标都达到', () => {
  for (const ex of SOLVE2_EXAMPLES) {
    const sim = new Sim(ex.modes ?? {});
    const goals = resolveGoals(ex.goals, ex.targets, sim.values);
    const r = goalSeek2(sim.graph, sim.inputs, { targets: ex.targets, goals, params: ex.params });
    assert.ok(r.ok, `${ex.label}: ${r.reason}`);
    const v = sim.graph.compute({ ...sim.inputs, [ex.params[0]]: r.x[0], [ex.params[1]]: r.x[1] });
    ex.targets.forEach((t, i) => assert.ok(close(v[t], goals[i]), `${ex.label} ${t}: ${v[t]} vs ${goals[i]}`));
    ex.params.forEach((p, i) => {
      const [lo, hi] = sim.spec(p).range;
      assert.ok(r.x[i] >= lo && r.x[i] <= hi, `${p} 越界`);
    });
  }
});

test('双目标求解：地方多花 2,000 亿且"其它"不减，赤字正好多 2,000 亿', () => {
  const sim = new Sim({ c26: 'rate', absorb: 'other', l26: 'deficit' });
  const r = goalSeek2(sim.graph, sim.inputs, { targets: ['el26', 'oth26'], goals: [sim.values.el26 + 2000, sim.values.oth26], params: ['g_tr', 'dr26'] });
  assert.ok(r.ok, r.reason);
  assert.ok(close(r.x[1], 0.04 + 2000 / sim.values.gdp26, 1e-9), `赤字率 ${r.x[1]}`);
  assert.ok(r.iter <= 3, `线性关系应很快收敛，实际 ${r.iter} 步`);
});

test('双目标求解：分税制的两个比例对"自给率"和"中央收入"作用成比例，判为奇异', () => {
  const sim = new Sim();
  const r = goalSeek2(sim.graph, sim.inputs, { targets: ['self26', 'rc26'], goals: [0.55, sim.values.rc26], params: ['s_vat', 's_cit'] });
  assert.equal(r.ok, false);
  assert.match(r.reason, /方向相同/);
});

test('双目标求解：奇异、越界、非上游都给出原因', () => {
  const sim = new Sim();
  // 增值税与消费税对两个收入目标的作用成比例（都按固定比例分成），矩阵奇异
  let r = goalSeek2(sim.graph, sim.inputs, { targets: ['r26', 'rc26'], goals: [230000, 100000], params: ['t_vat', 't_cit'] });
  assert.ok(r.ok || r.reason);
  r = goalSeek2(sim.graph, sim.inputs, { targets: ['drate26', 'r26'], goals: [0.2, sim.values.r26], params: ['dr26', 't_vat'] });
  assert.equal(r.ok, false, '赤字率 20% 超出滑杆区间');
  assert.ok(r.reason);
  r = goalSeek2(sim.graph, sim.inputs, { targets: ['f1_other', 'fc_gap'], goals: [20, 4], params: ['t_vat', 'dr26'] });
  assert.equal(r.ok, false);
  assert.match(r.reason, /上游/);
  r = goalSeek2(sim.graph, sim.inputs, { targets: ['r26', 'rc26'], goals: [1, 1], params: ['t_vat', 't_vat'] });
  assert.match(r.reason, /不能相同/);
});
