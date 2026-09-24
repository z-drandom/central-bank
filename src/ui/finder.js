// 全局查找：按 / 或 Ctrl+K，输入名称、符号或拼写片段，找到任意一个数字并打开它的公式卡片。
import { h, esc } from './dom.js';
import { fmt, fmtDelta } from '../model/format.js';
import { MODULES } from '../model/specs.js';
import { changed } from '../engine/graph.js';

const MAX = 30;

/** 按匹配程度打分：名称开头 > 名称包含 > 简称/符号/id 包含；多个关键词须全部命中 */
export function findNodes(graph, query, limit = MAX) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const out = [];
  for (const n of graph.specs.values()) {
    const label = (n.label ?? '').toLowerCase();
    const hay = [label, (n.short ?? '').toLowerCase(), (n.sym ?? '').toLowerCase(), n.id.toLowerCase()];
    let score = 0;
    let ok = true;
    for (const w of words) {
      if (label.startsWith(w)) score += 3;
      else if (label.includes(w)) score += 2;
      else if (hay.some((x) => x.includes(w))) score += 1;
      else { ok = false; break; }
    }
    if (!ok) continue;
    out.push({ id: n.id, score: score - label.length / 1000 });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit).map((x) => x.id);
}

export function createFinder(app) {
  let hits = [];
  let sel = 0;
  const input = h('input', { class: 'search', type: 'search', id: 'finder-input', placeholder: '找任何一个数：如"付息""专项债""2035 负债率"', 'aria-label': '查找数字', autocomplete: 'off' });
  const list = h('div', { class: 'finder-list', role: 'listbox', 'aria-label': '查找结果' });
  const el = h('div', { class: 'finder', hidden: true, role: 'dialog', 'aria-label': '查找数字' },
    input,
    list,
    h('div', { class: 'hint' }, h('kbd', {}, '↑'), h('kbd', {}, '↓'), ' 选择 · ', h('kbd', {}, 'Enter'), ' 打开公式卡片 · ', h('kbd', {}, 'Esc'), ' 关闭'),
  );
  const scrim = h('div', { class: 'finder-scrim', hidden: true, onclick: () => close() });

  function render() {
    const g = app.sim.graph;
    hits = findNodes(g, input.value);
    sel = Math.min(sel, Math.max(0, hits.length - 1));
    list.innerHTML = hits.length
      ? hits.map((id, i) => {
        const s = g.specs.get(id);
        const ch = changed(app.v[id], app.b[id]);
        return `<div class="finder-item ${i === sel ? 'on' : ''}" role="option" aria-selected="${i === sel}" data-i="${i}">
          <span class="fi-l">${esc(s.label)}<small>${esc(MODULES[s.mod]?.short ?? '')} · ${s.expr == null ? (s.fixed ? '原图数据' : '可调参数') : '公式'}</small></span>
          <span class="fi-v num">${esc(fmt(s, app.v[id]))}${ch ? `<small class="${app.v[id] >= app.b[id] ? 'up' : 'down'}">${esc(fmtDelta(s, app.v[id] - app.b[id]))}</small>` : ''}</span>
        </div>`;
      }).join('')
      : `<div class="empty">${input.value.trim() ? '没有找到。换个说法试试，比如"赤字""国债""土地"。' : '输入名称的一部分即可。'}</div>`;
    list.querySelector('.finder-item.on')?.scrollIntoView({ block: 'nearest' });
  }
  function open() {
    el.hidden = false;
    scrim.hidden = false;
    input.value = '';
    sel = 0;
    render();
    input.focus();
  }
  function close() {
    el.hidden = true;
    scrim.hidden = true;
  }
  function choose(i) {
    const id = hits[i];
    if (!id) return;
    close();
    app.openCard(id);
  }
  input.addEventListener('input', () => { sel = 0; render(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(hits.length - 1, sel + 1); render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); render(); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(sel); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  });
  list.addEventListener('click', (e) => {
    const it = e.target.closest('.finder-item');
    if (it) choose(Number(it.dataset.i));
  });
  return { el: [scrim, el], open, close, get isOpen() { return !el.hidden; } };
}
