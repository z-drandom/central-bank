import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/model/sim.js';
import { propagationSteps } from '../src/ui/views/overview.js';

const appOf = (sim) => ({ sim, get v() { return sim.values; }, get b() { return sim.base; } });

test('传导回放：箭头排在起点方框之后、终点方框之前', () => {
  const cases = [
    [{}, { t_vat: 60000 }],
    [{ c26: 'spend' }, { t_vat: 60000 }],
    [{}, { rcg: 0.03 }],
    [{ y25: 'transfer' }, { nontax: 30000 }],
    [{}, { f4_exp: 10 }],
    [{}, { dr26: 0.05, g_nom: 0.03 }],
  ];
  for (const [modes, inp] of cases) {
    const sim = new Sim(modes);
    sim.setMany(inp);
    const steps = propagationSteps(appOf(sim));
    assert.ok(steps.length > 0);
    const pos = (mod) => steps.findIndex((s) => s.kind === 'cl' && s.c.id === mod);
    steps.forEach((st, i) => {
      if (st.kind !== 'ln' || !st.tos.length) return;
      const dest = sim.spec(st.tos[0]).mod;
      const firstIn = steps.findIndex((x) => x.kind === 'ln' && x.tos.length && sim.spec(x.tos[0]).mod === dest);
      if (pos(dest) >= 0) assert.ok(pos(dest) > firstIn, `${JSON.stringify(inp)}: 第一条进入 ${dest} 的箭头应在它之前`);
      const srcMods = new Set(st.l.from.filter((id) => sim.has(id) && Math.abs(sim.values[id] - sim.base[id]) > 1e-9 * Math.max(1, Math.abs(sim.base[id]))).map((id) => sim.spec(id).mod));
      for (const m of srcMods) if (pos(m) >= 0 && m !== dest) assert.ok(pos(m) < i, `${JSON.stringify(inp)}: 起点 ${m} 应在箭头 ${st.l.label} 之前`);
    });
  }
});

test('传导回放：没有改动时为空；只改四本账时只有四本账', () => {
  assert.deepEqual(propagationSteps(appOf(new Sim())), []);
  const sim = new Sim();
  sim.set('f4_exp', 10);
  const kinds = propagationSteps(appOf(sim)).filter((s) => s.kind === 'cl').map((s) => s.c.id);
  assert.deepEqual(kinds, ['fb']);
});
