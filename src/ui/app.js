// 应用外壳：顶栏指标、标签页、参数面板、传导链、公式卡片，以及统一的刷新循环。
import { Sim } from '../model/sim.js';
import { fmt } from '../model/format.js';
import { changed } from '../engine/graph.js';
import { h, $, $$ } from './dom.js';
import { createPanel } from './controls.js';
import { createCard } from './card.js';
import { createChanges } from './changes.js';
import { deltaParts } from './common.js';
import { VIEWS } from './views/index.js';
import { createTracker } from './views/play.js';
import { createNarrator } from './narrator.js';

const KPIS = [
  { id: 'drate26', label: '2026 赤字率', ref: 0.03, refText: '3%：传统警戒参考', max: 0.08 },
  { id: 'debt_gdp1', label: '2026 年末政府负债率', ref: 0.6, refText: '60%：国际常用参考线', max: 1.2 },
  { id: 'broad_gdp1', label: '含隐性债务负债率', ref: 0.6, refText: '60%：国际常用参考线', max: 1.6 },
  { id: 'intburden26', label: '付息 ÷ 一般预算收入', ref: 0.1, refText: '10%：常见偏高参考线', max: 0.2 },
  { id: 'self26', label: '地方财政自给率', ref: null, max: 1 },
  { id: 'p_d_2035', label: '2035 年政府负债率', ref: 0.6, refText: '60%：国际常用参考线', max: 1.6 },
];

export function createApp(root) {
  const sim = new Sim();
  const listeners = new Set();
  let current = null;
  let scheduled = false;

  // 撤销 / 重做：连续拖动滑杆（间隔 < 700ms）只记一步
  const hist = { past: [], future: [], last: 0 };
  function record(force = false) {
    const t = Date.now();
    if (force || t - hist.last > 700) {
      hist.past.push(sim.snapshot());
      if (hist.past.length > 120) hist.past.shift();
      hist.future = [];
    }
    hist.last = t;
  }

  const app = {
    sim,
    get v() { return sim.values; },
    get b() { return sim.base; },
    set(id, value) {
      if (!sim.isInput(id) || !Number.isFinite(value)) return;
      record();
      sim.set(id, value);
      schedule();
    },
    setMany(obj) { record(true); sim.setMany(obj); schedule(); },
    setMode(key, val) {
      record(true);
      sim.setMode(key, val);
      rebuildAll();
    },
    undo() {
      if (!hist.past.length) return;
      hist.future.push(sim.snapshot());
      sim.restore(hist.past.pop());
      hist.last = 0;
      rebuildAll();
      flash('已撤销');
    },
    redo() {
      if (!hist.future.length) return;
      hist.past.push(sim.snapshot());
      sim.restore(hist.future.pop());
      hist.last = 0;
      rebuildAll();
      flash('已重做');
    },
    restore(snap, label) {
      record(true);
      sim.restore(snap);
      rebuildAll();
      if (label) flash(label);
    },
    applyPreset(p) {
      record(true);
      if (p.modes) for (const [k, v] of Object.entries(p.modes)) sim.setMode(k, v);
      if (p.reset) sim.reset();
      sim.apply(p.changes ?? []);
      if (p.go) go(p.go);
      rebuildAll();
      flash(`已应用情景：${p.label}`);
    },
    resetTab(config) {
      record(true);
      const ids = config.items.flatMap((x) => x.ids ?? []).filter((id) => sim.isInput(id));
      sim.reset(ids);
      schedule();
    },
    resetAll() {
      record(true);
      sim.resetAll();
      rebuildAll();
      flash('已恢复到原图数值');
    },
    openCard: (id) => { card.open(id); app.highlight?.(id); },
    go: (tab) => go(tab),
    onUpdate: (fn) => listeners.add(fn),
    flash: (t) => flash(t),
  };

  // ---------- 顶栏 ----------
  const kpiEls = KPIS.map((k) => {
    const v = h('span', { class: 'kpi-v num' });
    const d = h('span', { class: 'kpi-d num' });
    const bar = h('i');
    const refMark = k.ref != null ? h('span', { style: { position: 'absolute', top: '-2px', bottom: '-2px', width: '2px', background: 'var(--gold)', left: `${(k.ref / k.max) * 100}%` } }) : null;
    const el = h('button', { class: 'kpi', type: 'button', title: k.refText ? `金色刻度 = ${k.refText}` : '', onclick: () => app.openCard(k.id) },
      h('span', { class: 'kpi-l' }, k.label), v, d,
      h('span', { class: 'kpi-bar', style: { overflow: 'visible' } }, bar, refMark),
    );
    return { k, el, v, d, bar };
  });
  const undoBtn = h('button', { class: 'btn ghost', onclick: () => app.undo(), title: '撤销（Ctrl+Z）', 'aria-label': '撤销' }, '↶ 撤销');
  const redoBtn = h('button', { class: 'btn ghost', onclick: () => app.redo(), title: '重做（Ctrl+Shift+Z）', 'aria-label': '重做' }, '↷ 重做');
  const tabBar = h('nav', { class: 'tabs', role: 'tablist', 'aria-label': '模块' });
  const toast = h('div', { role: 'status', 'aria-live': 'polite', style: { position: 'fixed', left: '50%', bottom: '24px', transform: 'translateX(-50%)', background: 'var(--ink)', color: 'var(--paper)', padding: '8px 14px', borderRadius: '6px', fontSize: '13px', zIndex: 60, opacity: 0, transition: 'opacity .2s', pointerEvents: 'none' } });
  const top = h('header', { class: 'top' },
    h('div', { class: 'brand' },
      h('h1', {}, h('span', { class: 'seal', 'aria-hidden': 'true' }, '財'), '中国财政沙盘'),
      h('p', {}, '把四张财政图接成一台机器：拧任何一个旋钮，都能看到它沿公式传到哪里'),
      h('span', { class: 'spacer' }),
      undoBtn,
      redoBtn,
      h('button', { class: 'btn', onclick: () => app.resetAll(), title: '所有参数和规则恢复原图' }, '全部复原'),
    ),
    h('div', { class: 'kpis' }, kpiEls.map((x) => x.el)),
    tabBar,
  );

  const viewHost = h('main', { id: 'main' });
  const changes = createChanges(app);
  const card = createCard(app);
  const foot = h('footer', { class: 'foot' },
    h('div', {}, '数据：图①–④（公众号"微言书"，梦游尘制图）；2025/2026 年数据来自财政部《关于 2025 年中央和地方预算执行情况与 2026 年中央和地方预算草案的报告》，四本账为 2021 年决算。'),
    h('div', {}, '标"假设"的参数是图中没有、为了把各部分连起来而引入的，均可调整；标"校准"的参数由图中数字反推。模拟器用于理解机制，不构成预测。'),
  );
  // 窄屏：一键跳到参数面板 / 跳回图表
  const jump = h('button', { class: 'jump-panel btn primary', type: 'button', onclick: () => {
    const panel = viewHost.querySelector('.panel');
    const atPanel = jump.dataset.at === 'panel';
    const target = atPanel ? viewHost.querySelector('.main-col') : panel;
    target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  } }, '调参数 ↓');
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    for (const e of entries) {
      jump.dataset.at = e.isIntersecting ? 'panel' : 'chart';
      jump.textContent = e.isIntersecting ? '看图 ↑' : '调参数 ↓';
    }
  }) : null;
  app.observePanel = (panel) => { io?.disconnect(); if (panel) io?.observe(panel); jump.hidden = !panel; };
  const tracker = createTracker(app);
  app.tracker = tracker;
  const narrator = createNarrator(app);
  app.narrator = narrator;
  root.append(h('div', { class: 'app' }, top, viewHost, changes.el, foot), ...card.el, toast, tracker.el, narrator.el, jump);

  // 高亮：传导链悬停、公式卡片打开时，在当前图表里标出同一个数字
  let hlId = null;
  app.highlight = (id) => {
    const key = Array.isArray(id) ? id.join('|') : id;
    if (hlId === key) return;
    for (const el of viewHost.querySelectorAll('.hl')) el.classList.remove('hl');
    hlId = key;
    if (!id) return;
    for (const one of Array.isArray(id) ? id : [id]) {
      for (const el of viewHost.querySelectorAll(`[data-node="${CSS.escape(one)}"]:not(.sk-link)`)) el.classList.add("hl");
    }
  };
  // 桑基图悬停：只突出与该节点相连的流
  viewHost.addEventListener('mouseover', (e) => {
    const n = e.target.closest?.('[data-sk]');
    const svg = e.target.closest?.('svg');
    if (!svg) return;
    for (const el of svg.querySelectorAll('.sk-link.hot')) el.classList.remove('hot');
    if (!n) { svg.classList.remove('sk-focus'); return; }
    const k = n.dataset.sk;
    svg.classList.add('sk-focus');
    for (const el of svg.querySelectorAll(`.sk-link[data-s="${CSS.escape(k)}"], .sk-link[data-t="${CSS.escape(k)}"]`)) el.classList.add('hot');
  });
  viewHost.addEventListener('mouseleave', () => {
    for (const svg of viewHost.querySelectorAll('svg.sk-focus')) svg.classList.remove('sk-focus');
  }, true);

  // 点击任何带 data-node 的数字 → 打开公式卡片
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-node]');
    if (t && root.contains(t) && !t.closest('.drawer')) app.openCard(t.dataset.node);
  });
  root.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[data-node][tabindex]')) {
      e.preventDefault();
      app.openCard(e.target.dataset.node);
    }
  });

  // ---------- 视图 ----------
  const views = VIEWS.map((factory) => factory(app));
  const tabs = new Map();
  for (const v of views) {
    const badge = h('span', { class: 'badge', hidden: true });
    const b = h('button', { class: 'tab', role: 'tab', type: 'button', 'aria-selected': 'false', id: `tab-${v.id}`, onclick: () => go(v.id) },
      v.img ? h('span', { class: 'img' }, `图${v.img}`) : null, v.title, badge);
    tabBar.append(b);
    tabs.set(v.id, { btn: b, badge, view: v, panel: null, wrap: null });
  }

  function mountView(id) {
    const t = tabs.get(id);
    if (!t.wrap) {
      const v = t.view;
      const head = h('div', { class: 'view-head' },
        h('div', { class: 'grow' }, h('h2', {}, v.heading ?? v.title), v.lead ? h('p', { html: v.lead }) : null),
      );
      if (v.panelConfig) {
        t.panel = createPanel(app, v.panelConfig);
        t.wrap = h('section', { class: 'view', role: 'tabpanel', 'aria-labelledby': `tab-${id}` }, head,
          h('div', { class: 'layout' }, h('div', { class: 'main-col' }, v.el), t.panel.el));
      } else {
        t.wrap = h('section', { class: 'view', role: 'tabpanel', 'aria-labelledby': `tab-${id}` }, head, v.el);
      }
    }
    return t;
  }

  function go(id) {
    if (!tabs.has(id)) id = views[0].id;
    current = id;
    for (const [k, t] of tabs) t.btn.setAttribute('aria-selected', String(k === id));
    const t = mountView(id);
    viewHost.replaceChildren(t.wrap);
    try { if (location.hash.slice(1) !== id) history.replaceState(null, '', `#${id}`); } catch { /* 沙盒中可能不允许 */ }
    tabs.get(id).btn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    changes.el.hidden = !!t.view.hideChanges;
    app.observePanel?.(t.panel?.el ?? null);
    update();
  }

  function rebuildAll() {
    for (const t of tabs.values()) {
      t.panel?.rebuild();
      t.view.rebuild?.();
    }
    update();
  }

  // 次要面板（传导链、公式手册）用尾随节流：拖动滑杆时最多每 140ms 刷新一次
  const slowTimers = new Map();
  const slowLast = new Map();
  function slowLater(fn, key = 'view') {
    if (slowTimers.has(key)) { slowTimers.get(key).fn = fn; return; }
    const entry = { fn };
    slowTimers.set(key, entry);
    const wait = Math.max(0, 140 - (performance.now() - (slowLast.get(key) ?? -1e9)));
    setTimeout(() => {
      slowTimers.delete(key);
      slowLast.set(key, performance.now());
      entry.fn();
    }, wait);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      update();
    });
  }

  function update() {
    for (const x of kpiEls) {
      const s = sim.spec(x.k.id);
      const v = sim.values[x.k.id];
      x.v.textContent = fmt(s, v);
      const dp = deltaParts(app, x.k.id);
      x.d.innerHTML = dp ? `<span class="${dp.up ? 'up' : 'down'}">${dp.text}</span>` : '<span>原图基线</span>';
      x.bar.style.width = `${Math.max(0, Math.min(1, v / x.k.max)) * 100}%`;
    }
    // 标签上的角标：该模块有多少数字被牵动
    const ids = sim.changedIds();
    for (const [k, t] of tabs) {
      const n = t.view.mods ? ids.filter((id) => t.view.mods.includes(sim.spec(id).mod)).length : 0;
      t.badge.hidden = !n;
      t.badge.textContent = n > 99 ? '99+' : String(n);
      t.badge.title = `${n} 个数字相对原图有变化`;
    }
    undoBtn.disabled = !hist.past.length;
    redoBtn.disabled = !hist.future.length;
    const t = tabs.get(current);
    t?.panel?.update();
    if (t?.view.slow) slowLater(() => t.view.update());
    else t?.view.update();
    if (!changes.el.hidden) slowLater(() => changes.update(), 'changes');
    card.update();
    tracker.update();
    narrator.update();
    const hl = hlId;
    hlId = null;
    app.highlight(card.current ?? (hl ? hl.split('|') : null));
    for (const fn of listeners) fn();

  }

  let toastTimer;
  function flash(text) {
    toast.textContent = text;
    toast.style.opacity = 1;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast.style.opacity = 0), 1800);
  }

  window.addEventListener('hashchange', () => {
    const id = location.hash.slice(1);
    if (tabs.has(id) && id !== current) go(id);
  });
  window.addEventListener('resize', () => schedule());
  // 顶栏高度供参数面板吸顶（只在尺寸变化时读取，避免每帧强制重排）
  const setTopH = () => document.documentElement.style.setProperty('--top-h', `${top.offsetHeight}px`);
  if ('ResizeObserver' in window) new ResizeObserver(setTopH).observe(top);
  else setTopH();
  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
    if (e.target.matches?.('input[type=text], input[type=search], textarea')) return;
    e.preventDefault();
    if (e.shiftKey) app.redo(); else app.undo();
  });

  let start = views[0].id;
  try {
    const hid = location.hash.slice(1);
    if (tabs.has(hid)) start = hid;
  } catch { /* ignore */ }
  go(start);
  app.changed = (id) => changed(sim.values[id], sim.base[id]);
  window.__fiscal = app; // 便于调试与端到端测试
  return app;
}
