import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/model/sim.js';
import { toCSV } from '../src/model/export.js';

test('CSV 导出：每个节点一行，公式与数值齐全，改动反映在变化量里', () => {
  const sim = new Sim();
  sim.set('t_vat', 60000);
  const csv = toCSV(sim);
  const lines = csv.split('\n');
  assert.equal(lines.length, sim.graph.specs.size + 1);
  assert.match(lines[0], /^id,名称,模块,类型,单位,原图基线,当前值,变化量,公式$/);
  const vat = lines.find((l) => l.startsWith('t_vat,'));
  assert.match(vat, /,68947,60000,-8947,$/);
  const r26 = lines.find((l) => l.startsWith('r26,'));
  assert.match(r26, /,rc26 \+ rl26$/);
});
