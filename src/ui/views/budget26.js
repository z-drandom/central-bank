// 图② 2026 年全国一般公共预算安排
import { h } from '../dom.js';
import { renderSankey } from '../sankey-view.js';
import { ledgerHTML } from '../common.js';
import { OWN26_IDS } from '../../model/specs.js';
import { compareRules, RULE_ROWS } from '../../model/rulecompare.js';
import { fmtDelta } from '../../model/format.js';
import { esc } from '../dom.js';

const CAT = {
  def26: { name: '国防支出', g: 'gr_def26' },
  int26: { name: '债务付息支出', g: 'gr_int26' },
  sci26: { name: '科学技术支出', g: 'gr_sci26' },
  sec26: { name: '公共安全支出', g: 'gr_sec26' },
  edu26: { name: '教育支出', g: 'gr_edu26' },
  grain26: { name: '粮油物资储备支出', g: 'gr_grain26' },
  dip26: { name: '外交支出', g: 'gr_dip26' },
  oth26: { name: '其它', g: null },
};

export function sankeyDef(app) {
  const v = app.v;
  const nodes = [
    { id: 'tstab26', col: 0, color: 'xfer', minSlot: 38, label: { pos: 'left', name: '从中央预算稳定调节基金调入' } },
    { id: 'tsoe26', col: 0, color: 'xfer', minSlot: 38, label: { pos: 'left', name: '从中央国有资本经营预算调入' } },
    { id: 'rc26', col: 0, color: 'rev', label: { pos: 'left', name: '中央一般公共预算收入', growthId: 'gr_rc26' } },
    { id: 'd26', col: 0, color: 'def', gapBefore: 10, label: { pos: 'left', name: '全国财政赤字', growthId: null } },
    { id: 'tl26', col: 0, color: 'xfer', gapBefore: 10, minSlot: 36, label: { pos: 'left', name: '地方调入资金及结转结余' } },
    { id: 'rl26', col: 0, color: 'rev', label: { pos: 'left', name: '地方一般公共预算收入', growthId: 'gr_rl26' } },
    { id: 'dc26', col: 1, color: 'def', label: { pos: 'above', name: '中央财政赤字', growthId: 'gr_dc26' } },
    { id: 'dl26', col: 1, color: 'def', gapBefore: 24, minSlot: 20, label: { pos: 'below', name: '地方财政赤字' } },
    { id: 'ec26', col: 2, color: 'xfer', label: { pos: 'above', name: '中央一般公共预算支出', growthId: 'gr_ec26' } },
    { id: 'res26', col: 3, color: 'exp', minSlot: 44, label: { pos: 'right', name: '中央预备费' } },
    { id: 'own26', col: 3, color: 'exp', minSlot: 50, label: { pos: 'right', name: '中央本级支出', growthId: 'gr_own26' } },
    { id: 'tr26', col: 3, color: 'xfer', gapBefore: 30, label: { pos: 'right', name: '对地方转移支付', growthId: 'gr_tr26' } },
    ...OWN26_IDS.map((id) => ({ id, col: 4, color: 'exp', minSlot: 31, label: { pos: 'right', inline: true, name: CAT[id].name, growthId: CAT[id].g } })),
    { id: 'el26', col: 4, color: 'exp', gapBefore: 26, label: { pos: 'right', name: '地方一般公共预算支出', growthId: 'gr_el26' } },
  ];
  const links = [
    { s: 'tstab26', t: 'ec26', v: v.tstab26, color: 'xfer' },
    { s: 'tsoe26', t: 'ec26', v: v.tsoe26, color: 'xfer' },
    { s: 'rc26', t: 'ec26', v: v.rc26, color: 'rev' },
    { s: 'd26', t: 'dc26', v: v.dc26, color: 'def' },
    { s: 'd26', t: 'dl26', v: v.dl26, color: 'def' },
    { s: 'dc26', t: 'ec26', v: v.dc26, color: 'def' },
    { s: 'ec26', t: 'res26', v: v.res26, color: 'link' },
    { s: 'ec26', t: 'own26', v: v.own26, color: 'link' },
    { s: 'ec26', t: 'tr26', v: v.tr26, color: 'link' },
    ...OWN26_IDS.map((id) => ({ s: 'own26', t: id, v: v[id], color: 'exp' })),
    { s: 'tr26', t: 'el26', v: v.tr26, color: 'xfer' },
    { s: 'dl26', t: 'el26', v: v.dl26, color: 'def' },
    { s: 'tl26', t: 'el26', v: v.tl26, color: 'xfer' },
    { s: 'rl26', t: 'el26', v: v.rl26, color: 'rev' },
  ];
  return {
    nodes,
    links,
    width: 1120,
    height: 430,
    ky: 430 / 300100,
    nodeW: 12,
    gap: 7,
    colX: (c) => [206, 400, 560, 720, 880][c],
    colAlign: { 0: 'bottom', 4: 'top' },
    colOffset: { 1: 336, 2: 196, 3: 150 },
    padTop: 44,
    aria: '2026 年全国一般公共预算资金流向',
  };
}

export default function budget26(app) {
  const chart = h('div', { class: 'chart wide' });
  const ledger = h('div');
  const rules = h('div', { class: 'tbl-wrap' });
  let rulesTimer = null;
  rules.addEventListener('click', (e) => {
    const b = e.target.closest('[data-rule]');
    if (!b) return;
    const modes = JSON.parse(b.dataset.rule);
    for (const [k, v] of Object.entries(modes)) app.setMode(k, v);
    app.flash('已切换平衡规则（当前数字保持不变，之后的冲击按新规则分摊）');
  });
  const el = h('div', { style: { display: 'contents' } },
    h('div', { class: 'sheet' },
      h('h3', {}, '资金从哪里来、到哪里去', h('small', {}, '单位：亿元 · 点任何数字看公式 · ▲为较 2025 年执行数增幅')),
      chart,
      h('div', { class: 'swipe-hint' }, '← 左右滑动查看完整图 →'),
      h('div', { class: 'legend' },
        h('span', {}, h('i', { style: { background: 'var(--rev)' } }), '收入'),
        h('span', {}, h('i', { style: { background: 'var(--def)' } }), '赤字（借债）'),
        h('span', {}, h('i', { style: { background: 'var(--xfer)' } }), '调入资金 / 转移支付'),
        h('span', {}, h('i', { style: { background: 'var(--exp)' } }), '支出'),
      ),
    ),
    h('div', { class: 'sheet' },
      h('h3', {}, '换个规则会怎样', h('small', {}, '把你当前的改动放到不同平衡规则下重算，表中是相对原图的变化量——看每一列是谁把冲击接住了')),
      rules,
    ),
    h('div', { class: 'sheet' },
      h('h3', {}, '三本小账必须同时平', h('small', {}, '预算恒等式：来源 = 去向。当前平衡规则决定谁是余项')),
      h('div', { class: 'ledger-legend' }, h('span', {}, h('i', { class: 'p' }, '调'), '可调参数'), h('span', {}, h('i', {}, '算'), '由公式算出——换一个平衡规则，看“算”字挪到哪一项')),
      ledger,
    ),
  );

  function renderRules() {
    if (!app.sim.changedInputs().length) {
      rules.innerHTML = '<div class="empty">先改一个参数（比如点右侧"经济放缓"），这里会并排显示它在六种规则下分别由谁承担。</div>';
      return;
    }
    const res = compareRules(app.sim);
    const cur = app.sim.modes;
    const isCur = (rv) => Object.entries(rv.modes).every(([k, v]) => cur[k] === v || (k === 'absorb' && cur.c26 !== 'rate'));
    const head = res.map((rv) => `<th class="n"><button class="chip ${isCur(rv) ? 'on' : ''}" data-rule='${JSON.stringify(rv.modes)}' title="切换到这个规则">${esc(rv.label)}</button></th>`).join('');
    const body = RULE_ROWS.map(([id, label]) => {
      const cells = res.map((rv) => {
        const d = rv.delta[id];
        if (d == null) return '<td class="n hint">—</td>';
        const sp = app.sim.has(id) ? app.sim.spec(id) : null;
        const small = Math.abs(d) < 1e-6 * Math.max(1, Math.abs(rv.values[id] ?? 1));
        const txt = small ? '0' : sp ? fmtDelta(sp, d, { unit: false }) : d.toFixed(2);
        return `<td class="n ${small ? 'hint' : d > 0 ? 'up' : 'down'}" style="${small ? '' : 'font-weight:600'}">${esc(txt)}</td>`;
      }).join('');
      return `<tr class="click" data-node="${id}"><td>${esc(label)}</td>${cells}</tr>`;
    }).join('');
    const skipped = [...new Set(res.flatMap((rv) => rv.skipped))];
    rules.innerHTML = `<table class="tbl rules-tbl"><thead><tr><th>相对原图的变化</th>${head}</tr></thead><tbody>${body}</tbody></table>
      <p class="hint" style="margin:6px 0 0">点列头可切换到该规则。${skipped.length ? `有 ${skipped.length} 项改动在部分规则下是"余项"（由公式算出），无法直接施加，已跳过：${esc(skipped.map((x) => app.sim.has(x) ? app.sim.spec(x).label : x).join('、'))}。` : ''}</p>`;
  }

  function update() {
    clearTimeout(rulesTimer);
    rulesTimer = setTimeout(renderRules, 180);
    chart.innerHTML = renderSankey(app, sankeyDef(app));
    ledger.innerHTML = [
      ledgerHTML(app, [{ id: 'rc26', cls: 'rev' }, '+', { id: 'dc26', cls: 'def' }, '+', { id: 'tstab26', cls: 'xfer', label: '稳定基金调入' }, '+', { id: 'tsoe26', cls: 'xfer', label: '国资预算调入' }, '=', { id: 'ec26', cls: 'total' }], { title: '中央：来源' }),
      ledgerHTML(app, [{ id: 'ec26', cls: 'total' }, '=', { id: 'own26', cls: 'exp' }, '+', { id: 'tr26', cls: 'xfer' }, '+', { id: 'res26', cls: 'exp' }], { title: '中央：去向' }),
      ledgerHTML(app, [{ id: 'rl26', cls: 'rev' }, '+', { id: 'tr26', cls: 'xfer' }, '+', { id: 'dl26', cls: 'def' }, '+', { id: 'tl26', cls: 'xfer', label: '调入及结转结余' }, '=', { id: 'el26', cls: 'total' }], { title: '地方' }),
      ledgerHTML(app, [{ id: 'r26', cls: 'rev' }, '+', { id: 'd26', cls: 'def' }, '+', { id: 'tin26', cls: 'xfer' }, '=', { id: 'e26', cls: 'total' }], { title: '全国（转移支付在中央、地方之间抵消）' }),
      ledgerHTML(app, [{ id: 'd26', cls: 'def' }, '÷', { id: 'gdp26' }, '=', { id: 'drate26', cls: 'total' }], { title: '赤字率' }),
      ledgerHTML(app, [{ id: 'e26', cls: 'exp' }, '−', { id: 'r26', cls: 'rev' }, '=', { id: 'gap26', cls: 'total', label: '实际赤字' }], { title: '实际赤字（图④口径）：比预算赤字多出的部分就是调入资金' }),
    ].join('');
  }

  return {
    id: 'b26',
    img: '②',
    title: '2026 预算',
    heading: '2026 年全国一般公共预算：一张大账由两张小账拼成',
    lead: '中央收入加上中央赤字和调入资金，一部分自己花（本级支出），大部分转给地方；地方再加上自有收入、地方赤字、调入资金来花。任何一个数字变动，恒等式都要重新平衡——<b>参数面板里的"平衡规则"决定由谁来兜底</b>。',
    mods: ['b26', 'macro'],
    el,
    update,
    panelConfig: {
      title: '调 2026 预算',
      presets: [
        { label: '经济放缓：名义增速 3%', changes: [{ id: 'g_nom', set: 0.03 }], note: '名义 GDP 增速从 5% 降到 3%' },
        { label: '积极财政：赤字率 5%', changes: [{ id: 'dr26', set: 0.05 }] },
        { label: '国防 +10%、科技 +15%', changes: [{ id: 'g_def', set: 0.1 }, { id: 'g_sci', set: 0.15 }] },
        { label: '利率上行 0.5 个百分点', changes: [{ id: 'rcg', add: 0.005 }] },
        { label: '转移支付多增 5%', changes: [{ id: 'g_tr', set: 0.072 }] },
      ],
      items: [
        { mode: 'c26' },
        { mode: 'absorb', when: (m) => m.c26 === 'rate' },
        { mode: 'l26' },
        { title: '宏观与收入', ids: ['g_nom', 'eps', 'g_rc', 'g_rl', 'gdp25'], open: true },
        { title: '赤字', ids: ['dr26', 'dl26', 'dc26', 'd26'], open: true },
        { title: '调入资金', ids: ['tstab26', 'tsoe26', 'tl26'] },
        { title: '中央本级支出（增速）', ids: ['g_def', 'g_sci', 'g_sec', 'g_edu', 'g_grain', 'g_dip', 'oth26', 'oth_pl', 'kprop', 'rcg'], note: '选"本级各项等比例"时，这里的增速是<b>计划</b>增速，实际数 = 计划数 × 分摊系数。' },
        { title: '转移支付、预备费与地方支出', ids: ['g_tr', 'tr26', 'res26', 'g_el', 'el26'] },
      ],
    },
    rebuild: update,
  };
}
