// 反向求解：调整一个参数，使目标指标等于给定值。
// 在参数的允许区间内用二分法求根；目标对参数单调时一定能找到（若区间内可达）。
export function goalSeek(graph, inputs, { target, goal, param, lo, hi, tol = 1e-10, maxIter = 200 }) {
  const spec = graph.specs.get(param);
  if (!spec || spec.expr != null) return { ok: false, reason: '该参数在当前平衡规则下不是可调参数' };
  const up = new Set(graph.upstream(target));
  if (!up.has(param)) return { ok: false, reason: '这个参数不在目标的上游，调它不会影响目标' };
  const [rlo, rhi] = spec.range ?? [spec.base * 0.5, spec.base * 1.5];
  let a = lo ?? rlo;
  let b = hi ?? rhi;
  const f = (x) => graph.compute({ ...inputs, [param]: x })[target] - goal;
  let fa = f(a);
  let fb = f(b);
  if (!Number.isFinite(fa) || !Number.isFinite(fb)) return { ok: false, reason: '区间端点处无法计算' };
  if (fa === 0) return { ok: true, x: a, iter: 0 };
  if (fb === 0) return { ok: true, x: b, iter: 0 };
  if (Math.sign(fa) === Math.sign(fb)) {
    return { ok: false, reason: '在该参数允许的区间内达不到这个目标', range: [fa + goal, fb + goal] };
  }
  let iter = 0;
  let m = a;
  while (iter++ < maxIter) {
    m = (a + b) / 2;
    const fm = f(m);
    if (Math.abs(fm) <= tol * Math.max(1, Math.abs(goal)) || (b - a) / 2 < 1e-12 * Math.max(1, Math.abs(m))) break;
    if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm; } else { b = m; fb = fm; }
  }
  return { ok: true, x: m, iter };
}
