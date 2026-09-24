// 讲解模式：一步一步走完一条传导链。
// 每一步可以施加改动（set）、切换页面（tab）、高亮节点（focus），文字里的数字全部现算。
// 文本函数收到 T(id) = 当前值、D(id) = 相对基线的变化量，二者都会渲染成可点击的数字。

export const STORIES = [
  {
    id: 'vat',
    title: '一笔增值税的旅程',
    summary: '2025 年增值税少收 10%，这笔钱的缺口怎么一路传到 2026 年的预算？',
    steps: [
      {
        tab: 'y25', set: { reset: true, modes: { y25: 'deficit', c26: 'rate', absorb: 'other', l26: 'deficit' }, changes: [{ id: 't_vat', mul: 0.9 }] }, focus: ['t_vat', 'rev25'],
        text: (T, D) => `2025 年国内增值税少收 10%，即 ${D('t_vat')} 亿。税收合计同步减少，一般公共预算收入变为 ${T('rev25')} 亿。`,
      },
      {
        tab: 'y25', focus: ['tin25', 'gap25'],
        text: (T, D) => `支出不变，"差额"扩大 ${D('gap25')} 亿。当年赤字已由人大批准（"赤字锁定"），所以缺口全部由调入资金补：调入资金 ${D('tin25')} 亿。`,
      },
      {
        tab: 'y25', focus: ['rc25', 'rl25'],
        text: (T, D) => `按分税制，增值税中央地方五五分成：2025 年中央收入 ${D('rc25')} 亿，地方收入 ${D('rl25')} 亿。`,
      },
      {
        tab: 'b26', focus: ['rc26', 'rl26'],
        text: (T, D) => `2026 年预算以 2025 年执行数为基数：中央收入 ${D('rc26')} 亿（= 中央减收 × (1 + 1.8%)），地方收入 ${D('rl26')} 亿（× (1 + 2.4%)）。`,
      },
      {
        tab: 'b26', focus: ['oth26', 'el26'],
        text: (T, D) => `赤字率锚定在 4%，中央支出跟着收入一起少 ${D('ec26')} 亿；吸收项是中央本级"其它"，于是"其它"变化 ${D('oth26')} 亿。地方"以收定支"，地方支出变化 ${D('el26')} 亿。`,
      },
      {
        tab: 'b26', set: { reset: true, modes: { y25: 'deficit', c26: 'spend', l26: 'deficit' }, changes: [{ id: 't_vat', mul: 0.9 }] }, focus: ['dc26', 'drate26'],
        text: (T, D) => `换一条规则再看：改成"支出锚定"，中央支出一分不减，缺口改由借债填——中央赤字 ${D('dc26')} 亿，赤字率变为 ${T('drate26')}。同一个冲击，规则不同，结果完全不同。`,
      },
      {
        tab: 'debt', focus: ['bc1'],
        text: (T, D) => `多借的钱进入国债：2026 年末国债余额 ${D('bc1')} 万亿，政府负债率 ${T('debt_gdp1')}。明年开始，它每年都要付利息。`,
      },
    ],
  },
  {
    id: 'deficit',
    title: '赤字 → 债务 → 利息',
    summary: '赤字率从 4% 提到 5%，多花的钱从哪来，又会在未来留下什么？',
    steps: [
      {
        tab: 'b26', set: { reset: true, modes: { c26: 'rate', absorb: 'other' }, changes: [{ id: 'dr26', set: 0.05 }] }, focus: ['d26', 'dr26'],
        text: (T, D) => `赤字率从 4% 提到 5%：全国赤字 = 5% × GDP，增加 ${D('d26')} 亿，正好是 1% × ${T('gdp26')} 万亿。`,
      },
      {
        tab: 'b26', focus: ['dc26', 'oth26'],
        text: (T, D) => `地方赤字固定为 ${T('dl26')} 亿，增量全部落在中央：中央赤字 ${D('dc26')} 亿，中央支出同步增加，由本级"其它"支出吸收（${D('oth26')} 亿）。`,
      },
      {
        tab: 'debt', focus: ['bc1', 'debt_gdp1'],
        text: (T, D) => `中央赤字靠发国债：2026 年末国债 ${D('bc1')} 万亿，政府负债率 ${D('debt_gdp1')}。`,
      },
      {
        tab: 'proj', focus: ['p_I_2027'],
        text: (T, D) => `利息按"平均利率 × 上年末余额"算：2027 年一般预算付息 ${D('p_I_2027')} 亿。今年多借的每一元，以后每年都要付息。`,
      },
      {
        tab: 'proj', set: { changes: [{ id: 'pdr', set: 0.05 }] }, focus: ['p_d_2035', 'p_ib_2035'],
        text: (T, D) => `如果以后每年都按 5% 安排赤字：2035 年政府负债率 ${T('p_d_2035')}（${D('p_d_2035')}），付息占收入 ${T('p_ib_2035')}。`,
      },
    ],
  },
  {
    id: 'land',
    title: '卖地收入下滑，谁来买单',
    summary: '土地出让收入减少三成，政府性基金、一般预算和债务会怎样？（四本账，2021 年数据）',
    steps: [
      {
        tab: 'fb', set: { reset: true, modes: { fb1: 'deficit', fb2: 'cap' }, changes: [{ id: 'f2_land', mul: 0.7 }] }, focus: ['f2_land', 'f2_rev'],
        text: (T, D) => `土地出让收入减少 30%（${D('f2_land')} 万亿），政府性基金收入总量降到 ${T('f2_rev')} 万亿。`,
      },
      {
        tab: 'fb', focus: ['f2_cut', 'f2_exp'],
        text: (T, D) => `政府性基金预算"不列赤字"：收入总量已低于计划支出 ${T('f2_plan')} 万亿，只能压减 ${T('f2_cut')} 万亿支出，结余降到 ${T('f2_sur')}。`,
      },
      {
        tab: 'fb', focus: ['f2_to1', 'f1_exp'],
        text: (T, D) => `没有结余，就没钱调入一般预算：政府性基金调入 ${D('f2_to1')} 万亿。一般预算赤字锁定，于是一般预算支出 ${D('f1_exp')} 万亿。`,
      },
      {
        tab: 'fb', set: { changes: [{ id: 'f2_bond', add: 1 }] }, focus: ['f2_bond', 'f2_cut'],
        text: (T, D) => `补救：多发 1 万亿专项债。专项债属于政府性基金预算，不计入赤字——被迫压减的支出变成 ${T('f2_cut')} 万亿。`,
      },
      {
        tab: 'fb', focus: ['fc_gap', 'fc_gap2'],
        text: (T, D) => `但合并四本账看，"广义赤字"变化 ${D('fc_gap')} 万亿：专项债只是把缺口从赤字挪到了债务上，最终仍由政府偿还。`,
      },
    ],
  },
  {
    id: 'swap',
    title: '化债：换了什么，没换什么',
    summary: '2026 年置换隐性债务从 2 万亿加到 4 万亿，债务总量、结构、利息各怎么变？',
    steps: [
      {
        tab: 'debt', set: { reset: true, changes: [{ id: 'swap26', set: 40000 }] }, focus: ['hsel1', 'bls1'],
        text: (T, D) => `多置换 2 万亿：隐性债务 ${D('hsel1')} 万亿，地方专项债（再融资债）${D('bls1')} 万亿——一减一增，数额相同。`,
      },
      {
        tab: 'debt', focus: ['broad1', 'gov1'],
        text: (T, D) => `所以含隐债的广义债务 ${D('broad1')}（不变），但显性的政府债务 ${D('gov1')} 万亿，政府负债率 ${D('debt_gdp1')}。账面负债率上升，是把原来看不见的债摆上了台面。`,
      },
      {
        tab: 'debt', focus: ['swapsave26'],
        text: (T, D) => `真正的好处在利息：城投成本约 ${T('rh')}，地方债约 ${T('rl')}，每年少付利息 ${T('swapsave26')} 亿（${D('swapsave26')}）。`,
      },
      {
        tab: 'proj', set: { changes: [{ id: 'pswap', set: 10000 }] }, focus: ['p_H_2035', 'p_w_2035', 'p_iball_2035'],
        text: (T, D) => `如果此后每年再置换 1 万亿：2035 年隐性债务 ${T('p_H_2035')} 万亿，含隐债负债率 ${T('p_w_2035')}（${D('p_w_2035')}），全口径付息占收入 ${T('p_iball_2035')}（${D('p_iball_2035')}）——化债改变的是结构和利息，不是总量。`,
      },
    ],
  },
  {
    id: 'consumption',
    title: '消费税下划：财力怎么重新分配',
    summary: '国内消费税的一半从中央划给地方。中央少了、地方多了，全国总量会变吗？转移支付要怎么跟着调？',
    steps: [
      {
        tab: 'y25', set: { reset: true, modes: { y25: 'deficit', c26: 'rate', absorb: 'other', l26: 'deficit' }, changes: [{ id: 's_con', set: 0.5 }] }, focus: ['s_con', 'rc25', 'rl25'],
        text: (T, D) => `国内消费税 ${T('t_con')} 亿，中央分享比例从 100% 降到 50%：2025 年中央收入 ${D('rc25')} 亿，地方收入 ${D('rl25')} 亿，全国收入 ${D('rev25')}（不变）。`,
      },
      {
        tab: 'b26', focus: ['rc26', 'rl26', 'r26'],
        text: (T, D) => `2026 年预算以新的基数编制：中央收入 ${D('rc26')} 亿，地方收入 ${D('rl26')} 亿。全国收入只变了 ${D('r26')} 亿——因为中央、地方的预算增速不同（1.8% 与 2.4%）。`,
      },
      {
        tab: 'b26', focus: ['oth26', 'el26'],
        text: (T, D) => `转移支付不动的话：中央本级"其它"被挤出 ${D('oth26')} 亿，地方支出多出 ${D('el26')} 亿。钱从中央口袋挪到了地方口袋。`,
      },
      {
        tab: 'b26', set: { changes: [{ id: 'g_tr', set: -0.0627 }] }, focus: ['tr26', 'oth26', 'el26'],
        text: (T, D) => `配套调整：转移支付减少 ${D('tr26')} 亿，正好抵消。中央本级"其它" ${D('oth26')}，地方支出 ${D('el26')}——"财力下沉、总量中性"，改革只改变了地方自己收的比例：地方财政自给率 ${T('self26')}（${D('self26')}）。`,
      },
    ],
  },
  {
    id: 'aging',
    title: '银发浪潮：社保缺口怎么传到一般预算',
    summary: '社保基金支出增长 15%，财政补贴兜底。锁赤字和锁支出，结果有什么不同？（四本账，2021 年数据）',
    steps: [
      {
        tab: 'fb', set: { reset: true, modes: { fb1: 'deficit', fb4: 'gap' }, changes: [{ id: 'f4_exp', mul: 1.15 }] }, focus: ['f4_exp', 'f4_sub'],
        text: (T, D) => `社保基金支出增加 ${D('f4_exp')} 万亿。规则是"补贴兜底"：保持当年结余 ${T('f4_bal')} 万亿，财政补贴随之增加 ${D('f4_sub')} 万亿。`,
      },
      {
        tab: 'fb', focus: ['f1_other', 'f1_def'],
        text: (T, D) => `补贴是一般公共预算的支出。预算赤字锁定（${T('f1_def')} 万亿不变），于是一般预算的"其他支出"被挤出 ${D('f1_other')} 万亿。`,
      },
      {
        tab: 'fb', focus: ['fc_gap'], expectSame: true,
        text: (T, D) => `合并四本账看，广义赤字变化 ${D('fc_gap')}：社保多花的钱由其他支出让出来，总的收支缺口没有扩大。`,
      },
      {
        tab: 'fb', set: { reset: true, modes: { fb1: 'spend', fb4: 'gap' }, changes: [{ id: 'f4_exp', mul: 1.15 }] }, focus: ['f1_def', 'fc_gap'],
        text: (T, D) => `换成"其他支出锁定"：其他支出一分不减，补贴增加的部分全部变成赤字——预算赤字 ${D('f1_def')} 万亿，广义赤字 ${D('fc_gap')} 万亿。老龄化的账，要么挤出其他支出，要么多借债。`,
      },
    ],
  },
];

/** 把状态推进到第 k 步（从头重放，保证前进后退都确定） */
export function stateAt(sim, story, k) {
  sim.resetAll();
  for (let i = 0; i <= k; i++) {
    const st = story.steps[i].set;
    if (!st) continue;
    if (st.reset) sim.resetAll();
    if (st.modes) sim.setModes(st.modes);
    sim.apply(st.changes ?? []);
  }
  return sim;
}
