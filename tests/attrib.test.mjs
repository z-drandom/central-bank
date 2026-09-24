import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/model/sim.js';
import { attribute, mainPath } from '../src/engine/attrib.js';

test('归因：贡献之和 + 交互项 = 总变化；加减式没有交互项', () => {
  const sim = new Sim();
  sim.setMany({ t_vat: 60000, nontax: 42000, g_nom: 0.03, rcg: 0.025, f2_land: 6 });
  for (const id of sim.changedIds()) {
    const a = attribute(sim.graph, id, sim.values, sim.base);
    if (!a) continue;
    const s = a.parts.reduce((x, p) => x + p.contrib, 0) + a.interaction;
    assert.ok(Math.abs(s - (sim.values[id] - sim.base[id])) < 1e-6 * Math.max(1, Math.abs(sim.base[id])), id);
  }
  const rev = attribute(sim.graph, 'rev25', sim.values, sim.base);
  assert.ok(Math.abs(rev.interaction) < 1e-9, '收入 = 税收 − 退税 + 非税，是加减式');
  assert.equal(rev.parts.length, 2);
});

test('主要传导路径从输入参数出发，终点是目标节点', () => {
  const sim = new Sim();
  sim.set('t_vat', 60000);
  const p = mainPath(sim.graph, 'oth26', sim.values, sim.base);
  assert.equal(p[0], 't_vat');
  assert.equal(p.at(-1), 'oth26');
  for (let i = 1; i < p.length; i++) assert.ok(sim.graph.specs.get(p[i]).deps.includes(p[i - 1]), `${p[i - 1]} → ${p[i]} 不是依赖边`);
});
