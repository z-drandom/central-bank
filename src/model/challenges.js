// 挑战关卡：先施加一个冲击，再让玩家调参数达成目标。
// 每关都附一组"参考解"，测试会验证：冲击后目标未达成，而参考解能达成。
import { B2026, OWN_2026, FB2021 } from './data.js';

const OTH26 = OWN_2026.find((x) => x.id === 'oth26' || x.id === 'oth').v;
const EPS = 1e-6;

export const CHALLENGES = [
  {
    id: 'slowdown',
    level: '入门',
    title: '减收之年',
    tab: 'b26',
    story: '经济不及预期，2026 年名义 GDP 增速只有 3%。收入少了，GDP 也小了——按 4% 赤字率算出的赤字额也跟着缩水。中央本级"其它"支出和地方支出都被挤压。',
    setup: { modes: { c26: 'rate', absorb: 'other', l26: 'deficit' }, changes: [{ id: 'g_nom', set: 0.03 }] },
    goals: [
      { text: '赤字率不超过 4.3%', id: 'drate26', test: (v) => v.drate26 <= 0.043 + EPS },
      { text: '中央本级"其它"支出不低于原预算 6,996 亿', id: 'oth26', test: (v) => v.oth26 >= OTH26 - 0.01 },
      { text: '地方一般公共预算支出不低于原预算 254,180 亿', id: 'el26', test: (v) => v.el26 >= B2026.expL - 0.01 },
    ],
    hint: '提高一点赤字率可以补中央；地方的缺口可以动用"调入资金及结转结余"。',
    solution: [{ id: 'dr26', set: 0.0421 }, { id: 'tl26', set: 19500 }],
  },
  {
    id: 'defense',
    level: '入门',
    title: '国防科技双提速',
    tab: 'b26',
    story: '要把国防支出增速提到 10%、科技支出增速提到 15%，但赤字率不能突破 4%，中央本级"其它"支出也不许被挤占。钱从哪来？',
    setup: { modes: { c26: 'rate', absorb: 'other' }, changes: [] },
    goals: [
      { text: '国防支出增速 ≥ 10%', id: 'g_def', test: (v) => v.g_def >= 0.1 - EPS },
      { text: '科技支出增速 ≥ 15%', id: 'g_sci', test: (v) => v.g_sci >= 0.15 - EPS },
      { text: '赤字率不超过 4%', id: 'drate26', test: (v) => v.drate26 <= 0.04 + EPS },
      { text: '中央本级"其它"支出不低于原预算', id: 'oth26', test: (v) => v.oth26 >= OTH26 - 0.01 },
    ],
    hint: '不借债也能多花钱：看看"调入资金"——国有资本经营预算可以多调一些利润进来。',
    solution: [{ id: 'g_def', set: 0.1 }, { id: 'g_sci', set: 0.15 }, { id: 'tsoe26', set: 3300 }],
  },
  {
    id: 'lessdebt',
    level: '高阶',
    title: '少借不减支',
    tab: 'b26',
    story: '要把 2026 年赤字率从 4% 压到 3.5%，少借约 7,400 亿；但中央本级"其它"支出和地方支出都不能比原预算少。钱从哪里来？',
    setup: { modes: { c26: 'rate', absorb: 'other', l26: 'deficit' }, changes: [{ id: 'dr26', set: 0.035 }] },
    goals: [
      { text: '赤字率不超过 3.5%', id: 'drate26', test: (v) => v.drate26 <= 0.035 + EPS },
      { text: '中央本级"其它"支出不低于原预算 6,996 亿', id: 'oth26', test: (v) => v.oth26 >= OTH26 - 0.01 },
      { text: '地方一般公共预算支出不低于原预算 254,180 亿', id: 'el26', test: (v) => v.el26 >= B2026.expL - 0.01 },
    ],
    hint: '赤字率锚定时，中央支出 = 收入 + 赤字 + 调入资金。赤字少了，要么多调入（稳定调节基金、国有资本经营预算），要么压其他本级支出——但不能压转移支付，否则地方支出会减少。「影响与敏感度 → 双目标求解」可以帮你算。',
    solution: [{ id: 'tstab26', set: 8400 }],
  },
  {
    id: 'land',
    level: '进阶',
    title: '土地财政退潮',
    tab: 'fb',
    story: '土地出让收入骤降 40%。政府性基金预算"不列赤字"，收不抵支只能压减支出；它原本还往一般公共预算调钱，现在也调不出来了。',
    setup: { modes: { fb1: 'deficit', fb2: 'cap' }, changes: [{ id: 'f2_land', mul: 0.6 }] },
    goals: [
      { text: '政府性基金不被迫压减支出', id: 'f2_cut', test: (v) => (v.f2_cut ?? 0) <= EPS },
      { text: '一般预算"其他支出"不低于 22.26 万亿', id: 'f1_other', test: (v) => v.f1_other >= FB2021.rev1 + 1.11 + FB2021.budgetDef - FB2021.toStab - FB2021.subsidy - 0.02 - 0.005 },
      { text: '预算赤字不超过 3.8 万亿', id: 'f1_def', test: (v) => v.f1_def <= 3.8 + EPS },
    ],
    hint: '专项债属于政府性基金预算，不计入赤字；一般预算的缺口可以动用预算稳定调节基金。',
    solution: [{ id: 'f2_bond', set: 4.98 }, { id: 'f1_stabin', set: 0.73 }],
  },
  {
    id: 'aging',
    level: '进阶',
    title: '银发浪潮',
    tab: 'fb',
    story: '养老金、医保支出增长 20%。规则改为"补贴兜底"：社保基金的缺口全部由一般公共预算补，挤占其他支出。',
    setup: { modes: { fb1: 'deficit', fb4: 'gap' }, changes: [{ id: 'f4_exp', mul: 1.2 }] },
    goals: [
      { text: '一般预算"其他支出"减少不超过 0.5 万亿', id: 'f1_other', test: (v, b) => v.f1_other >= b.f1_other - 0.5 - EPS },
      { text: '预算赤字不超过 4.2 万亿', id: 'f1_def', test: (v) => v.f1_def <= 4.2 + EPS },
      { text: '社保基金当年结余不低于 0.5 万亿', id: 'f4_bal', test: (v) => v.f4_bal >= 0.5 - EPS },
    ],
    hint: '可以组合：适度提高保费收入、降低社保结余目标、多调国有资本收益、再加一点赤字。',
    solution: [{ id: 'f4_target', set: 0.5 }, { id: 'f1_def', set: 4.17 }, { id: 'f3_k', set: 0.75 }, { id: 'f4_prem', set: 7.0 }],
  },
  {
    id: 'consumption',
    level: '进阶',
    title: '消费税下划地方',
    tab: 'y25',
    story: '改革把国内消费税的一半下划给地方。中央收入少了、地方收入多了——怎样调整转移支付，让中央本级支出和地方支出都不受影响？',
    setup: { modes: { c26: 'rate', absorb: 'other', l26: 'deficit', y25: 'deficit' }, changes: [{ id: 's_con', set: 0.5 }] },
    goals: [
      { text: '中央本级"其它"支出不低于原预算', id: 'oth26', test: (v) => v.oth26 >= OTH26 - 0.01 },
      { text: '地方支出与原预算相差不超过 300 亿', id: 'el26', test: (v) => Math.abs(v.el26 - B2026.expL) <= 300 },
      { text: '赤字率不超过 4%', id: 'drate26', test: (v) => v.drate26 <= 0.04 + EPS },
    ],
    hint: '地方多拿到的税，中央少转移同样多，就是"财力下沉、总量中性"。转移支付增速在"2026 预算"页。',
    solution: [{ id: 'g_tr', set: -0.0627 }],
  },
  {
    id: 'trade',
    level: '进阶',
    title: '外贸冲击',
    tab: 'b26',
    story: '2025 年进口骤减：进口环节增值税、消费税和关税各少收两成。这些税全归中央，2026 年中央收入基数随之缩水。怎样守住中央本级支出和对地方转移支付？',
    setup: { modes: { y25: 'deficit', c26: 'rate', absorb: 'other' }, changes: [{ id: 't_imp', mul: 0.8 }, { id: 't_tar', mul: 0.8 }] },
    goals: [
      { text: '中央本级"其它"支出不低于原预算', id: 'oth26', test: (v) => v.oth26 >= OTH26 - 0.01 },
      { text: '对地方转移支付不低于原预算 104,150 亿', id: 'tr26', test: (v) => v.tr26 >= B2026.transfer - 0.01 },
      { text: '赤字率不超过 4.2%', id: 'drate26', test: (v) => v.drate26 <= 0.042 + EPS },
    ],
    hint: '缺口约 4,200 亿：赤字率每提高 0.1 个百分点约多借 1,470 亿，不够的部分可以多调国有资本经营预算。',
    solution: [{ id: 'dr26', set: 0.042 }, { id: 'tsoe26', set: 3800 }],
  },
  {
    id: 'decade',
    level: '高阶',
    title: '十年化债',
    tab: 'proj',
    story: '到 2035 年：隐性债务全部置换完毕，含隐债负债率不超过 95%，付息不超过收入的 10%——同时赤字率不低于 3%，不能靠紧缩过关。',
    setup: { modes: { proj: 'rate' }, changes: [] },
    goals: [
      { text: '2035 年隐性债务清零', id: 'p_H_2035', test: (v) => v.p_H_2035 <= 1 },
      { text: '2035 年含隐债负债率 ≤ 95%', id: 'p_w_2035', test: (v) => v.p_w_2035 <= 0.95 + EPS },
      { text: '2035 年付息 ÷ 收入 ≤ 10%', id: 'p_ib_2035', test: (v) => v.p_ib_2035 <= 0.1 + EPS },
      { text: '推演期赤字率 ≥ 3%', id: 'pdr', test: (v) => v.pdr >= 0.03 - EPS },
    ],
    hint: '置换本身不降低总债务；真正决定负债率的是赤字和专项债的规模。',
    solution: [{ id: 'pswap', set: 10000 }, { id: 'psp', set: 30000 }, { id: 'pdr', set: 0.035 }],
  },
];

export function evalGoals(ch, v, b) {
  return ch.goals.map((g) => ({ ...g, met: !!g.test(v, b) }));
}
