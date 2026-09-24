// 图④ 财政"四本账"（2021 年决算，万亿元）
import { h, esc } from '../dom.js';
import { ledgerHTML, deltaParts, isChanged } from '../common.js';

const f2 = (x) => (Math.abs(x) < 0.005 ? '0.00' : x.toFixed(2));

function box(app, id, x, y, w, hgt, kind, name, o = {}) {
  if (!app.sim.has(id)) return '';
  const v = app.v[id];
  const dp = deltaParts(app, id);
  const ch = isChanged(app, id);
  const auto = !app.sim.isInput(id);
  const cy = y + hgt / 2;
  const big = hgt >= 50;
  const nameY = big ? cy - 6 : cy - 3;
  const valY = big ? cy + 14 : cy + 11;
  return `<g data-node="${id}" tabindex="0" role="button" aria-label="${esc(name)} ${f2(v)} 万亿元">
    <rect class="fb-box k-${kind} ${ch ? 'changed' : ''}" x="${x}" y="${y}" width="${w}" height="${hgt}" rx="${o.r ?? 8}"/>
    <text x="${x + w / 2}" y="${nameY}" text-anchor="middle" class="t-name" style="font-size:${o.fs ?? 12}px">${esc(name)}</text>
    <text x="${x + w / 2}" y="${valY}" text-anchor="middle" class="t-val" style="font-weight:700;${big ? 'font-size:14px' : ''}">${f2(v)}${auto ? '' : ''}${dp ? `<tspan class="${dp.up ? 't-up' : 't-down'}" dx="5">${esc(dp.text)}</tspan>` : ''}</text>
  </g>`;
}

function arrow(d, flow, cls, o = {}) {
  // 账本之间的往来：线宽与流量成正比；账本内部的连接线固定细线
  const w = o.fixed ? 2 : Math.max(1.5, Math.min(8, 1.5 + (Math.abs(flow) || 0) * 2.6));
  const dash = o.dash ? 'stroke-dasharray="6 5"' : '';
  const op = flow <= 1e-6 ? 0.25 : 0.9;
  return `<path class="fb-arrow ${cls}" d="${d}" stroke-width="${w.toFixed(2)}" ${dash} opacity="${op}" marker-end="url(#ah-${cls.replace('a-', '')})"/>`;
}

/** 折线（圆角） */
function ortho(pts, r = 7) {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pts[i];
    if (i < pts.length - 1) {
      const [px, py] = pts[i - 1];
      const [nx, ny] = pts[i + 1];
      const d1 = Math.hypot(x - px, y - py);
      const d2 = Math.hypot(nx - x, ny - y);
      const rr = Math.min(r, d1 / 2, d2 / 2);
      const ax = x - ((x - px) / d1) * rr;
      const ay = y - ((y - py) / d1) * rr;
      const bx = x + ((nx - x) / d2) * rr;
      const by = y + ((ny - y) / d2) * rr;
      d += `L${ax.toFixed(1)},${ay.toFixed(1)}Q${x},${y} ${bx.toFixed(1)},${by.toFixed(1)}`;
    } else d += `L${x},${y}`;
  }
  return d;
}

function op(x, y, t) {
  return `<text x="${x}" y="${y}" text-anchor="middle" class="fb-op">${t}</text>`;
}

function panel(x, y, w, hgt, title) {
  return `<rect class="fb-panel" x="${x}" y="${y}" width="${w}" height="${hgt}" rx="6"/>
    <rect class="fb-tab" x="${x}" y="${y - 16}" width="${title.length * 13 + 24}" height="26" rx="3"/>
    <text x="${x + 12}" y="${y + 2}" class="fb-tab-t">${esc(title)}</text>`;
}

export function renderFourBooks(app) {
  const v = app.v;
  const has = (id) => app.sim.has(id);
  let s = '';
  // 箭头标记
  const markers = ['xfer', 'rev', 'exp', 'gold', 'def', 'muted']
    .map((c) => `<marker id="ah-${c}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" class="fill-${c === 'muted' ? 'muted' : c}"/></marker>`)
    .join('');

  // 面板
  s += panel(20, 96, 960, 300, '第一本账 · 一般公共预算');
  s += panel(20, 436, 700, 214, '第二本账 · 政府性基金预算');
  s += panel(20, 690, 700, 170, '第三本账 · 国有资本经营预算');
  s += panel(740, 436, 240, 424, '第四本账 · 社保基金');

  // 预算稳定调节基金
  s += box(app, 'fs_net', 380, 14, 240, 58, 'def', '预算稳定调节基金（本年净增加）', { fs: 13 });

  // ---- 第一本账 ----
  const L1 = [
    ['f1_stabin', '稳定调节基金调入'],
    ['f2_to1', '政府性基金调入'],
    ['f3_out', '国有资本经营调入'],
    ['f1_carry', '结转结余资金'],
  ];
  L1.forEach(([id, nm], i) => (s += box(app, id, 60, 116 + i * 46, 170, 40, 'xfer', nm)));
  s += box(app, 'f1_rev', 60, 304, 170, 56, 'rev', '一般公共预算收入', { fs: 13 });
  s += `<path d="M240,118 Q252,118 252,130 L252,338 Q252,350 240,350" fill="none" class="stroke-muted" stroke-width="1.5"/>`;
  s += arrow('M254,236 L276,236', v.f1_totrev, 'a-rev', { fixed: true });
  s += box(app, 'f1_totrev', 282, 206, 150, 60, 'rev', '一般公共预算总收入', { fs: 12.5 });
  s += op(452, 243, '+');
  s += box(app, 'f1_def', 470, 206, 124, 60, 'def', '预算赤字', { fs: 13 });
  s += op(612, 243, '=');
  s += box(app, 'f1_totexp', 630, 206, 140, 60, 'exp', '一般公共预算支出总量', { fs: 12 });
  s += `<path d="M786,118 Q774,118 774,130 L774,338 Q774,350 786,350" fill="none" class="stroke-muted" stroke-width="1.5"/>`;
  s += box(app, 'f1_tostab', 790, 116, 176, 44, 'def', '补充中央预算稳定调节基金', { fs: 11.5 });
  s += box(app, 'f1_exp', 790, 176, 176, 56, 'exp', '一般公共预算支出', { fs: 13 });
  s += box(app, 'f1_other', 790, 248, 176, 36, 'exp', '其中：其他支出', { fs: 11.5 });
  s += box(app, 'f4_sub', 790, 292, 84, 40, 'xfer', '社保补贴', { fs: 11 });
  s += box(app, 'f1_to2', 882, 292, 84, 40, 'xfer', '调入基金', { fs: 11 });
  s += box(app, 'f1_realdef', 470, 300, 124, 56, 'def', '实际赤字', { fs: 13 });
  s += `<text x="532" y="372" text-anchor="middle" class="t-small">= 支出 − 当年收入（原图用四舍五入的 24.6 算得 4.34）</text>`;
  s += `<path d="M232,336 C360,346 420,346 466,334" fill="none" class="stroke-muted" stroke-dasharray="4 4" stroke-width="1.2"/>`;
  s += `<path d="M788,210 C700,300 640,320 598,326" fill="none" class="stroke-muted" stroke-dasharray="4 4" stroke-width="1.2"/>`;

  // ---- 第二本账 ----
  const L2 = [
    ['f1_to2', '一般公共预算调入', 'xfer'],
    ['f2_land', '土地出让收入', 'rev'],
    ['f2_oth', '其他基金收入', 'rev'],
    ['f2_bond', '地方专项债', 'def'],
    ['f2_carry', '上年结转收入', 'xfer'],
  ];
  L2.forEach(([id, nm, k], i) => (s += box(app, `${id}`, 60, 456 + i * 37, 170, 32, k, nm, { fs: 11.5 })));
  s += `<path d="M240,458 Q252,458 252,470 L252,628 Q252,640 240,640" fill="none" class="stroke-muted" stroke-width="1.5"/>`;
  s += arrow('M254,546 L276,546', v.f2_rev, 'a-rev', { fixed: true });
  s += box(app, 'f2_rev', 282, 516, 140, 60, 'rev', '政府性基金收入总量', { fs: 12 });
  s += arrow('M424,530 C440,530 440,496 456,496', v.f2_exp, 'a-exp', { fixed: true });
  s += arrow('M424,562 C440,562 440,598 456,598', v.f2_sur, 'a-gold', { fixed: true });
  s += box(app, 'f2_exp', 462, 468, 124, 56, 'exp', '政府性基金支出', { fs: 12 });
  s += box(app, 'f2_sur', 462, 572, 124, 56, 'hid', '结余（不列赤字）', { fs: 11.5 });
  if (has('f2_cut') && v.f2_cut > 1e-6) s += box(app, 'f2_cut', 462, 530, 124, 36, 'def', '被迫压减支出', { fs: 11 });
  s += box(app, 'f2_to1', 600, 540, 110, 32, 'xfer', '调入一般预算', { fs: 11 });
  s += box(app, 'f2_tostab', 600, 578, 110, 32, 'def', '补充稳定基金', { fs: 11 });
  s += box(app, 'f2_next', 600, 616, 110, 28, 'muted', '结转下年', { fs: 11 });
  s += arrow('M588,600 C594,600 594,556 598,556', v.f2_to1, 'a-xfer', { fixed: true });
  s += arrow('M588,600 L598,594', v.f2_tostab, 'a-def', { fixed: true });
  s += arrow('M588,604 C594,604 594,630 598,630', v.f2_next, 'a-muted', { fixed: true });

  // ---- 第三本账 ----
  s += box(app, 'f3_inc', 60, 712, 170, 44, 'rev', '国有资本经营收入');
  s += box(app, 'f3_carry', 60, 764, 170, 40, 'xfer', '上年结转收入');
  s += `<path d="M240,714 Q252,714 252,726 L252,792 Q252,804 240,804" fill="none" class="stroke-muted" stroke-width="1.5"/>`;
  s += arrow('M254,758 L276,758', v.f3_rev, 'a-rev', { fixed: true });
  s += box(app, 'f3_rev', 282, 728, 140, 60, 'rev', '收入总量');
  s += op(442, 765, '=');
  s += box(app, 'f3_tot', 462, 728, 124, 60, 'exp', '支出总量');
  s += box(app, 'f3_exp', 600, 706, 110, 36, 'exp', '经营支出', { fs: 11 });
  s += box(app, 'f3_out', 600, 750, 110, 36, 'xfer', '调出', { fs: 11 });
  s += box(app, 'f3_next', 600, 794, 110, 36, 'muted', '结转下年支出', { fs: 11 });
  s += `<text x="370" y="846" text-anchor="middle" class="t-small">收支平衡：收入总量 = 支出总量</text>`;

  // ---- 第四本账 ----
  const L4 = [
    ['f4_prem', '保费收入', 'rev'],
    ['f4_sub', '财政补贴', 'xfer'],
    ['f4_inv', '利息、投资收益', 'rev'],
    ['f4_oth', '其他收入（图未列示）', 'rev'],
  ];
  L4.forEach(([id, nm, k], i) => (s += box(app, id, 760, 460 + i * 42, 200, 36, k, nm, { fs: 11.5 })));
  s += arrow('M860,628 L860,644', v.f4_rev, 'a-rev', { fixed: true });
  s += box(app, 'f4_rev', 770, 650, 180, 54, 'rev', '社保基金收入');
  s += arrow('M860,706 L860,720', v.f4_exp, 'a-exp', { fixed: true });
  s += box(app, 'f4_exp', 770, 724, 180, 50, 'exp', '社保基金支出');
  s += box(app, 'f4_bal', 770, 790, 180, 50, 'hid', '当年结余');

  // ---- 账本之间的连线（走面板之间的空隙）----
  // 国资调出 → 第一本账"国有资本经营调入"
  s += arrow(ortho([[710, 768], [728, 768], [728, 664], [32, 664], [32, 228], [56, 228]]), v.f3_out, 'a-gold');
  // 政府性基金结余调入 → 第一本账"政府性基金调入"
  s += arrow(ortho([[710, 556], [726, 556], [726, 404], [44, 404], [44, 182], [56, 182]]), v.f2_to1, 'a-xfer');
  // 一般预算 → 政府性基金（调入基金）
  s += arrow(ortho([[924, 334], [924, 414], [215, 414], [215, 452]]), v.f1_to2, 'a-xfer', { dash: true });
  // 一般预算 → 社保基金（补贴）
  s += arrow(ortho([[832, 334], [832, 422], [972, 422], [972, 520], [964, 520]]), v.f4_sub, 'a-xfer');
  // 一般预算 → 稳定调节基金（补充）
  s += arrow(ortho([[878, 114], [878, 43], [626, 43]]), v.f1_tostab, 'a-def');
  // 稳定调节基金 → 一般预算（调入）
  s += arrow(ortho([[376, 43], [145, 43], [145, 112]]), v.f1_stabin, 'a-def');
  // 政府性基金结余 → 稳定调节基金（补充）
  s += arrow(ortho([[712, 594], [732, 594], [732, 409], [990, 409], [990, 60], [626, 60]]), v.f2_tostab, 'a-def', { dash: true });

  return `<svg viewBox="0 0 1000 880" role="img" aria-label="财政四本账之间的资金往来">${`<defs>${markers}</defs>`}${s}</svg>`;
}

export default function fourbooks(app) {
  const chart = h('div', { class: 'chart wide' });
  const ledger = h('div');
  const el = h('div', { style: { display: 'contents' } },
    h('div', { class: 'sheet' },
      h('h3', {}, '四本账之间的钱怎么流', h('small', {}, '2021 年决算，单位：万亿元 · 线越粗流量越大 · 虚线为较小的往来')),
      chart,
      h('div', { class: 'swipe-hint' }, '← 左右滑动查看完整图 →'),
    ),
    h('div', { class: 'sheet' },
      h('h3', {}, '把四本账合起来看', h('small', {}, '合并时剔除账本之间的往来（补贴、调入调出），得到"广义赤字"')),
      ledger,
    ),
  );
  function update() {
    chart.innerHTML = renderFourBooks(app);
    ledger.innerHTML = [
      ledgerHTML(app, [{ id: 'f1_rev', cls: 'rev' }, '+', { id: 'f1_tin', cls: 'xfer' }, '+', { id: 'f1_def', cls: 'def' }, '=', { id: 'f1_exp', cls: 'exp' }, '+', { id: 'f1_tostab', cls: 'def' }], { title: '第一本账：收入 + 调入 + 预算赤字 = 支出 + 补充稳定基金' }),
      ledgerHTML(app, [{ id: 'f1_exp', cls: 'exp' }, '−', { id: 'f1_rev', cls: 'rev' }, '=', { id: 'f1_realdef', cls: 'total' }, '　', { id: 'f1_def', cls: 'def' }, '+', { id: 'f1_tin', cls: 'xfer' }, '−', { id: 'f1_tostab', cls: 'def' }], { title: '实际赤字 = 预算赤字 + 调入资金 − 补充稳定基金（图④：4.34 vs 3.57）' }),
      ledgerHTML(app, [{ id: 'fc_exp', cls: 'exp' }, '−', { id: 'fc_rev', cls: 'rev' }, '=', { id: 'fc_gap', cls: 'total' }], { title: '四本账合并：对外支出 − 对外收入 = 广义赤字' }),
      ledgerHTML(app, [{ id: 'f1_def', cls: 'def' }, '+', { id: 'f2_bond', cls: 'def' }, '+', { id: 'f1_carry', cls: 'xfer', label: '动用结转(一般)' }, '+', { id: 'f2_carry', cls: 'xfer', label: '动用结转(基金)' }, '+', { id: 'f3_carry', cls: 'xfer', label: '动用结转(国资)' }, '−', { id: 'f2_next', label: '结转下年(基金)' }, '−', { id: 'f3_next', label: '结转下年(国资)' }, '−', { id: 'fs_net', cls: 'def' }, '−', { id: 'f4_bal', cls: 'hid' }, '=', { id: 'fc_gap2', cls: 'total' }], { title: '同一个广义赤字，按"钱从哪来"拆开——两种算法必然相等' }),
    ].join('');
  }
  return {
    id: 'fb',
    img: '④',
    title: '四本账',
    heading: '财政"四本账"：一般预算、政府性基金、国有资本、社保基金',
    lead: '四本账不是互相独立的：国有资本经营预算把利润<b>调出</b>给一般预算；政府性基金（主要是土地出让收入）有结余可以<b>调入</b>一般预算；一般预算每年<b>补贴</b>社保基金约 2.3 万亿。所以卖地收入下滑、老龄化加剧，最终都会压到一般预算上。',
    mods: ['fb'],
    el,
    update,
    panelConfig: {
      title: '调四本账（2021）',
      presets: [
        { label: '土地出让收入 −30%', changes: [{ id: 'f2_land', mul: 0.7 }] },
        { label: '老龄化：社保支出 +15%', changes: [{ id: 'f4_exp', mul: 1.15 }], modes: { fb4: 'gap' } },
        { label: '国资收益上缴提到 60%', changes: [{ id: 'f3_k', set: 0.6 }] },
        { label: '专项债扩容到 5 万亿', changes: [{ id: 'f2_bond', set: 5 }] },
      ],
      items: [
        { mode: 'fb1' },
        { mode: 'fb2' },
        { mode: 'fb4' },
        { title: '第二本账：政府性基金', ids: ['f2_land', 'f2_oth', 'f2_bond', 'f2_carry', 'f2_plan', 'f2_ratio', 'f2_a', 'f2_b'], open: true },
        { title: '第四本账：社保基金', ids: ['f4_prem', 'f4_exp', 'f4_inv', 'f4_oth', 'f4_sub', 'f4_target'], open: true },
        { title: '第一本账：一般公共预算', ids: ['f1_rev', 'f1_def', 'f1_other', 'f1_stabin', 'f1_carry', 'f1_tostab', 'f1_to2'] },
        { title: '第三本账：国有资本经营', ids: ['f3_inc', 'f3_carry', 'f3_k', 'f3_next'] },
      ],
    },
    rebuild: update,
  };
}
