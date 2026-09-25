import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/model/sim.js';
import { PHASE_PRESETS, phaseGrid, contour, niceLevels, fitRange, defaultRange } from '../src/model/phase.js';

const close = (a, b, rel = 1e-9) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));

test('求值器：只算上游，结果与整图求值完全一致', () => {
  const sim = new Sim();
  for (const target of ['p_d_2035', 'oth26', 'self26', 'intburden26', 'f1_other', 'r26']) {
    const f = sim.graph.evaluator(target);
    for (let k = 0; k < 20; k++) {
      const inp = { ...sim.inputs };
      for (const n of sim.graph.inputs()) if (n.range && Math.random() < 0.3) inp[n.id] = n.range[0] + Math.random() * (n.range[1] - n.range[0]);
      const a = f(inp);
      const b = sim.graph.compute(inp)[target];
      assert.ok(Object.is(a, b) || close(a, b, 0), `${target}: ${a} vs ${b}`);
    }
  }
});

test('相图预设：参数都是当前规则下的上游输入，每一格等于直接重算', () => {
  for (const p of PHASE_PRESETS) {
    const sim = new Sim(p.modes ?? {});
    const g = sim.graph;
    const up = new Set(g.upstream(p.target));
    assert.ok(g.isInput(p.x) && up.has(p.x), `${p.id}: ${p.x}`);
    assert.ok(g.isInput(p.y) && up.has(p.y), `${p.id}: ${p.y}`);
    const xr = fitRange(g.specs.get(p.x), p.xr, sim.inputs[p.x]);
    const yr = fitRange(g.specs.get(p.y), p.yr, sim.inputs[p.y]);
    assert.ok(xr[0] <= sim.inputs[p.x] && sim.inputs[p.x] <= xr[1], `${p.id} 横轴区间应含当前值`);
    assert.ok(yr[0] <= sim.inputs[p.y] && sim.inputs[p.y] <= yr[1], `${p.id} 纵轴区间应含当前值`);
    const r = phaseGrid(g, sim.inputs, { x: p.x, y: p.y, target: p.target, xr, yr, n: 11 });
    assert.ok(close(r.now, sim.values[p.target]), `${p.id} 当前值`);
    for (const [i, j] of [[0, 0], [10, 10], [3, 7], [7, 2]]) {
      const direct = g.compute({ ...sim.inputs, [p.x]: r.xs[i], [p.y]: r.ys[j] })[p.target];
      assert.ok(close(r.z[j][i], direct), `${p.id} (${i},${j})`);
    }
    assert.ok(r.max > r.min, `${p.id} 在区间内应有变化`);
    // 交互项的定义：f11 − f10 − f01 + f00
    const c = r.corners;
    assert.ok(close(c.inter, c.f11 - c.f10 - c.f01 + c.f00, 1e-9));
    assert.ok(close(r.local.inter, r.local.both - r.local.dfx - r.local.dfy, 1e-9));
  }
});

test('对照组没有交互项；乘积关系有交互项', () => {
  const byId = Object.fromEntries(PHASE_PRESETS.map((p) => [p.id, p]));
  const run = (p) => {
    const sim = new Sim(p.modes ?? {});
    return phaseGrid(sim.graph, sim.inputs, { ...p, n: 5 });
  };
  const add = run(byId.add);
  assert.ok(add.corners.share < 1e-9, `对照组交互占比 ${add.corners.share}`);
  for (const id of ['oth', 'vat', 'int', 'soe', 'dg', 'reprice']) {
    const r = run(byId[id]);
    assert.ok(r.corners.share > 0.005, `${id} 交互占比 ${r.corners.share}`);
  }
  // 名义增速 × 赤字率 → 其它：交互项 = GDP₂₀₂₅ × Δg × Δ赤字率（精确）
  const oth = run(byId.oth);
  const sim = new Sim(byId.oth.modes);
  const expect = sim.inputs.gdp25 * (byId.oth.xr[1] - byId.oth.xr[0]) * (byId.oth.yr[1] - byId.oth.yr[0]);
  assert.ok(close(oth.corners.inter, expect, 1e-9), `${oth.corners.inter} vs ${expect}`);
});

test('取舍比率：沿等值线移动，结果近似不变', () => {
  for (const p of PHASE_PRESETS) {
    const sim = new Sim(p.modes ?? {});
    const r = phaseGrid(sim.graph, sim.inputs, { ...p, n: 3 });
    if (!Number.isFinite(r.trade.slope)) continue;
    const dx = r.local.sx * 0.02;
    const moved = sim.graph.compute({ ...sim.inputs, [p.x]: r.x0 + dx, [p.y]: r.y0 + r.trade.slope * dx })[p.target];
    const scale = Math.abs(r.trade.gx * dx) || 1;
    assert.ok(Math.abs(moved - r.now) < 0.05 * scale, `${p.id}: 偏离 ${moved - r.now}，单独动横轴 ${r.trade.gx * dx}`);
  }
});

test('等值线：交点都在网格边上且线性插值等于水平值', () => {
  const z = [[0, 1, 2], [1, 2, 3], [2, 3, 4]];
  const segs = contour(z, 1.5);
  assert.ok(segs.length >= 3);
  const bil = (x, y) => x + y; // 这个网格恰好是 z = i + j
  for (const [x1, y1, x2, y2] of segs) {
    for (const [x, y] of [[x1, y1], [x2, y2]]) {
      assert.ok(Number.isInteger(x) || Number.isInteger(y), '端点应在格线上');
      assert.ok(close(bil(x, y), 1.5, 1e-12));
    }
  }
  assert.deepEqual(contour(z, 10), []);
  assert.deepEqual(contour([[NaN, 1], [1, 2]], 1.5), []);
  // 鞍点：四角两高两低，应输出两段
  assert.equal(contour([[1, 0], [0, 1]], 0.5).length, 2);
});

test('整齐等值线水平', () => {
  assert.deepEqual(niceLevels(0.62, 1.31, 6), [0.8, 1, 1.2]);
  assert.deepEqual(niceLevels(-3100, 7200, 5), [-2500, 0, 2500, 5000]);
  assert.deepEqual(niceLevels(1, 1), []);
});

test('区间：包含当前值，裁剪到滑杆区间', () => {
  const s = { unit: 'pct', range: [0, 0.1] };
  assert.deepEqual(fitRange(s, [0.02, 0.07], 0.09), [0.02, 0.09]);
  const d = defaultRange(s, 0.01);
  assert.equal(d[0], 0);
  assert.ok(close(d[1], 0.04));
  const m = defaultRange({ unit: 'yi', range: [0, 100000] }, 80000);
  assert.deepEqual(m, [48000, 100000]);
});

test('增量求值器与多目标求值器：结果与整图重算逐位相同', () => {
  const sim = new Sim({ proj: 'spend' });
  const g = sim.graph;
  let seed = 3;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (const [target, vars] of [['p_d_2035', ['pg', 'pshift']], ['oth26', ['g_nom', 'dr26']], ['self26', ['t_vat', 's_vat']], ['p_iball_2030', ['rcg', 'pphi']]]) {
    const f = g.evaluatorDelta(target, vars, sim.inputs);
    for (let k = 0; k < 25; k++) {
      const vals = vars.map((id) => { const [a, b] = g.specs.get(id).range; return a + rnd() * (b - a); });
      const direct = g.compute({ ...sim.inputs, ...Object.fromEntries(vars.map((id, i) => [id, vals[i]])) })[target];
      assert.ok(Object.is(f(vals), direct), `${target} ${vals}`);
    }
  }
  const many = g.evaluatorMany(['p_d_2030', 'p_d_2035']);
  const v = many(sim.inputs);
  assert.equal(v.p_d_2030, sim.values.p_d_2030);
  assert.equal(v.p_d_2035, sim.values.p_d_2035);
});
