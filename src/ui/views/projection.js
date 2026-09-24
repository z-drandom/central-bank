// 十年推演：债务动态 Δd = d₋₁·(r − g)/(1 + g) + 基本赤字率 + 其他债务融资
import { h, esc } from '../dom.js';
import { lineChart, stackChart, fanChart } from '../charts.js';
import { fan, FAN_RANGES } from '../../model/fan.js';
import { ledgerHTML } from '../common.js';
import { formulaLines, fmt } from '../../model/format.js';
import { PROJ_START, PROJ_END } from '../../model/specs.js';

const YEARS = Array.from({ length: PROJ_END - PROJ_START + 1 }, (_, i) => PROJ_START + i);

export default function projection(app) {
  let year = PROJ_START + 1;
  const main = h('div', { class: 'chart' });
  const dec = h('div', { class: 'chart' });
  const small1 = h('div', { class: 'chart' });
  const small2 = h('div', { class: 'chart' });
  const small3 = h('div', { class: 'chart' });
  const ruleHint = h('p', { class: 'hint', style: { margin: '6px 0 0' } });
  const yearSel = h('select', { id: 'proj-year', 'aria-label': '选择年份', class: 'btn' });
  YEARS.forEach((y) => yearSel.append(h('option', { value: y }, `${y} 年`)));
  yearSel.value = String(year);
  yearSel.addEventListener('change', () => { year = Number(yearSel.value); update(); });
  const fx = h('div');
  const fanBox = h('div', { class: 'chart' });
  const fanNote = h('p', { class: 'hint', style: { margin: '6px 0 0' } });
  let fanTimer = null;
  const table = h('div', { class: 'tbl-wrap' });
  const el = h('div', { style: { display: 'contents' } },
    h('div', { class: 'sheet' },
      h('h3', {}, '负债率会走到哪里', h('small', {}, '实线 = 当前参数；虚线 = 原图基线；2025 年为图①起点')),
      main,
      ruleHint,
    ),
    h('div', { class: 'sheet' },
      h('h3', {}, '假设不确定时，负债率会落在哪里', h('small', {}, '在下方所列区间内同时随机改动四个假设，重算 300 次；深色带 = 中间 50%，浅色带 = 中间 80%')),
      fanBox,
      fanNote,
    ),
    h('div', { class: 'sheet' },
      h('h3', {}, '每年负债率变动拆成三块', h('small', {}, '柱 = 分量（个百分点），圆点 = 当年负债率净变动')),
      dec,
      h('div', { class: 'legend' },
        h('span', {}, h('i', { style: { background: 'var(--def)' } }), '基本赤字率（不含利息的赤字 ÷ GDP）'),
        h('span', {}, h('i', { style: { background: 'var(--gold)' } }), '其他债务融资（专项债、特别国债、置换）'),
        h('span', {}, h('i', { style: { background: 'var(--xfer)' } }), '滚雪球效应 d·(r − g)/(1 + g)'),
      ),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', margin: '14px 0 4px', flexWrap: 'wrap' } }, h('b', {}, '拆开看某一年：'), yearSel),
      fx,
    ),
    h('div', { class: 'ov-grid', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' } },
      h('div', { class: 'sheet' }, h('h3', {}, '付息 ÷ 一般预算收入', h('small', {}, '全口径 = 再加上专项债和城投债的利息')), small1),
      h('div', { class: 'sheet' }, h('h3', {}, '有效利率 r 与名义增速 g', h('small', {}, 'r < g 时，时间站在借债人一边')), small2),
      h('div', { class: 'sheet' }, h('h3', {}, '非付息支出占 GDP', h('small', {}, '真正能花在民生、建设上的钱')), small3),
    ),
    h('div', { class: 'sheet' }, h('h3', {}, '逐年数据', h('small', {}, '点任一单元格看公式')), table),
  );

  const ser = (key, from0) => YEARS.map((y) => ({ x: y, id: `p_${key}_${y}` }));
  function pts(key, first, src) {
    const arr = [];
    if (first) arr.push({ x: PROJ_START - 1, y: src[first], id: first });
    for (const y of YEARS) arr.push({ x: y, y: src[`p_${key}_${y}`], id: `p_${key}_${y}` });
    return arr;
  }

  function update() {
    const v = app.v, b = app.b;
    main.innerHTML = lineChart({
      series: [
        { label: '含隐债负债率', cls: 'stroke-hid', pts: pts('w', 'broad_gdp0', v), base: pts('w', 'broad_gdp0', b) },
        { label: '政府负债率', cls: 'stroke-xfer', pts: pts('d', 'debt_gdp0', v), base: pts('d', 'debt_gdp0', b) },
      ],
      refs: [{ y: 0.6, label: '60% 参考线' }],
      yMin: 0.4,
      width: 760,
      height: 300,
      title: '负债率推演',
    });
    const parts = [
      { label: '基本赤字率', cls: 'fill-def', vals: YEARS.map((y) => ({ v: v[`p_pd_${y}`], id: `p_pd_${y}` })) },
      { label: '其他债务融资', cls: 'fill-gold', vals: YEARS.map((y) => ({ v: v[`p_sfa_${y}`], id: `p_sfa_${y}` })) },
      { label: '滚雪球效应', cls: 'fill-xfer', vals: YEARS.map((y) => ({ v: v[`p_snow_${y}`], id: `p_snow_${y}` })) },
    ];
    dec.innerHTML = stackChart({ years: YEARS, parts, net: YEARS.map((y) => ({ v: v[`p_dd_${y}`], id: `p_dd_${y}` })), width: 760, height: 250, title: '负债率变动分解' });
    small1.innerHTML = lineChart({
      series: [
        { label: '全口径', cls: 'stroke-hid', pts: pts('iball', null, v), base: pts('iball', null, b) },
        { label: '一般预算', cls: 'stroke-exp', pts: pts('ib', null, v), base: pts('ib', null, b) },
      ],
      refs: [{ y: 0.1, label: '10%' }],
      width: 420, height: 220, yMin: 0, yFmt: (x) => `${(x * 100).toFixed(0)}%`, title: '付息压力',
    });
    small2.innerHTML = lineChart({
      series: [
        { label: '有效利率 r', cls: 'stroke-def', pts: pts('r', null, v), base: pts('r', null, b) },
        { label: '名义增速 g', cls: 'stroke-rev', pts: YEARS.map((y) => ({ x: y, y: y === PROJ_START ? v.g_nom : v.pg, id: y === PROJ_START ? 'g_nom' : 'pg' })) },
      ],
      width: 420, height: 220, yMin: 0, yFmt: (x) => `${(x * 100).toFixed(1)}%`, title: '利率与增速',
    });
    small3.innerHTML = lineChart({
      series: [{ label: '非付息支出/GDP', cls: 'stroke-rev', pts: YEARS.map((y) => ({ x: y, y: v[`p_PE_${y}`] / v[y === PROJ_START ? 'gdp26' : `p_Y_${y}`], id: `p_PE_${y}` })), base: YEARS.map((y) => ({ x: y, y: b[`p_PE_${y}`] / b[y === PROJ_START ? 'gdp26' : `p_Y_${y}`] })) }],
      width: 420, height: 220, yFmt: (x) => `${(x * 100).toFixed(1)}%`, title: '非付息支出占 GDP',
    });
    ruleHint.innerHTML = app.sim.modes.proj === 'rate'
      ? '当前规则是<b>赤字率不变</b>：利率上升不会让负债率更高，而是让付息挤占非付息支出（见下方"非付息支出占 GDP"）。想看利率推高负债率，把推演规则切到"支出增速不变"。'
      : '当前规则是<b>支出增速不变</b>：付息增加直接变成更大的赤字，负债率随之上升。';
    // 某一年的分解公式
    const L = formulaLines(app.sim.graph, `p_snow_${year}`, v);
    fx.innerHTML = `${ledgerHTML(app, [{ id: `p_dd_${year}`, cls: 'total', label: `${year} 负债率变动` }, '=', { id: `p_snow_${year}`, cls: 'xfer', label: '滚雪球效应' }, '+', { id: `p_pd_${year}`, cls: 'def', label: '基本赤字率' }, '+', { id: `p_sfa_${year}`, cls: 'gold', label: '其他债务融资' }], { title: '恒等式（精确成立，不是近似）' })}
      <div class="fx-table" style="margin-top:10px">
        <div class="k">公式</div><div class="v">${L.sym}</div>
        <div class="k">读法</div><div class="v read">${L.read}</div>
        <div class="k">代入</div><div class="v subst">${L.subst}</div>
      </div>
      <p class="note" style="margin:8px 0 0">推导：B<sub>t</sub> = B<sub>t−1</sub> + D<sub>t</sub> + 其他融资，D<sub>t</sub> = 基本赤字 + 利息，利息 = r·B<sub>t−1</sub>，Y<sub>t</sub> = Y<sub>t−1</sub>(1+g)。两边除以 Y<sub>t</sub> 再减去 d<sub>t−1</sub>，即得上式。专项债利息由政府性基金预算支付，不进入 r，所以有效利率低于票面利率。</p>`;
    // 扇形图：计算量较大（300 次全图重算），停止拖动 250ms 后再算
    clearTimeout(fanTimer);
    fanTimer = setTimeout(() => {
      const yrs = YEARS;
      const r = fan(app.sim.graph, app.sim.inputs, 'p_d', yrs, { n: 300 });
      fanBox.innerHTML = fanChart({ years: yrs, q: r.q, current: yrs.map((y) => ({ x: y, y: app.v[`p_d_${y}`], id: `p_d_${y}` })), refs: [{ y: 0.6, label: '60% 参考线' }], title: '政府负债率不确定性范围' });
      const ranges = FAN_RANGES.filter((x) => app.sim.isInput(x.id)).map((x) => `${x.label} ${x.kind === 'mul' ? `×${x.lo}～×${x.hi}` : `${x.lo >= 0 ? '+' : ''}${x.id === 'peps' ? x.lo : (x.lo * 100).toFixed(1) + 'pp'}～+${x.id === 'peps' ? x.hi : (x.hi * 100).toFixed(1) + 'pp'}`}`).join('；');
      fanNote.textContent = `抽样区间（相对当前参数）：${ranges}。每一次抽样都用同一套公式重算整张依赖图；这是"如果假设在这个范围内"的敏感性展示，不是概率预测。`;
    }, 250);
    // 表格
    const cols = [
      ['GDP（万亿）', 'Y', (y) => (y === PROJ_START ? 'gdp26' : `p_Y_${y}`)],
      ['一般预算收入（亿）', 'R', (y) => `p_R_${y}`],
      ['付息（亿）', 'I', (y) => `p_I_${y}`],
      ['赤字（亿）', 'D', (y) => `p_D_${y}`],
      ['赤字率', 'dr', (y) => `p_dr_${y}`],
      ['有效利率', 'r', (y) => `p_r_${y}`],
      ['政府债务（万亿）', 'B', (y) => `p_B_${y}`],
      ['隐性债务（万亿）', 'H', (y) => `p_H_${y}`],
      ['负债率', 'd', (y) => `p_d_${y}`],
      ['含隐债负债率', 'w', (y) => `p_w_${y}`],
      ['付息/收入', 'ib', (y) => `p_ib_${y}`],
    ];
    const cell = (id) => {
      const s = app.sim.spec(id);
      const ch = Math.abs(v[id] - b[id]) > 1e-9 * Math.max(1, Math.abs(b[id]));
      return `<td class="n" data-node="${id}" style="cursor:pointer;${ch ? 'color:var(--up);font-weight:600' : ''}">${esc(fmt(s, v[id], { unit: false, dp: s.unit === 'pct' ? 1 : undefined }))}</td>`;
    };
    table.innerHTML = `<table class="tbl"><thead><tr><th>年份</th>${cols.map((c) => `<th class="n">${c[0]}</th>`).join('')}</tr></thead><tbody>
      ${YEARS.map((y) => `<tr><td>${y}</td>${cols.map((c) => cell(c[2](y))).join('')}</tr>`).join('')}
    </tbody></table>`;
  }

  return {
    id: 'proj',
    title: '十年推演',
    heading: '十年推演：赤字、利率、增速如何决定负债率',
    lead: '把 2026 年预算（图②）和期末债务（图①）当作起点，往后按固定规则滚动十年。负债率的变化可以精确拆成三块：<b>基本赤字</b>、<b>专项债等其他融资</b>、<b>利率与增速之差带来的"滚雪球"</b>。',
    mods: ['proj'],
    el,
    update,
    panelConfig: {
      title: '调推演假设',
      presets: [
        { label: '低增长：名义增速 3%', changes: [{ id: 'pg', set: 0.03 }] },
        { label: '赤字率降到 3%', changes: [{ id: 'pdr', set: 0.03 }] },
        { label: '利率上行 1 个百分点', changes: [{ id: 'pshift', set: 0.01 }] },
        { label: '继续化债：每年置换 1 万亿', changes: [{ id: 'pswap', set: 10000 }] },
        { label: '专项债减半', changes: [{ id: 'psp', set: 22000 }] },
        { label: '紧支出：非付息支出增速 3%', modes: { proj: 'spend' }, changes: [{ id: 'pge', set: 0.03 }] },
      ],
      items: [
        { mode: 'proj' },
        { title: '增长与收入', ids: ['pg', 'peps'], open: true },
        { title: '赤字与支出', ids: ['pdr', 'pge'], open: true },
        { title: '利率与其他融资', ids: ['pshift', 'pphi', 'psp', 'pstb', 'pswap'], open: true },
        { title: '2026 年起点（来自其他页）', ids: ['dr26', 'g_nom', 'swap26', 'rcg', 'rl'] },
      ],
    },
    rebuild: update,
  };
}
