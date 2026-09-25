// 全局查找：按 / 或 Ctrl+K，输入名称、符号或拼写片段，找到任意一个数字并打开它的公式卡片。
import { h, esc } from './dom.js';
import { fmt, fmtDelta } from '../model/format.js';
import { MODULES } from '../model/specs.js';
import { changed } from '../engine/graph.js';
import { RECONCILE } from '../model/reconcile.js';

const MAX = 30;

// 同义词：口语说法 → 模型里的正式名称片段（| 分隔多个）
export const SYNONYMS = {
  个税: '个人所得税', 企税: '企业所得税', 增值: '增值税', 关税: '关税', 印花: '印花税',
  化债: '置换', 置换: '置换', 卖地: '土地出让', 土地财政: '土地出让', 地价: '土地出让', 房地产: '契税|土地增值税|房产税|土地出让',
  社保补贴: '财政对社保基金补贴|社保补贴', 社保: '社保|社会保险', 养老: '社保', 医保: '社保',
  利息: '付息', 付息: '付息', 利率: '付息率|利率', 国债利率: '国债平均付息率', 负债: '负债率|债务',
  隐债: '隐性债务', 城投: '城投|隐性债务|lgfv', 专项债: '专项债', 特别国债: '特别国债', 地方债: '地方政府债券|地方一般债|地方专项债',
  转移: '转移支付', 补贴: '补贴', 国资: '国有资本', 国企: '国有资本', 稳定基金: '稳定调节基金', 蓄水池: '稳定调节基金',
  gdp: 'gdp', 经济增长: '名义gdp增速', 增速: '增速', 通胀: '名义gdp增速', 科技: '科学技术', 军费: '国防', 教育: '教育',
  外贸: '关税|进口|出口退税', 出口: '出口退税', 进口: '进口', 赤字: '赤字', 缺口: '赤字|缺口|差额',
  名义增速: '名义gdp增速', gdp增速: '名义gdp增速', 地方收入: '地方一般公共预算收入', 中央收入: '中央一般公共预算收入', 全国收入: '全国一般公共预算收入',
  地方支出: '地方一般公共预算支出', 中央支出: '中央一般公共预算支出', 全国支出: '全国一般公共预算支出', 财政收入: '一般公共预算收入', 财政支出: '一般公共预算支出',
  其它: '其它|其他', 其他: '其它|其他', 国防支出: '国防', 地方赤字: '地方财政赤字', 中央赤字: '中央财政赤字',
};

// 重要节点：顶栏指标（按顺序）、影响矩阵的旋钮与结果、原图数字——搜索时排在前面
const KPI_ORDER = ['drate26', 'debt_gdp1', 'broad_gdp1', 'intburden26', 'self26', 'p_d_2035'];
const KEY_NODES = new Set(['r26', 'e26', 'd26', 'rc26', 'rl26', 'dc26', 'oth26', 'el26', 'tr26', 'gov1', 'gov0', 'bc0', 'bc1', 'blg1', 'bls1', 'hsel', 'hsel1', 'int26', 'sp26', 'swap26', 'stb26', 'gdp26', 'g_nom', 'dr26', 'rcg', 'rev25', 'exp25', 'def25', 'tin25', 'fc_gap', 'f1_def', 'f4_sub', 'f2_land', 't_vat', 't_cit', 't_pit', 'nontax', 'rebate', 'pg', 'pdr', 'pshift', 'pphi', 'p_w_2035', 'p_ib_2035']);

for (const r of RECONCILE) KEY_NODES.add(r.id); // 原图上出现的数字

const YEAR_RE = /_(20\d\d)$/;

/** 一个查询词的全部写法：本身、整词同义词、把词里包含的同义词片段替换后的写法 */
function variants(w) {
  const out = new Set([w]);
  for (const x of (SYNONYMS[w] ?? '').split('|')) if (x) out.add(x.toLowerCase());
  for (const [k, v] of Object.entries(SYNONYMS)) {
    if (k !== w && w.includes(k)) for (const x of v.split('|')) out.add(w.replace(k, x.toLowerCase()));
  }
  return [...out];
}

/** 字按顺序出现（允许中间隔字），用于"付息占收入"匹配"付息占一般公共预算收入比重" */
function subseq(w, label) {
  let i = 0;
  for (const ch of label) if (ch === w[i]) i++;
  return i === w.length;
}

/**
 * 打分：名称相同 4 > 名称开头 3 > 名称结尾 2.8 > 名称包含 2 > 简称/符号/id 包含 1（同义词命中同样计分）；多个关键词须全部命中。
 * 加权：顶栏指标 +2.5（越靠前越高），重要节点 +1.5，可调参数 +0.5。
 * 推演期逐年序列只保留一条：查询里有年份就取那一年，否则取 2035 年。
 */
export function findNodes(graph, query, limit = MAX) {
  const q = query.trim().toLowerCase();
  const yearInQ = (q.match(/20\d\d/) ?? [])[0];
  const words = q.replace(/20\d\d年?/g, ' ').split(/\s+/).filter(Boolean);
  if (!words.length && !yearInQ) return [];
  const alts = words.map(variants);
  const out = [];
  const seenSeries = new Map();
  for (const n of graph.specs.values()) {
    const label = (n.label ?? '').toLowerCase();
    const hay = [label, (n.short ?? '').toLowerCase(), (n.sym ?? '').toLowerCase(), n.id.toLowerCase()];
    const ym = n.id.match(YEAR_RE);
    if (ym) {
      // 逐年序列：有年份就只要那一年，没有年份只要 2035 年
      if (yearInQ ? ym[1] !== yearInQ : ym[1] !== '2035') continue;
    } else if (yearInQ && !label.includes(yearInQ)) continue;
    let score = 0;
    let ok = true;
    for (const a of alts) {
      let best = 0;
      for (const w of a) {
        if (label === w) best = Math.max(best, 4);
        else if (label.startsWith(w)) best = Math.max(best, 3);
        else if (label.endsWith(w)) best = Math.max(best, 2.8); // "全国财政赤字"之于"赤字"
        else if (label.includes(w)) best = Math.max(best, 2);
        else if (hay.some((x) => x.includes(w))) best = Math.max(best, 1);
        else if (w.length >= 3 && subseq(w, label)) best = Math.max(best, 0.8);
      }
      if (!best) { ok = false; break; }
      score += best;
    }
    if (!ok) continue;
    const k = KPI_ORDER.indexOf(n.id);
    if (k >= 0) score += 2.5 - k * 0.1;
    else if (KEY_NODES.has(n.id)) score += 1.5;
    if (n.expr == null && !n.fixed) score += 0.5;
    const key = ym ? n.id.replace(YEAR_RE, '') : n.id;
    if (seenSeries.has(key)) continue;
    seenSeries.set(key, true);
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
