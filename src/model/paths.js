// 路径分解：A 通过哪些公式路径影响 B，各贡献多少。
// 链式法则：dB/dA = Σ_路径 Π_边 ∂(下游)/∂(上游)。每条边的偏导数只对该节点自己的公式求（其余上游不动），
// 用中心差分计算；动态规划沿拓扑序累加，得到总导数、路径条数和贡献最大的前 k 条路径。
import { evaluate } from '../engine/expr.js';

/** 节点 id 对其直接上游 dep 的偏导数（只动这一个上游，在当前值处） */
export function partial(graph, values, id, dep) {
  const n = graph.specs.get(id);
  const v = values[dep];
  const h = Math.max(Math.abs(v) * 1e-6, 1e-9);
  const at = (x) => evaluate(n.ast, (k) => (k === dep ? x : values[k]));
  return (at(v + h) - at(v - h)) / (2 * h);
}

export function pathEffects(graph, values, from, to, { k = 5 } = {}) {
  if (from === to) return null;
  const down = new Set(graph.downstream(from));
  if (!down.has(to)) return null;
  const up = new Set(graph.upstream(to));
  const on = new Set([from, to, ...[...down].filter((x) => up.has(x))]);
  const order = graph.order.filter((id) => on.has(id));
  const total = new Map([[from, 1]]);
  const count = new Map([[from, 1]]);
  const best = new Map([[from, [{ prod: 1, path: [from], edges: [] }]]]);
  let edges = 0;
  for (const id of order) {
    if (id === from) continue;
    const deps = graph.specs.get(id).deps.filter((d) => on.has(d) && total.has(d));
    let t = 0;
    let c = 0;
    const cand = [];
    for (const d of deps) {
      const p = partial(graph, values, id, d);
      edges++;
      t += p * total.get(d);
      c += count.get(d);
      for (const b of best.get(d)) cand.push({ prod: b.prod * p, path: [...b.path, id], edges: [...b.edges, p] });
    }
    cand.sort((a, b) => Math.abs(b.prod) - Math.abs(a.prod));
    total.set(id, t);
    count.set(id, c);
    best.set(id, cand.slice(0, k));
  }
  const paths = best.get(to);
  const shown = paths.reduce((a, p) => a + p.prod, 0);
  return { from, to, total: total.get(to), count: count.get(to), paths, rest: total.get(to) - shown, nodes: on.size, edges };
}
