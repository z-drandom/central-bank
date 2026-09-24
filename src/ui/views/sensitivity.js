// 敏感度（龙卷风图）：哪些参数对目标影响最大
import { h, esc } from '../dom.js';
import { tornado, TARGETS, stepText } from '../../model/sensitivity.js';
import { fmt, fmtDelta, dispKind } from '../../model/format.js';
import { MODULES } from '../../model/specs.js';

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
  const el = h('div', {},
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

  function update() {
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
      ? `<svg viewBox="0 0 ${W} ${H}" role="group" aria-label="敏感度龙卷风图">${s}</svg>`
      : '<div class="empty">这个指标在当前规则下没有可调的上游参数。</div>';
  }

  return {
    id: 'sens',
    title: '敏感度',
    heading: '敏感度：哪个旋钮最有劲',
    lead: '选一个你关心的指标，模拟器会把它上游的每个参数分别拨高、拨低一步，重新计算整张依赖图，按影响大小排队。这是回答"调哪几项会带来多大变化"最系统的办法。',
    mods: [],
    el,
    update,
    hideChanges: true,
  };
}
