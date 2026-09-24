// 双目标求解界面：选两个目标、两个参数，牛顿法求出同时满足的组合。
import { h, esc } from './dom.js';
import { fmt, fmtDelta, fmtExact, dispKind } from '../model/format.js';
import { goalSeek2, resolveGoals, SOLVE2_EXAMPLES } from '../model/solve2.js';
import { tornado, TARGETS, stepOf, stepText } from '../model/sensitivity.js';
import { toDisp, fromDisp } from './controls.js';
import { MODE_OPTIONS } from '../model/specs.js';

const unitOf = (spec) => ({ yi: '亿元', wanyi: '万亿元', wy: '万亿元', pct: '%', num: '' }[dispKind(spec)] ?? '');
const ALL_TARGETS = [...TARGETS, ['r26', '全国一般公共预算收入'], ['rc26', '中央一般公共预算收入'], ['e26', '全国一般公共预算支出']]
  .filter(([id], i, a) => a.findIndex(([x]) => x === id) === i);

export function createSolve2(app) {
  let modes = {}; // 示例自带的规则；自选时为空（用当前规则）
  const tSel = [0, 1].map((i) => {
    const s = h('select', { class: 'btn', id: `s2-t${i}`, 'aria-label': `目标 ${i + 1}` });
    for (const [id, t] of ALL_TARGETS) s.append(h('option', { value: id }, t));
    return s;
  });
  const gIn = [0, 1].map((i) => h('input', { class: 'ctl-val', id: `s2-g${i}`, style: { width: '110px' }, 'aria-label': `目标 ${i + 1} 的值` }));
  const gUnit = [0, 1].map(() => h('span', { class: 'hint' }));
  const pSel = [0, 1].map((i) => h('select', { class: 'btn', id: `s2-p${i}`, 'aria-label': `参数 ${i + 1}`, style: { maxWidth: '100%' } }));
  const ruleNote = h('p', { class: 'hint', style: { margin: '6px 0 0' } });
  const out = h('div', { style: { marginTop: '10px' } });
  const chips = h('div', { class: 'presets', style: { padding: '0', border: '0', marginBottom: '8px' } });
  for (const ex of SOLVE2_EXAMPLES) chips.append(h('button', { class: 'chip', type: 'button', title: ex.note, onclick: () => loadExample(ex) }, ex.label));

  const sim = () => {
    const differs = Object.entries(modes).some(([k, v]) => app.sim.modes[k] !== v);
    if (!differs) return { s: app.sim, differs };
    const s = app.sim.clone();
    s.setModes(modes);
    return { s, differs };
  };

  function fillParams(keep = []) {
    const { s } = sim();
    const g = s.graph;
    const ids = [];
    for (const t of tSel.map((x) => x.value)) {
      if (!g.specs.has(t)) continue;
      for (const r of tornado(g, s.inputs, t, { limit: 30 }).rows) if (!ids.includes(r.id)) ids.push(r.id);
    }
    pSel.forEach((sel, i) => {
      const prev = keep[i] ?? sel.value;
      sel.innerHTML = '';
      for (const id of ids) sel.append(h('option', { value: id }, g.specs.get(id).label));
      if (ids.includes(prev)) sel.value = prev;
      else sel.value = ids[i] ?? ids[0] ?? '';
    });
  }
  function fillGoal(i, v) {
    const { s } = sim();
    const t = tSel[i].value;
    if (!s.has(t)) return;
    const spec = s.spec(t);
    gIn[i].value = String(Number(toDisp(spec, v ?? s.values[t]).toFixed(spec.unit === 'pct' ? 3 : 2)));
    gUnit[i].textContent = unitOf(spec);
  }
  function loadExample(ex) {
    modes = { ...(ex.modes ?? {}) };
    ex.targets.forEach((t, i) => { tSel[i].value = t; });
    const { s } = sim();
    const goals = resolveGoals(ex.goals, ex.targets, s.values);
    goals.forEach((g, i) => fillGoal(i, g));
    fillParams(ex.params);
    showRules();
    solve();
  }
  function showRules() {
    const { differs } = sim();
    const txt = Object.entries(modes).map(([k, v]) => `${MODE_OPTIONS[k]?.label ?? k}：${MODE_OPTIONS[k]?.options?.[v]?.label ?? v}`).join('；');
    ruleNote.textContent = !txt ? '按你当前的平衡规则求解。' : differs ? `这个例子在「${txt}」规则下求解（与你当前的规则不同）；应用时会一并切换规则。` : `平衡规则：${txt}（与当前一致）。`;
  }
  tSel.forEach((sel, i) => sel.addEventListener('change', () => { modes = {}; showRules(); fillGoal(i); fillParams(); out.innerHTML = ''; }));

  function solve() {
    const { s, differs } = sim();
    const g = s.graph;
    const targets = tSel.map((x) => x.value);
    const params = pSel.map((x) => x.value);
    const tspecs = targets.map((t) => g.specs.get(t));
    const goals = gIn.map((inp, i) => fromDisp(tspecs[i], parseFloat(inp.value)));
    if (goals.some((v) => !Number.isFinite(v)) || params.some((p) => !p)) return;
    const r = goalSeek2(g, s.inputs, { targets, goals, params });
    const pspecs = params.map((p) => g.specs.get(p));
    out.innerHTML = '';
    if (!r.ok && (!r.x || r.singular || !r.values)) {
      out.append(h('div', { class: 'warn-item' }, r.reason));
      return;
    }
    const lines = params.map((p, i) => `<b>${esc(pspecs[i].label)}</b> 从 ${esc(fmt(pspecs[i], s.inputs[p]))} 调到 <b>${esc(fmt(pspecs[i], r.x[i]))}</b>`).join('，');
    const res = targets.map((t, i) => `${esc(tspecs[i].label)} = ${esc(fmt(tspecs[i], r.values[i]))}`).join('；');
    out.append(h('p', { class: 'note', style: { margin: '0 0 8px' }, html: r.ok
      ? `${lines}。代回重算：${res}，两个目标同时达到（牛顿法迭代 ${r.iter} 次）。`
      : `${esc(r.reason)}：${lines}，此时 ${res}。` }));
    // 雅可比矩阵：以"参数动一个标准步长"为单位，两个目标各变多少
    const base = { ...s.inputs, [params[0]]: r.x[0], [params[1]]: r.x[1] };
    const ev = targets.map((t) => g.evaluator(t));
    const f0 = ev.map((e) => e(base));
    const steps = pspecs.map((sp) => stepOf(sp));
    const M = ev.map((e, i) => params.map((p, j) => e({ ...base, [p]: base[p] + steps[j] }) - f0[i]));
    // 行列式按显示单位计算（百分比用百分点，金额用亿元/万亿元），便于对照上表
    const D = M.map((row, i) => row.map((v) => toDisp(tspecs[i], v)));
    const det = D[0][0] * D[1][1] - D[0][1] * D[1][0];
    const num = (v) => {
      const a = Math.abs(v) < 1e-9 ? 0 : v;
      const t = Math.abs(a) >= 100 ? a.toLocaleString('en-US', { maximumFractionDigits: 2 }) : Number(a.toPrecision(4)).toString();
      return a < 0 ? `(${t.replace('-', '−')})` : t;
    };
    const cell = (i, j) => (Math.abs(M[i][j]) <= 1e-12 * Math.max(1, Math.abs(f0[i])) ? '0' : fmtExact(tspecs[i], M[i][j], { delta: true }));
    const tbl = `<table class="tbl s2-j"><thead><tr><th>参数动一步 →</th>${params.map((p, j) => `<th class="n">${esc(pspecs[j].label)}<div class="hint" style="font-weight:400">${esc(stepText(pspecs[j], steps[j]).replace('±', '+'))}</div></th>`).join('')}</tr></thead><tbody>
      ${targets.map((t, i) => `<tr><th>${esc(tspecs[i].label)}</th>${params.map((_, j) => `<td class="n">${esc(cell(i, j))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    out.append(h('div', { class: 'fx-table' },
      h('div', { class: 'k' }, '公式'), h('div', { class: 'v' }, 'J · Δx = −F，J = [∂f₁/∂x₁  ∂f₁/∂x₂ ; ∂f₂/∂x₁  ∂f₂/∂x₂]'),
      h('div', { class: 'k' }, '读法'), h('div', { class: 'v read' }, '每一步用"两个参数各动一点、两个目标各变多少"组成的 2×2 矩阵，解出让两个差距同时归零的调整量 Δx，重复到差距为零'),
      h('div', { class: 'k' }, '拟音'), h('div', { class: 'v read' }, 'J 读"雅可比矩阵"；∂ 读"偏"'),
      h('div', { class: 'k' }, '代入'), h('div', { class: 'v subst', html: `解处的 J 见下表（每列 = 参数动一步时两个目标的变化）。行列式 = ${num(D[0][0])} × ${num(D[1][1])} − ${num(D[0][1])} × ${num(D[1][0])} = <b>${num(det)}</b>${Math.abs(det) > 1e-12 ? '（≠ 0：两个参数的作用方向不同，所以解唯一）' : ''}` }),
    ), h('div', { class: 'tbl-wrap', html: tbl }));
    if (r.ok) {
      out.append(h('button', { class: 'btn primary', style: { marginTop: '8px' }, onclick: () => {
        const c = app.sim.clone();
        if (differs) c.setModes(modes);
        c.setMany({ [params[0]]: r.x[0], [params[1]]: r.x[1] });
        app.restore(c.snapshot(), `已同时调整${pspecs[0].label}和${pspecs[1].label}${differs ? '，并切换规则' : ''}（可撤销）`);
        modes = {};
        showRules();
      } }, '同时应用这两个值'));
    }
  }

  const el = h('div', { class: 'sheet', id: 'solve2' },
    h('h3', {}, '双目标求解', h('small', {}, '调两个参数，让两个指标同时达到目标——相当于找两条等值线的交点')),
    chips,
    h('div', { class: 's2-grid' },
      h('span', {}, '让'), tSel[0], h('span', {}, '='), h('span', { class: 's2-g' }, gIn[0], gUnit[0]),
      h('span', {}, '且'), tSel[1], h('span', {}, '='), h('span', { class: 's2-g' }, gIn[1], gUnit[1]),
      h('span', {}, '调'), pSel[0], h('span', {}, '和'), pSel[1],
    ),
    h('div', { style: { marginTop: '8px' } }, h('button', { class: 'btn primary', onclick: solve }, '求解')),
    ruleNote,
    out,
  );

  let init = false;
  function update() {
    if (init) return;
    init = true;
    loadExample(SOLVE2_EXAMPLES[0]);
  }
  return { el, update };
}
