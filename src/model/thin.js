// 读薄：从一百多个旋钮里挑出三个最出人意料的，每个只配一个问题、一句话、一条公式。
// 句子里的每个数字都由模型现算（read 返回的都是模型节点或由节点直接组合），单元测试逐句核对。
import { Sim } from './sim.js';

export const THIN_KEY = 'fiscal-sandbox-thin-v1';

const pct = (x, dp = 1) => `${(x * 100).toFixed(dp)}%`;
const pp = (x, dp = 2) => `${(x * 100).toFixed(dp)}`; // 百分点，不带符号
const wy = (x) => `${(x / 1e4).toFixed(2)} 万亿`; // 亿元 → 万亿元
const yi = (x) => `${Math.round(Math.abs(x)).toLocaleString('en-US')} 亿`;

/** 负债率终点之后的外推：把 2035 年的赤字率、其他债务融资率冻结，按 d = d/(1 + g) + δ + sf 走 */
export function debtPath(v, until = 2080) {
  const pts = [{ x: 2025, y: v.debt_gdp0 }];
  for (let y = 2026; y <= 2035; y++) pts.push({ x: y, y: v[`p_d_${y}`] });
  let d = v.p_d_2035;
  for (let y = 2036; y <= until; y++) {
    d = d / (1 + v.pg) + v.p_dr_2035 + v.p_sfa_2035;
    pts.push({ x: y, y: d, extra: true });
  }
  return pts;
}

export const LESSONS = [
  {
    id: 'ruler', no: '①', tab: 'b26', source: '图② 2026 年预算',
    q: '经济比预期冷，2026 年名义增速从 5% 掉到 3%。按 4% 赤字率编的预算，今年能借的钱会——',
    options: ['变多', '不变', '变少'], answer: 2,
    title: '赤字率是一把尺子，量的是 GDP',
    lever: { id: 'g_nom', label: '2026 年名义 GDP 增速', min: 0.01, max: 0.08, step: 0.001, try: 0.03 },
    read(v, b) {
      const g = v.g_nom;
      const dR = v.r26 - b.r26;
      const dD = v.d26 - b.d26;
      const dE = v.e26 - b.e26;
      const need = (b.e26 - v.r26 - v.tin26) / v.gdp26; // 让支出回到原图所需的赤字率
      const same = Math.abs(g - b.g_nom) < 5e-4;
      return {
        nums: [
          { label: '今年能借的钱', value: wy(v.d26), delta: same ? null : dD, node: 'd26' },
          { label: '今年能花的钱', value: wy(v.e26), delta: same ? null : dE, node: 'e26' },
          { label: '要让支出不缩，赤字率得是', value: pct(need, 2), node: null },
        ],
        say: same
          ? '拖动增速，让经济变冷或变热。'
          : g < b.g_nom
            ? `增速 ${pct(g)}：收入少 ${yi(dR)}，按 4% 能借的也少 ${yi(dD)}，一共少花 ${yi(dE)}。想让支出不缩，赤字率得从 4% 提到 ${pct(need, 2)}。`
            : `增速 ${pct(g)}：收入多 ${yi(dR)}，能借的也多 ${yi(dD)}，一共多花 ${yi(dE)}——经济越热，按比例编的预算花得越多。`,
        moral: '经济一冷，尺子跟着缩，能借的反而变少：按比例编的预算会顺着经济走。所以经济下行时，要调的是赤字率本身。',
        fx: { sym: '赤字 = 赤字率 × 名义 GDP', subst: `${wy(v.d26)} = ${pct(v.drate26, 2)} × ${wy(v.gdp26)}` },
      };
    },
  },
  {
    id: 'iceberg', no: '②', tab: 'debt', source: '图① 债务构成 + 图② 专项债',
    q: '2026 年全国赤字 5.89 万亿。这一年政府债务会增加多少？',
    options: ['约 6 万亿', '约 9 万亿', '约 12 万亿'], answer: 2,
    title: '赤字只是冰山露出水面的部分',
    lever: { id: 'sp26', label: '2026 年新增地方专项债', min: 0, max: 80000, step: 1000, try: 20000 },
    read(v) {
      const g = v.g_nom;
      const dB = v.gov1 - v.gov0;
      const dd = v.debt_gdp1 - v.debt_gdp0;
      const dil = v.debt_gdp0 * g / (1 + g); // 旧债被名义增长稀释的部分
      const parts = [
        { label: '赤字', value: v.d26, cls: 'def', node: 'd26', above: true },
        { label: '专项债', value: v.sp26, cls: 'gold', node: 'sp26' },
        { label: '置换隐性债务', value: v.swap26, cls: 'hid', node: 'swap26', note: '本来就欠' },
        { label: '特别国债', value: v.stb26, cls: 'xfer', node: 'stb26' },
      ].filter((p) => p.value > 0);
      const under = dB - v.d26;
      return {
        parts,
        nums: [
          { label: '赤字', value: wy(v.d26), node: 'd26' },
          { label: '政府债务一年增加', value: wy(dB), node: 'gov1' },
          { label: '负债率一年上升', value: `${pp(dd, 1)} 个百分点`, node: 'debt_gdp1' },
        ],
        say: `赤字 ${wy(v.d26)}，政府债务却多了 ${wy(dB)}，是赤字的 ${(dB / v.d26).toFixed(1)} 倍：水面下还有 ${wy(under)}不计入赤字${v.swap26 > 0 ? `（其中置换的 ${wy(v.swap26)}原本就欠着，只是从隐性变成显性）` : ''}。赤字率 ${pct(v.drate26, 0)}，负债率一年涨 ${pp(dd, 1)} 个百分点。`,
        moral: '专项债、置换债、特别国债都不算赤字，却都是政府债务。只看赤字率，看到的是冰山露出水面的那一角。',
        fx: {
          sym: '负债率变化 = 赤字率 + 不算赤字的借债 − 旧债被增长稀释',
          subst: `${pp(dd)} = ${pp(v.drate26)} + ${pp(v.p_sfa_2026)} − ${pp(dil)}（个百分点）`,
        },
        dd, dil,
      };
    },
  },
  {
    id: 'endpoint', no: '③', tab: 'proj', source: '十年推演（四张图接起来之后）',
    q: '假设以后每年的赤字率都是 4%，专项债这类不算赤字的借债占 GDP 的比例也不变，政府负债率会——',
    options: ['一直涨，没有尽头', '涨到某个水平就停下', '慢慢降下来'], answer: 1,
    title: '债务停在哪里，由分母决定',
    lever: { id: 'pg', label: '2027 年以后的名义 GDP 增速', min: 0.02, max: 0.08, step: 0.001, try: 0.03 },
    read(v, b) {
      const g = v.pg;
      const same = Math.abs(g - b.pg) < 5e-4;
      return {
        path: debtPath(v),
        basePath: debtPath(b),
        nums: [
          { label: '负债率的终点', value: pct(v.p_dstar, 0), node: 'p_dstar', deltaPct: same ? null : v.p_dstar - b.p_dstar },
          { label: '2035 年负债率', value: pct(v.p_d_2035), node: 'p_d_2035' },
        ],
        say: same
          ? `每年借的占 GDP 的比例不变，负债率不会无限涨，而是越涨越慢，最后停在 ${pct(v.p_dstar, 0)}。拖动增速，看终点怎么跑。`
          : `增速 ${pct(g)}：终点 ${pct(v.p_dstar, 0)}，是增速 ${pct(b.pg)} 时（${pct(b.p_dstar, 0)}）的 ${(v.p_dstar / b.p_dstar).toFixed(2)} 倍。增速是分母：分母越小，终点越高，而且越往下越陡。`,
        moral: '只要增速为正，按比例借债的负债率会停下来；停在哪里，看分母里的增速。增速少三分之一，终点高一半还多。',
        fx: {
          sym: '终点 d* = (赤字率 + 不算赤字的借债) × (1 + g) ÷ g',
          subst: `${pct(v.p_dstar)} = (${pct(v.p_dr_2035, 2)} + ${pct(v.p_sfa_2035, 2)}) × ${(1 + g).toFixed(3)} ÷ ${pct(g)}`,
        },
      };
    },
  },
];

/** 在一个独立的模型副本上读某一课：lever 为 null 时读原图 */
export function readLesson(lesson, value = null) {
  const s = new Sim();
  const b = s.values;
  const base = { ...b };
  if (value != null) s.set(lesson.lever.id, value);
  return { ...lesson.read(s.values, base), value: s.values[lesson.lever.id] };
}

/** 三句话压成一句；三个例子都由模型现算 */
export function summary() {
  const b = new Sim().values;
  const cold = new Sim();
  cold.set('g_nom', 0.03);
  const slow = new Sim();
  slow.set('pg', 0.03);
  return {
    line: '看财政，别只盯赤字率：先看水面下，再看分母。',
    points: [
      `分母：GDP 一缩，按比例能借的就少。2026 年增速从 ${pct(b.g_nom, 0)} 掉到 3%，能借的少 ${yi(b.d26 - cold.values.d26)}，能花的少 ${yi(b.e26 - cold.values.e26)}。`,
      `水面下：2026 年赤字 ${wy(b.d26)}，政府债务却增加 ${wy(b.gov1 - b.gov0)}。`,
      `分母：长期增速从 ${pct(b.pg)} 降到 3%，负债率的终点从 ${pct(b.p_dstar, 0)} 升到 ${pct(slow.values.p_dstar, 0)}。`,
    ],
  };
}
