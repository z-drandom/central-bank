// 随机扰动所有参数、随机选择平衡规则，检查所有会计恒等式始终成立。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/model/sim.js';
import { MODE_OPTIONS, PROJ_START, PROJ_END, OWN26_IDS, TAX_IDS, EXP25_IDS } from '../src/model/specs.js';
import { changed } from '../src/engine/graph.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function randomSim(seed) {
  const r = rng(seed);
  const modes = {};
  for (const [k, def] of Object.entries(MODE_OPTIONS)) {
    const opts = Object.keys(def.options);
    modes[k] = opts[Math.floor(r() * opts.length)];
  }
  const sim = new Sim(modes);
  const patch = {};
  for (const n of sim.graph.inputs()) {
    if (n.fixed) continue;
    if (r() < 0.5) continue;
    const [lo, hi] = n.range ?? [n.base * 0.5, n.base * 1.5];
    // 在基线 ±30% 范围内扰动，并截在允许区间内
    const v = n.base === 0 ? lo + (hi - lo) * r() * 0.3 : n.base * (0.7 + 0.6 * r());
    patch[n.id] = Math.min(hi, Math.max(lo, v));
  }
  sim.setMany(patch);
  return sim;
}

const close = (a, b, msg) => {
  const tol = 1e-7 * Math.max(1, Math.abs(a), Math.abs(b));
  assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≠ ${b}`);
};

test('会计恒等式在 300 组随机参数 × 随机规则下恒成立', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const sim = randomSim(seed);
    const v = sim.values;
    const S = (ids) => ids.reduce((a, id) => a + v[id], 0);
    const tag = `seed ${seed} ${JSON.stringify(sim.modes)}`;
    // 图③
    close(v.tax25, S(TAX_IDS), `税收合计 ${tag}`);
    close(v.rev25, v.tax25 - v.rebate + v.nontax, `收入 ${tag}`);
    close(v.exp25, S(EXP25_IDS), `支出合计 ${tag}`);
    close(v.exp25, v.rev25 + v.def25 + v.tin25, `支出 = 收入 + 赤字 + 调入 ${tag}`);
    close(v.rc25 + v.rl25, v.rev25, `中央 + 地方 = 全国（2025） ${tag}`);
    // 图②
    close(v.ec26, v.rc26 + v.dc26 + v.tstab26 + v.tsoe26, `中央来源 ${tag}`);
    close(v.ec26, v.own26 + v.tr26 + v.res26, `中央去向 ${tag}`);
    close(v.own26, S(OWN26_IDS), `本级 = 各项之和 ${tag}`);
    close(v.el26, v.rl26 + v.tr26 + v.dl26 + v.tl26, `地方 ${tag}`);
    close(v.d26, v.dc26 + v.dl26, `赤字 ${tag}`);
    close(v.r26, v.rc26 + v.rl26, `全国收入 ${tag}`);
    close(v.e26, v.r26 + v.d26 + v.tin26, `全国支出 = 收入 + 赤字 + 调入 ${tag}`);
    close(v.gap26, v.d26 + v.tin26, `实际赤字 = 预算赤字 + 调入 ${tag}`);
    // 图①
    close(v.gov1, v.gov0 + v.d26 + v.stb26 + v.sp26 + v.swap26, `债务存量-流量 ${tag}`);
    close(v.gov0, v.bc0 + v.blg0 + v.bls0, `期初债务 ${tag}`);
    close(v.broad1 - v.hsel1, v.gov1, `广义 ${tag}`);
    // 图④
    close(v.fc_gap, v.fc_gap2, `广义赤字两种算法 ${tag}`);
    close(v.f1_totexp, v.f1_totrev + v.f1_def, `第一本账 ${tag}`);
    close(v.f1_realdef, v.f1_def + v.f1_tin - v.f1_tostab, `实际赤字 vs 预算赤字 ${tag}`);
    close(v.f2_rev, v.f2_exp + v.f2_to1 + v.f2_tostab + v.f2_next, `第二本账 ${tag}`);
    close(v.f3_tot, v.f3_rev, `第三本账 ${tag}`);
    close(v.f4_bal, v.f4_rev - v.f4_exp, `第四本账 ${tag}`);
    // 推演：Δd = 滚雪球 + 基本赤字 + 其他债务融资
    for (let y = PROJ_START; y <= PROJ_END; y++) {
      close(v[`p_dd_${y}`], v[`p_snow_${y}`] + v[`p_pd_${y}`] + v[`p_sfa_${y}`], `债务动态分解 ${y} ${tag}`);
      if (y > PROJ_START) {
        close(v[`p_B_${y}`], v[`p_B_${y - 1}`] + v[`p_D_${y}`] + v.pstb + v.psp + v[`p_sw_${y}`], `推演存量 ${y} ${tag}`);
        close(v[`p_E_${y}`], v[`p_R_${y}`] + v[`p_D_${y}`] + v[`p_T_${y}`], `推演预算 ${y} ${tag}`);
      }
    }
  }
});

test('切换平衡规则不改变任何当前数值（只改变之后由谁吸收冲击）', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const sim = randomSim(seed);
    const before = { ...sim.values };
    const r = rng(seed * 7);
    for (let k = 0; k < 4; k++) {
      const keys = Object.keys(MODE_OPTIONS);
      const key = keys[Math.floor(r() * keys.length)];
      const opts = Object.keys(MODE_OPTIONS[key].options);
      const val = opts[Math.floor(r() * opts.length)];
      // 口径切换改变"隐性债务"的定义；推演规则切换改变的是未来各年的行为假设，二者本来就会改变数值
      if (key === 'scope' || key === 'proj') continue;
      sim.setMode(key, val);
      for (const id of Object.keys(before)) {
        if (!sim.has(id)) continue;
        close(sim.values[id], before[id], `seed ${seed} ${key}=${val} ${id}`);
      }
    }
  }
});

test('只有下游节点会变化', () => {
  const sim = new Sim();
  for (const id of ['t_vat', 'g_nom', 'f2_land', 'rcg', 'sh_lg', 'pg']) {
    sim.resetAll();
    sim.set(id, sim.values[id] * 1.1 + 0.001);
    const down = new Set([id, ...sim.graph.downstream(id)]);
    for (const c of sim.changedIds()) assert.ok(down.has(c), `${id} 不应影响 ${c}`);
  }
});

test('典型传导方向', () => {
  const sim = new Sim();
  // 1) 2025 增值税减少（赤字锁定）→ 调入资金增加；2026 中央、地方收入都下降
  sim.set('t_vat', sim.values.t_vat - 1000);
  assert.ok(sim.values.tin25 > sim.base.tin25);
  close(sim.values.tin25 - sim.base.tin25, 1000, '调入资金吸收全部减收');
  assert.ok(sim.values.rc26 < sim.base.rc26 && sim.values.rl26 < sim.base.rl26);
  close(sim.values.rc26 - sim.base.rc26, -500 * (1 + sim.values.g_rc), '中央分走 50%，再乘 2026 增速');
  // 赤字率锚定 + 其它吸收：中央本级其它支出下降同样多
  close(sim.values.oth26 - sim.base.oth26, sim.values.rc26 - sim.base.rc26, '挤出本级其它支出');

  // 2) 赤字率 +1 个百分点 → 中央赤字 + 1% × GDP → 年末国债同样增加
  sim.resetAll();
  sim.set('dr26', 0.05);
  close(sim.values.dc26 - sim.base.dc26, 0.01 * sim.values.gdp26, '中央赤字');
  close(sim.values.bc1 - sim.base.bc1, 0.01 * sim.values.gdp26, '国债余额');
  assert.ok(sim.values.p_I_2027 > sim.base.p_I_2027, '下一年付息增加');

  // 3) 四本账：社保支出增加 + 补贴兜底 → 补贴增加 → 其他支出被挤出
  const s2 = new Sim({ fb4: 'gap' });
  s2.set('f4_exp', s2.values.f4_exp + 0.5);
  close(s2.values.f4_sub - s2.base.f4_sub, 0.5, '补贴');
  close(s2.values.f1_other - s2.base.f1_other, -0.5, '挤出');
  close(s2.values.f1_def, s2.base.f1_def, '预算赤字不变');

  // 4) 土地出让收入下降 → 基金结余下降 → 调入一般预算下降
  const s3 = new Sim();
  s3.set('f2_land', s3.values.f2_land - 1);
  assert.ok(s3.values.f2_to1 < s3.base.f2_to1);
  assert.ok(s3.values.f1_exp < s3.base.f1_exp);

  // 5) 置换：隐债减少、显性债务增加、广义不变
  const s4 = new Sim();
  s4.set('swap26', 40000);
  close(s4.values.gov1 - s4.base.gov1, 20000, '显性增加');
  close(s4.values.hsel1 - s4.base.hsel1, -20000, '隐性减少');
  close(s4.values.broad1, s4.base.broad1, '广义不变');
  assert.ok(!changed(s4.values.p_B_2026 + s4.values.p_H_2026, s4.base.p_B_2026 + s4.base.p_H_2026));
});

test('图④的第一本账恒等式在 2025、2026 年同样成立', () => {
  const sim = new Sim();
  const v = sim.values;
  close(v.core25, v.rev25 + v.tin25 + v.def25 - v.e_stab, '2025');
  close(v.e26, v.r26 + v.tin26 + v.d26, '2026');
  close(v.realdef25 - v.def25, v.tin25 - v.e_stab, '2025 实际 − 预算 = 调入 − 补充');
  close(v.f1_realdef - v.f1_def, v.f1_tin - v.f1_tostab, '2021');
});
