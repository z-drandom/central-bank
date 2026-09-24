// 总览：四张图如何连成一台机器
import { h, esc } from '../dom.js';
import { val, deltaParts, isChanged } from '../common.js';
import { load, save } from '../dom.js';
import { createScenarios } from '../scenarios.js';
import { STORIES } from '../../model/stories.js';

const CLUSTERS = [
  { id: 'y25', tab: 'y25', x: 20, y: 30, w: 280, hh: 250, img: '③', title: '2025 年执行', sub: '税种 → 收入 → 支出 → 差额',
    kpis: [['rev25', '一般公共预算收入'], ['exp25', '一般公共预算支出'], ['def25', '赤字'], ['tin25', '调入资金']] },
  { id: 'b26', tab: 'b26', x: 410, y: 30, w: 280, hh: 250, img: '②', title: '2026 年预算', sub: '中央 + 地方两本小账',
    kpis: [['r26', '全国收入'], ['e26', '全国支出'], ['d26', '全国赤字'], ['drate26', '赤字率']] },
  { id: 'debt', tab: 'debt', x: 800, y: 30, w: 280, hh: 250, img: '①', title: '债务存量', sub: '显性 + 隐性',
    kpis: [['gov0', '期初政府债务'], ['gov1', '2026 年末政府债务'], ['broad1', '年末含隐债'], ['debt_gdp1', '年末负债率']] },
  { id: 'fb', tab: 'fb', x: 20, y: 380, w: 280, hh: 250, img: '④', title: '四本账（2021）', sub: '账本之间的调入调出',
    kpis: [['f1_def', '预算赤字'], ['f1_realdef', '实际赤字'], ['f4_sub', '社保补贴'], ['fc_gap', '广义赤字']] },
  { id: 'proj', tab: 'proj', x: 410, y: 380, w: 670, hh: 250, img: null, title: '十年推演（2026–2035）', sub: 'Δd = d·(r − g)/(1 + g) + 基本赤字率 + 其他融资',
    kpis: [['p_d_2030', '2030 负债率'], ['p_d_2035', '2035 负债率'], ['p_w_2035', '2035 含隐债'], ['p_ib_2035', '2035 付息/收入']] },
];

// 跨图连线：from/to 用于判断"这条线上有没有变化在传"，node 为点击后打开的公式
const LINKS = [
  { from: ['rc25', 'rl25'], to: ['rc26', 'rl26'], node: 'rc26', d: 'M300,112 L408,112', lx: 355, ly: 100, label: '×(1 + g)', sub: '收入基数', title: 'R₂₆ = R₂₅ × (1 + g)：2026 预算收入以 2025 执行数为基数' },
  { from: ['e_def'], to: ['def26'], node: 'def26', d: 'M300,176 L408,176', lx: 355, ly: 166, label: '×1.07', sub: '国防支出', title: '2026 国防 = 2025 国防（图③）× 1.07' },
  { from: ['dc26', 'dl26'], to: ['bc1', 'blg1'], node: 'bc1', d: 'M690,112 L798,112', lx: 745, ly: 100, label: '+ 赤字', sub: '变成债务', title: "B′ = B + 赤字 + 专项债 + 特别国债 + 置换" },
  { from: ['bc0', 'rcg'], to: ['int26'], node: 'int26', d: 'M800,200 L692,200', lx: 745, ly: 190, label: 'r × B', sub: '变成付息', title: '中央付息 = 国债平均付息率 × 国债余额' },
  { from: ['dc25', 'dl25'], to: ['bc0', 'blg0'], node: 'bc0', d: 'M160,30 C160,-8 940,-8 940,30', lx: 550, ly: -6, label: 'B = B_obs + ΔD₂₅（反事实：2025 年多借，年末余额同步增加）', sub: '', title: '' },
  { from: ['gov1', 'bc1', 'blg1', 'bls1', 'hsel1'], to: ['p_B_2026'], node: 'p_d_2026', d: 'M940,280 L940,378', lx: 950, ly: 334, label: '期末债务', sub: '推演起点', anchor: 'start' },
  { from: ['r26', 'd26', 'tin26', 'e26', 'int_gb26'], to: ['p_R_2026', 'p_D_2026', 'p_I_2026'], node: 'p_E_2026', d: 'M550,280 L550,378', lx: 560, ly: 334, label: '收支与赤字', sub: '推演起点', anchor: 'start' },
  { from: ['f1_tin', 'f1_def', 'f1_realdef'], to: [], node: 'tin26', d: 'M300,480 C360,480 350,250 408,250', lx: 356, ly: 372, label: '调入资金', sub: '实际 vs 预算赤字', anchor: 'middle' },
];

function clusterSVG(app, c) {
  const ids = app.sim.changedIds().filter((id) => app.sim.spec(id).mod === c.id);
  const n = ids.length;
  let s = `<g class="ov-cl" data-tab="${c.tab}" role="button" tabindex="0" aria-label="打开${esc(c.title)}">
    <rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.hh}" rx="10" class="ov-box ${n ? 'on' : ''}"/>
    <text x="${c.x + 16}" y="${c.y + 28}" class="t-title">${c.img ? `图${c.img} ` : ''}${esc(c.title)}</text>
    <text x="${c.x + 16}" y="${c.y + 46}" class="t-small">${esc(c.sub)}</text>`;
  if (n) s += `<g transform="translate(${c.x + c.w - 16},${c.y + 22})"><rect x="-76" y="-14" width="76" height="20" rx="10" class="fill-def"/><text x="-38" y="0" text-anchor="middle" style="fill:#fff;font-size:11.5px;font-weight:600">${n} 个数变了</text></g>`;
  s += '</g>';
  const colW = (c.w - 32) / 2;
  c.kpis.forEach(([id, label], i) => {
    if (!app.sim.has(id)) return;
    const x = c.x + 16 + (i % 2) * colW;
    const y = c.y + 84 + Math.floor(i / 2) * 78;
    const dp = deltaParts(app, id);
    s += `<g data-node="${id}" class="ov-kpi">
      <text x="${x}" y="${y}" class="t-small">${esc(label)}</text>
      <text x="${x}" y="${y + 24}" class="t-big">${esc(val(app, id, { dp: app.sim.spec(id).unit === 'pct' ? 1 : undefined }))}<tspan class="t-small" dx="4">${esc(unitOf(app, id))}</tspan></text>
      ${dp ? `<text x="${x}" y="${y + 42}" class="${dp.up ? 't-up' : 't-down'}">${esc(dp.text)}</text>` : ''}
    </g>`;
  });
  return s;
}

function unitOf(app, id) {
  const s = app.sim.spec(id);
  if (s.unit === 'yi') return s.disp === 'wy' ? '万亿' : '亿';
  if (s.unit === 'wy') return '万亿';
  return '';
}

function linkSVG(app, l) {
  const active = l.from.some((id) => app.sim.has(id) && isChanged(app, id)) && (l.to.length === 0 || l.to.some((id) => app.sim.has(id) && isChanged(app, id)));
  return `<g data-node="${l.node}" class="ov-link ${active ? 'on' : ''}">
    ${l.title ? `<title>${esc(l.title)}</title>` : ''}<path d="${l.d}" class="ov-path" marker-end="url(#ov-ah${active ? '-on' : ''})"/>
    ${active ? `<path d="${l.d}" class="ov-pulse"/>` : ''}
    <text x="${l.lx}" y="${l.ly}" text-anchor="${l.anchor ?? 'middle'}" class="ov-lbl">${esc(l.label)}</text>
    ${l.sub ? `<text x="${l.lx}" y="${l.ly + 14}" text-anchor="${l.anchor ?? 'middle'}" class="t-small">${esc(l.sub)}</text>` : ''}
  </g>`;
}

export default function overview(app) {
  const map = h('div', { class: 'chart wide' });
  map.addEventListener('click', (e) => {
    if (e.target.closest('[data-node]')) return;
    const c = e.target.closest('[data-tab]');
    if (c) app.go(c.dataset.tab);
  });
  map.addEventListener('keydown', (e) => {
    const c = e.target.closest?.('[data-tab]');
    if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); app.go(c.dataset.tab); }
  });
  const story = h('ol', { class: 'story' });
  const scen = createScenarios(app);
  const TOUR = 'fiscal-sandbox-tour-v1';
  const tour = h('div', { class: 'sheet tour', hidden: !!load(TOUR, false) },
    h('h3', {}, '三步上手'),
    h('div', { class: 'tour-steps' },
      h('div', {}, h('b', {}, '① 点数字'), h('p', {}, '图里、表里、顶栏的任何数字都能点。卡片会给出"公式 / 读法 / 代入"，以及它由谁决定、又影响谁。')),
      h('div', {}, h('b', {}, '② 拧旋钮'), h('p', {}, '右侧每个滑杆上的金色刻度是原图数值。拖动后，页面底部的"传导链"按顺序列出每个被牵动的数字。')),
      h('div', {}, h('b', {}, '③ 换规则'), h('p', {}, '"平衡规则"决定缺口由谁兜底：同样少收 1,000 亿，锁定赤字就要砍支出，锁定支出就要多借债。')),
    ),
    h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
      h('button', { class: 'btn primary', onclick: () => { app.applyPreset({ label: '示例：增值税少收 10%', changes: [{ id: 't_vat', mul: 0.9 }] }); } }, '试一下：增值税少收 10%'),
      h('button', { class: 'btn ghost', onclick: () => { tour.hidden = true; save(TOUR, true); } }, '知道了，不再显示'),
    ),
  );
  const stories = h('div', { class: 'sheet' },
    h('h3', {}, '跟着讲解走一遍', h('small', {}, '每条讲解会自动切页、施加改动、高亮相关数字，文字里的数都是现算的')),
    h('div', { class: 'story-grid' }, STORIES.map((st) => h('div', { class: 'story-card' },
      h('b', {}, st.title),
      h('p', {}, st.summary),
      h('span', { class: 'hint' }, `${st.steps.length} 步`),
      h('button', { class: 'btn primary', onclick: () => app.narrator.start(st.id) }, '开始讲解'),
    ))),
  );
  const el = h('div', { style: { display: 'contents' } },
    tour,
    stories,
    h('div', { class: 'sheet' },
      h('h3', {}, '四张图是一台机器', h('small', {}, '方框 = 一张图；箭头上写着连接它们的公式。拖动右侧旋钮，看变化沿哪几条箭头传播（亮起的箭头）')),
      map,
      h('div', { class: 'swipe-hint' }, '← 左右滑动查看完整图 →'),
    ),
    h('div', { class: 'sheet' }, h('h3', {}, '钱是怎么转一圈的'), story),
    scen.el,
  );

  function update() {
    const defs = `<defs>
      <marker id="ov-ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><path d="M0,0L10,5L0,10z" class="fill-muted"/></marker>
      <marker id="ov-ah-on" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto"><path d="M0,0L10,5L0,10z" class="fill-def"/></marker>
    </defs>`;
    map.innerHTML = `<svg viewBox="0 -24 1100 674" role="img" aria-label="四张图之间的公式连接">${defs}${CLUSTERS.map((c) => clusterSVG(app, c)).join('')}${LINKS.map((l) => linkSVG(app, l)).join('')}</svg>`;
    const v = app.v;
    const T = (id, o) => `<b class="num" data-node="${id}" style="cursor:pointer;border-bottom:1px dotted var(--ink-3)">${esc(val(app, id, o))}</b>`;
    story.innerHTML = [
      `<li><div><b>收税（图③）</b>：2025 年 16 个税种合计 ${T('tax25')} 亿，扣掉出口退税 ${T('rebate')} 亿、加上非税收入 ${T('nontax')} 亿，得到一般公共预算收入 ${T('rev25')} 亿。按分税制，其中约 ${T('rc25')} 亿归中央。</div></li>`,
      `<li><div><b>花钱与补缺口（图③）</b>：支出 ${T('exp25')} 亿比收入多出 ${T('gap25')} 亿，由赤字 ${T('def25')} 亿和调入资金 ${T('tin25')} 亿补上。调入资金来自另外三本账和往年结余（图④）。</div></li>`,
      `<li><div><b>编明年预算（图②）</b>：以 2025 年执行数为基数，2026 年全国收入 ${T('r26')} 亿；定下赤字率 ${T('drate26')}，赤字 ${T('d26')} 亿，于是全国支出 ${T('e26')} 亿。中央把 ${T('tr26')} 亿转移给地方。</div></li>`,
      `<li><div><b>赤字变成债务（图①）</b>：中央赤字进入国债，地方赤字进入一般债，专项债和置换进入专项债。2026 年末政府债务 ${T('gov1')} 万亿，负债率 ${T('debt_gdp1')}。</div></li>`,
      `<li><div><b>债务变成利息，再回到预算（图①→图②）</b>：国债余额 × 平均利率 = 中央付息 ${T('int26')} 亿，它是中央本级支出的第二大项。债务越多，下一年能花在别处的钱越少。</div></li>`,
      `<li><div><b>滚动十年</b>：按当前假设，2035 年政府负债率 ${T('p_d_2035')}，付息占收入 ${T('p_ib_2035')}。</div></li>`,
    ].join('');
    void v;
    scen.update();
  }

  return {
    id: 'overview',
    title: '总览',
    heading: '中国财政沙盘：四张图，一台机器',
    lead: '四张图分别讲 2025 年的执行（图③）、2026 年的预算（图②）、债务存量（图①）和四本账的结构（图④）。这里把它们用公式接起来：<b>任何一个数字都能点开看公式，任何一个旋钮都能看到它的影响沿哪条路传播</b>。',
    mods: [],
    el,
    update,
    panelConfig: {
      title: '关键旋钮',
      presets: [
        { label: '经济放缓', changes: [{ id: 'g_nom', set: 0.03 }, { id: 'pg', set: 0.035 }], note: '2026 名义增速 3%，之后 3.5%' },
        { label: '楼市继续下行', changes: [{ id: 't_deed', mul: 0.8 }, { id: 't_lat', mul: 0.75 }, { id: 'f2_land', mul: 0.7 }], note: '契税 −20%、土地增值税 −25%、土地出让收入 −30%' },
        { label: '积极财政：赤字率 5%', changes: [{ id: 'dr26', set: 0.05 }, { id: 'pdr', set: 0.05 }] },
        { label: '化债攻坚', changes: [{ id: 'swap26', set: 40000 }, { id: 'pswap', set: 15000 }] },
        { label: '消费税下划地方一半', changes: [{ id: 's_con', set: 0.5 }] },
      ],
      items: [
        { title: '最有牵动力的几个参数', ids: ['t_vat', 'g_nom', 'dr26', 'rcg', 'swap26', 'f2_land', 'f4_exp', 'pg'], open: true },
        { mode: 'c26' },
        { mode: 'proj' },
      ],
    },
    rebuild: update,
  };
}
