// 公式手册：全部公式、全部假设、与原图逐项对账
import { h, esc } from '../dom.js';
import { formulaLines, fmt, kindOf, symHTML } from '../../model/format.js';
import { MODULES } from '../../model/specs.js';
import { reconcile } from '../../model/reconcile.js';
import { GLOSSARY } from '../../model/glossary.js';

export default function handbook(app) {
  const search = h('input', { class: 'search', type: 'search', id: 'fx-search', placeholder: '搜索：名称、符号或变量名，如"付息"、"赤字率"、rc26', 'aria-label': '搜索公式' });
  const filters = h('div', { class: 'presets', style: { padding: '8px 0', border: 0 } });
  const list = h('div');
  const assumeBox = h('div', { class: 'tbl-wrap' });
  const recBox = h('div', { class: 'tbl-wrap' });
  const crossBox = h('div');
  const tabs = h('div', { class: 'seg', style: { display: 'inline-flex', marginBottom: '12px' } });
  let mode = 'gloss';
  let mod = 'all';
  let showProj = false;
  const glossBox = h('div', { class: 'gloss' });
  const panes = { gloss: h('div', { class: 'sheet' }), fx: h('div', { class: 'sheet' }), cross: h('div', { class: 'sheet' }), assume: h('div', { class: 'sheet' }), rec: h('div', { class: 'sheet' }) };
  panes.gloss.append(h('h3', {}, '名词解释', h('small', {}, `${GLOSSARY.length} 个词条；右侧数字点开可看公式`)), glossBox);
  panes.cross.append(h('h3', {}, '跨图连接', h('small', {}, '所有"一张图的数字用到了另一张图的数字"的公式。点格子筛选，点公式看卡片')), crossBox);
  panes.fx.append(h('h3', {}, '全部公式', h('small', {}, '每条公式都是模拟器实际计算用的那一条（同一段表达式既用来算，也用来显示）')), search, filters, list);
  panes.assume.append(h('h3', {}, '假设与校准参数清单', h('small', {}, '图中没有、为了把四张图连起来而引入的参数。全部可调')), assumeBox);
  panes.rec.append(h('h3', {}, '与原图逐项对账', h('small', {}, '基线下，模拟器对原图每一个数字的复现情况')), recBox);
  const el = h('div', {}, tabs, panes.gloss, panes.fx, panes.cross, panes.assume, panes.rec);
  let pair = null;
  for (const [k, t] of [['gloss', '名词'], ['fx', '公式'], ['cross', '跨图连接'], ['assume', '假设清单'], ['rec', '原图对账']]) {
    tabs.append(h('button', { type: 'button', 'data-k': k, onclick: () => { mode = k; update(); } }, t));
  }
  search.addEventListener('input', () => renderList());
  // 读法一行含上游名称，与数值无关；代入值在卡片里看

  function renderFilters() {
    filters.innerHTML = '';
    const opts = [['all', '全部'], ...Object.entries(MODULES).map(([k, m]) => [k, m.name])];
    for (const [k, t] of opts) filters.append(h('button', { class: `chip ${mod === k ? 'on' : ''}`, onclick: () => { mod = k; renderFilters(); renderList(); } }, t));
    filters.append(h('label', { class: 'hint', style: { display: 'inline-flex', gap: '4px', alignItems: 'center', marginLeft: '8px' } },
      h('input', { type: 'checkbox', checked: showProj, onchange: (e) => { showProj = e.target.checked; renderList(); } }), '显示推演逐年公式'));
  }

  function renderList() {
    const qq = search.value.trim().toLowerCase();
    const g = app.sim.graph;
    const items = g.order.map((id) => g.specs.get(id)).filter((s) => s.expr != null)
      .filter((s) => mod === 'all' || s.mod === mod)
      .filter((s) => showProj || s.mod !== 'proj' || /_(2026|2027)$/.test(s.id))
      .filter((s) => !qq || s.label.toLowerCase().includes(qq) || s.id.toLowerCase().includes(qq) || (s.sym ?? '').toLowerCase().includes(qq) || (s.note ?? '').includes(qq));
    list.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (const s of items.slice(0, 400)) {
      const L = formulaLines(g, s.id, app.v);
      const k = kindOf(s);
      frag.append(h('div', { class: 'fx-item', 'data-node': s.id, tabindex: '0' },
        h('div', { class: 'l1' },
          h('b', {}, s.label),
          h('span', { class: 'tag' }, MODULES[s.mod].short),
          h('span', { class: `tag k-${k.key}` }, k.text),
          h('span', { class: 'num fx-val', 'data-v': s.id, style: { marginLeft: 'auto', color: 'var(--ink-2)' } }, fmt(s, app.v[s.id])),
        ),
        h('div', { class: 'l2', html: L.sym }),
        h('div', { class: 'hint', html: L.read }),
      ));
    }
    list.append(frag);
    if (!items.length) list.append(h('div', { class: 'empty' }, '没有匹配的公式'));
  }

  function renderAssume() {
    const g = app.sim.graph;
    const rows = [...g.specs.values()].filter((s) => s.expr == null && (s.tag === 'assume' || s.tag === 'calib' || s.fixed));
    assumeBox.innerHTML = `<table class="tbl"><thead><tr><th>参数</th><th>模块</th><th>性质</th><th class="n">取值</th><th>依据</th></tr></thead><tbody>
      ${rows.map((s) => {
        const k = kindOf(s);
        return `<tr class="click" data-node="${s.id}"><td>${symHTML(s.sym)} ${esc(s.label)}</td><td>${esc(MODULES[s.mod].short)}</td><td><span class="tag k-${k.key}">${k.text}</span></td><td class="n">${esc(fmt(s, app.v[s.id]))}</td><td style="max-width:48ch">${esc(s.src ?? '')}${s.note ? `<div class="hint">${esc(s.note)}</div>` : ''}</td></tr>`;
      }).join('')}</tbody></table>`;
  }

  function renderRec() {
    const rows = reconcile(app.b);
    const ok = rows.filter((r) => r.ok).length;
    const fmtE = (r, v) => (r.pct ? `${(v * 100).toFixed(2)}%` : r.wy ? `${(v / 1e4).toFixed(2)} 万亿` : v.toLocaleString('en-US', { maximumFractionDigits: 2 }));
    recBox.innerHTML = `<p class="note" style="margin-top:0">共 ${rows.length} 项，<b class="ok">${ok} 项在四舍五入误差内一致</b>。下表用的是基线值（不受你当前调整影响）。</p>
      <table class="tbl"><thead><tr><th>图</th><th>项目</th><th class="n">原图</th><th class="n">模拟器</th><th class="n">差</th><th>说明</th></tr></thead><tbody>
      ${rows.map((r) => `<tr class="click" data-node="${r.id}"><td>${r.img}</td><td>${esc(r.label)}</td><td class="n">${fmtE(r, r.expected)}</td><td class="n">${fmtE(r, r.actual)}</td><td class="n ${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓' : '✗'} ${Math.abs(r.diff) < 1e-9 ? '0' : (r.pct ? `${(r.diff * 100).toFixed(3)}pp` : r.wy ? (r.diff / 1e4).toFixed(4) : r.diff.toFixed(3))}</td><td class="hint">${esc(r.note ?? '')}</td></tr>`).join('')}
      </tbody></table>`;
  }

  function renderCross() {
    const g = app.sim.graph;
    const mods = Object.keys(MODULES);
    const edges = [];
    for (const s of g.specs.values()) {
      for (const d of s.deps) {
        const ds = g.specs.get(d);
        if (ds.mod !== s.mod) edges.push({ from: ds, to: s });
      }
    }
    const count = (a, b) => edges.filter((e) => e.from.mod === a && e.to.mod === b).length;
    const name = (m) => `${MODULES[m].img ? `图${MODULES[m].img} ` : ''}${MODULES[m].short}`;
    let html = `<div class="tbl-wrap"><table class="tbl xmat"><thead><tr><th>从 ↓ 到 →</th>${mods.map((m) => `<th class="n">${esc(name(m))}</th>`).join('')}</tr></thead><tbody>`;
    for (const a of mods) {
      html += `<tr><th>${esc(name(a))}</th>${mods.map((b) => {
        if (a === b) return '<td class="n hint">·</td>';
        const n = count(a, b);
        const on = pair && pair[0] === a && pair[1] === b;
        return n ? `<td class="n"><button class="chip ${on ? 'on' : ''}" data-pair="${a}|${b}">${n}</button></td>` : '<td class="n hint">0</td>';
      }).join('')}</tr>`;
    }
    html += '</tbody></table></div><p class="note">图④（四本账）一行一列都是 0：它用的是 2021 年决算数据，与 2025/2026 年的模块不共享数值，只共享同一套恒等式（见「四本账」页的"三个年份"表）。其余各图之间的每一条连线都是一条真实参与计算的公式。</p>';
    const list = edges.filter((e) => !pair || (e.from.mod === pair[0] && e.to.mod === pair[1]))
      .filter((e) => e.to.mod !== 'proj' || /_(2026|2027)$/.test(e.to.id) || !/_\d{4}$/.test(e.to.id));
    const seen = new Set();
    html += `<p class="hint">${pair ? `${esc(name(pair[0]))} → ${esc(name(pair[1]))}：` : '全部：'}${list.length} 条（推演逐年公式只列前两年）</p><div>`;
    for (const e of list) {
      if (seen.has(e.to.id)) continue;
      seen.add(e.to.id);
      const L = formulaLines(g, e.to.id, app.v);
      const froms = list.filter((x) => x.to.id === e.to.id).map((x) => x.from.label).join('、');
      html += `<div class="fx-item" data-node="${e.to.id}"><div class="l1"><span class="tag">${esc(name(e.from.mod))} → ${esc(name(e.to.mod))}</span><b>${esc(e.to.label)}</b><span class="hint">用到：${esc(froms)}</span></div><div class="l2">${L.sym}</div></div>`;
    }
    html += '</div>';
    crossBox.innerHTML = html;
  }
  crossBox.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pair]');
    if (!b) return;
    const p = b.dataset.pair.split('|');
    pair = pair && pair[0] === p[0] && pair[1] === p[1] ? null : p;
    renderCross();
  });

  function renderGloss() {
    glossBox.innerHTML = GLOSSARY.map((g) => `<div class="gloss-item">
      <div class="gloss-t"><b>${esc(g.term)}</b><span class="tag">图${esc(g.img)}</span></div>
      <p>${esc(g.def)}</p>
      <div class="gloss-n">${g.ids.filter((id) => app.sim.has(id)).map((id) => `<button class="chip" data-node="${id}">${esc(app.sim.spec(id).label)}：${esc(fmt(app.sim.spec(id), app.v[id]))}</button>`).join('')}</div>
    </div>`).join('');
  }

  let builtFor = null;
  function update() {
    for (const b of tabs.children) b.setAttribute('aria-pressed', String(b.dataset.k === mode));
    for (const [k, p] of Object.entries(panes)) p.hidden = k !== mode;
    if (mode === 'fx') {
      // 公式文本与数值无关：同一张依赖图只建一次列表，之后只刷新数值
      if (builtFor !== app.sim.graph) { renderFilters(); renderList(); builtFor = app.sim.graph; }
      else for (const el of list.querySelectorAll('[data-v]')) el.textContent = fmt(app.sim.spec(el.dataset.v), app.v[el.dataset.v]);
    }
    if (mode === 'assume') renderAssume();
    if (mode === 'rec') renderRec();
    if (mode === 'cross') renderCross();
    if (mode === 'gloss') renderGloss();
  }

  return {
    id: 'book',
    title: '公式手册',
    heading: '公式手册：每个数字从哪来',
    lead: '三类公式：<b>会计恒等式</b>（图中直接成立的加总关系）、<b>校准关系</b>（参数由图中数字反推）、<b>假设关系</b>（图中没有，为连接各部分引入）。"原图对账"逐项核对模拟器对四张图的复现。',
    mods: [],
    el,
    update,
    hideChanges: true,
    slow: true,
  };
}
