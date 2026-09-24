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
