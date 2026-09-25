// 双参数相图：同时改变两个参数，在网格上逐点重算目标指标。
// 每一格都是整张依赖图的一次求值（只算目标的上游），不做插值或近似。
import { stepOf } from './sensitivity.js';

export const PHASE_PRESETS = [
  {
    id: 'rg', title: '增速 × 利率 → 2035 负债率',
    x: 'pg', xr: [0.02, 0.07], y: 'pshift', yr: [-0.01, 0.02], target: 'p_d_2035', modes: { proj: 'spend' },
    why: '推演规则取"支出增速不变"：赤字 = 支出 − 收入，利息越高赤字越大。债务动态 Δd = d·(r − g)/(1 + g) + 基本赤字率 + 其他融资率：利率高、增速低都推高负债率，所以要维持同一负债率，利率每高一点，增速也得高一点——等值线向右上方倾斜。',
  },
  {
    id: 'reprice', title: '重定价速度 × 利率 → 2035 负债率',
    x: 'pphi', xr: [0.05, 1], y: 'pshift', yr: [-0.01, 0.02], target: 'p_d_2035', modes: { proj: 'spend' },
    why: '存量债务的平均利率按 r_t = r_{t−1} + φ × (市场利率 − r_{t−1}) 逐年靠拢市场利率，φ 是重定价速度。φ 小（长期债为主），利率上升要很多年才传到付息；φ = 100% 时，全部债务当年就按新利率付息。利率变动的影响等于"变动幅度 × 传导速度"，两者相乘，所以交互项很大：只看默认 φ = 15% 会低估利率冲击。即使 φ = 100%，利率冲击仍小于增速冲击：专项债利息由政府性基金预算支付，不进入一般预算赤字；而名义增速同时压低收入和 GDP 分母。',
  },
  {
    id: 'dg', title: '增速 × 赤字率 → 2035 负债率',
    x: 'pg', xr: [0.02, 0.07], y: 'pdr', yr: [0.02, 0.06], target: 'p_d_2035', modes: { proj: 'rate' },
    why: '推演规则取"赤字率不变"：每年新增债务 = 赤字率 × 当年 GDP，而负债率的分母是 2035 年 GDP。名义增速越高，早年的赤字相对 2035 年 GDP 越小，所以赤字率多 1 个百分点的影响在高增长时更小——两个旋钮的效果不能简单相加。',
  },
  {
    id: 'oth', title: '名义增速 × 目标赤字率 → 中央本级"其它"',
    x: 'g_nom', xr: [0, 0.08], y: 'dr26', yr: [0.03, 0.05], target: 'oth26', level: 0, modes: { c26: 'rate', absorb: 'other' },
    why: '中央赤字 = 赤字率 × GDP₂₀₂₆ − 地方赤字，GDP₂₀₂₆ = GDP₂₀₂₅ × (1 + 名义增速)，中央收入也随名义增速变化。"其它"是余项：赤字率每高 1 个百分点多出 1% × GDP₂₀₂₆，增速越高这笔钱越多——赤字率与增速相乘，产生交互项。金线是"其它 = 0"的边界，越过它就需要换平衡规则。',
  },
  {
    id: 'vat', title: '增值税 × 中央分享比例 → 地方自给率',
    x: 't_vat', xr: [50000, 90000], y: 's_vat', yr: [0.3, 0.7], target: 'self26',
    why: '地方分到的增值税 = 增值税 × (1 − 中央分享比例)，是一个乘积；自给率 = 地方收入 ÷ 地方支出，地方支出 = 地方收入 + 转移支付 + 地方赤字 + 调入资金。增值税规模越大，分享比例每变 1 个百分点对地方的影响越大。',
  },
  {
    id: 'int', title: '付息率 × 国债余额 → 付息 ÷ 收入',
    x: 'rcg', xr: [0.01, 0.035], y: 'bc_obs', yr: [350000, 500000], target: 'intburden26',
    why: '中央付息 = 国债平均付息率 × 期初国债余额，乘积关系，所以等值线是双曲线：利率越高，同样多一笔债务带来的付息越多。',
  },
  {
    id: 'soe', title: '国资收入 × 调出比例 → 四本账其他支出',
    x: 'f3_inc', xr: [0.2, 1], y: 'f3_k', yr: [0.2, 0.8], target: 'f1_other', modes: { fb1: 'deficit' },
    why: '国有资本经营调出 = 收入 × 调出比例，调入一般公共预算后，在"预算赤字锁定"规则下全部变成其他支出——又是一个乘积（四本账，2021 年数据）。',
  },
  {
    id: 'add', title: '对照组：增值税 × 非税收入 → 全国收入',
    x: 't_vat', xr: [50000, 90000], y: 'nontax', yr: [20000, 60000], target: 'r26',
    why: '全国收入是各项收入之和再乘同一个增长系数，两个旋钮的效果可以直接相加：等值线是等距平行直线，交互项为 0。拿它和其他几张图对比，就能看出"交互作用"长什么样。',
  },
];

// 参考线（金色）：与顶栏刻度一致；"其它"支出和四本账其他支出以 0 为界
export const REF_LEVEL = { drate26: 0.03, debt_gdp1: 0.6, broad_gdp1: 0.6, intburden26: 0.1, p_d_2035: 0.6, p_w_2035: 0.6, oth26: 0, f1_other: 0 };

export function linspace(a, b, n) {
  return Array.from({ length: n }, (_, i) => (n === 1 ? a : a + ((b - a) * i) / (n - 1)));
}

/** 自选参数时的默认区间：比率类 ±3 个百分点，金额类 ±40%，并裁剪到滑杆区间 */
export function defaultRange(spec, cur) {
  const [lo, hi] = spec.range ?? [-Infinity, Infinity];
  let a;
  let b;
  if (spec.unit === 'pct') { a = cur - 0.03; b = cur + 0.03; }
  else if (spec.unit === 'num') { a = cur - 0.5; b = cur + 0.5; }
  else if (cur !== 0) { a = cur * 0.6; b = cur * 1.4; if (a > b) [a, b] = [b, a]; }
  else { a = 0; b = (hi === Infinity ? 1 : hi) * 0.5; }
  return [Math.max(lo, a), Math.min(hi, b)];
}

/** 预设区间若不含当前值则扩展到包含它，再裁剪到滑杆区间 */
export function fitRange(spec, r, cur) {
  const [lo, hi] = spec.range ?? [-Infinity, Infinity];
  return [Math.max(lo, Math.min(r[0], cur)), Math.min(hi, Math.max(r[1], cur))];
}

/**
 * 计算网格。z[j][i] = 目标在 (xs[i], ys[j]) 处的值（其余参数保持 inputs 不变）。
 * 另给出：当前点的边际影响、等值线取舍比率、全图四角的交互项。
 */
export function phaseGrid(graph, inputs, { x, y, target, xr, yr, n = 31 }) {
  // 只重算受 x、y 影响的节点，其余上游沿用当前值（结果与整图重算相同）
  const f = graph.evaluatorDelta(target, [x, y], inputs);
  const at = (xv, yv) => f([xv, yv]);
  const xs = linspace(xr[0], xr[1], n);
  const ys = linspace(yr[0], yr[1], n);
  const z = ys.map((yv) => xs.map((xv) => at(xv, yv)));
  const x0 = inputs[x] ?? graph.specs.get(x).base;
  const y0 = inputs[y] ?? graph.specs.get(y).base;
  const now = at(x0, y0);
  let min = Infinity;
  let max = -Infinity;
  for (const row of z) for (const v of row) if (Number.isFinite(v)) { if (v < min) min = v; if (v > max) max = v; }

  // 当前点：各拨一个标准步长
  const sx = stepOf(graph.specs.get(x));
  const sy = stepOf(graph.specs.get(y));
  const fx = at(x0 + sx, y0);
  const fy = at(x0, y0 + sy);
  const fxy = at(x0 + sx, y0 + sy);
  const local = { sx, sy, dfx: fx - now, dfy: fy - now, both: fxy - now, inter: fxy - fx - fy + now };
  // 取舍比率：沿等值线 dy/dx = −(∂f/∂x)/(∂f/∂y)，用中心差分
  const hx = sx * 0.01;
  const hy = sy * 0.01;
  const gx = (at(x0 + hx, y0) - at(x0 - hx, y0)) / (2 * hx);
  const gy = (at(x0, y0 + hy) - at(x0, y0 - hy)) / (2 * hy);
  const trade = { gx, gy, slope: gy !== 0 ? -gx / gy : NaN };

  // 全图四角：从左下到右上
  const c = { f00: z[0][0], f10: z[0][n - 1], f01: z[n - 1][0], f11: z[n - 1][n - 1] };
  const add = c.f10 + c.f01 - c.f00;
  const inter = c.f11 - add;
  const parts = Math.abs(c.f10 - c.f00) + Math.abs(c.f01 - c.f00) + Math.abs(inter);
  const corners = { ...c, add, inter, share: parts > 0 ? Math.abs(inter) / parts : 0 };

  return { x, y, target, xs, ys, z, x0, y0, now, min, max, local, trade, corners };
}

/**
 * 等值线（marching squares）：返回线段 [[i1, j1, i2, j2], ...]，坐标是网格下标（可带小数）。
 * 鞍点用四角平均值判定走向。含非有限值的格子跳过。
 */
export function contour(z, level) {
  const ny = z.length;
  const nx = z[0].length;
  const segs = [];
  const t = (a, b) => (a === b ? 0.5 : (level - a) / (b - a));
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = z[j][i];
      const b = z[j][i + 1];
      const c = z[j + 1][i + 1];
      const d = z[j + 1][i];
      if (![a, b, c, d].every(Number.isFinite)) continue;
      const k = (a >= level ? 1 : 0) | (b >= level ? 2 : 0) | (c >= level ? 4 : 0) | (d >= level ? 8 : 0);
      if (k === 0 || k === 15) continue;
      // 四条边上的交点
      const B = () => [i + t(a, b), j];
      const R = () => [i + 1, j + t(b, c)];
      const T = () => [i + t(d, c), j + 1];
      const L = () => [i, j + t(a, d)];
      const add = (p, q) => segs.push([p[0], p[1], q[0], q[1]]);
      switch (k) {
        case 1: case 14: add(L(), B()); break;
        case 2: case 13: add(B(), R()); break;
        case 3: case 12: add(L(), R()); break;
        case 4: case 11: add(R(), T()); break;
        case 6: case 9: add(B(), T()); break;
        case 7: case 8: add(L(), T()); break;
        case 5: case 10: {
          const center = (a + b + c + d) / 4 >= level;
          // k=5：a、c 在上方
          if ((k === 5) === center) { add(L(), T()); add(B(), R()); }
          else { add(L(), B()); add(R(), T()); }
          break;
        }
        default: break;
      }
    }
  }
  return segs;
}

/** 在 (min, max) 内取约 count 个"整齐"的等值线水平（1、2、2.5、5 × 10ᵏ）；坐标轴刻度用 inclusive 包含端点 */
export function niceLevels(min, max, count = 6, { inclusive = false } = {}) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [];
  const raw = (max - min) / count;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? 10 * p;
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) {
    const r = Math.round(v / step) * step;
    const eps = step * 1e-9;
    if (inclusive ? r >= min - eps && r <= max + eps : r > min && r < max) out.push(Number(r.toPrecision(12)));
  }
  return out;
}
