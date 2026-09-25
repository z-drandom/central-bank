import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/model/sim.js';
import { shapley } from '../src/model/shapley.js';

const close = (a, b, rel = 1e-9) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));

test('Shapley：贡献之和等于总变化，总变化等于当前值 − 基线', () => {
  const cases = [
    [{}, { dr26: 0.05, g_nom: 0.07 }, 'oth26'],
    [{}, { t_vat: 60000, s_vat: 0.4, g_nom: 0.03 }, 'self26'],
    [{ proj: 'spend' }, { pg: 0.03, pshift: 0.01, pdr: 0.05, psp: 30000 }, 'p_d_2035'],
    [{}, { rcg: 0.03, bc_obs: 450000, t_vat: 60000 }, 'intburden26'],
  ];
  for (const [modes, inp, target] of cases) {
    const sim = new Sim(modes);
    sim.setMany(inp);
    const r = shapley(sim.graph, sim.inputs, target);
    assert.ok(r.exact);
    assert.ok(close(r.total, sim.values[target] - sim.base[target]), `${target} total`);
    const sum = r.rows.reduce((a, x) => a + x.phi, 0);
    assert.ok(close(sum, r.total), `${target}: Σφ=${sum} total=${r.total}`);
    assert.ok(close(r.sumAlone + r.interaction, r.total));
  }
});

test('Shapley：两个参数时 φ₁ = ½[f(1) − f(∅)] + ½[f(1,2) − f(2)]，交互项平分', () => {
  const sim = new Sim({ c26: 'rate', absorb: 'other' });
  sim.setMany({ dr26: 0.05, g_nom: 0.07 });
  const r = shapley(sim.graph, sim.inputs, 'oth26');
  const gdp25 = sim.inputs.gdp25;
  const inter = gdp25 * 0.01 * 0.02;
  assert.ok(close(r.interaction, inter, 1e-9), `交互 ${r.interaction} vs ${inter}`);
  for (const row of r.rows) assert.ok(close(row.phi, row.alone + inter / 2, 1e-9), row.id);
});

test('Shapley：加法关系没有交互，单独效果即贡献；只算上游且改过的参数', () => {
  const sim = new Sim();
  sim.setMany({ t_vat: 60000, nontax: 30000, f4_exp: 10 });
  const r = shapley(sim.graph, sim.inputs, 'r26');
  assert.deepEqual(r.ids.sort(), ['nontax', 't_vat']);
  assert.ok(Math.abs(r.interaction) < 1e-6);
  for (const row of r.rows) assert.ok(close(row.phi, row.alone, 1e-9));
  assert.equal(shapley(new Sim().graph, new Sim().inputs, 'r26'), null);
});

test('Shapley：参数太多时退化为单独效果 + 交互余项', () => {
  const sim = new Sim();
  const ids = ['t_vat', 't_cit', 't_pit', 't_con', 'nontax', 'rebate'];
  sim.setMany(Object.fromEntries(ids.map((id) => [id, sim.inputs[id] * 0.9])));
  const r = shapley(sim.graph, sim.inputs, 'self26', { maxExact: 4 });
  assert.equal(r.exact, false);
  assert.ok(r.rows.every((x) => x.phi == null));
  assert.ok(close(r.sumAlone + r.interaction, r.total));
});

test('Shapley：改动参数超过 31 个时总变化和单独效果仍正确（不再受 32 位掩码限制）', () => {
  const sim = new Sim();
  const up = new Set(sim.graph.upstream('p_iball_2028'));
  const ids = sim.graph.inputs().filter((n) => up.has(n.id) && !n.fixed && n.base !== 0).map((n) => n.id);
  assert.ok(ids.length > 32, `上游参数 ${ids.length} 个`);
  sim.setMany(Object.fromEntries(ids.map((id) => [id, sim.inputs[id] * 1.02])));
  const r = shapley(sim.graph, sim.inputs, 'p_iball_2028');
  assert.equal(r.exact, false);
  assert.ok(close(r.total, sim.values.p_iball_2028 - sim.base.p_iball_2028), `${r.total} vs ${sim.values.p_iball_2028 - sim.base.p_iball_2028}`);
  const last = r.ids[r.ids.length - 1];
  const direct = sim.graph.compute({ ...sim.graph.baseInputs(), [last]: sim.inputs[last] }).p_iball_2028 - sim.base.p_iball_2028;
  assert.ok(close(r.rows.find((x) => x.id === last).alone, direct), '第 32 个以后的参数单独效果');
});
