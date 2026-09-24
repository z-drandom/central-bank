// 双目标反向求解：调两个参数，使两个指标同时等于目标值。
// 牛顿法：每一步用有限差分求 2×2 雅可比矩阵 J，解 J·Δ = −F；残差不降就把步长减半；参数限制在滑杆区间内。
// 几何意义：两个目标各自的"等值线"在两个参数构成的平面上的交点。
// goals 里的 null 表示"保持当前值"，函数表示"相对当前值"（参数为当前各节点值）。

export function resolveGoals(goals, targets, values) {
  return goals.map((g, i) => (g == null ? values[targets[i]] : typeof g === 'function' ? g(values) : g));
}

export function goalSeek2(graph, inputs, { targets, goals, params, maxIter = 60, tol = 1e-10 }) {
  const [t1, t2] = targets;
  const [p1, p2] = params;
  if (p1 === p2) return { ok: false, reason: '两个参数不能相同' };
  if (t1 === t2) return { ok: false, reason: '两个目标不能相同' };
  for (const p of params) {
    const s = graph.specs.get(p);
    if (!s || s.expr != null) return { ok: false, reason: `${s?.label ?? p} 在当前平衡规则下不是可调参数` };
  }
  const up1 = new Set(graph.upstream(t1));
  const up2 = new Set(graph.upstream(t2));
  if (!params.some((p) => up1.has(p))) return { ok: false, reason: '两个参数都不在第一个目标的上游，调它们不会影响它' };
  if (!params.some((p) => up2.has(p))) return { ok: false, reason: '两个参数都不在第二个目标的上游，调它们不会影响它' };
  const e1 = graph.evaluator(t1);
  const e2 = graph.evaluator(t2);
  const lo = params.map((p) => graph.specs.get(p).range?.[0] ?? -Infinity);
  const hi = params.map((p) => graph.specs.get(p).range?.[1] ?? Infinity);
  const clamp = (x) => x.map((v, i) => Math.min(hi[i], Math.max(lo[i], v)));
  const at = (x) => ({ ...inputs, [p1]: x[0], [p2]: x[1] });
  const x0 = params.map((p) => inputs[p] ?? graph.specs.get(p).base);
  // 残差按目标量级归一化，避免"亿元"和"百分比"混在一起比较
  const sc = [0, 1].map((i) => Math.max(Math.abs(goals[i]), Math.abs([e1, e2][i](at(x0))), 1e-3));
  const F = (x) => { const v = at(x); return [(e1(v) - goals[0]) / sc[0], (e2(v) - goals[1]) / sc[1]]; };
  const norm = (r) => Math.hypot(r[0], r[1]);
  let x = x0.slice();
  let r = F(x);
  let J = null;
  let iter = 0;
  for (; iter < maxIter && norm(r) > tol; iter++) {
    J = [[0, 0], [0, 0]];
    for (let j = 0; j < 2; j++) {
      const w = Number.isFinite(hi[j] - lo[j]) ? hi[j] - lo[j] : Math.max(1, Math.abs(x[j]));
      let hstep = Math.max(Math.abs(x[j]) * 1e-7, w * 1e-8);
      if (x[j] + hstep > hi[j]) hstep = -hstep;
      const xs = x.slice();
      xs[j] += hstep;
      const rs = F(xs);
      J[0][j] = (rs[0] - r[0]) / hstep;
      J[1][j] = (rs[1] - r[1]) / hstep;
    }
    const det = J[0][0] * J[1][1] - J[0][1] * J[1][0];
    const scale = Math.max(Math.abs(J[0][0] * J[1][1]) + Math.abs(J[0][1] * J[1][0]), 1e-300);
    // 有限差分有约 1e-7 的相对噪声，行列式相对值小于 1e-5 视为奇异（两个参数的作用成比例）
    if (Math.abs(det) < 1e-5 * scale || !Number.isFinite(det)) {
      return { ok: false, singular: true, reason: '这两个参数对两个目标的作用"方向相同"（雅可比矩阵奇异）：动哪一个，两个目标都按同样的比例变，没法分别满足。换一个参数试试。', x, iter, J };
    }
    const d = [-(J[1][1] * r[0] - J[0][1] * r[1]) / det, -(-J[1][0] * r[0] + J[0][0] * r[1]) / det];
    let t = 1;
    let moved = false;
    while (t > 1e-6) {
      const xn = clamp([x[0] + t * d[0], x[1] + t * d[1]]);
      const rn = F(xn);
      if (norm(rn) < norm(r)) { x = xn; r = rn; moved = true; break; }
      t /= 2;
    }
    if (!moved) break;
  }
  const ok = norm(r) <= 1e-7;
  const v = at(x);
  return {
    ok,
    reason: ok ? null : '在两个参数允许的区间内找不到同时满足两个目标的组合（下面是最接近的组合）',
    x,
    iter,
    J,
    values: [e1(v), e2(v)],
    residual: [e1(v) - goals[0], e2(v) - goals[1]],
  };
}

export const SOLVE2_EXAMPLES = [
  {
    label: '赤字率降到 3.5%，本级"其它"不减',
    targets: ['drate26', 'oth26'], goals: [0.035, null], params: ['dr26', 'g_tr'], modes: { c26: 'rate', absorb: 'other' },
    note: '赤字率锚定 + 本级"其它"吸收：少借的钱只能从转移支付里省',
  },
  {
    label: '2035 负债率 90%，付息占收入 8%',
    targets: ['p_d_2035', 'p_ib_2035'], goals: [0.9, 0.08], params: ['pdr', 'pshift'], modes: { proj: 'rate' },
    note: '推演期赤字率管负债率，利率管付息负担',
  },
  {
    label: '地方多花 2,000 亿，中央本级"其它"不减',
    targets: ['el26', 'oth26'], goals: [(v) => v.el26 + 2000, null], params: ['g_tr', 'dr26'], modes: { c26: 'rate', absorb: 'other', l26: 'deficit' },
    note: '多给地方的转移支付，要么挤占中央本级，要么多借——这里要求不挤占，看赤字率要提高多少',
  },
];
