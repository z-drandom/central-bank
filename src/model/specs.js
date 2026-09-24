// 模型规格：每个节点 = 输入参数 或 一条公式。
// buildSpecs(modes) 根据"平衡规则"生成当前的节点集合——规则决定预算恒等式中谁是余项。
//
// 节点字段：
//   id     变量名（公式里引用它）
//   sym    数学符号（公式卡片"公式"一行显示）
//   label  中文名（"读法"一行显示）
//   unit   'yi' 亿元 | 'wy' 万亿元 | 'pct' 比率(存小数) | 'num' 无量纲
//   disp   'wy' 表示以亿元存储、以万亿元显示
//   mod    所属模块：macro / y25 / b26 / debt / fb / proj
//   kind   'input' 输入参数 | 'identity' 会计恒等式 | 'calib' 校准关系 | 'assume' 假设关系
//   src    数据来源
//   note   经济含义说明
//   base   输入参数默认值；range: [min, max, step]
import { TAXES_2025, REBATE_2025, NONTAX_2025, EXP_2025, DEFICIT_2025, TRANSFER_IN_2025, B2026, OWN_2026, DEBT, FB2021 } from './data.js';

export const MODE_OPTIONS = {
  y25: {
    label: '2025 平衡规则',
    options: {
      deficit: { label: '赤字锁定', desc: '赤字是人大批准的数；收支变化由"调入资金"吸收（动用结转结余、稳定调节基金）' },
      transfer: { label: '调入锁定', desc: '调入资金不变；收支变化全部反映为赤字（反事实：如果当年多借/少借）' },
    },
  },
  c26: {
    label: '中央平衡规则',
    options: {
      rate: { label: '赤字率锚定', desc: '先定赤字率，中央支出 = 收入 + 赤字 + 调入，由"吸收项"承担增减' },
      spend: { label: '支出锚定', desc: '支出各项先定，中央赤字 = 支出 − 收入 − 调入（赤字率随之变化）' },
      stab: { label: '稳定基金兜底', desc: '赤字率和支出都定死，缺口从中央预算稳定调节基金调入' },
    },
  },
  absorb: {
    label: '中央吸收项',
    options: {
      other: { label: '本级"其它"支出', desc: '中央支出增减由中央本级"其它"支出承担（挤出效应最直观）' },
      transfer: { label: '对地方转移支付', desc: '中央支出增减由转移支付承担，进而传到地方支出' },
      prop: { label: '本级各项等比例', desc: '中央本级支出总额的增减，按各项（付息除外）的计划数等比例分摊' },
    },
  },
  l26: {
    label: '地方平衡规则',
    options: {
      deficit: { label: '以收定支', desc: '地方支出 = 地方收入 + 转移支付 + 地方赤字 + 调入资金' },
      spend: { label: '支出锚定', desc: '地方支出按增速先定，缺口由"调入资金及使用结转结余"补' },
    },
  },
  scope: {
    label: '隐性债务口径',
    options: {
      official: { label: '官方口径', desc: '官方披露 2024 年末隐性债务 10.5 万亿' },
      interest: { label: '城投有息债务', desc: '城投债券 + 其它有息负债（笔者估算）' },
      broad: { label: '宽口径', desc: '城投债券 + 其它有息负债 + 其它负债（图①上限口径）' },
    },
  },
  fb1: {
    label: '第一本账规则',
    options: {
      deficit: { label: '预算赤字锁定', desc: '赤字由人大批准；支出 = 总收入 + 赤字 − 补充稳定基金，补贴增加会挤占其他支出' },
      spend: { label: '其他支出锁定', desc: '其他支出不变；补贴、调入变化反映为预算赤字' },
    },
  },
  fb2: {
    label: '第二本账规则',
    options: {
      cap: { label: '计划支出 + 不列赤字', desc: '按计划支出，但支出不能超过收入总量（不列赤字），差额被迫压减' },
      ratio: { label: '以收定支', desc: '支出 = 收入总量 × 支出率' },
    },
  },
  fb4: {
    label: '第四本账规则',
    options: {
      fixed: { label: '补贴固定', desc: '财政补贴不变，社保基金结余随收支变化' },
      gap: { label: '补贴兜底', desc: '财政补贴 = 支出 + 目标结余 − 其他收入，缺口由一般公共预算补' },
    },
  },
  proj: {
    label: '推演规则',
    options: {
      rate: { label: '赤字率不变', desc: '每年赤字 = 赤字率 × GDP；付息增加挤占非付息支出' },
      spend: { label: '支出增速不变', desc: '非付息支出按固定增速增长；赤字 = 支出 − 收入 − 调入' },
    },
  },
};

export const DEFAULT_MODES = {
  y25: 'deficit', c26: 'rate', absorb: 'other', l26: 'deficit', scope: 'official',
  fb1: 'deficit', fb2: 'cap', fb4: 'fixed', proj: 'rate',
};

export const MODULES = {
  macro: { name: '宏观假设', short: '宏观', img: null },
  y25: { name: '2025 执行', short: '2025', img: '③' },
  b26: { name: '2026 预算', short: '2026', img: '②' },
  debt: { name: '债务存量', short: '债务', img: '①' },
  fb: { name: '四本账', short: '四本账', img: '④' },
  proj: { name: '十年推演', short: '推演', img: null },
};

// 切换平衡规则时，新出现的输入参数取什么值才能让当前数字保持不变
export const CARRY = {
  dr26: (v) => v.d26 / v.gdp26,
  g_tr: (v) => v.tr26 / v.b_tr25 - 1,
  g_el: (v) => v.el26 / v.b_el25 - 1,
  f2_ratio: (v) => v.f2_exp / v.f2_rev,
  f2_plan: (v) => v.f2_exp,
  f4_target: (v) => v.f4_bal,
  oth_pl: (v) => v.oth26,
};

/**
 * 规则切换的附加处理：离开"本级各项等比例"时，各项实际数 = 计划数 × 系数，
 * 需要把增速参数改写成"实际数对应的增速"，否则切换瞬间各项会跳回计划数。
 */
export function rebaseOnModeChange(prevModes, newModes, prev, inputs) {
  const wasProp = prevModes.c26 === 'rate' && prevModes.absorb === 'prop';
  const isProp = newModes.c26 === 'rate' && newModes.absorb === 'prop';
  if (wasProp && !isProp) {
    for (const x of ['sci', 'sec', 'edu', 'grain', 'dip']) if (`g_${x}` in inputs) inputs[`g_${x}`] = prev[`${x}26`] / prev[`b_${x}25`] - 1;
    if ('g_def' in inputs) inputs.g_def = prev.def26 / prev.e_def - 1;
  }
}

export const PROJ_START = 2026;
export const PROJ_END = 2035;

// 校准常数 -----------------------------------------------------------------
const GDP26_IMPLIED = B2026.defN / B2026.defRate; // 58,900 ÷ 4% = 1,472,500 亿元
const G_NOM0 = 0.05;
export const CALIB = {
  gdp25: GDP26_IMPLIED / (1 + G_NOM0),
  // 2025 中央收入由图② ▲1.8% 反推，用来校准非税收入的中央分享比例
  rc25Target: B2026.revC / (1 + B2026.gRevC),
};
{
  const centralTax = TAXES_2025.reduce((a, t) => a + t.v * t.share, 0);
  CALIB.sNontax = (CALIB.rc25Target - centralTax + REBATE_2025) / NONTAX_2025;
  CALIB.rl25 = TAXES_2025.reduce((a, t) => a + t.v, 0) - REBATE_2025 + NONTAX_2025 - CALIB.rc25Target;
  CALIB.gRc = B2026.revC / CALIB.rc25Target - 1;
  CALIB.gRl = B2026.revL / CALIB.rl25 - 1;
  CALIB.rcg = OWN_2026.find((x) => x.id === 'int').v / DEBT.cgb;
}

// 小工具 ------------------------------------------------------------------
function makeBuilder(mod) {
  const list = [];
  const inp = (id, sym, label, base, o = {}) => list.push({ id, sym, label, base, mod, kind: 'input', unit: 'yi', ...o });
  const f = (id, sym, label, expr, o = {}) => list.push({ id, sym, label, expr, mod, kind: 'identity', unit: 'yi', ...o });
  return { list, inp, f };
}

const pctRange = (lo, hi, step = 0.001) => [lo, hi, step];

// ============================================================================
export function buildSpecs(modes = DEFAULT_MODES) {
  const M = { ...DEFAULT_MODES, ...modes };
  const specs = [];

  // ---------------- 宏观 ----------------
  {
    const { list, inp, f } = makeBuilder('macro');
    inp('gdp25', 'Y_{25}', '2025年名义GDP', CALIB.gdp25, {
      disp: 'wy', kind: 'input', src: '由图②"赤字率≈4%"反推：58,900 ÷ 4% ÷ (1 + 5%)',
      note: '图中未直接给出 GDP。按 2026 年赤字 58,900 亿、赤字率 4%，得 2026 年 GDP ≈ 147.25 万亿；再按名义增速 5% 折回 2025 年 ≈ 140.24 万亿，与统计局公布的约 140 万亿一致。',
      range: [1300000, 1500000, 1000], tag: 'assume',
    });
    inp('g_nom', 'g', '2026年名义GDP增速', G_NOM0, {
      unit: 'pct', range: pctRange(-0.04, 0.12), tag: 'assume',
      note: '名义增速 = 实际增速 + GDP 平减指数涨幅。它同时影响 GDP（赤字率的分母）和财政收入（通过弹性 ε）。',
    });
    inp('g_nom0', 'g_{0}', '编制预算时假定的名义增速', G_NOM0, {
      unit: 'pct', fixed: true, tag: 'assume',
      note: '预算收入增速是按这个名义增速编的；实际名义增速偏离它时，收入按弹性 ε 同步偏离。',
    });
    f('gdp26', 'Y_{26}', '2026年名义GDP', 'gdp25 * (1 + g_nom)', { disp: 'wy', note: '今年 GDP = 去年 GDP × (1 + 名义增速)。' });
    specs.push(...list);
  }

  // ---------------- 图③ 2025 执行 ----------------
  {
    const { list, inp, f } = makeBuilder('y25');
    const src = '图③';
    for (const t of TAXES_2025) {
      inp(`t_${t.id}`, `T_{${t.id}}`, t.name, t.v, { src, group: 'tax', range: [0, Math.round(t.v * 2), 1] });
    }
    inp('rebate', 'X', '出口退税', REBATE_2025, {
      src, group: 'tax', range: [0, 45000, 1],
      note: '出口退税把出口环节已缴的增值税、消费税退还给企业。它是税收的抵减项：图中"税收收入 197,700"是各税种加总，扣掉退税后才进入一般公共预算收入。',
    });
    inp('nontax', 'N', '非税收入', NONTAX_2025, {
      src, group: 'tax', range: [0, 80000, 1],
      note: '非税收入包括专项收入、行政事业性收费、罚没收入、国有资源（资产）有偿使用收入等，其中大部分归地方。',
    });
    f('tax25', 'T', '税收收入（各税种合计）', `sum(${TAXES_2025.map((t) => `t_${t.id}`).join(', ')})`, { src, note: '图③中的"税收收入 197,700"就是 16 个税种的直接加总。' });
    f('taxnet25', 'T_{net}', '税收收入（扣除出口退税）', 'tax25 - rebate', { src });
    f('rev25', 'R_{25}', '2025年一般公共预算收入', 'taxnet25 + nontax', { src, note: '一般公共预算收入 = 税收（扣退税）+ 非税收入。' });

    for (const e of EXP_2025) {
      // 国防支出同时是 2026 年国防的基数，不能取 0（增速无定义）
      const lo = e.id === 'def' ? Math.round(e.v * 0.2) : 0;
      inp(`e_${e.id}`, `E_{${e.id}}`, e.name, e.v, { src, group: 'exp', short: e.short, range: [lo, Math.round(e.v * 2), 1] });
    }
    f('exp25', 'E_{25}', '2025年一般公共预算支出', `sum(${EXP_2025.map((e) => `e_${e.id}`).join(', ')})`, {
      src, note: '图③中的支出合计包含"补充中央预算稳定调节基金"1,003.24 亿——这笔钱没有花掉，而是存进了稳定调节基金。',
    });
    f('gap25', 'G_{25}', '收支差额', 'exp25 - rev25', { src, note: '差额 = 支出 − 收入，需要由赤字（借债）和调入资金共同弥补。' });
    if (M.y25 === 'deficit') {
      inp('def25', 'D_{25}', '2025年全国赤字', DEFICIT_2025, { src, range: [0, 120000, 1], note: '全国人大批准的赤字规模。' });
      f('tin25', 'T^{in}_{25}', '2025年调入资金及使用结转结余', 'gap25 - def25', {
        src, note: '赤字锁定时，调入资金是余项：差额里赤字填不满的部分，靠从稳定调节基金、政府性基金、国有资本经营预算调入以及动用结转结余来补。',
      });
    } else {
      inp('tin25', 'T^{in}_{25}', '2025年调入资金及使用结转结余', TRANSFER_IN_2025, { src, range: [0, 40000, 1] });
      f('def25', 'D_{25}', '2025年全国赤字', 'gap25 - tin25', { src, note: '调入资金锁定时，赤字是余项：差额里调入资金填不满的部分都要借债。' });
    }
    f('dr25', 'd_{25}', '2025年赤字率', 'def25 / gdp25', { unit: 'pct', note: '赤字率 = 赤字 ÷ 名义 GDP。' });
    f('core25', 'E^{*}_{25}', '2025年支出（不含补充稳定基金）', 'exp25 - e_stab', {
      note: '图②的"▲4.4%"是拿 300,100 与这个口径（287,395）比较得出的：300,100 ÷ 287,395 − 1 ≈ 4.4%。',
    });
    f('realdef25', 'A_{25}', '2025年实际赤字（图④口径）', 'core25 - rev25', {
      note: '图④把"支出 − 收入"称作实际赤字，它比预算赤字大，差额就是调入资金（净额）。',
    });
    f('taxshare25', 'τ_{25}', '税收占一般公共预算收入比重', 'taxnet25 / rev25', { unit: 'pct', note: '税收占比越高，收入质量越好（非税收入往往是一次性的）。' });
    f('burden25', 'b_{25}', '2025年宏观税负（一般预算口径）', 'rev25 / gdp25', { unit: 'pct' });
    f('intratio25', 'i_{25}', '2025年付息支出占收入比重', 'e_int / rev25', { unit: 'pct' });

    // 分税制：拆出中央收入
    for (const t of TAXES_2025.filter((x) => x.share > 0)) {
      inp(`s_${t.id}`, `s_{${t.id}}`, `${t.name}中央分享比例`, t.share, {
        unit: 'pct', group: 'share', range: [0, 1, 0.01], tag: 'assume', src: '分税制规定', note: t.shareNote,
      });
    }
    inp('s_rb', 's_{X}', '出口退税中央负担比例', 1, {
      unit: 'pct', group: 'share', range: [0, 1, 0.01], tag: 'assume', src: '分税制规定',
      note: '2015 年起出口退税（增值税部分）全部由中央负担，地方按 2014 年基数定额上解。',
    });
    inp('s_nt', 's_{N}', '非税收入中央占比', CALIB.sNontax, {
      unit: 'pct', group: 'share', range: [0, 1, 0.001], tag: 'calib', src: '校准：使 2025 年中央收入 = 95,670 ÷ 1.018',
      note: '图中没有 2025 年中央/地方收入拆分。用法定分享比例算出中央税收后，令非税收入的中央占比取值使中央收入恰好等于图②按 ▲1.8% 反推的 93,978 亿。',
    });
    const shared = TAXES_2025.filter((x) => x.share > 0).map((t) => `t_${t.id} * s_${t.id}`).join(' + ');
    f('tc25', 'T_{c}', '2025年中央税收（扣退税前）', shared, { kind: 'assume', note: '中央税收 = Σ 各税种 × 中央分享比例。' });
    f('rc25', 'R_{c,25}', '2025年中央一般公共预算收入', 'tc25 - rebate * s_rb + nontax * s_nt', {
      kind: 'calib', note: '中央收入 = 中央税收 − 中央负担的出口退税 + 中央非税收入。',
    });
    f('rl25', 'R_{l,25}', '2025年地方一般公共预算收入', 'rev25 - rc25', { note: '地方收入 = 全国收入 − 中央收入。' });
    inp('dl25', 'D_{l,25}', '2025年地方赤字', B2026.defL, {
      src: '图②："地方财政赤字 8,000，较 2025 年执行数持平"', range: [0, 30000, 1],
    });
    f('dc25', 'D_{c,25}', '2025年中央赤字', 'def25 - dl25', { note: '中央赤字 = 全国赤字 − 地方赤字。图② 50,900 ▲4.7% 正是相对这一数值。' });
    specs.push(...list);
  }

  // ---------------- 图② 2026 预算 ----------------
  {
    const { list, inp, f } = makeBuilder('b26');
    const src = '图②';
    inp('g_rc', 'g_{c}', '中央收入预算增速', CALIB.gRc, {
      unit: 'pct', range: pctRange(-0.1, 0.12), tag: 'calib', src: '图② ▲1.8%',
      note: '预算收入以上年执行数为基数编制：R₂₆ = R₂₅ × (1 + 增速)。',
    });
    inp('g_rl', 'g_{l}', '地方收入预算增速', CALIB.gRl, { unit: 'pct', range: pctRange(-0.1, 0.12), tag: 'calib', src: '图② ▲2.4%' });
    inp('eps', 'ε', '收入对名义增速偏离的弹性', 1, {
      unit: 'num', range: [0, 2, 0.05], tag: 'assume',
      note: '名义 GDP 增速每比预算假设高 1 个百分点，收入增速高 ε 个百分点。税收大体与名义 GDP 同步，ε≈1。',
    });
    f('rc26', 'R_{c}', '中央一般公共预算收入', 'rc25 * (1 + g_rc + eps * (g_nom - g_nom0))', { kind: 'calib', src });
    f('rl26', 'R_{l}', '地方一般公共预算收入', 'rl25 * (1 + g_rl + eps * (g_nom - g_nom0))', { kind: 'calib', src });
    f('r26', 'R', '全国一般公共预算收入', 'rc26 + rl26', { src });

    // 本级支出分项
    const own = OWN_2026.filter((x) => x.g != null && x.id !== 'int' && x.id !== 'def');
    const prop = M.c26 === 'rate' && M.absorb === 'prop';
    for (const x of own) {
      inp(`b_${x.id}25`, `E^{25}_{${x.id}}`, `2025年中央${x.name.replace('支出', '')}支出（反推）`, x.v / (1 + x.g), {
        fixed: true, src: `由图② ${x.v.toLocaleString('en-US')} ▲${(x.g * 100).toFixed(1)}% 反推`,
      });
      inp(`g_${x.id}`, `g_{${x.id}}`, `${x.name.replace('支出', '')}支出增速`, x.g, { unit: 'pct', range: pctRange(-0.3, 0.4), src, group: 'own' });
      if (prop) {
        f(`pl_${x.id}26`, `E^{plan}_{${x.id}}`, `${x.name}（计划数）`, `b_${x.id}25 * (1 + g_${x.id})`, { src, group: 'own' });
        f(`${x.id}26`, `E_{${x.id}}`, x.name, `pl_${x.id}26 * kprop`, { src, group: 'own', note: '等比例分摊：实际数 = 计划数 × 分摊系数。' });
      } else {
        f(`${x.id}26`, `E_{${x.id}}`, x.name, `b_${x.id}25 * (1 + g_${x.id})`, { src, group: 'own' });
      }
    }
    const defX = OWN_2026.find((x) => x.id === 'def');
    inp('g_def', 'g_{def}', '国防支出增速', defX.v / EXP_2025.find((e) => e.id === 'def').v - 1, {
      unit: 'pct', range: pctRange(-0.3, 0.4), src: '图② ▲7%（以图③ 2025 国防支出为基数）', group: 'own',
      note: '国防支出全部是中央本级支出，所以图③的全国国防支出 17,846.65 就是 2025 年中央国防支出：17,846.65 × 1.07 ≈ 19,095.61。',
    });
    if (prop) {
      f('pl_def26', 'E^{plan}_{def}', '国防支出（计划数）', 'e_def * (1 + g_def)', { src, group: 'own' });
      f('def26', 'E_{def}', '国防支出', 'pl_def26 * kprop', { src, group: 'own', note: '等比例分摊：实际数 = 计划数 × 分摊系数。' });
    } else {
      f('def26', 'E_{def}', '国防支出', 'e_def * (1 + g_def)', { src, group: 'own' });
    }
    f('int26', 'E_{int}', '债务付息支出', 'rcg * bc0', {
      kind: 'calib', src, group: 'own',
      note: '中央付息 = 国债平均付息率 × 年初国债余额（图①）。国债余额增加或利率上升，付息就增加。',
    });
    inp('b_int25', 'E^{25}_{int}', '2025年中央付息支出（反推）', 8739.9 / 1.067, { fixed: true, src: '由图② 8,739.90 ▲6.7% 反推' });
    f('int25l', 'I_{l,25}', '2025年地方付息支出（推算）', 'e_int - b_int25', {
      note: '图③全国付息 13,491 减去中央付息 ≈ 8,191，剩下约 5,300 亿是地方一般债的利息。',
    });

    inp('res26', 'E_{res}', '中央预备费', B2026.reserve, { src, range: [0, 3000, 10], note: '预备费用于年度执行中难以预见的开支。' });
    inp('b_tr25', 'TR_{25}', '2025年对地方转移支付（反推）', B2026.transfer / (1 + B2026.gTransfer), { fixed: true, src: '由图② ▲2.2% 反推' });
    inp('b_own25', 'E^{25}_{own}', '2025年中央本级支出（反推）', B2026.own / (1 + B2026.gOwn), { fixed: true, src: '由图② ▲5.5% 反推' });
    inp('b_ec25', 'E^{25}_{c}', '2025年中央一般公共预算支出（反推）', B2026.expC / (1 + B2026.gExpC), { fixed: true, src: '由图② ▲3.5% 反推' });
    inp('b_el25', 'E^{25}_{l}', '2025年地方一般公共预算支出（反推）', B2026.expL / (1 + B2026.gExpL), { fixed: true, src: '由图② ▲4% 反推' });
    inp('tstab26', 'T_{stab}', '从中央预算稳定调节基金调入', B2026.stabIn, { src, range: [0, 10000, 10] });
    inp('tsoe26', 'T_{soe}', '从中央国有资本经营预算调入', B2026.soeIn, { src, range: [0, 8000, 10] });
    inp('dl26', 'D_{l}', '地方财政赤字', B2026.defL, { src, range: [0, 30000, 10], note: '地方赤字即新增地方政府一般债券额度。' });

    const ownIds = ['def26', 'int26', 'sci26', 'sec26', 'edu26', 'grain26', 'dip26'];
    const absorbOther = M.c26 === 'rate' && M.absorb === 'other';
    const absorbProp = M.c26 === 'rate' && M.absorb === 'prop';
    const absorbTr = M.c26 === 'rate' && M.absorb === 'transfer';

    // 赤字
    if (M.c26 === 'rate' || M.c26 === 'stab') {
      inp('dr26', 'd^{*}', '目标赤字率', B2026.defRate, { unit: 'pct', src: '图② 赤字率≈4%', range: pctRange(0.005, 0.1, 0.0005) });
      f('d26', 'D', '全国财政赤字', 'dr26 * gdp26', { src, note: '赤字率锚定：赤字 = 目标赤字率 × 名义 GDP。' });
      f('dc26', 'D_{c}', '中央财政赤字', 'd26 - dl26', { src, note: '中央赤字 = 全国赤字 − 地方赤字。' });
    }
    // 其它支出、转移支付
    if (prop) {
      inp('oth_pl', 'E^{plan}_{oth}', '中央本级其它支出（计划数）', OWN_2026.find((x) => x.id === 'oth').v, { src, group: 'own', range: [0, 30000, 10] });
      f('oth26', 'E_{oth}', '中央本级其它支出', 'oth_pl * kprop', { src, group: 'own', note: '等比例分摊：实际数 = 计划数 × 分摊系数。' });
      const plans = ['pl_def26', 'pl_sci26', 'pl_sec26', 'pl_edu26', 'pl_grain26', 'pl_dip26', 'oth_pl'];
      f('kprop', 'k', '本级支出分摊系数', `(own26 - int26) / (${plans.join(' + ')})`, {
        unit: 'num', note: '可分配的本级支出（扣除刚性的付息）÷ 各项计划数之和。等于 1 表示各项都按计划安排；小于 1 表示同比例压减。',
      });
    } else if (absorbOther) {
      f('oth26', 'E_{oth}', '中央本级其它支出', `own26 - (${ownIds.join(' + ')})`, {
        src, group: 'own', note: '吸收项：中央本级支出总额定下来后，列明各项之外剩下的就是"其它"。其它变负说明赤字率锚定下无法容纳这些支出。',
      });
    } else {
      inp('oth26', 'E_{oth}', '中央本级其它支出', OWN_2026.find((x) => x.id === 'oth').v, { src, group: 'own', range: [0, 30000, 10] });
    }
    if (absorbTr) {
      f('tr26', 'TR', '对地方转移支付', 'ec26 - own26 - res26', { src, note: '吸收项：中央支出扣除本级支出和预备费后，剩下的都转移给地方。' });
    } else {
      inp('g_tr', 'g_{TR}', '转移支付增速', B2026.gTransfer, { unit: 'pct', range: pctRange(-0.2, 0.3), src });
      f('tr26', 'TR', '对地方转移支付', 'b_tr25 * (1 + g_tr)', { src });
    }
    if (M.c26 === 'rate') {
      f('ec26', 'E_{c}', '中央一般公共预算支出', 'rc26 + dc26 + tstab26 + tsoe26', { src, note: '中央支出 = 中央收入 + 中央赤字 + 从稳定调节基金调入 + 从国有资本经营预算调入。' });
      if (absorbOther || absorbProp) f('own26', 'E_{own}', '中央本级支出', 'ec26 - tr26 - res26', { src, note: '中央本级支出 = 中央支出 − 转移支付 − 预备费。' });
      else f('own26', 'E_{own}', '中央本级支出', `sum(${[...ownIds, 'oth26'].join(', ')})`, { src });
    } else {
      f('own26', 'E_{own}', '中央本级支出', `sum(${[...ownIds, 'oth26'].join(', ')})`, { src });
      f('ec26', 'E_{c}', '中央一般公共预算支出', 'own26 + tr26 + res26', { src });
      if (M.c26 === 'spend') {
        f('dc26', 'D_{c}', '中央财政赤字', 'ec26 - rc26 - tstab26 - tsoe26', { src, note: '支出锚定：中央赤字是余项。' });
        f('d26', 'D', '全国财政赤字', 'dc26 + dl26', { src });
      } else {
        // stab：tstab26 变为余项，需要先移除上面的输入定义
        const i = list.findIndex((x) => x.id === 'tstab26');
        list.splice(i, 1);
        f('tstab26', 'T_{stab}', '从中央预算稳定调节基金调入', 'ec26 - rc26 - dc26 - tsoe26', {
          src, note: '稳定基金兜底：赤字和支出都已锁定，缺口只能从预算稳定调节基金调入。为负表示有结余可补充基金。',
        });
      }
    }
    // 地方
    if (M.l26 === 'deficit') {
      inp('tl26', 'T_{l}', '地方调入资金及使用结转结余', B2026.localIn, { src, range: [0, 50000, 10] });
      f('el26', 'E_{l}', '地方一般公共预算支出', 'rl26 + tr26 + dl26 + tl26', { src, note: '地方支出 = 地方收入 + 中央转移支付 + 地方赤字 + 调入资金。' });
    } else {
      inp('g_el', 'g_{El}', '地方支出增速', B2026.gExpL, { unit: 'pct', range: pctRange(-0.2, 0.3), src });
      f('el26', 'E_{l}', '地方一般公共预算支出', 'b_el25 * (1 + g_el)', { src });
      f('tl26', 'T_{l}', '地方调入资金及使用结转结余', 'el26 - rl26 - tr26 - dl26', { src, note: '支出锚定：地方用调入资金和结转结余补缺口。' });
    }
    f('e26', 'E', '全国一般公共预算支出', 'own26 + res26 + el26', { src, note: '全国支出 = 中央本级 + 预备费 + 地方支出（转移支付在中央、地方之间抵消，不重复计算）。' });
    f('drate26', 'd', '2026年赤字率', 'd26 / gdp26', { unit: 'pct', src });
    f('gap26', 'A', '2026年实际赤字（支出 − 收入）', 'e26 - r26', { note: '图④口径的实际赤字。' });
    f('tin26', 'T^{in}', '2026年调入资金合计', 'tstab26 + tsoe26 + tl26', { note: '全国支出 = 全国收入 + 赤字 + 调入资金合计。' });
    // 增速（与 2025 基数比较）
    const pct1 = { unit: 'pct', dp: 1, group: 'growth' };
    f('gr_r26', 'Δ_{R}', '全国收入增速', 'r26 / rev25 - 1', { ...pct1, src: '图② ▲2.2%' });
    f('gr_rc26', 'Δ_{Rc}', '中央收入增速', 'rc26 / rc25 - 1', { ...pct1, src: '图② ▲1.8%' });
    f('gr_rl26', 'Δ_{Rl}', '地方收入增速', 'rl26 / rl25 - 1', { ...pct1, src: '图② ▲2.4%' });
    f('gr_e26', 'Δ_{E}', '全国支出增速', 'e26 / core25 - 1', { ...pct1, src: '图② ▲4.4%' });
    f('gr_ec26', 'Δ_{Ec}', '中央支出增速', 'ec26 / b_ec25 - 1', { ...pct1, src: '图② ▲3.5%' });
    f('gr_own26', 'Δ_{own}', '中央本级支出增速', 'own26 / b_own25 - 1', { ...pct1, src: '图② ▲5.5%' });
    f('gr_tr26', 'Δ_{TR}', '转移支付增速', 'tr26 / b_tr25 - 1', { ...pct1, src: '图② ▲2.2%' });
    f('gr_el26', 'Δ_{El}', '地方支出增速', 'el26 / b_el25 - 1', { ...pct1, src: '图② ▲4%' });
    f('gr_dc26', 'Δ_{Dc}', '中央赤字增速', 'dc26 / dc25 - 1', { ...pct1, src: '图② ▲4.7%' });
    f('gr_int26', 'Δ_{int}', '付息支出增速', 'int26 / b_int25 - 1', { ...pct1, src: '图② ▲6.7%' });
    f('gr_def26', 'Δ_{def}', '国防支出实际增速', 'def26 / e_def - 1', { ...pct1, src: '图② ▲7%' });
    for (const x of own) f(`gr_${x.id}26`, `Δ_{${x.id}}`, `${x.name.replace('支出', '')}支出实际增速`, `${x.id}26 / b_${x.id}25 - 1`, { ...pct1, src: `图② ▲${(x.g * 100).toFixed(1)}%` });
    // 指标
    f('self26', 'σ', '地方财政自给率', 'rl26 / el26', { unit: 'pct', note: '地方自己的收入能覆盖多少支出；其余靠转移支付、借债和调入。' });
    f('trdep26', 'τ_{TR}', '转移支付占地方支出比重', 'tr26 / el26', { unit: 'pct' });
    f('burden26', 'b', '2026年宏观税负（一般预算口径）', 'r26 / gdp26', { unit: 'pct' });
    f('cint26', 'i_{c}', '中央付息占中央收入比重', 'int26 / rc26', { unit: 'pct' });
    specs.push(...list);
  }

  // ---------------- 图① 债务 ----------------
  {
    const { list, inp, f } = makeBuilder('debt');
    const src = '图①';
    const W = { disp: 'wy' };
    inp('bc_obs', 'B^{obs}_{c}', '国债余额（图①）', DEBT.cgb, { ...W, src, range: [300000, 600000, 100] });
    inp('bl_obs', 'B^{obs}_{l}', '地方政府债券余额（图①）', DEBT.govBonds, { ...W, src, range: [400000, 800000, 100] });
    inp('dc25_obs', 'D^{obs}_{c,25}', '2025年中央赤字（实际）', DEFICIT_2025 - B2026.defL, { fixed: true, src: '图③ 56,599.46 − 图② 8,000' });
    inp('dl25_obs', 'D^{obs}_{l,25}', '2025年地方赤字（实际）', B2026.defL, { fixed: true, src: '图②' });
    f('bc0', 'B_{c}', '国债余额（期初）', 'bc_obs + (dc25 - dc25_obs)', {
      ...W, kind: 'identity',
      note: '反事实调整：图①是实际余额。若你改动了 2025 年的赤字，2025 年末的国债余额也应同步多（少）这么多，否则两张图就对不上了。基线下括号内为 0。',
    });
    inp('sh_lg', 'θ', '一般债占地方政府债券比重', 0.35, {
      unit: 'pct', range: [0.2, 0.5, 0.01], tag: 'assume',
      note: '图①未拆分一般债与专项债。公开数据中一般债约占三分之一强，此处取 35%。它影响付息的归属：一般债利息由一般公共预算支付，专项债利息由政府性基金预算支付。',
    });
    f('blg0', 'B_{lg}', '地方一般债余额（期初）', 'bl_obs * sh_lg + (dl25 - dl25_obs)', { ...W, kind: 'assume', note: '地方赤字对应新增一般债，故 2025 年地方赤字的偏离计入一般债。' });
    f('bls0', 'B_{ls}', '地方专项债余额（期初）', 'bl_obs * (1 - sh_lg)', { ...W, kind: 'assume' });
    f('bl0', 'B_{l}', '地方政府债券余额（期初）', 'blg0 + bls0', { ...W });
    inp('h_bond', 'H_{b}', 'LGFV债券', DEBT.lgfvBonds, { ...W, src: '图①（笔者估算，截至2025年9月）', range: [0, 200000, 100] });
    inp('h_oib', 'H_{o}', 'LGFV其它有息负债', DEBT.lgfvOtherInt, { ...W, src: '图①（笔者估算）', range: [0, 400000, 100] });
    inp('h_ol', 'H_{n}', 'LGFV其它负债', DEBT.lgfvOther, { ...W, src: '图①（笔者估算）', range: [0, 400000, 100] });
    inp('h_off', 'H_{off}', '隐性债务（官方披露，2024年末）', DEBT.hiddenOfficial, { ...W, src: '图①（官方披露）', range: [0, 300000, 100] });
    inp('swap25', 'S_{25}', '口径修正：2025年已置换隐债', 0, {
      ...W, range: [0, 40000, 100], tag: 'assume',
      note: '时点差异：官方隐债 10.5 万亿是 2024 年末数，而 2025 年已经发行约 2 万亿再融资债券置换隐债，这部分已计入政府债券 54.82 万亿。原图直接相加可能重复计算；需要修正时把此项设为 20,000。默认 0 以复现原图。',
    });
    f('gov0', 'B', '全国政府债务余额', 'bc0 + bl0', { ...W, src });
    f('hwide', 'H_{max}', '隐性债务（宽口径）', 'h_bond + h_oib + h_ol', { ...W, src });
    f('hib', 'H_{ib}', '城投有息债务', 'h_bond + h_oib', { ...W });
    f('hoff_adj', 'H^{*}_{off}', '官方口径隐债（修正后）', 'max(0, h_off - swap25)', { ...W });
    f('local_lo', 'L_{min}', '地方债务合计（下限）', 'bl0 + hoff_adj', { ...W, src });
    f('local_hi', 'L_{max}', '地方债务合计（上限）', 'bl0 + hwide', { ...W, src });
    f('broad_lo', 'W_{min}', '含隐债的政府债务（下限）', 'gov0 + hoff_adj', { ...W, src });
    f('broad_hi', 'W_{max}', '含隐债的政府债务（上限）', 'gov0 + hwide', { ...W, src });
    const hsel = { official: 'hoff_adj', interest: 'hib', broad: 'hwide' }[M.scope];
    f('hsel', 'H', `隐性债务（${MODE_OPTIONS.scope.options[M.scope].label}）`, hsel, { ...W });
    f('hib_sel', 'H^{ib}', '计息隐性债务', M.scope === 'official' ? 'hoff_adj' : 'hib', { ...W, note: '宽口径中的"其它负债"（应付款等）不计息。' });
    f('broad0', 'W', '广义政府债务（期初）', 'gov0 + hsel', { ...W });
    f('debt_gdp0', 'd_{0}', '政府负债率（期初）', 'gov0 / gdp25', { unit: 'pct' });
    f('broad_gdp0', 'w_{0}', '广义负债率（期初）', 'broad0 / gdp25', { unit: 'pct' });
    f('broadlo_gdp0', 'w_{min}', '广义负债率下限', 'broad_lo / gdp25', { unit: 'pct' });
    f('broadhi_gdp0', 'w_{max}', '广义负债率上限', 'broad_hi / gdp25', { unit: 'pct' });

    inp('stb26', 'S_{tb}', '2026年特别国债（不计赤字）', 0, {
      ...W, range: [0, 30000, 100], tag: 'assume',
      note: '特别国债（如超长期特别国债）列入政府性基金预算，不计入赤字，但同样增加国债余额。图中未给出，默认 0。',
    });
    inp('sp26', 'S_{sp}', '2026年新增地方专项债', 44000, {
      ...W, range: [0, 80000, 100], tag: 'assume',
      note: '专项债列入政府性基金预算，不计入赤字。图中未给出 2026 年数，默认取 2025 年安排的 4.4 万亿。',
    });
    inp('swap26', 'S_{sw}', '2026年置换隐性债务', 20000, {
      ...W, range: [0, 60000, 100], tag: 'assume',
      note: '2024 年 11 月全国人大常委会批准增加 6 万亿元地方债限额置换存量隐性债务，2024–2026 年每年 2 万亿。置换让隐性债务变成显性的再融资专项债，总量不变、利息下降。',
    });
    f('bc1', "B'_{c}", '2026年末国债余额', 'bc0 + dc26 + stb26', { ...W, note: '年末国债 = 年初 + 中央赤字 + 特别国债（到期本金借新还旧，不改变余额）。' });
    f('blg1', "B'_{lg}", '2026年末地方一般债', 'blg0 + dl26', { ...W });
    f('bls1', "B'_{ls}", '2026年末地方专项债', 'bls0 + sp26 + swap26', { ...W });
    f('bl1', "B'_{l}", '2026年末地方政府债券', 'blg1 + bls1', { ...W });
    f('gov1', "B'", '2026年末全国政府债务', 'bc1 + bl1', { ...W });
    f('hsel1', "H'", '2026年末隐性债务', 'max(0, hsel - swap26)', { ...W, note: '置换把隐性债务转成专项债：隐债减少、专项债增加，广义债务总量不变。' });
    f('broad1', "W'", '2026年末广义政府债务', 'gov1 + hsel1', { ...W });
    f('debt_gdp1', 'd_{1}', '2026年末政府负债率', 'gov1 / gdp26', { unit: 'pct', note: '负债率 = 政府债务余额 ÷ GDP，国际常用 60% 作为警戒参考。' });
    f('broad_gdp1', 'w_{1}', '2026年末广义负债率', 'broad1 / gdp26', { unit: 'pct' });

    inp('rcg', 'r_{c}', '国债平均付息率', CALIB.rcg, {
      unit: 'pct', range: pctRange(0.005, 0.05, 0.0001), tag: 'calib', src: '校准：8,739.90 ÷ 412,300', kw: '利率 利息 国债收益率',
      note: '用图②中央付息 8,739.90 亿除以图①国债余额 41.23 万亿得到的隐含平均付息率，约 2.12%。',
    });
    inp('rl', 'r_{l}', '地方政府债券平均利率', 0.028, {
      unit: 'pct', range: pctRange(0.01, 0.06, 0.0001), tag: 'assume',
      note: '假设值。检验：2025 年地方付息推算约 5,300 亿，÷ 地方一般债约 19 万亿 ≈ 2.8%。',
    });
    inp('rh', 'r_{h}', '城投有息债务平均成本', 0.05, { unit: 'pct', range: pctRange(0.02, 0.1, 0.0001), tag: 'assume', kw: '利率 利息 融资成本', note: '城投融资成本普遍高于政府债券，假设 5%。' });
    f('int_lg26', 'I_{lg}', '地方一般债付息（一般预算）', 'rl * blg0', { kind: 'assume' });
    f('int_ls26', 'I_{ls}', '地方专项债付息（基金预算）', 'rl * bls0', { kind: 'assume' });
    f('int_h26', 'I_{h}', '城投隐性债务付息', 'rh * hib_sel', { kind: 'assume' });
    f('int_gb26', 'I_{G}', '一般公共预算付息（中央+地方）', 'int26 + int_lg26', {});
    f('int_all26', 'I', '全口径付息', 'int_gb26 + int_ls26 + int_h26', {});
    f('intburden26', 'i', '付息占一般公共预算收入比重', 'int_gb26 / r26', { unit: 'pct', note: 'IMF 等机构常把 10% 视作偏高的警戒线。' });
    f('swapsave26', 'ΔI', '置换年化节约利息', 'swap26 * (rh - rl)', { kind: 'assume', note: '把 5% 左右的城投债换成 2.8% 左右的政府债，每年少付的利息。' });
    specs.push(...list);
  }

  // ---------------- 图④ 四本账（2021，万亿元） ----------------
  {
    const { list, inp, f } = makeBuilder('fb');
    const U = { unit: 'wy' };
    const src = '图④';
    const R = (lo, hi, step = 0.01) => [lo, hi, step];
    // 第二本账
    inp('f2_land', 'L', '土地出让收入', 8.7, {
      ...U, range: R(0, 15), tag: 'assume', src: '外部参考：2021 年国有土地使用权出让收入约 8.7 万亿',
      note: '图④只给出政府性基金 9.8，其中绝大部分是土地出让收入。拆出来是为了模拟"土地财政"的变化。',
    });
    inp('f2_oth', 'F_{o}', '其他政府性基金收入', 1.1, { ...U, range: R(0, 5), tag: 'assume', src: '9.8 − 8.7' });
    f('f2_fund', 'F', '政府性基金收入', 'f2_land + f2_oth', { ...U, src });
    inp('f2_bond', 'B_{s}', '地方专项债', FB2021.specialBonds, { ...U, src, range: R(0, 8) });
    inp('f1_to2', 'T_{1→2}', '一般公共预算调入政府性基金', 0.02, { ...U, range: R(0, 1), tag: 'assume', src: '图中与"上年结转"合计 0.04（=13.49−9.8−3.65），拆分为假设' });
    inp('f2_carry', 'C_{2}', '政府性基金上年结转收入', 0.02, { ...U, range: R(0, 2), tag: 'assume', src: '同上' });
    f('f2_rev', 'R_{2}', '政府性基金收入总量', 'f2_fund + f2_bond + f1_to2 + f2_carry', { ...U, src });
    if (M.fb2 === 'cap') {
      inp('f2_plan', 'E^{plan}_{2}', '政府性基金计划支出', FB2021.exp2, { ...U, src, range: R(0, 20) });
      f('f2_exp', 'E_{2}', '政府性基金支出', 'min(f2_plan, f2_rev)', { ...U, src, note: '政府性基金预算不列赤字：支出不能超过收入总量。' });
      f('f2_cut', 'E^{cut}_{2}', '被迫压减的支出', 'f2_plan - f2_exp', { ...U, note: '收入不够时，计划支出中无法安排的部分。' });
    } else {
      inp('f2_ratio', 'ρ', '政府性基金支出率', FB2021.exp2 / FB2021.rev2, { unit: 'pct', range: [0.5, 1, 0.001], tag: 'calib', src: '11.34 ÷ 13.49' });
      f('f2_exp', 'E_{2}', '政府性基金支出', 'f2_rev * f2_ratio', { ...U, src, note: '以收定支：支出按收入总量的固定比例安排。' });
    }
    f('f2_sur', 'S_{2}', '政府性基金结余', 'f2_rev - f2_exp', { ...U, note: '不列赤字，结余可以：补充预算稳定调节基金、调入一般公共预算、结转下年支出。' });
    inp('f2_a', 'α', '结余调入一般公共预算比例', 0.2, { unit: 'pct', range: [0, 1, 0.01], tag: 'assume' });
    inp('f2_b', 'β', '结余补充稳定调节基金比例', 0.05, { unit: 'pct', range: [0, 1, 0.01], tag: 'assume' });
    f('f2_to1', 'T_{2→1}', '政府性基金调入一般公共预算', 'f2_sur * f2_a', { ...U, kind: 'assume' });
    f('f2_tostab', 'S_{2→s}', '政府性基金补充稳定调节基金', 'f2_sur * f2_b', { ...U, kind: 'assume' });
    f('f2_next', "C'_{2}", '政府性基金结转下年', 'f2_sur - f2_to1 - f2_tostab', { ...U });
    // 第三本账
    inp('f3_inc', 'R_{3}', '国有资本经营收入', 0.52, { ...U, range: R(0, 2), tag: 'assume', src: '图中与上年结转合计 0.56，拆分为假设' });
    inp('f3_carry', 'C_{3}', '国有资本经营上年结转', 0.04, { ...U, range: R(0, 0.5), tag: 'assume' });
    f('f3_rev', 'R^{tot}_{3}', '国有资本经营收入总量', 'f3_inc + f3_carry', { ...U, src });
    inp('f3_k', 'κ', '国有资本经营预算调出比例', FB2021.out3 / 0.52, { unit: 'pct', range: [0, 1, 0.01], tag: 'calib', src: '0.25 ÷ 0.52', note: '国有资本经营预算调入一般公共预算的比例，近年政策要求逐步提高。' });
    f('f3_out', 'T_{3→1}', '国有资本经营调出', 'f3_inc * f3_k', { ...U, src, kind: 'calib' });
    inp('f3_next', "C'_{3}", '国有资本经营结转下年支出', 0, { ...U, range: R(0, 0.5), tag: 'assume' });
    f('f3_exp', 'E_{3}', '国有资本经营支出', 'f3_rev - f3_out - f3_next', { ...U, note: '国有资本经营预算收支平衡："收入总量 = 支出总量"。' });
    f('f3_tot', 'E^{tot}_{3}', '国有资本经营支出总量', 'f3_exp + f3_out + f3_next', { ...U, src });
    // 第四本账
    inp('f4_prem', 'P', '社保基金保费收入', FB2021.prem4, { ...U, src, range: R(0, 15) });
    inp('f4_inv', 'I_{4}', '利息、投资收益', FB2021.inv4, { ...U, src, range: R(0, 2) });
    inp('f4_oth', 'O_{4}', '社保基金其他收入（图中未列示）', 0.22, { ...U, range: R(0, 2), tag: 'calib', src: '9.69 − 6.9 − 2.3 − 0.27' });
    inp('f4_exp', 'E_{4}', '社保基金支出', FB2021.exp4, { ...U, src, range: R(0, 15), note: '主要是养老金、医保待遇等。老龄化会推高这一项。' });
    if (M.fb4 === 'fixed') {
      inp('f4_sub', 'T_{1→4}', '财政对社保基金补贴', FB2021.subsidy, { ...U, src, range: R(0, 6) });
    } else {
      inp('f4_target', 'Z', '社保基金目标当年结余', 0.99, { ...U, range: R(-1, 3), tag: 'assume' });
      f('f4_sub', 'T_{1→4}', '财政对社保基金补贴', 'max(0, f4_exp + f4_target - f4_prem - f4_inv - f4_oth)', { ...U, note: '补贴兜底：社保基金的缺口由一般公共预算补足。' });
    }
    f('f4_rev', 'R_{4}', '社保基金收入', 'f4_prem + f4_sub + f4_inv + f4_oth', { ...U, src });
    f('f4_bal', 'S_{4}', '社保基金当年结余', 'f4_rev - f4_exp', { ...U, note: '结余滚存进社保基金累计结余。' });
    // 第一本账
    inp('f1_rev', 'R_{1}', '一般公共预算收入', FB2021.rev1, { ...U, src, range: R(10, 30) });
    inp('f1_stabin', 'T_{s→1}', '预算稳定调节基金调入', 0.3, { ...U, range: R(0, 2), tag: 'assume', src: '图中调入合计 1.11，拆分为假设' });
    inp('f1_carry', 'C_{1}', '一般公共预算结转结余资金', 0.13, { ...U, range: R(0, 2), tag: 'assume' });
    f('f1_tin', 'T_{1}', '调入资金合计', 'f1_stabin + f1_carry + f2_to1 + f3_out', { ...U, note: '调入 = 稳定调节基金调入 + 结转结余 + 政府性基金调入 + 国有资本经营调入。' });
    f('f1_totrev', 'R^{tot}_{1}', '一般公共预算总收入', 'f1_rev + f1_tin', { ...U, src });
    inp('f1_tostab', 'S_{1}', '补充中央预算稳定调节基金', FB2021.toStab, { ...U, src, range: R(0, 2) });
    if (M.fb1 === 'deficit') {
      inp('f1_def', 'D_{1}', '预算赤字', FB2021.budgetDef, { ...U, src, range: R(0, 8) });
      f('f1_exp', 'E_{1}', '一般公共预算支出', 'f1_totrev + f1_def - f1_tostab', { ...U, src });
      f('f1_other', 'E^{o}_{1}', '其他一般公共预算支出', 'f1_exp - f4_sub - f1_to2', { ...U, note: '扣掉给其他账本的钱之后，真正花在一般公共服务上的支出。' });
    } else {
      inp('f1_other', 'E^{o}_{1}', '其他一般公共预算支出', FB2021.rev1 + 1.11 + FB2021.budgetDef - FB2021.toStab - FB2021.subsidy - 0.02, { ...U, range: R(10, 35) });
      f('f1_exp', 'E_{1}', '一般公共预算支出', 'f1_other + f4_sub + f1_to2', { ...U, src });
      f('f1_def', 'D_{1}', '预算赤字', 'f1_exp + f1_tostab - f1_totrev', { ...U, src, note: '其他支出锁定：预算赤字是余项。' });
    }
    f('f1_totexp', 'E^{tot}_{1}', '一般公共预算支出总量', 'f1_exp + f1_tostab', { ...U, src });
    f('f1_realdef', 'A_{1}', '实际赤字', 'f1_exp - f1_rev', { ...U, src, note: '实际赤字 = 支出 − 当年收入，不扣调入资金。它比预算赤字大，差额是"调入资金 − 补充稳定基金"。' });
    // 稳定调节基金与合并口径
    f('fs_in', 'S_{in}', '稳定调节基金流入', 'f1_tostab + f2_tostab', { ...U });
    f('fs_out', 'S_{out}', '稳定调节基金流出', 'f1_stabin', { ...U });
    f('fs_net', 'ΔS', '稳定调节基金净增加', 'fs_in - fs_out', { ...U });
    f('fc_rev', 'R^{all}', '四本账合并收入（剔除内部往来）', 'f1_rev + f2_fund + f3_inc + f4_prem + f4_inv + f4_oth', {
      ...U, note: '合并口径只计对外收入：补贴、调入调出是账本之间左手倒右手，要剔除。',
    });
    f('fc_exp', 'E^{all}', '四本账合并支出（剔除内部往来）', 'f1_other + f2_exp + f3_exp + f4_exp', { ...U });
    f('fc_gap', 'A^{all}', '合并口径收支缺口（广义赤字）', 'fc_exp - fc_rev', { ...U, note: '四本账合并后"真实"的收支缺口。' });
    f('fc_gap2', 'A^{all}', '广义赤字（按融资来源分解）', 'f1_def + f2_bond + (f1_carry + f2_carry + f3_carry) - (f2_next + f3_next) - fs_net - f4_bal', {
      ...U, note: '恒等式：广义赤字 = 预算赤字 + 专项债 + 动用上年结转 − 结转下年 − 稳定基金净增加 − 社保当年结余。两种算法结果必然相等。',
    });
    specs.push(...list);
  }

  // ---------------- 十年推演 ----------------
  {
    const { list, inp, f } = makeBuilder('proj');
    const W = { disp: 'wy' };
    inp('pg', 'g', '2027年后名义GDP增速', 0.045, { unit: 'pct', range: pctRange(0, 0.1), tag: 'assume' });
    inp('peps', 'ε', '收入弹性', 1, { unit: 'num', range: [0, 2, 0.05], tag: 'assume', note: '收入增速 = ε × 名义 GDP 增速。' });
    inp('pdr', 'd^{*}', '推演期赤字率', 0.04, { unit: 'pct', range: pctRange(0, 0.1, 0.0005), tag: 'assume' });
    inp('pge', 'g_{E}', '非付息支出增速', 0.045, { unit: 'pct', range: pctRange(-0.05, 0.12), tag: 'assume' });
    inp('pshift', 'Δr', '利率变动', 0, { unit: 'pct', range: pctRange(-0.02, 0.03, 0.0005), tag: 'assume', note: '在 2026 年利率基础上整体平移。' });
    inp('psp', 'S_{sp}', '每年新增专项债', 44000, { ...W, range: [0, 80000, 100], tag: 'assume' });
    inp('pstb', 'S_{tb}', '每年特别国债', 0, { ...W, range: [0, 30000, 100], tag: 'assume' });
    inp('pswap', 'S_{sw}', '每年置换隐债', 0, { ...W, range: [0, 60000, 100], tag: 'assume', note: '2027 年起每年继续置换的规模（不超过剩余隐债）。' });
    inp('pphi', 'φ', '存量利率重定价速度', 0.15, {
      unit: 'pct', range: [0.02, 1, 0.01], tag: 'assume',
      note: '每年有多大比例的存量债务按新的市场利率重新定价，约等于 1 ÷ 平均剩余期限（约 6–7 年）。设为 100% 表示利率变化立刻作用于全部存量。',
    });
    f('prc', 'm_{c}', '推演期国债市场利率', 'rcg + pshift', { unit: 'pct', note: '新发国债的利率 = 2026 年平均付息率 + 利率变动。' });
    f('prl', 'm_{l}', '推演期地方债市场利率', 'rl + pshift', { unit: 'pct' });

    const y0 = PROJ_START;
    // 起点：2026 年 = 预算模块结果
    f(`p_Y_${y0}`, `Y_{${y0}}`, `${y0}年GDP`, 'gdp26', W);
    f(`p_R_${y0}`, `R_{${y0}}`, `${y0}年一般预算收入`, 'r26', {});
    f(`p_T_${y0}`, `T_{${y0}}`, `${y0}年调入资金`, 'tin26', {});
    f(`p_I_${y0}`, `I_{${y0}}`, `${y0}年一般预算付息`, 'int_gb26', {});
    f(`p_rc_${y0}`, `r_{c,${y0}}`, `${y0}年国债平均付息率`, 'rcg', { unit: 'pct' });
    f(`p_rl_${y0}`, `r_{l,${y0}}`, `${y0}年地方债平均利率`, 'rl', { unit: 'pct' });
    f(`p_D_${y0}`, `D_{${y0}}`, `${y0}年赤字`, 'd26', {});
    f(`p_E_${y0}`, `E_{${y0}}`, `${y0}年一般预算支出`, 'e26', {});
    f(`p_PE_${y0}`, `PE_{${y0}}`, `${y0}年非付息支出`, `p_E_${y0} - p_I_${y0}`, {});
    f(`p_Bc_${y0}`, `B_{c,${y0}}`, `${y0}年末国债`, 'bc1', W);
    f(`p_Blg_${y0}`, `B_{lg,${y0}}`, `${y0}年末地方一般债`, 'blg1', W);
    f(`p_Bls_${y0}`, `B_{ls,${y0}}`, `${y0}年末地方专项债`, 'bls1', W);
    f(`p_H_${y0}`, `H_{${y0}}`, `${y0}年末隐性债务`, 'hsel1', W);
    f(`p_B_${y0}`, `B_{${y0}}`, `${y0}年末政府债务`, 'gov1', W);
    f(`p_d_${y0}`, `d_{${y0}}`, `${y0}年政府负债率`, `p_B_${y0} / p_Y_${y0}`, { unit: 'pct' });
    f(`p_w_${y0}`, `w_{${y0}}`, `${y0}年广义负债率`, `(p_B_${y0} + p_H_${y0}) / p_Y_${y0}`, { unit: 'pct' });
    f(`p_ib_${y0}`, `i_{${y0}}`, `${y0}年付息/收入`, `p_I_${y0} / p_R_${y0}`, { unit: 'pct' });
    f(`p_dr_${y0}`, `δ_{${y0}}`, `${y0}年赤字率`, `p_D_${y0} / p_Y_${y0}`, { unit: 'pct' });
    f(`p_dd_${y0}`, `Δd_{${y0}}`, `${y0}年负债率变动`, `p_d_${y0} - debt_gdp0`, { unit: 'pct' });
    f(`p_r_${y0}`, `r_{${y0}}`, `${y0}年有效利率`, `p_I_${y0} / gov0`, {
      unit: 'pct', note: '有效利率 = 一般公共预算付息 ÷ 上年末显性债务。专项债利息由政府性基金预算支付，不在分子里，所以它低于票面利率。',
    });
    f(`p_snow_${y0}`, `SB_{${y0}}`, `${y0}年滚雪球效应`, `debt_gdp0 * (p_r_${y0} - g_nom) / (1 + g_nom)`, { unit: 'pct' });
    f(`p_pd_${y0}`, `pd_{${y0}}`, `${y0}年基本赤字率`, `(p_D_${y0} - p_I_${y0}) / p_Y_${y0}`, { unit: 'pct' });
    f(`p_sfa_${y0}`, `sf_{${y0}}`, `${y0}年其他债务融资`, `(stb26 + sp26 + swap26) / p_Y_${y0}`, { unit: 'pct' });

    for (let y = y0 + 1; y <= PROJ_END; y++) {
      const p = y - 1;
      f(`p_Y_${y}`, `Y_{${y}}`, `${y}年GDP`, `p_Y_${p} * (1 + pg)`, W);
      f(`p_R_${y}`, `R_{${y}}`, `${y}年一般预算收入`, `p_R_${p} * (1 + peps * pg)`, {});
      f(`p_T_${y}`, `T_{${y}}`, `${y}年调入资金`, `p_T_${p} * (1 + pg)`, { kind: 'assume', note: '调入资金按 GDP 同比例增长。' });
      f(`p_rc_${y}`, `r_{c,${y}}`, `${y}年国债平均付息率`, `p_rc_${p} + pphi * (prc - p_rc_${p})`, {
        unit: 'pct', note: '存量平均利率每年向市场利率靠拢一部分：新发和到期续发的债务按市场利率计息，其余沿用旧利率。',
      });
      f(`p_rl_${y}`, `r_{l,${y}}`, `${y}年地方债平均利率`, `p_rl_${p} + pphi * (prl - p_rl_${p})`, { unit: 'pct' });
      f(`p_I_${y}`, `I_{${y}}`, `${y}年一般预算付息`, `p_rc_${y} * p_Bc_${p} + p_rl_${y} * p_Blg_${p}`, { note: '付息 = 平均利率 × 上年末余额（专项债利息由政府性基金预算支付，不在此列）。' });
      if (M.proj === 'rate') {
        f(`p_D_${y}`, `D_{${y}}`, `${y}年赤字`, `pdr * p_Y_${y}`, {});
        f(`p_E_${y}`, `E_{${y}}`, `${y}年一般预算支出`, `p_R_${y} + p_D_${y} + p_T_${y}`, {});
        f(`p_PE_${y}`, `PE_{${y}}`, `${y}年非付息支出`, `p_E_${y} - p_I_${y}`, { note: '赤字率锁定时，付息越多，能花在其他地方的钱越少。' });
      } else {
        f(`p_PE_${y}`, `PE_{${y}}`, `${y}年非付息支出`, `p_PE_${p} * (1 + pge)`, {});
        f(`p_E_${y}`, `E_{${y}}`, `${y}年一般预算支出`, `p_PE_${y} + p_I_${y}`, {});
        f(`p_D_${y}`, `D_{${y}}`, `${y}年赤字`, `p_E_${y} - p_R_${y} - p_T_${y}`, {});
      }
      f(`p_sw_${y}`, `S_{sw,${y}}`, `${y}年置换隐债`, `min(pswap, p_H_${p})`, W);
      f(`p_Dl_${y}`, `D_{l,${y}}`, `${y}年地方赤字`, `dl26 * p_Y_${y} / gdp26`, { kind: 'assume', note: '地方赤字（新增一般债限额）占 GDP 的比例保持 2026 年水平，其余赤字由中央承担。' });
      f(`p_Bc_${y}`, `B_{c,${y}}`, `${y}年末国债`, `p_Bc_${p} + (p_D_${y} - p_Dl_${y}) + pstb`, { ...W, note: '国债 = 上年末 + 中央赤字（全国赤字 − 地方赤字）+ 特别国债。' });
      f(`p_Blg_${y}`, `B_{lg,${y}}`, `${y}年末地方一般债`, `p_Blg_${p} + p_Dl_${y}`, W);
      f(`p_Bls_${y}`, `B_{ls,${y}}`, `${y}年末地方专项债`, `p_Bls_${p} + psp + p_sw_${y}`, W);
      f(`p_H_${y}`, `H_{${y}}`, `${y}年末隐性债务`, `p_H_${p} - p_sw_${y}`, W);
      f(`p_B_${y}`, `B_{${y}}`, `${y}年末政府债务`, `p_Bc_${y} + p_Blg_${y} + p_Bls_${y}`, W);
      f(`p_d_${y}`, `d_{${y}}`, `${y}年政府负债率`, `p_B_${y} / p_Y_${y}`, { unit: 'pct' });
      f(`p_w_${y}`, `w_{${y}}`, `${y}年广义负债率`, `(p_B_${y} + p_H_${y}) / p_Y_${y}`, { unit: 'pct' });
      f(`p_ib_${y}`, `i_{${y}}`, `${y}年付息/收入`, `p_I_${y} / p_R_${y}`, { unit: 'pct' });
      f(`p_dr_${y}`, `δ_{${y}}`, `${y}年赤字率`, `p_D_${y} / p_Y_${y}`, { unit: 'pct' });
      f(`p_dd_${y}`, `Δd_{${y}}`, `${y}年负债率变动`, `p_d_${y} - p_d_${p}`, { unit: 'pct' });
      f(`p_r_${y}`, `r_{${y}}`, `${y}年有效利率`, `p_I_${y} / p_B_${p}`, { unit: 'pct' });
      f(`p_snow_${y}`, `SB_{${y}}`, `${y}年滚雪球效应`, `p_d_${p} * (p_r_${y} - pg) / (1 + pg)`, {
        unit: 'pct', note: '债务自我滚动：有效利率 r 高于增速 g 时，即使没有基本赤字，负债率也会上升。',
      });
      f(`p_pd_${y}`, `pd_{${y}}`, `${y}年基本赤字率`, `(p_D_${y} - p_I_${y}) / p_Y_${y}`, { unit: 'pct' });
      f(`p_sfa_${y}`, `sf_{${y}}`, `${y}年其他债务融资`, `(pstb + psp + p_sw_${y}) / p_Y_${y}`, { unit: 'pct', note: '专项债、特别国债和置换债不计入赤字，但增加显性债务。' });
    }
    specs.push(...list);
  }

  return specs;
}

// 常用分组，供界面使用
export const TAX_IDS = TAXES_2025.map((t) => `t_${t.id}`);
export const EXP25_IDS = EXP_2025.map((e) => `e_${e.id}`);
export const OWN26_IDS = ['def26', 'int26', 'sci26', 'sec26', 'edu26', 'grain26', 'dip26', 'oth26'];
