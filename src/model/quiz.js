// "先猜后算"：每道题的正确答案由模型现算——选项里离计算结果最近的那个就是对的。
const N = (x, d = 0) => (x < 0 ? '−' : x > 0 ? '+' : '') + Math.abs(x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const PP = (x) => `${x < 0 ? '−' : x > 0 ? '+' : ''}${Math.abs(x * 100).toFixed(2)} 个百分点`;

export const QUIZ = [
  {
    id: 'vat-central',
    answer: 1, // 出题人预期的答案，测试会核对模型算出来的是否一致
    q: '2025 年国内增值税少收 1,000 亿元（2025 平衡规则：赤字锁定）。2026 年中央一般公共预算收入会变化多少？',
    setup: { modes: { y25: 'deficit' }, changes: [{ id: 't_vat', add: -1000 }] },
    target: 'rc26',
    choices: [
      { text: () => '约 −1,018 亿：少收的全算中央的，再乘 2026 年增速', value: (b) => -1000 * (1 + b.g_rc) },
      { text: (b) => `约 ${N(-500 * (1 + b.g_rc))} 亿：中央只分一半，再乘 2026 年增速`, value: (b) => -500 * (1 + b.g_rc) },
      { text: () => '不变：2025 年的缺口已经由调入资金补上了', value: () => 0 },
      { text: () => '约 +500 亿：地方少收，中央多收', value: () => 500 },
    ],
    explain: '增值税中央地方五五分成，2025 年中央收入少 500 亿；2026 年预算以 2025 年执行数为基数，所以再乘 (1 + 1.8%)。"调入资金补缺口"只影响 2025 年的账，不影响 2026 年的收入基数。',
    tab: 'b26',
  },
  {
    id: 'vat-transfer',
    answer: 0, // 出题人预期的答案，测试会核对模型算出来的是否一致
    q: '同样少收 1,000 亿增值税，在"赤字锁定"规则下，2025 年的"调入资金及使用结转结余"会怎样？',
    setup: { modes: { y25: 'deficit' }, changes: [{ id: 't_vat', add: -1000 }] },
    target: 'tin25',
    choices: [
      { text: () => '+1,000 亿：赤字不能动，缺口全部靠调入资金补', value: () => 1000 },
      { text: () => '+500 亿：只补中央那一半', value: () => 500 },
      { text: () => '不变：赤字会自动增加', value: () => 0 },
      { text: () => '−1,000 亿', value: () => -1000 },
    ],
    explain: '差额 = 支出 − 收入 = 赤字 + 调入资金。支出不变、收入少 1,000，差额多 1,000；赤字锁定，所以调入资金多 1,000。',
    tab: 'y25',
  },
  {
    id: 'deficit-debt',
    answer: 0, // 出题人预期的答案，测试会核对模型算出来的是否一致
    q: '2026 年赤字率从 4% 提高到 5%（地方赤字不变）。2026 年末国债余额会增加多少？',
    setup: { modes: { c26: 'rate' }, changes: [{ id: 'dr26', set: 0.05 }] },
    target: 'bc1',
    choices: [
      { text: (b) => `约 ${N(0.01 * b.gdp26)} 亿：多出的 1% × GDP 全部是中央赤字，变成国债`, value: (b) => 0.01 * b.gdp26 },
      { text: (b) => `约 ${N(0.01 * b.gdp26 / 2)} 亿：中央地方各一半`, value: (b) => 0.005 * b.gdp26 },
      { text: () => '不变：赤字是流量，余额是存量', value: () => 0 },
      { text: () => '+58,900 亿：赤字总额都算新增', value: () => 58900 },
    ],
    explain: '地方赤字固定为 8,000 亿，中央赤字 = 全国赤字 − 地方赤字，所以多出的 1% × 147.25 万亿全部落在中央，年末国债 = 年初 + 中央赤字。',
    tab: 'debt',
  },
  {
    id: 'rate-interest',
    answer: 0, // 出题人预期的答案，测试会核对模型算出来的是否一致
    q: '国债平均付息率上升 0.5 个百分点。在"赤字率锚定 + 本级其它吸收"规则下，2026 年中央本级"其它"支出会怎样？',
    setup: { modes: { c26: 'rate', absorb: 'other' }, changes: [{ id: 'rcg', add: 0.005 }] },
    target: 'oth26',
    choices: [
      { text: (b) => `约 ${N(-0.005 * b.bc0)} 亿：付息多出的部分全部挤占其它支出`, value: (b) => -0.005 * b.bc0 },
      { text: () => '不变：付息增加会自动增加赤字', value: () => 0 },
      { text: (b) => `约 ${N(0.005 * b.bc0)} 亿`, value: (b) => 0.005 * b.bc0 },
      { text: () => '约 −437 亿：只影响新增的国债', value: () => -437 },
    ],
    explain: '付息 = 利率 × 国债余额，0.5% × 41.23 万亿 ≈ 2,062 亿。赤字率锁定时中央支出总额不变，付息多出多少，"其它"就少多少——这就是利息的挤出效应。',
    tab: 'b26',
  },
  {
    id: 'land-general',
    answer: 1, // 出题人预期的答案，测试会核对模型算出来的是否一致
    q: '四本账中，土地出让收入减少 1 万亿（其余按默认规则）。一般公共预算支出会减少多少？',
    setup: { modes: { fb1: 'deficit', fb2: 'cap' }, changes: [{ id: 'f2_land', add: -1 }] },
    target: 'f1_exp',
    choices: [
      { text: () => '减少 1 万亿：卖地收入就是地方的收入', value: () => -1 },
      { text: (b) => `减少约 ${(b.f2_a).toFixed(2)} 万亿：只有结余中调入一般预算的那部分受影响`, value: (b) => -b.f2_a },
      { text: () => '不变：土地收入在另一本账里', value: () => 0 },
      { text: () => '减少 0.5 万亿', value: () => -0.5 },
    ],
    explain: '土地出让收入在第二本账。它减少 1 万亿，政府性基金结余减少 1 万亿，其中按比例 α（默认 20%）调入一般预算的部分减少 0.2 万亿。一般预算赤字锁定，所以一般预算支出减少 0.2 万亿。',
    tab: 'fb',
  },
  {
    id: 'aging-crowd',
    answer: 0, // 出题人预期的答案，测试会核对模型算出来的是否一致
    q: '社保基金支出增加 0.5 万亿，规则是"补贴兜底"和"预算赤字锁定"。一般预算的"其他支出"会怎样？',
    setup: { modes: { fb1: 'deficit', fb4: 'gap' }, changes: [{ id: 'f4_exp', add: 0.5 }] },
    target: 'f1_other',
    choices: [
      { text: () => '减少 0.5 万亿：补贴全额增加，挤占其他支出', value: () => -0.5 },
      { text: () => '不变：社保是另一本账', value: () => 0 },
      { text: () => '减少 0.25 万亿', value: () => -0.25 },
      { text: () => '增加 0.5 万亿', value: () => 0.5 },
    ],
    explain: '补贴兜底：补贴 = 支出 + 目标结余 − 保费 − 其他收入，支出多 0.5，补贴多 0.5。补贴是一般预算的支出，而一般预算总支出被赤字锁死，所以其他支出少 0.5。',
    tab: 'fb',
  },
  {
    id: 'swap-broad',
    answer: 0, // 出题人预期的答案，测试会核对模型算出来的是否一致
    q: '2026 年置换隐性债务从 2 万亿加到 4 万亿。2026 年末"含隐债负债率"会怎样？',
    setup: { changes: [{ id: 'swap26', set: 40000 }] },
    target: 'broad_gdp1',
    choices: [
      { text: () => '不变：隐性债务换成显性债务，总量不变', value: () => 0 },
      { text: (b) => `下降约 ${(20000 / b.gdp26 * 100).toFixed(2)} 个百分点`, value: (b) => -20000 / b.gdp26 },
      { text: (b) => `上升约 ${(20000 / b.gdp26 * 100).toFixed(2)} 个百分点`, value: (b) => 20000 / b.gdp26 },
      { text: (b) => `下降约 ${(40000 / b.gdp26 * 100).toFixed(2)} 个百分点`, value: (b) => -40000 / b.gdp26 },
    ],
    explain: '置换让隐性债务减少、专项债增加，同样多。"政府负债率"会上升，"含隐债负债率"不变。置换的好处在利息：城投 5% 左右的成本换成 2.8% 左右的政府债。',
    tab: 'debt',
    fmt: PP,
  },
  {
    id: 'consumption-total',
    answer: 0, // 出题人预期的答案，测试会核对模型算出来的是否一致
    q: '国内消费税的中央分享比例从 100% 降到 50%。2026 年全国一般公共预算收入会怎样？',
    setup: { changes: [{ id: 's_con', set: 0.5 }] },
    target: 'r26',
    choices: [
      { text: () => '几乎不变：只是在中央和地方之间换了口袋', value: () => 0 },
      { text: () => '减少约 8,600 亿', value: () => -8600 },
      { text: () => '增加约 8,600 亿', value: () => 8600 },
      { text: () => '减少约 16,900 亿', value: () => -16900 },
    ],
    explain: '分享比例只改变中央和地方各拿多少，不改变总量。之所以不是精确的 0，是因为中央和地方 2026 年的预算增速不同（1.8% vs 2.4%），同一笔钱放在地方口袋里增长得快一点。',
    tab: 'y25',
  },
  {
    id: 'growth-deficit',
    answer: 1, // 出题人预期的答案，测试会核对模型算出来的是否一致
    q: '2026 年名义 GDP 增速从 5% 降到 3%，赤字率仍锚定 4%。全国赤字额会怎样？',
    setup: { modes: { c26: 'rate' }, changes: [{ id: 'g_nom', set: 0.03 }] },
    target: 'd26',
    choices: [
      { text: () => '不变：赤字率没变', value: () => 0 },
      { text: (b) => `减少约 ${N(0.04 * b.gdp25 * 0.02).replace('+', '')} 亿：分母 GDP 变小，同样 4% 对应的赤字额也变小`, value: (b) => -0.04 * b.gdp25 * 0.02 },
      { text: (b) => `增加约 ${N(0.04 * b.gdp25 * 0.02).replace('+', '')} 亿：经济差要多借`, value: (b) => 0.04 * b.gdp25 * 0.02 },
      { text: () => '减少约 2,944 亿', value: () => -2944 },
    ],
    explain: '赤字 = 赤字率 × GDP。GDP 少了 2% × 140.24 万亿，4% 的赤字就少了约 1,122 亿。这说明"锚定赤字率"在经济下行时反而会收紧——所以现实中常常调高赤字率。',
    tab: 'b26',
  },
  {
    id: 'rate-path',
    answer: 0, // 出题人预期的答案，测试会核对模型算出来的是否一致
    q: '推演中利率整体上升 1 个百分点，推演规则是"赤字率不变"。2035 年政府负债率会怎样？',
    setup: { modes: { proj: 'rate' }, changes: [{ id: 'pshift', set: 0.01 }] },
    target: 'p_d_2035',
    choices: [
      { text: () => '不变：赤字率锁定，债务每年增加同样多，利息只是挤占其他支出', value: () => 0 },
      { text: () => '上升约 5 个百分点', value: () => 0.05 },
      { text: () => '上升约 10 个百分点', value: () => 0.1 },
      { text: () => '下降约 3 个百分点', value: () => -0.03 },
    ],
    explain: '赤字率锁定时，每年新增债务 = 赤字率 × GDP，与利率无关。利率上升只改变赤字的构成：付息多了，非付息支出少了。切换到"支出增速不变"规则，利率才会推高负债率。',
    tab: 'proj',
    fmt: PP,
  },
];

/** 在沙盒中计算一道题：返回 {delta, correctIndex, choices:[{text, value}]} */
export function gradeQuestion(sim, q) {
  const s = sim.clone();
  s.resetAll();
  const b = s.base;
  if (q.setup.modes) s.setModes(q.setup.modes);
  s.apply(q.setup.changes ?? []);
  const delta = s.values[q.target] - s.base[q.target];
  const choices = q.choices.map((c) => ({ text: c.text(b), value: c.value(b) }));
  let best = 0;
  choices.forEach((c, i) => {
    if (Math.abs(c.value - delta) < Math.abs(choices[best].value - delta)) best = i;
  });
  return { delta, correctIndex: best, choices, sim: s };
}
