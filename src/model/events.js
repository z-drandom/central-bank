// 事件卡：随机冲击 + 自动给出对冲方案（每个方案都由反向求解算出）。
import { Sim } from './sim.js';
import { tornado } from './sensitivity.js';
import { goalSeek } from './solve.js';

export const EVENTS = [
  { id: 'housing', title: '楼市成交骤降', story: '二手房、新房成交双双走弱，契税、土地增值税、房产税明显少收。', changes: [{ id: 't_deed', mul: 0.75 }, { id: 't_lat', mul: 0.7 }, { id: 't_prop', mul: 0.95 }], defend: 'el26', modes: { y25: 'deficit', l26: 'deficit' } },
  { id: 'export', title: '出口超预期', story: '外需回暖，出口退税多退了 15%。', changes: [{ id: 'rebate', mul: 1.15 }], defend: 'oth26', modes: { y25: 'deficit', c26: 'rate', absorb: 'other' } },
  { id: 'import', title: '进口萎缩', story: '大宗商品进口减少，进口环节税和关税各少收 15%。', changes: [{ id: 't_imp', mul: 0.85 }, { id: 't_tar', mul: 0.85 }], defend: 'oth26', modes: { y25: 'deficit', c26: 'rate', absorb: 'other' } },
  { id: 'stock', title: '股市火热', story: '证券交易放量，印花税多收 40%，个税也多收 5%。', changes: [{ id: 't_stamp', mul: 1.4 }, { id: 't_pit', mul: 1.05 }], defend: 'drate26', modes: { y25: 'deficit', c26: 'spend' } },
  { id: 'slow', title: '名义增长放缓', story: '价格低迷，2026 年名义 GDP 增速只有 3.5%。', changes: [{ id: 'g_nom', set: 0.035 }], defend: 'oth26', modes: { c26: 'rate', absorb: 'other' } },
  { id: 'rate', title: '利率上行', story: '国债平均付息率上升 0.4 个百分点。', changes: [{ id: 'rcg', add: 0.004 }], defend: 'oth26', modes: { c26: 'rate', absorb: 'other' } },
  { id: 'disaster', title: '极端天气', story: '粮油物资储备支出需要多增 20 个百分点，同时追加中央预备费。', changes: [{ id: 'g_grain', add: 0.2 }, { id: 'res26', set: 1500 }], defend: 'oth26', modes: { c26: 'rate', absorb: 'other' } },
  { id: 'defense', title: '国防需求上升', story: '国防支出增速需要提高到 12%。', changes: [{ id: 'g_def', set: 0.12 }], defend: 'drate26', modes: { c26: 'spend' } },
  { id: 'land', title: '土地市场冰封', story: '土地出让收入再降四成（四本账，2021 年数据）。', changes: [{ id: 'f2_land', mul: 0.6 }], defend: 'f1_other', modes: { fb1: 'deficit', fb2: 'cap' } },
  { id: 'pension', title: '退休高峰', story: '社保基金支出增长 12%，财政补贴兜底（四本账）。', changes: [{ id: 'f4_exp', mul: 1.12 }], defend: 'f1_other', modes: { fb1: 'deficit', fb4: 'gap' } },
  { id: 'localrev', title: '地方收入不及预期', story: '地方一般公共预算收入增速比预算低 3 个百分点。', changes: [{ id: 'g_rl', add: -0.03 }], defend: 'el26', modes: { l26: 'deficit' } },
  { id: 'growth', title: '长期增长中枢下移', story: '2027 年后名义增速降到 3.5%。', changes: [{ id: 'pg', set: 0.035 }], defend: 'p_d_2035', modes: { proj: 'rate' } },
];

// 只有政策可以动的旋钮才能当对冲手段（历史数据、利率、GDP 这些不算）
export const LEVER = /^(dr26|tstab26|tsoe26|tl26|dl26|g_tr|res26|g_(def|sci|sec|edu|grain|dip|el)|oth26|oth_pl|sp26|stb26|swap26|pdr|pge|psp|pswap|pstb|f1_def|f1_other|f1_stabin|f1_to2|f1_tostab|f2_bond|f2_plan|f2_a|f2_b|f3_k|f4_prem|f4_sub|f4_target|s_(vat|cit|pit|stamp|imp|con|tar|veh))$/;

/** 施加事件，返回冲击后的状态、受影响最大的关键指标、以及对冲方案 */
export function playEvent(ev, { topK = 3 } = {}) {
  const sim = new Sim(ev.modes ?? {});
  sim.apply(ev.changes);
  const shocked = new Set(ev.changes.map((c) => c.id));
  const target = ev.defend;
  const goal = sim.base[target];
  const rank = tornado(sim.graph, sim.inputs, target, { limit: 60 }).rows.filter((r) => !shocked.has(r.id) && !sim.spec(r.id).fixed && LEVER.test(r.id));
  const fixes = [];
  for (const r of rank) {
    const res = goalSeek(sim.graph, sim.inputs, { target, goal, param: r.id });
    if (res.ok) fixes.push({ id: r.id, from: sim.inputs[r.id], to: res.x });
    if (fixes.length >= topK) break;
  }
  return { sim, target, goal, now: sim.values[target], fixes };
}
