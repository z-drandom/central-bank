// 双参数相图：两个旋钮一起拧，目标指标在整个平面上怎么变。
// 颜色 = 与当前值的差（红高绿低）；细线 = 等值线；粗实线 = 与当前相同的组合；金色虚线 = 参考线。
import { h, esc } from './dom.js';
import { fmt, fmtDelta, fmtExact, dispKind } from '../model/format.js';
import { PHASE_PRESETS, REF_LEVEL, phaseGrid, contour, niceLevels, fitRange, defaultRange } from '../model/phase.js';
import { tornado, TARGETS } from '../model/sensitivity.js';
import { MODE_OPTIONS } from '../model/specs.js';

const N = 31;
const LEVELS = 10;
const PHASE_TARGETS = [...TARGETS, ['r26', '全国一般公共预算收入']];

/** 坐标轴刻度：比率显示为百分数，金额按原单位 */
function tick(spec, v) {
  const k = dispKind(spec);
  const trim = (s) => s.replace(/\.?0+$/, '');
  if (k === 'pct') return `${trim((v * 100).toFixed(2))}%`;
  if (k === 'wanyi') return trim((v / 1e4).toFixed(2));
  if (k === 'yi') return Math.round(v).toLocaleString('en-US');
  return trim(v.toFixed(2));
}
const unitOf = (spec) => ({ pct: '', wanyi: '万亿元', wy: '万亿元', yi: '亿元', num: '' }[dispKind(spec)] ?? '');

export function createPhase(app) {
  let preset = PHASE_PRESETS[0].id;
  const custom = { target: 'p_d_2035', x: 'pg', y: 'pdr' };
  let last = null;
  let cursor = null;
  let lastW = 0;

  const chips = h('div', { class: 'presets ph-chips', style: { padding: '0', border: '0' } });
  for (const p of PHASE_PRESETS) {
    chips.append(h('button', { class: 'chip', type: 'button', 'data-p': p.id, onclick: () => { preset = p.id; cursor = null; update(); } }, p.title));
  }
  const selT = h('select', { class: 'btn', id: 'ph-target', 'aria-label': '相图目标指标' });
  for (const [id, t] of PHASE_TARGETS) selT.append(h('option', { value: id }, t));
  const selX = h('select', { class: 'btn', id: 'ph-x', 'aria-label': '横轴参数', style: { maxWidth: '100%' } });
  const selY = h('select', { class: 'btn', id: 'ph-y', 'aria-label': '纵轴参数', style: { maxWidth: '100%' } });
  const toCustom = () => { preset = null; custom.target = selT.value; custom.x = selX.value; custom.y = selY.value; cursor = null; update(); };
  selT.addEventListener('change', () => { preset = null; custom.target = selT.value; custom.x = null; custom.y = null; cursor = null; update(); });
  selX.addEventListener('change', toCustom);
  selY.addEventListener('change', toCustom);
  const ruleNote = h('p', { class: 'hint', style: { margin: '6px 0 0' } });
  const readout = h('div', { class: 'ph-read', role: 'status', 'aria-live': 'polite' });
  const plot = h('div', { class: 'ph-plot' });
  const why = h('p', { class: 'note', style: { margin: '10px 0 0' } });
  const math = h('div', { class: 'ph-math' });
  const table = h('div', { class: 'tbl-wrap' });
  const refLegend = h('span', {}, h('i', { class: 'lg-line', style: { background: 'var(--gold)' } }), '参考线');
  const el = h('div', { class: 'sheet', id: 'phase' },
    h('h3', {}, '双参数相图：两个旋钮一起拧', h('small', {}, '横纵两个参数在区间内各取 31 个值，每一格都重算一遍依赖图。选一张预设图，或自己挑目标和两个参数')),
    chips,
    h('div', { class: 'ph-pick' },
      h('label', {}, '目标 ', selT), h('label', {}, '横轴 ', selX), h('label', {}, '纵轴 ', selY),
    ),
    ruleNote,
    h('div', { class: 'ph-body' },
      h('div', { class: 'ph-left' },
        readout,
        plot,
        h('div', { class: 'legend' },
          h('span', {}, h('i', { style: { background: 'var(--up)' } }), '比当前高'),
          h('span', {}, h('i', { style: { background: 'var(--down)' } }), '比当前低（颜色越深差得越多）'),
          h('span', {}, h('i', { class: 'lg-line', style: { background: 'var(--ink)' } }), '与当前相同的组合'),
          refLegend,
          h('span', {}, h('i', { class: 'lg-dot' }), '当前位置'),
        ),
      ),
      h('div', { class: 'ph-right' }, why, math),
    ),
    h('details', { class: 'ph-table' }, h('summary', {}, '数值表（每隔 5 格取一个值）'), table),
    h('p', { class: 'hint' }, '悬停或用方向键移动看每一格的数值；点击（或按回车）把两个参数设为这一格的值，可撤销。其余参数保持当前值不变。'),
  );

  /** 当前要画的配置：预设（可能带自己的平衡规则）或自选 */
  function context() {
    const p = PHASE_PRESETS.find((q) => q.id === preset) ?? null;
    const modes = p?.modes ?? {};
    const differs = Object.entries(modes).some(([k, v]) => app.sim.modes[k] !== v);
    let sim = app.sim;
    if (differs) { sim = app.sim.clone(); sim.setModes(modes); }
    const g = sim.graph;
    let { target, x, y } = p ?? custom;
    if (!g.specs.has(target)) target = 'p_d_2035';
    const up = new Set(g.upstream(target));
    const ok = (id) => id && g.isInput(id) && !g.specs.get(id).fixed && up.has(id);
    let ranked = null;
    const rank = () => (ranked ??= tornado(g, sim.inputs, target, { limit: 40 }).rows.map((r) => r.id));
    if (!ok(x)) x = rank().find((id) => id !== y);
    if (!ok(y) || y === x) y = rank().find((id) => id !== x);
    if (!x || !y) return { sim, target, bad: true, p, modes, differs };
    const xs = g.specs.get(x);
    const ys = g.specs.get(y);
    const xr = p ? fitRange(xs, p.xr, sim.inputs[x]) : defaultRange(xs, sim.inputs[x]);
    const yr = p ? fitRange(ys, p.yr, sim.inputs[y]) : defaultRange(ys, sim.inputs[y]);
    if (!p) Object.assign(custom, { target, x, y });
    return { p, sim, modes, differs, target, x, y, xr, yr, options: rank() };
  }

  function fillSelects(ctx) {
    selT.value = ctx.target;
    const g = ctx.sim.graph;
    const opts = ctx.options ?? tornado(g, ctx.sim.inputs, ctx.target, { limit: 40 }).rows.map((r) => r.id);
    const list = [...new Set([ctx.x, ctx.y, ...opts])].filter(Boolean);
    for (const [sel, v] of [[selX, ctx.x], [selY, ctx.y]]) {
      sel.innerHTML = '';
      for (const id of list) sel.append(h('option', { value: id }, g.specs.get(id).label));
      sel.value = v;
    }
  }

  function ruleText(modes) {
    return Object.entries(modes).map(([k, v]) => `${MODE_OPTIONS[k]?.label ?? k}：${MODE_OPTIONS[k]?.options?.[v]?.label ?? v}`).join('；');
  }

  function update() {
    for (const b of chips.children) b.classList.toggle('on', b.dataset.p === preset);
    const ctx = context();
    fillSelects(ctx);
    if (ctx.bad) {
      last = null;
      plot.innerHTML = '<div class="empty">这个指标在当前规则下可调的上游参数不足两个。</div>';
      readout.textContent = '';
      math.innerHTML = '';
      why.textContent = '';
      table.innerHTML = '';
      ruleNote.textContent = '';
      return;
    }
    const r = phaseGrid(ctx.sim.graph, ctx.sim.inputs, { x: ctx.x, y: ctx.y, target: ctx.target, xr: ctx.xr, yr: ctx.yr, n: N });
    last = { ctx, r };
    ruleNote.innerHTML = ctx.differs
      ? `这张图在「${esc(ruleText(ctx.modes))}」规则下计算（与你当前的规则不同，你的状态不受影响）。点格子应用时会一并切换规则。`
      : ctx.p?.modes ? `平衡规则：${esc(ruleText(ctx.modes))}（与当前一致）。` : '按你当前的平衡规则计算。';
    why.textContent = ctx.p?.why ?? '自选组合：看等值线的形状——等距平行直线说明两个参数的效果可以直接相加；弯曲或疏密不均说明存在交互作用或非线性。';
    draw();
    renderMath();
    renderTable();
    showReadout();
  }

  function geom() {
    const W = Math.round(Math.max(300, Math.min(720, plot.clientWidth || 640)));
    const narrow = W < 480;
    const H = Math.round(W * (narrow ? 0.86 : 0.6));
    const m = { l: narrow ? 46 : 64, r: 12, t: 22, b: 40 };
    return { W, H, m, pw: W - m.l - m.r, ph: H - m.t - m.b };
  }

  function draw() {
    const { ctx, r } = last;
    const G = geom();
    lastW = G.W;
    const { m, pw, ph } = G;
    const n = r.xs.length;
    const cw = pw / n;
    const chh = ph / n;
    const px = (fi) => m.l + (fi + 0.5) * cw;
    const py = (fj) => m.t + (n - 1 - fj + 0.5) * chh;
    const g = ctx.sim.graph;
    const xs = g.specs.get(ctx.x);
    const ys = g.specs.get(ctx.y);
    const ts = g.specs.get(ctx.target);
    const maxAbs = Math.max(...r.z.flat().filter(Number.isFinite).map((v) => Math.abs(v - r.now)), 1e-300);
    let cells = '';
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const v = r.z[j][i];
        let cls = 'phc-nan';
        if (Number.isFinite(v)) {
          const d = v - r.now;
          const k = Math.round((Math.abs(d) / maxAbs) * LEVELS);
          cls = k === 0 ? 'phc-0' : `phc-${d > 0 ? 'u' : 'd'}${k}`;
        }
        cells += `<rect class="${cls}" x="${(m.l + i * cw).toFixed(2)}" y="${(m.t + (n - 1 - j) * chh).toFixed(2)}" width="${(cw + 0.4).toFixed(2)}" height="${(chh + 0.4).toFixed(2)}"/>`;
      }
    }
    const pathOf = (segs) => segs.map(([a, b, c, d]) => `M${px(a).toFixed(1)} ${py(b).toFixed(1)}L${px(c).toFixed(1)} ${py(d).toFixed(1)}`).join('');
    const labelAt = (segs, text, cls) => {
      if (!segs.length) return '';
      // 放在最靠右的线段中点，避开右边界
      let best = segs[0];
      for (const s of segs) if (Math.max(s[0], s[2]) + 0.01 * Math.max(s[1], s[3]) > Math.max(best[0], best[2]) + 0.01 * Math.max(best[1], best[3])) best = s;
      const lx = Math.min(px((best[0] + best[2]) / 2), m.l + pw - 4);
      const ly = Math.max(m.t + 13, py((best[1] + best[3]) / 2));
      return `<text class="${cls}" x="${lx.toFixed(1)}" y="${(ly - 3).toFixed(1)}" text-anchor="end">${esc(text)}</text>`;
    };
    let iso = '';
    let isoLab = '';
    for (const L of niceLevels(r.min, r.max, 8)) {
      const segs = contour(r.z, L);
      iso += `<path class="ph-iso" d="${pathOf(segs)}"/>`;
      isoLab += labelAt(segs, tick(ts, L), 'ph-lab');
    }
    const refLevel = ctx.p?.level ?? REF_LEVEL[ctx.target];
    let ref = '';
    const showRef = refLevel != null && refLevel > r.min && refLevel < r.max;
    refLegend.hidden = !showRef;
    refLegend.lastChild.textContent = showRef ? `参考线 ${tick(ts, refLevel)}` : '参考线';
    if (showRef) {
      const segs = contour(r.z, refLevel);
      ref = `<path class="ph-ref" d="${pathOf(segs)}"/>${labelAt(segs, `参考 ${tick(ts, refLevel)}`, 'ph-lab ph-lab-ref')}`;
    }
    const nowSegs = contour(r.z, r.now);
    const nowPath = `<path class="ph-now" d="${pathOf(nowSegs)}"/>`;
    const fiOf = (v, [a, b]) => (b === a ? 0 : ((v - a) / (b - a)) * (n - 1));
    const dot = `<circle class="ph-dot" cx="${px(fiOf(r.x0, ctx.xr)).toFixed(1)}" cy="${py(fiOf(r.y0, ctx.yr)).toFixed(1)}" r="5.5"/>`;
    // 坐标轴
    let axes = `<line x1="${m.l}" y1="${m.t + ph}" x2="${m.l + pw}" y2="${m.t + ph}"/><line x1="${m.l}" y1="${m.t}" x2="${m.l}" y2="${m.t + ph}"/>`;
    for (const v of niceLevels(ctx.xr[0], ctx.xr[1], G.W < 480 ? 3 : 5, { inclusive: true })) {
      const X = px(fiOf(v, ctx.xr));
      axes += `<line x1="${X.toFixed(1)}" y1="${m.t + ph}" x2="${X.toFixed(1)}" y2="${m.t + ph + 4}"/><text x="${X.toFixed(1)}" y="${m.t + ph + 16}" text-anchor="middle">${esc(tick(xs, v))}</text>`;
    }
    for (const v of niceLevels(ctx.yr[0], ctx.yr[1], 5, { inclusive: true })) {
      const Y = py(fiOf(v, ctx.yr));
      axes += `<line x1="${m.l - 4}" y1="${Y.toFixed(1)}" x2="${m.l}" y2="${Y.toFixed(1)}"/><text x="${m.l - 6}" y="${(Y + 4).toFixed(1)}" text-anchor="end">${esc(tick(ys, v))}</text>`;
    }
    const xt = `横轴 → ${xs.label}${unitOf(xs) ? `（${unitOf(xs)}）` : ''}`;
    const yt = `↑ 纵轴：${ys.label}${unitOf(ys) ? `（${unitOf(ys)}）` : ''}`;
    const titles = `<text class="ph-title" x="${m.l + pw}" y="${G.H - 6}" text-anchor="end">${esc(xt)}</text><text class="ph-title" x="${m.l}" y="${m.t - 8}">${esc(yt)}</text>`;
    const aria = `${ts.label}随${xs.label}和${ys.label}变化的相图，方向键移动，回车应用`;
    plot.innerHTML = `<svg viewBox="0 0 ${G.W} ${G.H}" width="${G.W}" height="${G.H}" tabindex="0" role="application" aria-label="${esc(aria)}">
      <g>${cells}</g>${iso}${ref}${nowPath}<g class="ph-axis">${axes}</g>${isoLab}${titles}${dot}<rect class="ph-cur" visibility="hidden" width="${cw.toFixed(2)}" height="${chh.toFixed(2)}"/></svg>`;
    const svg = plot.firstElementChild;
    const curRect = svg.querySelector('.ph-cur');
    const cellAt = (ev) => {
      const b = svg.getBoundingClientRect();
      const sx = ((ev.clientX - b.left) / b.width) * G.W;
      const sy = ((ev.clientY - b.top) / b.height) * G.H;
      const i = Math.floor((sx - m.l) / cw);
      const jj = Math.floor((sy - m.t) / chh);
      if (i < 0 || i >= n || jj < 0 || jj >= n) return null;
      return [i, n - 1 - jj];
    };
    const setCursor = (c) => {
      cursor = c;
      if (!c) { curRect.setAttribute('visibility', 'hidden'); showReadout(); return; }
      curRect.setAttribute('x', (m.l + c[0] * cw).toFixed(2));
      curRect.setAttribute('y', (m.t + (n - 1 - c[1]) * chh).toFixed(2));
      curRect.setAttribute('visibility', 'visible');
      showReadout();
    };
    svg.addEventListener('pointermove', (ev) => setCursor(cellAt(ev)));
    svg.addEventListener('pointerleave', () => { if (document.activeElement !== svg) setCursor(null); });
    svg.addEventListener('click', (ev) => { const c = cellAt(ev); if (c) applyCell(c); });
    svg.addEventListener('focus', () => {
      if (!cursor) setCursor([Math.round(fiOf(r.x0, ctx.xr)), Math.round(fiOf(r.y0, ctx.yr))].map((v) => Math.max(0, Math.min(n - 1, v))));
    });
    svg.addEventListener('blur', () => setCursor(null));
    svg.addEventListener('keydown', (ev) => {
      if (!cursor) return;
      const mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[ev.key];
      if (mv) {
        ev.preventDefault();
        const step = ev.shiftKey ? 5 : 1;
        setCursor([Math.max(0, Math.min(n - 1, cursor[0] + mv[0] * step)), Math.max(0, Math.min(n - 1, cursor[1] + mv[1] * step))]);
      } else if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        applyCell(cursor);
      }
    });
    if (cursor) setCursor(cursor);
  }

  function showReadout() {
    if (!last) return;
    const { ctx, r } = last;
    const g = ctx.sim.graph;
    const xs = g.specs.get(ctx.x);
    const ys = g.specs.get(ctx.y);
    const ts = g.specs.get(ctx.target);
    if (!cursor) {
      readout.innerHTML = `圆点是当前位置：${esc(xs.label)} <b>${esc(fmt(xs, r.x0))}</b>，${esc(ys.label)} <b>${esc(fmt(ys, r.y0))}</b> → ${esc(ts.label)} <b>${esc(fmt(ts, r.now))}</b>。`;
      return;
    }
    const [i, j] = cursor;
    const v = r.z[j][i];
    readout.innerHTML = `${esc(xs.label)} <b>${esc(fmt(xs, r.xs[i]))}</b>，${esc(ys.label)} <b>${esc(fmt(ys, r.ys[j]))}</b> → ${esc(ts.label)} <b>${esc(fmt(ts, v))}</b>（比当前 <b class="${v >= r.now ? 'up' : 'down'}">${esc(fmtDelta(ts, v - r.now))}</b>）`;
  }

  function applyCell([i, j]) {
    if (!last) return;
    const { ctx, r } = last;
    const s = app.sim.clone();
    if (ctx.differs) s.setModes(ctx.modes);
    s.setMany({ [ctx.x]: r.xs[i], [ctx.y]: r.ys[j] });
    const xs = s.spec(ctx.x);
    const ys = s.spec(ctx.y);
    cursor = [i, j];
    app.restore(s.snapshot(), `已把${xs.label}设为 ${fmt(xs, r.xs[i])}，${ys.label}设为 ${fmt(ys, r.ys[j])}${ctx.differs ? '，并切换到本图的平衡规则' : ''}（可撤销）`);
  }

  function renderMath() {
    const { ctx, r } = last;
    const g = ctx.sim.graph;
    const xs = g.specs.get(ctx.x);
    const ys = g.specs.get(ctx.y);
    const ts = g.specs.get(ctx.target);
    // 代入式里用足够的有效数字，保证"各项代入后算得出右边"
    const lv = (v) => esc(fmtExact(ts, v, { sig: 6 }));
    const pv = (v) => (v < 0 ? `(${lv(v)})` : lv(v));
    const dv = (v) => esc(fmtExact(ts, v, { delta: true }));
    const stepX = esc(fmtExact(xs, r.local.sx, { delta: true }));
    const stepY = esc(fmtExact(ys, r.local.sy, { delta: true }));
    const A = r.trade.gx * r.local.sx;
    const B = r.trade.gy * r.local.sy;
    let trade;
    if (!Number.isFinite(r.trade.slope) || B === 0) {
      trade = `<p class="note">在当前点，${esc(ys.label)}对${esc(ts.label)}没有边际影响，无法用它抵消${esc(xs.label)}的变化。</p>`;
    } else {
      const need = r.trade.slope * r.local.sx;
      trade = `<div class="fx-table">
        <div class="k">公式</div><div class="v">Δy = −(∂f/∂x · Δx) ÷ (∂f/∂y · Δy₁) × Δy₁</div>
        <div class="k">读法</div><div class="v read">纵轴需要的变化 = −(横轴动一步的影响 ÷ 纵轴动一步的影响) × 纵轴一步</div>
        <div class="k">拟音</div><div class="v read">∂ 读"偏"（偏导数：只动一个参数时的变化率）</div>
        <div class="k">代入</div><div class="v subst">Δy = −(${dv(A)} ÷ ${dv(B)}) × ${stepY} = <b>${esc(fmtExact(ys, need, { delta: true }))}</b></div>
      </div>
      <p class="note" style="margin:6px 0 0">在圆点附近，${esc(xs.label)} ${stepX}，${esc(ys.label)}约需 <b>${esc(fmtExact(ys, need, { delta: true }))}</b>，${esc(ts.label)}才保持 ${esc(fmt(ts, r.now))} 不变。这是粗实线（与当前相同的等值线）在圆点处的切线斜率；等值线越弯，离圆点越远这个比率偏得越多。</p>`;
    }
    const c = r.corners;
    const x0 = esc(fmt(xs, ctx.xr[0]));
    const x1 = esc(fmt(xs, ctx.xr[1]));
    const y0 = esc(fmt(ys, ctx.yr[0]));
    const y1 = esc(fmt(ys, ctx.yr[1]));
    const additive = c.share < 1e-9;
    const inter = `<div class="fx-table">
        <div class="k">公式</div><div class="v">I = f(x₁, y₁) − f(x₁, y₀) − f(x₀, y₁) + f(x₀, y₀)</div>
        <div class="k">读法</div><div class="v read">交互项 = 两个都调到右上角 − 只调横轴 − 只调纵轴 + 左下角起点</div>
        <div class="k">代入</div><div class="v subst">I = ${lv(c.f11)} − ${pv(c.f10)} − ${pv(c.f01)} + ${pv(c.f00)} = <b>${additive ? '0' : dv(c.inter)}</b></div>
      </div>
      <p class="note" style="margin:6px 0 0">${additive
        ? '交互项为 0：两个旋钮的效果可以直接相加，等值线是平行直线。'
        : `若效果可以相加，右上角应为 ${lv(c.add)}，实际是 ${lv(c.f11)}；差额 ${dv(c.inter)} 就是两个旋钮"一起拧"额外产生的，占总变化的 <b>${(c.share * 100).toFixed(1)}%</b>。`}（x₀ = ${x0}，x₁ = ${x1}；y₀ = ${y0}，y₁ = ${y1}）</p>`;
    math.innerHTML = `<div><h4>取舍比率：沿粗实线走，结果不变</h4>${trade}</div><div><h4>交互项：能不能简单相加</h4>${inter}</div>`;
  }

  function renderTable() {
    const { ctx, r } = last;
    const g = ctx.sim.graph;
    const xs = g.specs.get(ctx.x);
    const ys = g.specs.get(ctx.y);
    const ts = g.specs.get(ctx.target);
    const idx = [0, 5, 10, 15, 20, 25, 30].filter((k) => k < r.xs.length);
    table.innerHTML = `<table class="tbl"><thead><tr><th>${esc(ys.label)} ＼ ${esc(xs.label)}</th>${idx.map((i) => `<th class="n">${esc(tick(xs, r.xs[i]))}</th>`).join('')}</tr></thead><tbody>
      ${[...idx].reverse().map((j) => `<tr><th>${esc(tick(ys, r.ys[j]))}</th>${idx.map((i) => `<td class="n">${esc(fmt(ts, r.z[j][i], { unit: false }))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }

  // 宽度变化时重画（手机旋转、侧栏收起）
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      if (!last || !plot.isConnected) return;
      const W = Math.round(Math.max(300, Math.min(720, plot.clientWidth || 640)));
      if (Math.abs(W - lastW) > 4) draw();
    }).observe(plot);
  }

  // 其他页面（测验、龙卷风图）可以直接打开某张预设图，或指定目标和两个参数
  const reveal = () => requestAnimationFrame(() => el.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
  app.showPhase = (id) => {
    if (!PHASE_PRESETS.some((p) => p.id === id)) return;
    preset = id;
    cursor = null;
    update();
    reveal();
  };
  app.showPhaseCustom = ({ target, x, y }) => {
    preset = null;
    Object.assign(custom, { target, x, y });
    cursor = null;
    update();
    reveal();
  };

  return { el, update, get state() { return last; } };
}
