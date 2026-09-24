// 按"你改的参数"归因：同时改了几个参数时，某个结果的总变化各有多少来自哪个参数。
// 用 Shapley 分解：把参数逐个加入的所有顺序都走一遍，取每个参数加入时带来的变化的平均值。
// 性质：各参数贡献之和精确等于总变化；交互作用按对称原则分给相关参数。
// 参数不超过 maxExact 个时精确计算（2ⁿ 次求值）；更多时只给单独效果和交互余项。
import { changed } from '../engine/graph.js';

/** 当前规则下，相对原图基线改过的、且在 target 上游的输入参数 */
export function changedUpstreamInputs(graph, inputs, target) {
  const up = new Set(graph.upstream(target));
  return graph.inputs()
    .filter((n) => up.has(n.id) && changed(inputs[n.id] ?? n.base, n.base))
    .map((n) => n.id);
}

export function shapley(graph, inputs, target, { maxExact = 10 } = {}) {
  const ids = changedUpstreamInputs(graph, inputs, target);
  const n = ids.length;
  if (n === 0) return null;
  const f = graph.evaluator(target);
  const base = {};
  for (const node of graph.inputs()) base[node.id] = node.base;
  const cache = new Map();
  const v = (mask) => {
    if (cache.has(mask)) return cache.get(mask);
    const inp = { ...base };
    for (let i = 0; i < n; i++) if (mask & (1 << i)) inp[ids[i]] = inputs[ids[i]];
    const r = f(inp);
    cache.set(mask, r);
    return r;
  };
  const full = (1 << n) - 1;
  const v0 = v(0);
  const total = v(full) - v0;
  const alone = ids.map((_, i) => v(1 << i) - v0);
  const sumAlone = alone.reduce((a, b) => a + b, 0);
  let phi = null;
  if (n <= maxExact) {
    // 权重 |S|!(n−|S|−1)!/n!
    const fact = [1];
    for (let k = 1; k <= n; k++) fact[k] = fact[k - 1] * k;
    phi = ids.map(() => 0);
    for (let mask = 0; mask <= full; mask++) {
      let size = 0;
      for (let m = mask; m; m &= m - 1) size++;
      const vm = v(mask);
      for (let i = 0; i < n; i++) {
        if (mask & (1 << i)) continue;
        const w = (fact[size] * fact[n - size - 1]) / fact[n];
        phi[i] += w * (v(mask | (1 << i)) - vm);
      }
    }
  }
  const rows = ids.map((id, i) => ({ id, alone: alone[i], phi: phi ? phi[i] : null }))
    .sort((a, b) => Math.abs(b.phi ?? b.alone) - Math.abs(a.phi ?? a.alone));
  return { ids, total, v0, vAll: v(full), rows, sumAlone, interaction: total - sumAlone, exact: !!phi, evals: cache.size };
}
