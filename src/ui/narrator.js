// 讲解面板：逐步播放一条传导故事，自动切页、施加改动、高亮相关数字。
import { h, esc } from './dom.js';
import { Sim } from '../model/sim.js';
import { STORIES, stateAt } from '../model/stories.js';
import { fmt, fmtDelta } from '../model/format.js';
import { changed } from '../engine/graph.js';

export function createNarrator(app) {
  let story = null;
  let k = 0;
  const title = h('b');
  const stepNo = h('span', { class: 'hint' });
  const text = h('div', { class: 'nar-text' });
  const dots = h('div', { class: 'nar-dots', 'aria-hidden': 'true' });
  const prev = h('button', { class: 'btn', onclick: () => goStep(k - 1) }, '← 上一步');
  const next = h('button', { class: 'btn primary', onclick: () => (k < story.steps.length - 1 ? goStep(k + 1) : stop(true)) }, '下一步 →');
  const el = h('aside', { class: 'narrator', hidden: true, role: 'region', 'aria-label': '讲解' },
    h('div', { class: 'tracker-head' }, h('span', { class: 'hint' }, '讲解'), title, h('span', { style: { flex: 1 } }), stepNo,
      h('button', { class: 'btn ghost', onclick: () => stop(false), 'aria-label': '结束讲解' }, '✕')),
    dots,
    text,
    h('div', { class: 'tracker-foot' }, prev, next),
  );

  const T = (id) => {
    if (!app.sim.has(id)) return '—';
    const s = app.sim.spec(id);
    return `<b class="num nar-num" data-node="${id}">${esc(fmt(s, app.v[id], { unit: false }))}</b>`;
  };
  const D = (id) => {
    if (!app.sim.has(id)) return '—';
    const s = app.sim.spec(id);
    const d = app.v[id] - app.b[id];
    const txt = changed(app.v[id], app.b[id]) ? fmtDelta(s, d, { unit: false }) : '0';
    return `<b class="num nar-num ${d > 0 ? 'up' : d < 0 ? 'down' : ''}" data-node="${id}">${esc(txt)}</b>`;
  };

  const A = (id) => {
    if (!app.sim.has(id)) return '—';
    const s = app.sim.spec(id);
    const d = Math.abs(app.v[id] - app.b[id]);
    const txt = fmtDelta(s, d, { unit: false }).replace(/^\+/, '');
    return `<b class="num nar-num" data-node="${id}">${esc(txt)}</b>`;
  };

  function start(id) {
    story = STORIES.find((s) => s.id === id);
    if (!story) return;
    app.activeChallenge = null;
    app.tracker?.update();
    el.hidden = false;
    goStep(0);
  }
  function goStep(i) {
    if (!story) return;
    k = Math.max(0, Math.min(story.steps.length - 1, i));
    const st = story.steps[k];
    const s = stateAt(new Sim(), story, k);
    app.restore(s.snapshot());
    app.go(st.tab);
    if (st.phase) app.showPhase?.(st.phase);
    render();
    requestAnimationFrame(() => {
      if (st.card) app.openCard(st.card);
      app.highlight(st.focus ?? null);
      const first = document.querySelector('#main .hl');
      first?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
  }
  function render() {
    if (!story) return;
    const st = story.steps[k];
    title.textContent = story.title;
    stepNo.textContent = `${k + 1} / ${story.steps.length}`;
    text.innerHTML = st.text(T, D, A);
    dots.innerHTML = story.steps.map((_, i) => `<i class="${i === k ? 'on' : i < k ? 'done' : ''}"></i>`).join('');
    prev.disabled = k === 0;
    next.textContent = k === story.steps.length - 1 ? '讲完了 ✓' : '下一步 →';
  }
  function stop(done) {
    story = null;
    el.hidden = true;
    app.highlight(null);
    if (done) app.flash('讲解结束。当前状态保留在最后一步，你可以继续调参数，或点"全部复原"。');
  }
  function update() {
    if (story) render();
  }
  return { el, start, update, get active() { return !!story; } };
}

export { STORIES };
