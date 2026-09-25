// 参数面板：平衡规则开关 + 分组滑杆。每个滑杆标出原图基线位置（金色刻度）。
import { LESSONS } from '../model/thin.js';
import { h } from './dom.js';
import { dispKind, fmt } from '../model/format.js';
import { MODE_OPTIONS } from '../model/specs.js';
import { changed } from '../engine/graph.js';

// 模型值 ↔ 显示值
export function toDisp(spec, v) {
  const k = dispKind(spec);
  if (k === 'wanyi') return v / 1e4;
  if (k === 'pct') return v * 100;
  return v;
}
export function fromDisp(spec, d) {
  const k = dispKind(spec);
  if (k === 'wanyi') return d * 1e4;
  if (k === 'pct') return d / 100;
  return d;
}
function dispUnit(spec) {
  return { yi: '亿', wanyi: '万亿', wy: '万亿', pct: '%', num: '' }[dispKind(spec)];
}
function dispDigits(spec) {
  const k = dispKind(spec);
  if (k === 'yi') return 0;
  if (k === 'pct') return 2;
  return 2;
}
function rangeOf(spec) {
  const [lo, hi, step] = spec.range ?? [0, Math.max(1, spec.base * 2), Math.max(spec.base / 200, 1e-4)];
  return { lo: toDisp(spec, lo), hi: toDisp(spec, hi), step: toDisp(spec, step) };
}

const THIN_LEVERS = new Set(LESSONS.map((L) => L.lever.id));

export function makeSlider(app, id, { compact = false, idPrefix = '' } = {}) {
  const spec = app.sim.spec(id);
  const r = rangeOf(spec);
  const baseD = toDisp(spec, spec.base);
  const wrap = h('div', { class: 'ctl', 'data-ctl': id });
  const star = THIN_LEVERS.has(id) ? h('span', { class: 'ctl-star', title: '"读薄"精选的三个旋钮之一' }, '★') : null;
  const name = h('span', { class: 'ctl-name', title: '点击查看公式与来源', onclick: () => app.openCard(id) }, star, spec.label);
  const box = h('input', { class: 'ctl-val', type: 'text', inputmode: 'decimal', id: `${idPrefix}in-${id}`, 'aria-label': spec.label });
  const reset = h('button', { class: 'ctl-reset', title: '恢复原图数值', 'aria-label': `恢复 ${spec.label}`, onclick: () => app.set(id, spec.base) }, '↺');
  const range = h('input', { type: 'range', min: r.lo, max: r.hi, step: r.step, id: `${idPrefix}rg-${id}`, 'aria-label': spec.label });
  const tickPos = Math.min(1, Math.max(0, (baseD - r.lo) / (r.hi - r.lo || 1)));
  const tick = h('span', { class: 'tick', title: `原图/基线：${fmt(spec, spec.base)}`, style: { left: `calc(7px + (100% - 14px) * ${tickPos})` } });
  range.addEventListener('input', () => app.set(id, fromDisp(spec, parseFloat(range.value))));
  const commit = () => {
    const d = parseFloat(box.value.replace(/,/g, ''));
    if (Number.isFinite(d)) app.set(id, fromDisp(spec, d));
    else sync();
  };
  box.addEventListener('change', commit);
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { commit(); box.blur(); }
  });
  wrap.append(
    h('div', { class: 'ctl-top' }, name, reset, box, h('span', { class: 'ctl-unit' }, dispUnit(spec))),
    h('div', { class: 'ctl-slider' }, tick, range),
  );
  if (!compact && spec.src) wrap.append(h('div', { class: 'ctl-sub' }, spec.src));
  function sync() {
    const v = app.v[id];
    const d = toDisp(spec, v);
    if (document.activeElement !== box) {
      const dg = dispDigits(spec);
      box.value = dispKind(spec) === 'yi' ? Math.round(d).toLocaleString('en-US') : d.toFixed(dg);
    }
    if (document.activeElement !== range) range.value = String(d);
    wrap.classList.toggle('dirty', changed(v, spec.base));
  }
  sync();
  return { el: wrap, sync };
}

/** 当前规则下是余项（公式）的参数：只读显示 */
function makeAuto(app, id) {
  const spec = app.sim.spec(id);
  const out = h('span', { class: 'ctl-val num' });
  const wrap = h('div', { class: 'ctl auto', 'data-ctl': id },
    h('div', { class: 'ctl-top' },
      h('span', { class: 'ctl-name', onclick: () => app.openCard(id), title: '点击查看公式' }, spec.label),
      h('span', { class: 'auto-tag', title: '当前平衡规则下由公式自动算出' }, '自动'),
      out,
      h('span', { class: 'ctl-unit' }, dispUnit(spec)),
    ),
  );
  const sync = () => {
    const d = toDisp(spec, app.v[id]);
    out.textContent = dispKind(spec) === 'yi' ? Math.round(d).toLocaleString('en-US') : d.toFixed(2);
    wrap.classList.toggle('dirty', changed(app.v[id], app.b[id]));
  };
  sync();
  return { el: wrap, sync };
}

function makeMode(app, key) {
  const def = MODE_OPTIONS[key];
  const cur = app.sim.modes[key];
  const desc = h('div', { class: 'mode-desc' }, def.options[cur].desc);
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': def.label });
  for (const [k, o] of Object.entries(def.options)) {
    seg.append(h('button', { type: 'button', 'aria-pressed': String(k === cur), title: o.desc, onclick: () => app.setMode(key, k) }, o.label));
  }
  return h('div', { class: 'mode' }, h('div', { class: 'mode-label' }, def.label), seg, desc);
}

/**
 * config: { title, presets: [{label, changes, modes, note}], items: [{mode}|{title, ids, open}] }
 */
export function createPanel(app, config) {
  const el = h('aside', { class: 'panel', 'aria-label': '参数面板' });
  let ctls = [];
  let searchCtls = [];
  const openState = new Map();

  function build() {
    el.innerHTML = '';
    ctls = [];
    el.append(
      h('div', { class: 'panel-head' },
        h('h3', {}, config.title ?? '调参数'),
        h('button', { class: 'btn ghost', onclick: () => app.resetTab(config) }, '本页复原'),
      ),
    );
    // 参数搜索：在全部输入参数里找（不限本页）
    const q = h('input', { class: 'search', type: 'search', placeholder: '搜参数：如"契税""利率""专项债"', 'aria-label': '搜索参数', id: `ps-${config.title}` });
    const results = h('div', { class: 'grp-body', style: { paddingTop: '8px' } });
    q.addEventListener('input', () => {
      results.innerHTML = '';
      searchCtls = [];
      const t = q.value.trim().toLowerCase();
      if (!t) return;
      const hay = (n) => `${n.label} ${n.id} ${n.src ?? ''} ${n.kw ?? ''} ${n.note ?? ''}`.toLowerCase();
      const all = app.sim.graph.inputs().filter((n) => !n.fixed && hay(n).includes(t));
      // 名称命中的排前面
      all.sort((a, b) => Number(!a.label.toLowerCase().includes(t)) - Number(!b.label.toLowerCase().includes(t)));
      const hits = all.slice(0, 8);
      if (!hits.length) { results.append(h('div', { class: 'hint' }, '没有找到。当前平衡规则下是公式计算的量不能直接调，可以在"公式手册"里搜。')); return; }
      for (const n of hits) {
        const c = makeSlider(app, n.id, { idPrefix: 'ps-' });
        results.append(c.el);
        searchCtls.push(c);
      }
    });
    el.append(h('div', { style: { padding: '10px 14px 0' } }, q), results);
    if (config.presets?.length) {
      const box = h('div', { class: 'presets' });
      for (const p of config.presets) {
        box.append(h('button', { class: 'chip', title: p.note ?? '', onclick: () => app.applyPreset(p) }, p.label));
      }
      el.append(box);
    }
    for (const item of config.items) {
      if (item.mode) {
        if (item.when && !item.when(app.sim.modes)) continue;
        el.append(makeMode(app, item.mode));
        continue;
      }
      const ids = item.ids.filter((id) => app.sim.has(id));
      if (!ids.length) continue;
      const det = h('details', { class: 'grp' });
      const key = item.title;
      det.open = openState.has(key) ? openState.get(key) : !!item.open;
      det.addEventListener('toggle', () => openState.set(key, det.open));
      const cnt = h('span', { class: 'cnt' });
      det.append(h('summary', {}, item.title, cnt));
      const body = h('div', { class: 'grp-body' });
      const groupCtls = [];
      for (const id of ids) {
        const c = app.sim.isInput(id) ? makeSlider(app, id) : makeAuto(app, id);
        body.append(c.el);
        groupCtls.push({ id, ...c });
      }
      if (item.note) body.append(h('div', { class: 'hint', html: item.note }));
      det.append(body);
      el.append(det);
      ctls.push({ det, cnt, groupCtls });
    }
  }

  function update() {
    for (const c of searchCtls) c.sync();
    for (const g of ctls) {
      let n = 0;
      for (const c of g.groupCtls) {
        c.sync();
        if (app.sim.isInput(c.id) && changed(app.v[c.id], app.sim.spec(c.id).base)) n++;
      }
      g.cnt.textContent = n ? `已改 ${n}` : '';
    }
  }

  build();
  return { el, update, rebuild: build };
}

