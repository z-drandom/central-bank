import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/model/sim.js';
import { evalCustom, LAB_EXAMPLES } from '../src/model/lab.js';

test('公式实验室：示例都能算，结果与直接计算一致，且不改动依赖图', () => {
  const sim = new Sim();
  const n = sim.graph.specs.size;
  const r = evalCustom(sim, 'rc26 / r26', { unit: 'pct' });
  assert.ok(r.ok);
  assert.ok(Math.abs(r.value - 95670 / 220700) < 1e-12);
  assert.match(r.lines.subst, /95,670\.00/);
  for (const [, src, unit] of LAB_EXAMPLES) assert.ok(evalCustom(sim, src, { unit }).ok, src);
  assert.equal(sim.graph.specs.size, n);
  assert.equal(evalCustom(sim, 'foo + 1').ok, false);
  assert.equal(evalCustom(sim, '1 +').ok, false);
  assert.equal(evalCustom(sim, '1 + 2').ok, false);
});
