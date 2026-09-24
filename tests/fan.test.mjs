import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/model/sim.js';
import { fan } from '../src/model/fan.js';

test('扇形图：分位数单调、可复现，区间收窄为 0 时退化为当前路径', () => {
  const sim = new Sim();
  const years = [2027, 2030, 2035];
  const a = fan(sim.graph, sim.inputs, 'p_d', years, { n: 200 });
  const b = fan(sim.graph, sim.inputs, 'p_d', years, { n: 200 });
  assert.deepEqual(a, b, '同一种子结果应相同');
  years.forEach((_, i) => {
    assert.ok(a.q.p10[i] <= a.q.p25[i] && a.q.p25[i] <= a.q.p50[i] && a.q.p50[i] <= a.q.p75[i] && a.q.p75[i] <= a.q.p90[i]);
  });
  assert.ok(a.q.p90[2] - a.q.p10[2] > a.q.p90[0] - a.q.p10[0], '越远的年份不确定性越大');
  const z = fan(sim.graph, sim.inputs, 'p_d', years, { n: 20, ranges: [{ id: 'pg', lo: 0, hi: 0, kind: 'add' }] });
  years.forEach((y, i) => assert.ok(Math.abs(z.q.p50[i] - sim.values[`p_d_${y}`]) < 1e-12));
});
