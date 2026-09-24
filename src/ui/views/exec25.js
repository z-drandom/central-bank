// 图③ 2025 年全国一般公共预算执行情况
import { h } from '../dom.js';
import { renderSankey } from '../sankey-view.js';
import { ledgerHTML, termHTML } from '../common.js';
import { TAXES_2025, EXP_2025 } from '../../model/data.js';
import { TAX_IDS, EXP25_IDS } from '../../model/specs.js';
import { fmt } from '../../model/format.js';

export function sankeyDef(app) {
  const v = app.v;
  const nodes = [
    ...TAXES_2025.map((t) => ({ id: `t_${t.id}`, col: 0, color: 'rev', minSlot: 25, label: { pos: 'left', inline: true, name: t.name } })),
    { id: 'tax25', col: 1, color: 'xfer', label: { pos: 'above', name: '税收收入（退税前）' } },
    { id: 'nontax', col: 1, color: 'rev', gapBefore: 90, label: { pos: 'left', name: '非税收入' } },
    { id: 'rebate', col: 2, color: 'exp', minSlot: 30, label: { pos: 'above', name: '出口退税（抵减）' } },
    { id: 'rev25', col: 2, color: 'xfer', gapBefore: 16, label: { pos: 'above', name: '一般公共预算收入', dy: 0 } },
    { id: 'def25', col: 2, color: 'def', gapBefore: 30, label: { pos: 'left', name: '全国一般公共预算赤字' } },
    { id: 'tin25', col: 2, color: 'xfer', gapBefore: 20, minSlot: 30, label: { pos: 'left', name: '调入资金及使用结转结余' } },
    { id: 'gap25', col: 3, color: 'def', label: { pos: 'below', name: '差额（支出 − 收入）' } },
    { id: 'exp25', col: 4, color: 'xfer', label: { pos: 'above', name: '一般公共预算支出' } },
    ...EXP_2025.map((e) => ({ id: `e_${e.id}`, col: 5, color: 'exp', minSlot: 29, label: { pos: 'right', inline: true, name: e.short ?? e.name } })),
  ];
  const links = [
    ...TAXES_2025.map((t) => ({ s: `t_${t.id}`, t: 'tax25', v: v[`t_${t.id}`], color: 'rev' })),
    { s: 'tax25', t: 'rebate', v: v.rebate, color: 'exp' },
    { s: 'tax25', t: 'rev25', v: v.taxnet25, color: 'rev', bind: 'taxnet25' },
    { s: 'nontax', t: 'rev25', v: v.nontax, color: 'rev' },
    { s: 'rev25', t: 'exp25', v: v.rev25, color: 'link' },
    { s: 'def25', t: 'gap25', v: v.def25, color: 'def' },
    { s: 'tin25', t: 'gap25', v: v.tin25, color: 'xfer' },
    { s: 'gap25', t: 'exp25', v: v.gap25, color: 'def' },
    ...EXP_2025.map((e) => ({ s: 'exp25', t: `e_${e.id}`, v: v[`e_${e.id}`], color: 'exp' })),
  ];
  return {
    nodes,
    links,
    width: 1120,
    height: 440,
    ky: 440 / 300000,
    nodeW: 12,
    gap: 6,
    colX: (c) => [238, 384, 530, 660, 780, 896][c],
    colAlign: { 0: 'top', 1: 'top', 2: 'top', 4: 'top', 5: 'top' },
    colOffset: { 3: 318 },
    padTop: 40,
    aria: '2025 年全国一般公共预算执行资金流向',
  };
}

export default function exec25(app) {
  const chart = h('div', { class: 'chart wide' });
  const ledger = h('div');
  const split = h('div', { class: 'tbl-wrap' });
  const el = h('div', { style: { display: 'contents' } },
    h('div', { class: 'sheet' },
      h('h3', {}, '16 个税种如何变成一般公共预算收入，又如何花出去', h('small', {}, '单位：亿元')),
      chart,
      h('div', { class: 'swipe-hint' }, '← 左右滑动查看完整图 →'),
      h('div', { class: 'legend' },
        h('span', {}, h('i', { style: { background: 'var(--rev)' } }), '收入'),
        h('span', {}, h('i', { style: { background: 'var(--exp)' } }), '支出 / 抵减'),
        h('span', {}, h('i', { style: { background: 'var(--def)' } }), '赤字与差额'),
        h('span', {}, h('i', { style: { background: 'var(--xfer)' } }), '汇总 / 调入'),
      ),
    ),
    h('div', { class: 'sheet' }, h('h3', {}, '账是怎么平的'), h('div', { class: 'ledger-legend' }, h('span', {}, h('i', { class: 'p' }, '调'), '可调参数'), h('span', {}, h('i', {}, '算'), '由公式算出——换一个平衡规则，看“算”字挪到哪一项')), ledger),
    h('div', { class: 'sheet' },
      h('h3', {}, '分税制：同一笔税，中央地方怎么分', h('small', {}, '图③只有全国合计。用法定分享比例拆出中央收入，再按图②增速接到 2026 年')),
      split,
    ),
  );

  function update() {
    const v = app.v;
    chart.innerHTML = renderSankey(app, sankeyDef(app));
    ledger.innerHTML = [
      ledgerHTML(app, [{ id: 'tax25', cls: 'rev', label: '税收（16 项合计）' }, '−', { id: 'rebate', cls: 'exp' }, '+', { id: 'nontax', cls: 'rev' }, '=', { id: 'rev25', cls: 'total' }], { title: '收入' }),
      ledgerHTML(app, [{ id: 'exp25', cls: 'exp' }, '−', { id: 'rev25', cls: 'rev' }, '=', { id: 'gap25', cls: 'total' }], { title: '差额' }),
      ledgerHTML(app, [{ id: 'gap25', cls: 'total' }, '=', { id: 'def25', cls: 'def' }, '+', { id: 'tin25', cls: 'xfer' }], { title: '差额由谁来补（取决于"2025 平衡规则"）' }),
      ledgerHTML(app, [{ id: 'def25', cls: 'def' }, '÷', { id: 'gdp25' }, '=', { id: 'dr25', cls: 'total' }], { title: '赤字率' }),
      ledgerHTML(app, [{ id: 'core25', cls: 'exp', label: '支出（不含补充稳定基金）' }, '−', { id: 'rev25', cls: 'rev' }, '=', { id: 'realdef25', cls: 'total' }], { title: '实际赤字（图④口径）' }),
    ].join('');
    // 分税制表
    const rows = TAXES_2025.filter((t) => t.share > 0).map((t) => {
      const tv = v[`t_${t.id}`];
      const sh = v[`s_${t.id}`];
      return `<tr class="click" data-node="s_${t.id}"><td>${t.name}</td><td class="n">${fmt(app.sim.spec(`t_${t.id}`), tv, { unit: false })}</td><td class="n">${(sh * 100).toFixed(0)}%</td><td class="n">${(tv * sh).toLocaleString('en-US', { maximumFractionDigits: 0 })}</td><td class="n">${(tv * (1 - sh)).toLocaleString('en-US', { maximumFractionDigits: 0 })}</td></tr>`;
    });
    const localOnly = TAXES_2025.filter((t) => t.share === 0).reduce((a, t) => a + v[`t_${t.id}`], 0);
    split.innerHTML = `<table class="tbl"><thead><tr><th>税种</th><th class="n">2025 年</th><th class="n">中央比例</th><th class="n">归中央</th><th class="n">归地方</th></tr></thead><tbody>
      ${rows.join('')}
      <tr><td>房产税、契税、土地增值税等 8 项地方税</td><td class="n">${localOnly.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td><td class="n">0%</td><td class="n">0</td><td class="n">${localOnly.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td></tr>
      <tr class="click" data-node="s_rb"><td>出口退税（抵减）</td><td class="n">−${v.rebate.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td><td class="n">${(v.s_rb * 100).toFixed(0)}%</td><td class="n">−${(v.rebate * v.s_rb).toLocaleString('en-US', { maximumFractionDigits: 0 })}</td><td class="n">−${(v.rebate * (1 - v.s_rb)).toLocaleString('en-US', { maximumFractionDigits: 0 })}</td></tr>
      <tr class="click" data-node="s_nt"><td>非税收入（中央占比为校准值）</td><td class="n">${v.nontax.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td><td class="n">${(v.s_nt * 100).toFixed(1)}%</td><td class="n">${(v.nontax * v.s_nt).toLocaleString('en-US', { maximumFractionDigits: 0 })}</td><td class="n">${(v.nontax * (1 - v.s_nt)).toLocaleString('en-US', { maximumFractionDigits: 0 })}</td></tr>
      </tbody></table>
      <div style="margin-top:10px">${ledgerHTML(app, [{ id: 'rc25', cls: 'rev' }, '+', { id: 'rl25', cls: 'rev' }, '=', { id: 'rev25', cls: 'total' }], { title: '2025 年中央 + 地方 = 全国' })}
      ${ledgerHTML(app, [{ id: 'rc25', cls: 'rev' }, '→', { id: 'rc26', cls: 'rev', label: '2026 中央收入' }, '　', { id: 'rl25', cls: 'rev' }, '→', { id: 'rl26', cls: 'rev', label: '2026 地方收入' }], { title: '接到图②：2026 预算数 = 2025 执行数 × (1 + 增速)' })}</div>`;
  }

  return {
    id: 'y25',
    img: '③',
    title: '2025 执行',
    heading: '2025 年一般公共预算执行：税从哪来、钱花哪去、缺口谁补',
    lead: '税收收入 197,700 亿是 16 个税种的直接加总，要先扣掉出口退税 21,337 亿，再加上非税收入，才是一般公共预算收入 216,045 亿。支出比收入多出的 72,353 亿"差额"，由赤字和调入资金共同弥补。<b>这一年的收入是 2026 年预算的基数</b>，改动它会一路传到图②和图①。',
    mods: ['y25'],
    el,
    update,
    panelConfig: {
      title: '调 2025 执行数',
      presets: [
        { label: '楼市再降温', changes: [{ id: 't_deed', mul: 0.85 }, { id: 't_lat', mul: 0.8 }, { id: 't_prop', mul: 0.95 }, { id: 't_farm', mul: 0.9 }], note: '契税 −15%、土地增值税 −20%、房产税 −5%、耕地占用税 −10%' },
        { label: '外贸冲击', changes: [{ id: 't_imp', mul: 0.85 }, { id: 't_tar', mul: 0.9 }, { id: 'rebate', mul: 0.9 }], note: '进口环节税 −15%、关税 −10%、出口退税 −10%（出口少了，退税也少）' },
        { label: '增值税 −10%', changes: [{ id: 't_vat', mul: 0.9 }] },
        { label: '消费税下划地方一半', changes: [{ id: 's_con', set: 0.5 }], note: '国内消费税中央分享比例从 100% 降到 50%' },
        { label: '反事实：多借不调入', modes: { y25: 'transfer' }, changes: [{ id: 'tin25', set: 0 }], note: '切换为"调入锁定"，并假设不调入任何资金' },
      ],
      items: [
        { mode: 'y25' },
        { title: '税收（16 个税种）', ids: TAX_IDS.slice(0, 6), open: true },
        { title: '税收（其余 10 项）', ids: TAX_IDS.slice(6) },
        { title: '出口退税与非税收入', ids: ['rebate', 'nontax'], open: true },
        { title: '赤字与调入资金', ids: ['def25', 'tin25', 'dl25'], open: true },
        { title: '支出（13 类）', ids: EXP25_IDS },
        { title: '分税制：中央分享比例', ids: ['s_vat', 's_cit', 's_pit', 's_stamp', 's_imp', 's_con', 's_tar', 's_veh', 's_rb', 's_nt'] },
      ],
    },
    rebuild: update,
  };
}
