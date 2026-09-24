// 敏感度（龙卷风图）：哪些参数对目标影响最大
import { h, esc } from '../dom.js';
import { tornado, TARGETS, stepText } from '../../model/sensitivity.js';
import { fmt, fmtDelta, dispKind } from '../../model/format.js';
import { MODULES } from '../../model/specs.js';
import { goalSeek } from '../../model/solve.js';
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
  const el = h('div', { style: { display: 'grid', gap: '16px' } },
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
    for (const b of modeSeg.children) b.setAttribute('aria-pressed', String(b.dataset.m === mode));
    if (!app.sim.has(target)) target = 'p_d_2035';
    const g = app.sim.graph;
    const tspec = g.specs.get(target);
    const r = tornado(g, app.sim.inputs, target, { mode, limit: 22 });
    info.innerHTML = `当前值 <b>${esc(fmt(tspec, r.now))}</b>。它的上游共有 ${r.total} 个可调参数，下面按影响大小列出前 ${r.rows.length} 个。`;
    const max = Math.max(...r.rows.flatMap((x) => [Math.abs(x.up), Math.abs(x.down)]), 1e-12);
    const W = 900, rowH = 30, left = 300, right = 150, mid = left + (W - left - right) / 2, half = (W - left - right) / 2;
    const H = r.rows.length * rowH + 30;
    const pctTarget = dispKind(tspec) === 'pct';
    const dtext = (d) => (pctTarget ? `${d >= 0 ? '+' : '−'}${Math.abs(d * 100).toFixed(2)}pp` : fmtDelta(tspec, d, { unit: false }));
    let s = `<line x1="${mid}" x2="${mid}" y1="0" y2="${H - 20}" class="stroke-muted"/>`;
    r.rows.forEach((row, i) => {
      const spec = g.specs.get(row.id);
      const y = i * rowH + 6;
      const bar = (d, cls) => {
        const w = (Math.abs(d) / max) * half;
        const x = d >= 0 ? mid : mid - w;
        return `<rect x="${x.toFixed(1)}" y="${y + 3}" width="${Math.max(w, 0.5).toFixed(1)}" height="${rowH - 12}" class="${cls}" rx="2"/>`;
      };
      s += `<g data-node="${row.id}" class="sens-row">
        <rect x="0" y="${y - 2}" width="${W}" height="${rowH}" fill="transparent"/>
        <text x="${left - 12}" y="${y + 13}" text-anchor="end" class="t-name" style="font-weight:500">${esc(spec.label.length > 18 ? spec.label.slice(0, 18) + '…' : spec.label)}</text>
        <text x="${left - 12}" y="${y + 25}" text-anchor="end" class="t-small">${esc(MODULES[spec.mod].short)} · ${esc(stepText(spec, row.step))}</text>
        ${bar(row.up, 'fill-up')}${bar(row.down, 'fill-down')}
        <text x="${W - right + 10}" y="${y + 13}" class="t-up">${esc(dtext(row.up))}</text>
        <text x="${W - right + 10}" y="${y + 26}" class="t-down">${esc(dtext(row.down))}</text>
      </g>`;
    });
    chart.innerHTML = r.rows.length
      ? `<svg viewBox="0 0 ${W} ${H}" role="group" aria-label="敏感度龙卷风图" style="max-width:980px">${s}</svg>`
      : '<div class="empty">这个指标在当前规则下没有可调的上游参数。</div>';
  }

  return {
    id: 'sens',
    title: '敏感度',
    heading: '敏感度与反向求解：哪个旋钮最有劲，要拧多少',
    lead: '选一个你关心的指标，模拟器会把它上游的每个参数分别拨高、拨低一步，重新计算整张依赖图，按影响大小排队。这是回答"调哪几项会带来多大变化"最系统的办法。',
    mods: [],
    el,
    update,
    hideChanges: true,
  };
}
