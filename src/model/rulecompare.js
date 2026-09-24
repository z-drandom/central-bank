// 规则对比：把当前的参数改动放到不同平衡规则下重算，比较谁承担了冲击。
import { Sim } from './sim.js';

export const RULE_VARIANTS = [
  { key: 'rate-other', label: '赤字率锚定 · 其它吸收', modes: { c26: 'rate', absorb: 'other', l26: 'deficit' } },
  { key: 'rate-prop', label: '赤字率锚定 · 等比例', modes: { c26: 'rate', absorb: 'prop', l26: 'deficit' } },
  { key: 'rate-tr', label: '赤字率锚定 · 转移支付吸收', modes: { c26: 'rate', absorb: 'transfer', l26: 'deficit' } },
  { key: 'spend', label: '支出锚定（多借债）', modes: { c26: 'spend', l26: 'deficit' } },
  { key: 'stab', label: '稳定基金兜底', modes: { c26: 'stab', l26: 'deficit' } },
  { key: 'spend-l', label: '支出锚定 + 地方调入兜底', modes: { c26: 'spend', l26: 'spend' } },
];

export const RULE_ROWS = [
  ['d26', '全国赤字'], ['drate26', '赤字率'], ['tstab26', '稳定基金调入'], ['own26', '中央本级支出'], ['oth26', '中央本级"其它"'],
  ['def26', '国防支出'], ['tr26', '转移支付'], ['tl26', '地方调入资金'], ['el26', '地方支出'], ['gov1', '年末政府债务'], ['p_d_2035', '2035 负债率'],
];

/**
 * 在每种规则下，从原图基线出发，施加与当前状态相同的参数改动（只施加该规则下存在的参数），返回 Δ 表。
 * 注意：在某规则下是"余项"的量，在另一规则下可能是参数——那种改动在该规则下无法施加，会列在 skipped 里。
 */
export function compareRules(sim) {
  const changes = sim.toScenario();
  return RULE_VARIANTS.map((rv) => {
    const s = new Sim({ ...sim.modes, ...rv.modes });
    const skipped = [];
    const patch = {};
    for (const [id, v] of Object.entries(changes.i)) {
      if (s.isInput(id)) patch[id] = v;
      else skipped.push(id);
    }
    s.setMany(patch);
    const delta = {};
    for (const [id] of RULE_ROWS) delta[id] = s.has(id) ? s.values[id] - s.base[id] : null;
    return { ...rv, delta, skipped, values: s.values };
  });
}
