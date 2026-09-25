// 每个参数拨到滑杆两端（逐个、在各种平衡规则下），模型都不应报错或产生 NaN/Infinity。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/model/sim.js';
import { MODE_OPTIONS } from '../src/model/specs.js';

const combos = [{}];
for (const k of Object.keys(MODE_OPTIONS)) for (const v of Object.keys(MODE_OPTIONS[k].options)) combos.push({ [k]: v });

test('单个参数取滑杆两端：无报错、无 NaN/Infinity', () => {
  const bad = [];
  for (const modes of combos) {
    const sim = new Sim(modes);
    for (const n of sim.graph.inputs()) {
      if (n.fixed || !n.range) continue;
      for (const x of [n.range[0], n.range[1]]) {
        sim.reset();
        sim.set(n.id, x);
        for (const [id, v] of Object.entries(sim.values)) if (!Number.isFinite(v)) bad.push(`${JSON.stringify(modes)} ${n.id}=${x} → ${id}=${v}`);
      }
    }
  }
  assert.deepEqual(bad.slice(0, 10), []);
});

test('多个参数同时取随机端点：计算不报错', () => {
  let s = 12345;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  for (let k = 0; k < 80; k++) {
    const modes = {};
    for (const [key, def] of Object.entries(MODE_OPTIONS)) {
      const o = Object.keys(def.options);
      modes[key] = o[Math.floor(r() * o.length)];
    }
    const sim = new Sim(modes);
    const patch = {};
    for (const n of sim.graph.inputs()) if (!n.fixed && n.range && r() < 0.25) patch[n.id] = r() < 0.5 ? n.range[0] : n.range[1];
    assert.doesNotThrow(() => sim.setMany(patch));
  }
});

test('所有参数同时取上限：没有非有限值；同时取下限：只有"除以收入"类比率无法计算', () => {
  for (const end of [0, 1]) {
    const s = new Sim();
    const set = {};
    for (const n of s.graph.inputs()) if (!n.fixed && n.range) set[n.id] = n.range[end];
    s.setMany(set);
    const bad = s.graph.order.filter((id) => !Number.isFinite(s.values[id]));
    if (end === 1) assert.deepEqual(bad, []);
    // 下限时收入为 0，非有限值必须都来自除法（比率、增速），且不能传到存量和流量
    for (const id of bad) assert.match(s.spec(id).expr ?? '', /\//, `${id} 不是比率却出现非有限值`);
    for (const id of ['r26', 'e26', 'd26', 'gov1', 'p_B_2035', 'p_d_2035', 'fc_gap']) assert.ok(Number.isFinite(s.values[id]), `${id} 应可计算`);
  }
});
