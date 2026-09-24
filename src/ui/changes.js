// 传导链：列出所有相对基线发生变化的数字（按依赖顺序），并可切换为"传导路径图"。
import { h, esc } from './dom.js';
import { fmt, fmtDelta, symLineText } from '../model/format.js';
import { MODULES } from '../model/specs.js';
import { activeWarnings } from './warnings.js';
import { deltaParts } from './common.js';

const FILTERS = [
  { key: 'core', label: '全部（不含推演）', test: (s) => s.mod !== 'proj' },
  { key: 'y25', label: '2025', test: (s) => s.mod === 'y25' },
  { key: 'b26', label: '2026', test: (s) => s.mod === 'b26' },
  { key: 'debt', label: '债务', test: (s) => s.mod === 'debt' },
  { key: 'fb', label: '四本账', test: (s) => s.mod === 'fb' },
  { key: 'proj', label: '推演', test: (s) => s.mod === 'proj' },
];

export function createChanges(app) {
  let filter = 'core';
  let view = 'list';
  const warnBox = h('div', { class: 'warns' });
  const sum = h('span', { class: 'sum' });
  const chips = h('div', { class: 'presets', style: { padding: '0', border: '0' } });
  const viewBtns = h('div', { class: 'seg', style: { flex: '0 0 auto' } });
  const body = h('div');
  const el = h('section', { class: 'changes sheet', id: 'changes', 'aria-label': '传导链' },
    h('div', { class: 'changes-head' },
      h('h3', {}, '传导链'),
      sum,
      h('span', { class: 'grow' }),
      viewBtns,
    ),
    warnBox,
    chips,
    h('div', { style: { height: '8px' } }),
    body,
  );
  const setView = (v) => { view = v; update(); };
  for (const [k, t] of [['list', '列表'], ['dag', '路径图']]) {
    viewBtns.append(h('button', { type: 'button', 'data-v': k, onclick: () => setView(k) }, t));
  }

  function update() {
    const sim = app.sim;
    const ids = sim.changedIds();
    const inputs = new Set(sim.changedInputs());
    const nProj = ids.filter((id) => sim.spec(id).mod === 'proj').length;
    sum.textContent = inputs.size
      ? `你改了 ${inputs.size} 个参数 → ${ids.length - inputs.size} 个数字随之变化${nProj ? `（其中十年推演 ${nProj} 个）` : ''}`
      : '还没有改动。拖动任意滑杆，这里会按依赖顺序列出每一个被牵动的数字和它的公式。';
    for (const b of viewBtns.children) b.setAttribute('aria-pressed', String(b.dataset.v === view));

    warnBox.innerHTML = '';
    for (const w of activeWarnings(app)) {
      warnBox.append(h('div', { class: `warn-item ${w.level === 'info' ? 'info' : ''}`, onclick: () => app.openCard(w.id), style: { cursor: 'pointer' } }, w.msg));
    }

    chips.innerHTML = '';
    for (const f of FILTERS) {
      const n = ids.filter((id) => f.test(sim.spec(id))).length;
      chips.append(h('button', { class: `chip ${f.key === filter ? 'on' : ''}`, onclick: () => { filter = f.key; update(); } }, `${f.label} ${n}`));
    }
    const F = FILTERS.find((x) => x.key === filter);
    const shown = ids.filter((id) => F.test(sim.spec(id)));
    body.innerHTML = '';
    if (!inputs.size) {
      body.append(h('div', { class: 'empty' }, '试试：在上方面板把"国内增值税"调低 10%，或点下面的情景按钮。'));
      return;
    }
    if (!shown.length) {
      body.append(h('div', { class: 'empty' }, '这一类里没有变化。'));
      return;
    }
    if (view === 'list') body.append(list(shown, inputs));
    else body.append(dag(shown, inputs));
  }

  function list(ids, inputs) {
    const sim = app.sim;
    const box = h('div', { class: 'chg-list', role: 'list' });
    for (const id of ids) {
      const s = sim.spec(id);
      const dp = deltaParts(app, id);
      const fx = s.expr != null ? symLineText(sim.graph, id) : inputs.has(id) ? '你调整的参数' : '参数';
      box.append(h('div', { class: `chg ${s.expr == null ? 'input' : ''}`, role: 'listitem', onclick: () => app.openCard(id), onmouseenter: () => app.highlight(id), onmouseleave: () => app.highlight(null) },
        h('span', { class: 'mod' }, s.expr == null ? '输入' : MODULES[s.mod].short),
        h('div', {}, h('div', { class: 'nm' }, s.label), h('div', { class: 'fx' }, fx)),
        h('div', { class: 'vals num' }, `${fmt(s, app.b[id])} → ${fmt(s, app.v[id])}`),
        h('div', { class: `dv num ${dp?.up ? 'up' : 'down'}` }, fmtDelta(s, app.v[id] - app.b[id])),
      ));
    }
    return box;
  }

  function dag(ids, inputs) {
    const sim = app.sim;
    const set = new Set(ids);
    const MAX = 120;
    const use = ids.slice(0, MAX);
    const useSet = new Set(use);
    const layer = new Map();
    for (const id of use) {
      const deps = sim.spec(id).deps.filter((d) => useSet.has(d));
      layer.set(id, deps.length ? Math.max(...deps.map((d) => layer.get(d) + 1)) : 0);
    }
    const nL = Math.max(...layer.values()) + 1;
    const cols = Array.from({ length: nL }, () => []);
    for (const id of use) cols[layer.get(id)].push(id);
    const W = 168, Hh = 44, GX = 54, GY = 10;
    const pos = new Map();
    cols.forEach((col, i) => {
      if (i > 0) {
        // 按父节点平均位置排序，减少交叉
        const bary = (id) => {
          const ps = sim.spec(id).deps.filter((d) => pos.has(d));
          return ps.length ? ps.reduce((a, d) => a + pos.get(d).y, 0) / ps.length : 0;
        };
        col.sort((a, b) => bary(a) - bary(b));
      }
      col.forEach((id, j) => pos.set(id, { x: i * (W + GX), y: j * (Hh + GY) }));
    });
    const width = nL * (W + GX) - GX + 4;
    const height = Math.max(...cols.map((c) => c.length)) * (Hh + GY) + 4;
    let edges = '';
    for (const id of use) {
      const p = pos.get(id);
      for (const d of sim.spec(id).deps) {
        if (!pos.has(d)) continue;
        const q = pos.get(d);
        const x0 = q.x + W, y0 = q.y + Hh / 2, x1 = p.x, y1 = p.y + Hh / 2, xm = (x0 + x1) / 2;
        edges += `<path d="M${x0},${y0}C${xm},${y0} ${xm},${y1} ${x1},${y1}" fill="none" class="stroke-muted" stroke-width="1" opacity="0.55"/>`;
      }
    }
    let nodes = '';
    for (const id of use) {
      const s = sim.spec(id);
      const p = pos.get(id);
      const dp = deltaParts(app, id);
      const isIn = inputs.has(id);
      const name = s.label.length > 11 ? s.label.slice(0, 11) + '…' : s.label;
      nodes += `<g data-node="${id}" transform="translate(${p.x},${p.y})">
        <rect class="box ${isIn ? 'fill-ink' : 'fill-surface'}" width="${W}" height="${Hh}" rx="5" stroke-width="1" style="stroke:var(--rule-strong)"/>
        <text x="8" y="17" class="t-name" style="${isIn ? 'fill:var(--paper)' : ''}">${esc(name)}</text>
        <text x="8" y="34" class="${dp?.up ? 't-up' : 't-down'}">${esc(dp ? dp.text : '')}</text>
      </g>`;
    }
    const svg = `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="min-width:${Math.min(width, 900)}px" role="img" aria-label="传导路径图">${edges}${nodes}</svg>`;
    const wrap = h('div', { class: 'chart', style: { maxHeight: '560px', overflow: 'auto' } });
    wrap.innerHTML = svg;
    const note = ids.length > MAX ? h('div', { class: 'hint' }, `只显示前 ${MAX} 个（共 ${ids.length} 个）。可用上面的分类筛选。`) : null;
    return h('div', {}, h('div', { class: 'hint', style: { marginBottom: '6px' } }, '从左到右是传导顺序：黑色是你调整的参数，每条线表示"右边的数字用到了左边的数字"。点任一方块看公式。'), wrap, note);
  }

  update();
  return { el, update };
}
