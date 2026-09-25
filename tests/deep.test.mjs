// 深度检查：①全部平衡规则组合 × 随机参数下，会计恒等式精确成立、关键指标可计算；
// ②公式卡片"代入"行里显示的数字，代回去算得出显示的结果（界面上的代入式自洽）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/model/sim.js';
import { MODE_OPTIONS } from '../src/model/specs.js';
import { formulaLines } from '../src/model/format.js';

function allCombos() {
  let combos = [{}];
  for (const [k, def] of Object.entries(MODE_OPTIONS)) {
    const next = [];
    for (const c of combos) for (const v of Object.keys(def.options)) next.push({ ...c, [k]: v });
    combos = next;
  }
  return combos;
}

test('全部平衡规则组合（2,592 种）× 随机参数：7 条恒等式精确成立，16 个关键指标可计算', () => {
  let seed = 11;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const KEY = ['r26', 'e26', 'd26', 'drate26', 'oth26', 'el26', 'gov1', 'debt_gdp1', 'broad_gdp1', 'intburden26', 'self26', 'p_d_2035', 'p_w_2035', 'p_ib_2035', 'fc_gap', 'f1_other'];
  const combos = allCombos();
  assert.equal(combos.length, 2592);
  for (const m of combos) {
    const s = new Sim(m);
    const ch = {};
    for (const n of s.graph.inputs()) if (!n.fixed && n.range && rnd() < 0.25) ch[n.id] = n.range[0] + rnd() * (n.range[1] - n.range[0]);
    s.setMany(ch);
    const v = s.values;
    for (const id of KEY) if (s.has(id)) assert.ok(Number.isFinite(v[id]), `${JSON.stringify(m)} ${id}=${v[id]}`);
    const scale = Math.max(1, Math.abs(v.e26));
    const checks = [
      v.e26 - (v.own26 + v.res26 + v.el26),
      (v.e26 - v.r26) - (v.d26 + v.tin26),
      v.ec26 - (v.rc26 + v.dc26 + v.tstab26 + v.tsoe26),
      v.el26 - (v.rl26 + v.tr26 + v.dl26 + v.tl26),
      v.gov1 - (v.bc1 + v.bl1),
      v.p_B_2035 - (v.p_Bc_2035 + v.p_Blg_2035 + v.p_Bls_2035),
      (v.p_dd_2035 - (v.p_snow_2035 + v.p_pd_2035 + v.p_sfa_2035)) * scale,
    ];
    checks.forEach((d, i) => assert.ok(Math.abs(d) / scale <= 1e-9, `${JSON.stringify(m)} 恒等式 ${i + 1} 偏差 ${d}`));
  }
});

// 把代入式的文字还原成可计算的表达式
function toJS(str) {
  return str.replace(/亿元|万亿元|个百分点/g, '').replace(/, /g, '§').replace(/,/g, '').replace(/§/g, ',')
    .replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/')
    .replace(/(\d+(?:\.\d+)?)%/g, '($1/100)').replace(/max\{/g, 'Math.max(').replace(/min\{/g, 'Math.min(').replace(/\}/g, ')')
    .replace(/\[/g, '(').replace(/\]/g, ')');
}

test('公式卡片的代入式自洽：代入显示的数字，算得出显示的结果（全部 393 条，基线与改动后）', () => {
  const states = [new Sim(), (() => { const s = new Sim(); s.setMany({ t_vat: 61234.5, dr26: 0.0437, rcg: 0.0263, g_nom: 0.0371, f2_land: 6.13, pg: 0.039, swap26: 31000 }); return s; })()];
  for (const sim of states) {
    let checked = 0;
    for (const id of sim.graph.order) {
      if (sim.spec(id).expr == null) continue;
      const L = formulaLines(sim.graph, id, sim.values, { html: false });
      const parts = L.subst.split(' = ');
      const lhs = parts.slice(1, -1).join(' = ');
      const rhs = parts[parts.length - 1];
      const a = Function(`return ${toJS(lhs)}`)();
      const b = Function(`return ${toJS(rhs)}`)();
      const dec = (rhs.replace(/[^\d.]/g, '').split('.')[1] ?? '').length;
      const tol = Math.max((/%/.test(rhs) ? 0.01 : 1) * 10 ** -dec, Math.abs(b) * 1e-3);
      assert.ok(Math.abs(a - b) <= tol, `${id}: ${L.subst}（代回算得 ${a}）`);
      checked++;
    }
    assert.ok(checked >= 390, `检查了 ${checked} 条`);
  }
});
