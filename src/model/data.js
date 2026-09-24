// 四张图的原始数据。除特别注明外，数值逐项抄自图片。
// 单位：图②③为"亿元"；图①原图为"万亿元"，这里统一换算成亿元存储；图④为"万亿元"。

export const SOURCES = {
  img1: '图① 中国公共债务的构成与规模',
  img2: '图② 2026年全国一般公共预算安排情况',
  img3: '图③ 2025年全国一般公共预算执行情况',
  img4: '图④ 图解财政"四本帐"体系（2021年决算）',
};

// ---------- 图③ 2025 年执行 ----------
export const TAXES_2025 = [
  // id, 名称, 金额(亿元), 中央分享比例(分税制), 分享说明
  { id: 'vat', name: '国内增值税', v: 68947, share: 0.5, shareNote: '中央地方 50:50 分享' },
  { id: 'cit', name: '企业所得税', v: 41304, share: 0.6, shareNote: '中央 60%、地方 40%（部分央企总部全归中央，未单列）' },
  { id: 'imp', name: '进口货物增值税、消费税', v: 18263, share: 1, shareNote: '海关代征，全归中央' },
  { id: 'con', name: '国内消费税', v: 16857, share: 1, shareNote: '目前全归中央（改革方向：后移征收环节、稳步下划地方）' },
  { id: 'pit', name: '个人所得税', v: 16187, share: 0.6, shareNote: '中央 60%、地方 40%' },
  { id: 'prop', name: '房产税', v: 5212, share: 0, shareNote: '地方税' },
  { id: 'city', name: '城建税', v: 5170, share: 0, shareNote: '地方税' },
  { id: 'deed', name: '契税', v: 4440, share: 0, shareNote: '地方税' },
  { id: 'stamp', name: '印花税', v: 4270, share: 0.4, shareNote: '证券交易印花税归中央，其余归地方；中央占比为假设值' },
  { id: 'lat', name: '土地增值税', v: 4102, share: 0, shareNote: '地方税' },
  { id: 'res', name: '资源税', v: 2950, share: 0, shareNote: '基本为地方税（海洋石油资源税归中央，数额小，忽略）' },
  { id: 'ulu', name: '城镇土地使用税', v: 2551, share: 0, shareNote: '地方税' },
  { id: 'tar', name: '关税', v: 2369, share: 1, shareNote: '中央税' },
  { id: 'veh', name: '车辆购置税', v: 1972, share: 1, shareNote: '中央税' },
  { id: 'farm', name: '耕地占用税', v: 1421, share: 0, shareNote: '地方税' },
  { id: 'oth', name: '其他税收', v: 1685, share: 0, shareNote: '主要为烟叶税、环保税等地方税' },
];
export const REBATE_2025 = 21337; // 出口退税
export const NONTAX_2025 = 39682; // 非税收入
export const TAX_TOTAL_2025 = 197700; // 税收收入（图中数字 = 各税种加总，未扣退税）
export const REV_2025 = 216045; // 一般公共预算收入

export const EXP_2025 = [
  { id: 'other', name: '其它', v: 68818.35 },
  { id: 'ss', name: '社会保障和就业', short: '社保', v: 44416 },
  { id: 'edu', name: '教育', v: 43417 },
  { id: 'agri', name: '农林水', v: 23495 },
  { id: 'health', name: '卫生健康', short: '卫健', v: 21446 },
  { id: 'urban', name: '城乡社区', short: '城乡', v: 20664 },
  { id: 'def', name: '国防', v: 17846.65 },
  { id: 'int', name: '债务付息', short: '付息', v: 13491 },
  { id: 'sci', name: '科学技术', short: '科技', v: 12062 },
  { id: 'trans', name: '交通运输', short: '交通', v: 11977 },
  { id: 'env', name: '节能环保', short: '环保', v: 5816 },
  { id: 'cult', name: '文化旅游体育与传媒', short: '文旅', v: 3946 },
  { id: 'stab', name: '补充中央预算稳定调节基金', short: '补充稳定基金', v: 1003.24 },
];
export const EXP_TOTAL_2025 = 288398.24;
export const GAP_2025 = 72353.24; // 差额
export const DEFICIT_2025 = 56599.46; // 全国一般公共预算赤字
export const TRANSFER_IN_2025 = 15753.78; // 调入资金及使用结转结余

// ---------- 图② 2026 年预算 ----------
export const B2026 = {
  stabIn: 1000, // 从中央预算稳定调节基金调入
  soeIn: 2500, // 从中央国有资本经营预算调入
  revC: 95670, gRevC: 0.018, // 中央一般公共预算收入 ▲1.8%
  revN: 220700, gRevN: 0.022, // 全国一般公共预算收入 ▲2.2%
  revL: 125030, gRevL: 0.024, // 地方一般公共预算收入 ▲2.4%
  defN: 58900, defRate: 0.04, // 全国财政赤字，赤字率≈4%
  defC: 50900, gDefC: 0.047, // 中央财政赤字 ▲4.7%
  defL: 8000, // 地方财政赤字（较 2025 年执行数持平）
  expC: 150070, gExpC: 0.035, // 中央一般公共预算支出 ▲3.5%
  reserve: 500, // 中央预备费
  own: 45420, gOwn: 0.055, // 中央本级支出 ▲5.5%
  transfer: 104150, gTransfer: 0.022, // 对地方转移支付 ▲2.2%
  localIn: 17000, // 调入资金及使用结转结余（地方）
  expL: 254180, gExpL: 0.04, // 地方一般公共预算支出 ▲4%
  expN: 300100, gExpN: 0.044, // 全国一般公共预算支出 ▲4.4%（包括中央预备费）
};
// 中央本级支出分项：金额、较 2025 年执行数增幅
export const OWN_2026 = [
  { id: 'def', name: '国防支出', v: 19095.61, g: 0.07 },
  { id: 'int', name: '债务付息支出', v: 8739.9, g: 0.067 },
  { id: 'sci', name: '科学技术支出', v: 4264.2, g: 0.1 },
  { id: 'sec', name: '公共安全支出', v: 2582.69, g: 0.059 },
  { id: 'edu', name: '教育支出', v: 1924.76, g: 0.05 },
  { id: 'grain', name: '粮油物资储备支出', v: 1106.84, g: 0.081 },
  { id: 'dip', name: '外交支出', v: 709.75, g: 0.093 },
  { id: 'oth', name: '其它', v: 6996.25, g: null },
];

// ---------- 图① 债务（原图万亿元 → 亿元） ----------
export const DEBT = {
  govBonds: 548200, // 政府债券（地方一般债 + 专项债）54.82 万亿
  cgb: 412300, // 国债余额约 41.23 万亿
  lgfvBonds: 98300, // LGFV 债券 9.83 万亿（笔者估算，截至 2025 年 9 月）
  lgfvOtherInt: 220000, // LGFV 其它有息负债 22 万亿
  lgfvOther: 200000, // LGFV 其它负债 20 万亿
  hiddenOfficial: 105000, // 官方披露隐性债务 10.5 万亿（2024 年末）
  localLo: 653200, localHi: 1066500, // 地方债务合计 65.32 ~ 106.65 万亿
  govTotal: 960500, // 全国政府债务余额约 96.05 万亿
  broadLo: 1065500, broadHi: 1478800, // 加上隐债 106.55 ~ 147.88 万亿
};

// ---------- 图④ 四本账（2021 年，万亿元） ----------
export const FB2021 = {
  rev1: 20.26, // 一般公共预算收入
  totRev1: 21.37, // 一般公共预算总收入
  totExp1: 24.93, // 一般公共预算支出总量
  toStab: 0.36, // 补充中央预算稳定调节基金
  exp1: 24.6, // 一般公共预算支出
  budgetDef: 3.57, // 预算赤字
  realDef: 4.34, // 实际赤字
  subsidy: 2.3, // 对社保基金补贴
  fund: 9.8, // 政府性基金
  specialBonds: 3.65, // 地方专项债
  rev2: 13.49, // 政府性基金收入总量
  exp2: 11.34, // 政府性基金支出总量
  rev3: 0.56, exp3: 0.56, // 国有资本经营收支
  out3: 0.25, // 国有资本经营调出
  rev4: 9.69, // 社保基金收入
  prem4: 6.9, // 保费收入
  inv4: 0.27, // 其它（利息、投资收益）
  exp4: 8.7, // 社保基金支出
};
