// 图① 中国公共债务的构成与规模
import { h, esc } from '../dom.js';
import { ledgerHTML, deltaParts } from '../common.js';
import { fmt } from '../../model/format.js';
import { MODE_OPTIONS } from '../../model/specs.js';

const WY = (v) => (v / 1e4).toFixed(2);

function blocksDef(app, when) {
  const v = app.v;
  const end = when === 'end';
  const scope = app.sim.modes.scope;
  // 期初/年末的各块数值与"其中 2026 年新增"部分
  const bc = end ? v.bc1 : v.bc0;
  const blg = end ? v.blg1 : v.blg0;
  const bls = end ? v.bls1 : v.bls0;
  const hs = end ? v.hsel1 : v.hsel;
  const hComp = [];
  if (scope === 'official') hComp.push({ id: 'hoff_adj', name: '官方披露隐债', v: v.hoff_adj });
  else {
    hComp.push({ id: 'h_bond', name: 'LGFV 债券', v: v.h_bond });
    hComp.push({ id: 'h_oib', name: 'LGFV 其它有息负债', v: v.h_oib });
    if (scope === 'broad') hComp.push({ id: 'h_ol', name: 'LGFV 其它负债', v: v.h_ol });
  }
  // 年末：隐债各分项按比例扣减置换额
  const hTot0 = hComp.reduce((a, x) => a + x.v, 0);
  const k = hTot0 > 0 ? hs / hTot0 : 0;
  for (const x of hComp) x.v *= end ? k : 1;
  return {
    bc, blg, bls, hs, hComp,
    gov: bc + blg + bls,
    total: bc + blg + bls + hs,
    gdp: end ? v.gdp26 : v.gdp25,
    newC: end ? v.bc1 - v.bc0 : 0,
    newLg: end ? v.blg1 - v.blg0 : 0,
    newLs: end ? v.bls1 - v.bls0 : 0,
    ids: end
      ? { total: 'broad1', gov: 'gov1', bc: 'bc1', bl: 'bl1', blg: 'blg1', bls: 'bls1', h: 'hsel1', gdp: 'gdp26' }
      : { total: 'broad0', gov: 'gov0', bc: 'bc0', bl: 'bl0', blg: 'blg0', bls: 'bls0', h: 'hsel', gdp: 'gdp25' },
  };
}

function renderBlocks(app, when) {
  const d = blocksDef(app, when);
  const b = app.b;
  const W = 980, H = 470, top = 24, base = top + H;
  const maxV = Math.max(d.total, d.gdp, b.gov1 + b.hwide, 1) * 1.04;
  const ky = H / maxV;
  const colX = [60, 210, 360, 510];
  const cw = 136;
  let out = '';
  const block = (x, y0, val, cls, id, name, opts = {}) => {
    const hgt = val * ky;
    const y = y0 - hgt;
    let s = `<g data-node="${id}"><rect x="${x}" y="${y.toFixed(1)}" width="${cw}" height="${Math.max(hgt, 0.5).toFixed(1)}" class="blk-${cls}" rx="2" stroke="var(--surface)" stroke-width="1.5"><title>${esc(name)}</title></rect>`;
    if (opts.newPart > 0) {
      const nh = opts.newPart * ky;
      s += `<rect x="${x}" y="${y.toFixed(1)}" width="${cw}" height="${nh.toFixed(1)}" fill="url(#hatch)" pointer-events="none"/>`;
    }
    if (hgt >= 34) {
      const dp = deltaParts(app, id);
      s += `<text x="${x + cw / 2}" y="${(y + hgt / 2 - (dp ? 8 : 2)).toFixed(1)}" text-anchor="middle" class="t-name" style="fill:#fff">${esc(name)}</text>`;
      s += `<text x="${x + cw / 2}" y="${(y + hgt / 2 + (dp ? 8 : 14)).toFixed(1)}" text-anchor="middle" class="t-val" style="fill:#fff;opacity:.92">${WY(val)} 万亿</text>`;
      if (dp) s += `<text x="${x + cw / 2}" y="${(y + hgt / 2 + 23).toFixed(1)}" text-anchor="middle" class="t-val" style="fill:#fff;font-weight:700">${esc(dp.text)}</text>`;
    } else if (hgt >= 14) {
      s += `<text x="${x + cw / 2}" y="${(y + hgt / 2 + 4).toFixed(1)}" text-anchor="middle" class="t-small" style="fill:#fff">${esc(name)} ${WY(val)}</text>`;
    }
    return s + '</g>';
  };
  // A：广义
  out += block(colX[0], base, d.total, 'total', d.ids.total, '广义政府债务');
  // B：全国政府债务 + 隐性债务
  out += block(colX[1], base, d.gov, 'xfer', d.ids.gov, '全国政府债务');
  out += block(colX[1], base - d.gov * ky, d.hs, 'hid', d.ids.h, '隐性债务');
  // C：国债 + 地方债 + 隐债分项
  out += block(colX[2], base, d.bc, 'xfer', d.ids.bc, '国债', { newPart: d.newC });
  out += block(colX[2], base - d.bc * ky, d.blg + d.bls, 'rev', d.ids.bl, '地方政府债券', { newPart: d.newLg + d.newLs });
  let y = base - d.gov * ky;
  for (const c of d.hComp) {
    out += block(colX[2], y, c.v, 'hid', c.id, c.name);
    y -= c.v * ky;
  }
  // D：地方一般债 + 专项债
  const yL = base - d.bc * ky;
  out += block(colX[3], yL, d.blg, 'rev', d.ids.blg, '地方一般债', { newPart: d.newLg });
  out += block(colX[3], yL - d.blg * ky, d.bls, 'gold', d.ids.bls, '地方专项债', { newPart: d.newLs });
  // 列标题
  const heads = ['广义口径', '显性 / 隐性', '按发行主体', '地方债拆分'];
  heads.forEach((t, i) => (out += `<text x="${colX[i] + cw / 2}" y="${base + 18}" text-anchor="middle" class="t-small">${t}</text>`));
  // GDP 参考线与 60% 线
  const gy = base - d.gdp * ky;
  const g60 = base - d.gdp * 0.6 * ky;
  out += `<g data-node="${d.ids.gdp}"><line x1="40" x2="${W - 290}" y1="${gy}" y2="${gy}" stroke="var(--def)" stroke-dasharray="6 4" stroke-width="1.5"/>
    <text x="${W - 285}" y="${gy + 4}" class="t-name t-def">名义 GDP ${WY(d.gdp)} 万亿（=100%）</text></g>`;
  out += `<line x1="40" x2="${W - 290}" y1="${g60}" y2="${g60}" stroke="var(--gold)" stroke-dasharray="3 4" stroke-width="1.2"/>
    <text x="${W - 285}" y="${g60 + 4}" class="t-small" style="fill:var(--gold)">60% 参考线</text>`;
  // 纵轴刻度（万亿）
  for (let t = 0; t <= maxV; t += 200000) {
    const ty = base - t * ky;
    out += `<line x1="44" x2="52" y1="${ty}" y2="${ty}" class="stroke-muted"/><text x="40" y="${ty + 4}" text-anchor="end" class="axis-t">${t / 1e4}</text>`;
  }
  out += `<text x="4" y="${top - 8}" class="axis-t">万亿元</text>`;
  // 右侧：比率
  const rx = W - 280;
  const rows = [
    ['政府负债率', d.gov / d.gdp, when === 'end' ? 'debt_gdp1' : 'debt_gdp0'],
    ['含隐债负债率', d.total / d.gdp, when === 'end' ? 'broad_gdp1' : 'broad_gdp0'],
  ];
  rows.forEach(([t, r, id], i) => {
    const yy = base - 120 + i * 56;
    const dp = deltaParts(app, id);
    out += `<g data-node="${id}"><text x="${rx}" y="${yy}" class="t-small">${t}</text><text x="${rx}" y="${yy + 24}" class="t-big">${(r * 100).toFixed(1)}%</text>${dp ? `<text x="${rx + 86}" y="${yy + 24}" class="${dp.up ? 't-up' : 't-down'}">${esc(dp.text)}</text>` : ''}</g>`;
  });
  const defs = `<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="rgba(255,255,255,0.18)"/><line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.75)" stroke-width="2.2"/></pattern></defs>`;
  return `<svg viewBox="0 0 ${W} ${base + 30}" role="img" aria-label="政府债务构成（按比例）">${defs}${out}</svg>`;
}

function scopeBars(app) {
  const v = app.v;
  const gdp = v.gdp25;
  const rows = [
    { label: '全国政府债务（国债 + 地方债）', val: v.gov0, id: 'gov0' },
    { label: '＋ 官方口径隐债', val: v.gov0 + v.hoff_adj, id: 'broad_lo', scope: 'official' },
    { label: '＋ 城投有息债务', val: v.gov0 + v.hib, id: 'hib', scope: 'interest' },
    { label: '＋ 城投全部负债（宽口径）', val: v.broad_hi, id: 'broad_hi', scope: 'broad' },
  ];
  const max = Math.max(...rows.map((r) => r.val), gdp) * 1.02;
  const cur = app.sim.modes.scope;
  return rows.map((r) => `
    <div class="sbar ${r.scope === cur ? 'on' : ''}" ${r.scope ? `data-scope="${r.scope}" role="button" tabindex="0" title="切换到此口径"` : ''}>
      <div class="sbar-l">${esc(r.label)}</div>
      <div class="sbar-track"><i style="width:${((r.val / max) * 100).toFixed(1)}%"></i><b style="left:${((gdp / max) * 100).toFixed(1)}%"></b></div>
      <div class="sbar-v num" data-node="${r.id}">${WY(r.val)} 万亿 · ${((r.val / gdp) * 100).toFixed(1)}%</div>
    </div>`).join('');
}

export default function debt(app) {
  let when = 'start';
  const chart = h('div', { class: 'chart mid' });
  const seg = h('div', { class: 'seg', style: { display: 'inline-flex' } });
  const setWhen = (w) => { when = w; update(); };
  seg.append(
    h('button', { type: 'button', 'data-w': 'start', onclick: () => setWhen('start') }, '期初（图①时点）'),
    h('button', { type: 'button', 'data-w': 'end', onclick: () => setWhen('end') }, '2026 年末'),
  );
  const bars = h('div', { class: 'sbars' });
  bars.addEventListener('click', (e) => {
    const t = e.target.closest('[data-scope]');
    if (t && !e.target.closest('[data-node]')) app.setMode('scope', t.dataset.scope);
  });
  const ledger = h('div');
  const interest = h('div');
  const el = h('div', { style: { display: 'contents' } },
    h('div', { class: 'sheet' },
      h('h3', {}, '债务积木（按比例）', h('small', {}, '块的高度与余额成正比；斜纹 = 2026 年新增；红色虚线 = GDP')),
      h('div', { style: { marginBottom: '8px' } }, seg),
      chart,
    ),
    h('div', { class: 'sheet' },
      h('h3', {}, '隐性债务有多大？取决于口径', h('small', {}, '图①给出的区间：106.55 ~ 147.88 万亿。竖线 = 2025 年 GDP。点击一行切换口径')),
      bars,
    ),
    h('div', { class: 'sheet' }, h('h3', {}, '存量与流量'), ledger),
    h('div', { class: 'sheet' }, h('h3', {}, '利息账：余额 × 利率 = 付息', h('small', {}, '付息回到图②的"债务付息支出"')), interest),
  );

  function update() {
    for (const b of seg.children) b.setAttribute('aria-pressed', String(b.dataset.w === when));
    chart.innerHTML = renderBlocks(app, when);
    bars.innerHTML = scopeBars(app);
    ledger.innerHTML = [
      ledgerHTML(app, [{ id: 'bc0', cls: 'xfer' }, '+', { id: 'bl0', cls: 'rev' }, '=', { id: 'gov0', cls: 'total' }], { title: '全国政府债务（图①，单位：万亿元）', scale: 'wanyi' }),
      ledgerHTML(app, [{ id: 'bl0', cls: 'rev' }, '+', { id: 'hoff_adj', cls: 'hid' }, '=', { id: 'local_lo', cls: 'total' }, '　', { id: 'bl0', cls: 'rev' }, '+', { id: 'hwide', cls: 'hid' }, '=', { id: 'local_hi', cls: 'total' }], { title: '地方债务合计：下限 / 上限（图①表格）', scale: 'wanyi' }),
      ledgerHTML(app, [{ id: 'bc0', cls: 'xfer' }, '+', { id: 'dc26', cls: 'def' }, '+', { id: 'stb26', cls: 'xfer' }, '=', { id: 'bc1', cls: 'total' }], { title: '国债：年末 = 年初 + 中央赤字（图②）+ 特别国债', scale: 'wanyi' }),
      ledgerHTML(app, [{ id: 'blg0', cls: 'rev' }, '+', { id: 'dl26', cls: 'def' }, '=', { id: 'blg1', cls: 'total' }, '　', { id: 'bls0', cls: 'gold' }, '+', { id: 'sp26' }, '+', { id: 'swap26', cls: 'hid' }, '=', { id: 'bls1', cls: 'total' }], { title: '地方债：一般债随地方赤字增加；专项债随新增专项债和置换增加', scale: 'wanyi' }),
      ledgerHTML(app, [{ id: 'hsel', cls: 'hid' }, '−', { id: 'swap26', cls: 'hid' }, '=', { id: 'hsel1', cls: 'total' }], { title: '隐性债务：置换让它减少，但广义总量不变', scale: 'wanyi' }),
      ledgerHTML(app, [{ id: 'gov1', cls: 'xfer' }, '÷', { id: 'gdp26' }, '=', { id: 'debt_gdp1', cls: 'total' }, '　', { id: 'broad1', cls: 'hid' }, '÷', { id: 'gdp26' }, '=', { id: 'broad_gdp1', cls: 'total' }], { title: '负债率', scale: 'wanyi' }),
    ].join('');
    interest.innerHTML = [
      ledgerHTML(app, [{ id: 'rcg' }, '×', { id: 'bc0', cls: 'xfer' }, '=', { id: 'int26', cls: 'exp' }], { title: '中央：国债付息，进入图②中央本级支出（单位：亿元）', scale: 'yi' }),
      ledgerHTML(app, [{ id: 'rl' }, '×', { id: 'blg0', cls: 'rev' }, '=', { id: 'int_lg26', cls: 'exp' }, '　', { id: 'rl' }, '×', { id: 'bls0', cls: 'gold' }, '=', { id: 'int_ls26', cls: 'exp' }], { title: '地方：一般债利息走一般公共预算，专项债利息走政府性基金预算', scale: 'yi' }),
      ledgerHTML(app, [{ id: 'rh' }, '×', { id: 'hib_sel', cls: 'hid' }, '=', { id: 'int_h26', cls: 'exp' }], { title: '城投：隐性债务的利息由融资平台自己付（成本更高）', scale: 'yi' }),
      ledgerHTML(app, [{ id: 'int_gb26', cls: 'exp' }, '÷', { id: 'r26', cls: 'rev' }, '=', { id: 'intburden26', cls: 'total' }], { title: '付息压力', scale: 'yi' }),
      ledgerHTML(app, [{ id: 'swap26', cls: 'hid' }, '×', '(', { id: 'rh' }, '−', { id: 'rl' }, ')', '=', { id: 'swapsave26', cls: 'total' }], { title: '置换化债每年省下的利息', scale: 'yi' }),
    ].join('');
  }

  return {
    id: 'debt',
    img: '①',
    title: '债务',
    heading: '公共债务：显性的 96 万亿，加上隐性的多少？',
    lead: '国债和地方政府债券是"显性债务"，图②的赤字每年往里加；城投平台（LGFV）的负债是"隐性债务"，大小取决于口径。<b>置换</b>把隐性债务换成利率更低的地方债：隐性减少、显性增加、总量不变、利息下降。',
    mods: ['debt'],
    el,
    update,
    panelConfig: {
      title: '调债务',
      presets: [
        { label: '化债加速：2026 置换 4 万亿', changes: [{ id: 'swap26', set: 40000 }] },
        { label: '修正时点：扣除 2025 年已置换', changes: [{ id: 'swap25', set: 20000 }] },
        { label: '城投成本降到 4%', changes: [{ id: 'rh', set: 0.04 }] },
        { label: '发行 1.3 万亿超长期特别国债', changes: [{ id: 'stb26', set: 13000 }] },
      ],
      items: [
        { mode: 'scope' },
        { title: '2026 年新增', ids: ['stb26', 'sp26', 'swap26'], open: true },
        { title: '利率', ids: ['rcg', 'rl', 'rh'], open: true },
        { title: '存量（图①）', ids: ['bc_obs', 'bl_obs', 'sh_lg', 'h_bond', 'h_oib', 'h_ol', 'h_off', 'swap25'] },
        { title: '来自 2026 预算的赤字', ids: ['dr26', 'dl26'], note: '赤字在"2026 预算"页调整效果相同。' },
      ],
    },
    rebuild: update,
  };
}

export { MODE_OPTIONS };
