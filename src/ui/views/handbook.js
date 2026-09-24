// 公式手册：全部公式、全部假设、与原图逐项对账
import { h, esc } from '../dom.js';
import { toCSV } from '../../model/export.js';
import { formulaLines, fmt, kindOf, symHTML } from '../../model/format.js';
import { MODULES } from '../../model/specs.js';
import { reconcile } from '../../model/reconcile.js';
import { GLOSSARY } from '../../model/glossary.js';
import { evalCustom, LAB_EXAMPLES } from '../../model/lab.js';

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
  // 公式实验室
  const labIn = h('input', { class: 'search', id: 'lab-expr', value: 'rc26 / r26', 'aria-label': '自定义表达式', style: { fontFamily: 'var(--f-mono)' } });
  const labUnit = h('select', { class: 'btn', id: 'lab-unit', 'aria-label': '结果单位' },
    h('option', { value: 'pct' }, '比率 %'), h('option', { value: 'yi' }, '亿元'), h('option', { value: 'wanyi' }, '万亿元（亿元存储）'), h('option', { value: 'wy' }, '万亿元（四本账）'), h('option', { value: 'num' }, '数值'));
  const labOut = h('div', { style: { marginTop: '10px' } });
  const labFind = h('input', { class: 'search', type: 'search', placeholder: '找变量名：输入中文，如"地方支出"', 'aria-label': '查找变量名' });
  const labHits = h('div', { class: 'presets', style: { padding: '6px 0', border: 0 } });
  const labEx = h('div', { class: 'presets', style: { padding: '6px 0', border: 0 } });
  for (const [t, src, u] of LAB_EXAMPLES) labEx.append(h('button', { class: 'chip', onclick: () => { labIn.value = src; labUnit.value = u; renderLab(); } }, t));
  labIn.addEventListener('input', () => renderLab());
  labUnit.addEventListener('change', () => renderLab());
  labFind.addEventListener('input', () => {
    const t = labFind.value.trim();
    labHits.innerHTML = '';
    if (!t) return;
    const hits = [...app.sim.graph.specs.values()].filter((n) => n.label.includes(t) || n.id.includes(t)).slice(0, 12);
    for (const n of hits) labHits.append(h('button', { class: 'chip', title: n.label, onclick: () => {
      const pos = labIn.selectionStart ?? labIn.value.length;
      labIn.value = labIn.value.slice(0, pos) + n.id + labIn.value.slice(labIn.selectionEnd ?? pos);
      labIn.focus();
      renderLab();
    } }, `${n.label} = ${n.id}`));
  });
  function renderLab() {
    const u = labUnit.value;
    const r = evalCustom(app.sim, labIn.value, { unit: u === 'wanyi' ? 'yi' : u, disp: u === 'wanyi' ? 'wy' : undefined });
    if (!r.ok) { labOut.innerHTML = `<div class="warn-item">${esc(r.error)}</div>`; return; }
    const spec = { unit: u === 'wanyi' ? 'yi' : u, disp: u === 'wanyi' ? 'wy' : undefined };
    const ch = Math.abs(r.value - r.base) > 1e-9 * Math.max(1, Math.abs(r.base));
    labOut.innerHTML = `<div class="card-val" style="margin-bottom:8px"><span class="big num" style="font:700 24px var(--f-display)">${esc(fmt(spec, r.value))}</span><span class="cmp">${ch ? `基线 ${esc(fmt(spec, r.base))}` : '与基线一致'}</span></div>
      <div class="fx-table"><div class="k">公式</div><div class="v">${r.lines.sym}</div><div class="k">读法</div><div class="v read">${r.lines.read}</div>${r.lines.pron ? `<div class="k">拟音</div><div class="v read">${esc(r.lines.pron)}</div>` : ''}<div class="k">代入</div><div class="v subst">${r.lines.subst}</div></div>
      <p class="hint">用到：${r.deps.map((d) => `<button class="chip" data-node="${d}">${esc(app.sim.spec(d).label)}</button>`).join(' ')}</p>`;
  }
  const limits = h('div', { class: 'sheet' },
    h('h3', {}, '方法与局限', h('small', {}, '这台模拟器能回答什么、不能回答什么')),
    h('ul', { class: 'limits' },
      ...[
        ['会计恒等式是精确的', '收支平衡、债务存量-流量、四本账合并、负债率分解，都是恒等式，在任何参数下都成立（300 组随机参数测试）。'],
        ['行为关系是简化的', '收入对名义增速的弹性、利率重定价速度、调入资金随 GDP 增长等，都是可调的假设，不是估计出来的模型。'],
        ['一次只看一个"余项"', '预算恒等式要平，必须有一项被动调整。现实中往往几项同时调整；可以用"规则对比表"看各种极端情形，再自行组合。'],
        ['2025 → 2026 用"基数 × (1 + 增速)"连接', '2026 年预算按 2025 年执行数编制，所以改动 2025 年会改变 2026 年的基数。这是预算编制方法，不是经济预测。'],
        ['付息按期初余额计算', '当年新增债务的利息计入下一年；推演中存量利率按"重定价速度"逐步向市场利率靠拢。'],
        ['四本账是 2021 年数据', '与 2025/2026 年模块不相加，只用来演示账本之间的机制；两者共享同一套恒等式。'],
        ['隐性债务口径差异很大', '官方 10.5 万亿与市场估算 50 万亿以上的差别，主要来自统计范围，不是计算误差。时点也不同（见"口径修正"参数）。'],
        ['GDP 是反推的', '由"赤字率≈4%"和名义增速 5% 反推，约 140.2 万亿（2025）、147.25 万亿（2026）。'],
        ['专项债利息', '专项债利息由政府性基金预算支付，不进入一般预算的"有效利率"；"全口径付息"把它加了回来。'],
        ['影响矩阵与龙卷风图一次只动一个参数', '它们给出的是"其余不动"时的单项效果。几项一起动时，乘积关系（如赤字率 × GDP、利率 × 余额）会产生交互项，单项效果之和不等于总效果；用"双参数相图"看两项一起动的精确结果。'],
        ['相图是逐格精确计算，等值线是插值', '相图 31 × 31 格，每格都重算一遍依赖图；等值线在相邻格点之间做线性插值，取舍比率用中心差分求局部斜率。它们描述的是网格内的形状，离开区间不能外推。'],
        ['Shapley 归因是"公平分摊"，不是唯一答案', '几个参数一起改时，交互部分本身不属于任何一个参数。Shapley 按"所有先后顺序取平均"的对称原则分摊，各项之和精确等于总变化；卡片同时列出"单独改"的效果，两者之差就是分到它头上的交互份额。'],
        ['路径分解用的是局部斜率', '链式法则在当前点求每一段的偏导数再相乘相加，是线性近似：链上全是加减和常数乘法时与直接重算完全相等；有乘除、取最大/最小时，拨动越大偏差越大，面板会同时给出直接重算的结果。'],
        ['双目标求解可能无解或不唯一', '牛顿法从当前值出发找两条等值线的交点。两个参数对两个目标的作用成比例时（雅可比矩阵奇异）无法分别满足，会直接说明；区间内没有交点时给出最接近的组合。'],
        ['传导回放按公式依赖排序，不是时间顺序', '回放里的"先后"是依赖图的拓扑顺序：B 的公式用到 A，A 就排在 B 前面。它说明因果链条，不代表现实中的时滞。'],
        ['不是预测', '十年推演展示的是"如果假设成立会怎样"，扇形图展示的是假设变动的敏感性，都不代表概率判断。'],
      ].map(([t, d]) => h('li', {}, h('b', {}, t), ' — ', d)),
    ),
  );
  const panes = { gloss: h('div', { class: 'sheet' }), limits, lab: h('div', { class: 'sheet' }), fx: h('div', { class: 'sheet' }), cross: h('div', { class: 'sheet' }), assume: h('div', { class: 'sheet' }), rec: h('div', { class: 'sheet' }) };
  panes.lab.append(
    h('h3', {}, '公式实验室', h('small', {}, '自己写一个指标：可以用 + − × ÷（写作 + - * /）、括号、sum/min/max/abs，变量名见下方查找')),
    h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, h('div', { style: { flex: '1 1 320px' } }, labIn), labUnit),
    labEx, labFind, labHits, labOut,
  );
  panes.gloss.append(h('h3', {}, '名词解释', h('small', {}, `${GLOSSARY.length} 个词条；右侧数字点开可看公式`)), glossBox);
  panes.cross.append(h('h3', {}, '跨图连接', h('small', {}, '所有"一张图的数字用到了另一张图的数字"的公式。点格子筛选，点公式看卡片')), crossBox);
  const csvMsg = h('span', { class: 'hint', role: 'status' });
  let csvArea = null;
  const csvBtn = h('button', { class: 'btn', type: 'button', onclick: async () => {
    const text = toCSV(app.sim);
    csvArea?.remove();
    csvArea = null;
    try { await navigator.clipboard.writeText(text); csvMsg.textContent = `已复制 ${text.split('\n').length - 1} 行，可直接粘贴到表格软件`; }
    catch {
      csvArea = h('textarea', { class: 'search copy-area', rows: 8, readonly: true, 'aria-label': 'CSV 文本' }, text);
      csvBtn.parentElement.after(csvArea);
      csvArea.focus(); csvArea.select();
      csvMsg.textContent = '浏览器不允许自动复制，文本已选中';
    }
  } }, '复制全部数字（CSV）');
  panes.fx.append(h('h3', {}, '全部公式', h('small', {}, '每条公式都是模拟器实际计算用的那一条（同一段表达式既用来算，也用来显示）')),
    h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', margin: '0 0 8px' } }, csvBtn, csvMsg,
      h('span', { class: 'hint' }, '含编号、名称、类型、原图基线、当前值、变化量和公式；数值按存储单位（亿元 / 万亿元 / 小数比率）')),
    search, filters, list);
  panes.assume.append(h('h3', {}, '假设与校准参数清单', h('small', {}, '图中没有、为了把四张图连起来而引入的参数。全部可调')), assumeBox);
  panes.rec.append(h('h3', {}, '与原图逐项对账', h('small', {}, '基线下，模拟器对原图每一个数字的复现情况')), recBox);
  const el = h('div', {}, tabs, panes.gloss, panes.limits, panes.lab, panes.fx, panes.cross, panes.assume, panes.rec);
  let pair = null;
  for (const [k, t] of [['gloss', '名词'], ['limits', '方法与局限'], ['lab', '公式实验室'], ['fx', '公式'], ['cross', '跨图连接'], ['assume', '假设清单'], ['rec', '原图对账']]) {
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
    if (mode === 'lab') renderLab();
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
