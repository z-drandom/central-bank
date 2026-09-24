// 敏感度（龙卷风图）：哪些参数对目标影响最大
import { h, esc } from '../dom.js';
import { tornado, TARGETS, stepText } from '../../model/sensitivity.js';
import { fmt, fmtDelta, dispKind } from '../../model/format.js';
import { MODULES } from '../../model/specs.js';
import { goalSeek } from '../../model/solve.js';
import { influenceMatrix, MATRIX_COLS } from '../../model/matrix.js';
import { toDisp, fromDisp } from '../controls.js';

export default function sensitivity(app) {
  let target = 'p_d_2035';
  let mode = 'mixed';
  const sel = h('select', { class: 'btn', id: 'sens-target', 'aria-label': '目标指标' });
  for (const [id, t] of TARGETS) sel.append(h('option', { value: id }, t));
  sel.value = target;
  sel.addEventListener('change', () => { target = sel.value; update(); });
  const modeSeg = h('div', { class: 'seg', style: { display: 'inline-flex' } });
  for (const [k, t] of [['mixed', '比率 ±1pp，金额 ±10%'], ['rel', '全部 ±10%']]) {
    modeSeg.append(h('button', { type: 'button', 'data-m': k, onclick: () => { mode = k; update(); } }, t));
  }
  const info = h('p', { class: 'note', style: { margin: '8px 0' } });
  const chart = h('div', { class: 'chart' });
  // 反向求解
  const gsTarget = h('select', { class: 'btn', id: 'gs-target', 'aria-label': '求解目标' });
  for (const [id, t] of TARGETS) gsTarget.append(h('option', { value: id }, t));
  gsTarget.value = 'p_d_2035';
  const gsGoal = h('input', { class: 'ctl-val', id: 'gs-goal', style: { width: '110px' }, 'aria-label': '目标值' });
  const gsUnit = h('span', { class: 'hint' });
  const gsParam = h('select', { class: 'btn', id: 'gs-param', 'aria-label': '调整的参数', style: { maxWidth: '100%' } });
  const gsOut = h('div', { style: { marginTop: '10px' } });
  function fillParams() {
    const t = gsTarget.value;
    if (!app.sim.has(t)) return;
    const spec = app.sim.spec(t);
    gsGoal.value = toDisp(spec, app.v[t]).toFixed(spec.unit === 'pct' ? 2 : 2);
    gsUnit.textContent = { yi: spec.disp === 'wy' ? '万亿元' : '亿元', wy: '万亿元', pct: '%', num: '' }[spec.unit];
    const r = tornado(app.sim.graph, app.sim.inputs, t, { limit: 40 });
    gsParam.innerHTML = '';
    for (const row of r.rows) gsParam.append(h('option', { value: row.id }, app.sim.spec(row.id).label));
    gsOut.innerHTML = '';
  }
  gsTarget.addEventListener('change', fillParams);
  function solve() {
    const t = gsTarget.value;
    const tspec = app.sim.spec(t);
    const goal = fromDisp(tspec, parseFloat(gsGoal.value));
    const pid = gsParam.value;
    if (!Number.isFinite(goal) || !pid) return;
    const pspec = app.sim.spec(pid);
    const r = goalSeek(app.sim.graph, app.sim.inputs, { target: t, goal, param: pid });
    if (!r.ok) {
      const extra = r.range ? `（在允许区间内，目标只能在 ${fmt(tspec, Math.min(...r.range))} 到 ${fmt(tspec, Math.max(...r.range))} 之间）` : '';
      gsOut.innerHTML = `<div class="warn-item">${esc(r.reason)}${esc(extra)}。换一个参数试试，或把几个参数组合起来。</div>`;
      return;
    }
    const cur = app.v[pid];
    gsOut.innerHTML = '';
    gsOut.append(
      h('p', { class: 'note', style: { margin: '0 0 8px' }, html: `把 <b>${esc(pspec.label)}</b> 从 ${esc(fmt(pspec, cur))} 调到 <b>${esc(fmt(pspec, r.x))}</b>，${esc(tspec.label)} 就等于 ${esc(fmt(tspec, goal))}。（二分法迭代 ${r.iter} 次，每次都重算整张依赖图）` }),
      h('button', { class: 'btn primary', onclick: () => { app.set(pid, r.x); app.flash(`已把${pspec.label}调到 ${fmt(pspec, r.x)}`); fillParams(); } }, '应用这个值'),
    );
  }
  const gsSheet = h('div', { class: 'sheet' },
    h('h3', {}, '反向求解', h('small', {}, '想让某个指标达到目标，只调一个参数，需要调到多少？')),
    h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' } },
      h('span', {}, '让'), gsTarget, h('span', {}, '等于'), gsGoal, gsUnit, h('span', {}, '，只调'), gsParam,
      h('button', { class: 'btn primary', onclick: solve }, '求解'),
    ),
    gsOut,
    h('p', { class: 'hint' }, '参数列表按对目标的影响大小排序，只列上游参数。求解在参数滑杆的允许区间内进行；达不到时会告诉你目标的可达范围。'),
  );
  const mat = h('div', { class: 'tbl-wrap' });
  const matSheet = h('div', { class: 'sheet' },
    h('h3', {}, '影响矩阵：谁影响谁', h('small', {}, '每一行把一个旋钮拨动一步（比率 +1 个百分点，金额 +10%），每一格是结果的变化。“·”表示两者之间没有任何公式路径；“0”表示有路径但效果正好抵消。颜色越深影响越大（按列比较）')),
    mat,
  );
  function renderMatrix() {
    const g = app.sim.graph;
    const rows = influenceMatrix(g, app.sim.inputs);
    const colMax = MATRIX_COLS.map((_, j) => Math.max(...rows.map((r) => Math.abs(r.cells[j] ?? 0)), 1e-12));
    const short = (spec, d) => {
      const k = dispKind(spec);
      const sg = d >= 0 ? '+' : '−';
      const a = Math.abs(d);
      if (k === 'pct') return `${sg}${(a * 100).toFixed(2)}`;
      if (k === 'wanyi') return `${sg}${(a / 1e4).toFixed(2)}`;
      if (k === 'wy') return `${sg}${a.toFixed(2)}`;
      return `${sg}${Math.round(a).toLocaleString('en-US')}`;
    };
    const unitOf = (spec) => ({ pct: 'pp', wanyi: '万亿', wy: '万亿', yi: '亿' }[dispKind(spec)] ?? '');
    mat.innerHTML = `<table class="tbl mat"><thead><tr><th>旋钮（拨动一步）</th>${MATRIX_COLS.map(([c, t]) => `<th class="n" data-node="${c}" style="cursor:pointer">${esc(t)}<div class="hint" style="font-weight:400">${esc(app.sim.has(c) ? unitOf(app.sim.spec(c)) : '')}</div></th>`).join('')}</tr></thead><tbody>
      ${rows.filter((r) => !r.skipped).map((r) => {
        const sp = g.specs.get(r.id);
        return `<tr><th data-node="${r.id}" style="cursor:pointer;text-align:left;font-weight:500">${esc(sp.label)}<div class="hint" style="font-weight:400">${esc(stepText(sp, r.step).replace('±', '+'))}</div></th>${r.cells.map((d, j) => {
          if (d == null) return '<td class="n mat-0">·</td>';
          const cspec = app.sim.spec(MATRIX_COLS[j][0]);
          const t = Math.min(1, Math.abs(d) / colMax[j]);
          const small = Math.abs(d) < 1e-9 * Math.max(1, Math.abs(app.v[MATRIX_COLS[j][0]]));
          const bg = small ? 'transparent' : `color-mix(in srgb, var(${d > 0 ? '--up' : '--down'}) ${Math.round(8 + t * 45)}%, var(--surface))`;
          return `<td class="n" data-node="${MATRIX_COLS[j][0]}" style="cursor:pointer;background:${bg}">${small ? '0' : esc(short(cspec, d))}</td>`;
        }).join('')}</tr>`;
      }).join('')}</tbody></table>`;
  }
  const el = h('div', { style: { display: 'grid', gap: '16px' } },
    matSheet,
    gsSheet,
    h('div', { class: 'sheet' },
      h('h3', {}, '谁对这个指标影响最大', h('small', {}, '在当前参数和规则下，把每个参数单独上下拨动一步，其余不动')),
      h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' } }, h('b', {}, '目标：'), sel, modeSeg),
      info,
      chart,
      h('div', { class: 'legend' },
        h('span', {}, h('i', { style: { background: 'var(--up)' } }), '参数调高时目标的变化'),
        h('span', {}, h('i', { style: { background: 'var(--down)' } }), '参数调低时目标的变化'),
      ),
      h('p', { class: 'hint' }, '只列出目标的上游参数——不在上游的参数无论怎么调都不会影响它。点击任一行打开该参数的卡片。换平衡规则后排序会变：规则决定了冲击沿哪条路传播。'),
    ),
  );

  let gsInit = false;
  function update() {
    if (!gsInit) { fillParams(); gsInit = true; }
    renderMatrix();
    for (const b of modeSeg.children) b.setAttribute('aria-pressed', String(b.dataset.m === mode));
    if (!app.sim.has(target)) target = 'p_d_2035';
    const g = app.sim.graph;
    const tspec = g.specs.get(target);
    const r = tornado(g, app.sim.inputs, target, { mode, limit: 22 });
    info.innerHTML = `当前值 <b>${esc(fmt(tspec, r.now))}</b>。它的上游共有 ${r.total} 个可调参数，下面按影响大小列出前 ${r.rows.length} 个。`;
    const max = Math.max(...r.rows.flatMap((x) => [Math.abs(x.up), Math.abs(x.down)]), 1e-12);
    const pctTarget = dispKind(tspec) === 'pct';
    const dtext = (d) => (pctTarget ? `${d >= 0 ? '+' : '−'}${Math.abs(d * 100).toFixed(2)}pp` : fmtDelta(tspec, d, { unit: false }));
    const bar = (d, cls) => {
      const w = (Math.abs(d) / max) * 50;
      return `<span class="${cls}" style="left:${d >= 0 ? 50 : 50 - w}%;width:${Math.max(w, 0.3).toFixed(2)}%"></span>`;
    };
    chart.innerHTML = r.rows.length
      ? `<div class="tor" role="list">${r.rows.map((row) => {
        const spec = g.specs.get(row.id);
        return `<div class="tor-row" role="listitem" data-node="${row.id}" tabindex="0">
          <div class="tor-l"><b>${esc(spec.label)}</b><small>${esc(MODULES[spec.mod].short)} · ${esc(stepText(spec, row.step))}</small></div>
          <div class="tor-bar">${bar(row.up, 'b-up')}${bar(row.down, 'b-down')}<i></i></div>
          <div class="tor-v"><span class="up">${esc(dtext(row.up))}</span><span class="down">${esc(dtext(row.down))}</span></div>
        </div>`;
      }).join('')}</div>`
      : '<div class="empty">这个指标在当前规则下没有可调的上游参数。</div>';
  }

  return {
    id: 'sens',
    title: '影响与敏感度',
    heading: '影响矩阵、敏感度与反向求解：谁影响谁、影响多大、要拧多少',
    lead: '选一个你关心的指标，模拟器会把它上游的每个参数分别拨高、拨低一步，重新计算整张依赖图，按影响大小排队。这是回答"调哪几项会带来多大变化"最系统的办法。',
    mods: [],
    el,
    update,
    hideChanges: true,
  };
}
