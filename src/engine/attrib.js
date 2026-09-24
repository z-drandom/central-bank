// 变化归因：一个公式节点的变化，分别来自哪些上游的变化。
// 贡献_i = 只让上游 i 取当前值、其余上游保持基线时，本节点的变化。
// 对加减式，各项贡献之和精确等于总变化；有乘除时，差额记为"交互项"。
import { evaluate } from './expr.js';
import { changed } from './graph.js';

export function attribute(graph, id, now, base) {
  const n = graph.specs.get(id);
  if (!n || n.expr == null) return null;
  const f0 = evaluate(n.ast, (x) => base[x]);
  const total = now[id] - f0;
  const parts = n.deps
    .filter((d) => changed(now[d], base[d]))
    .map((d) => ({
      id: d,
      delta: now[d] - base[d],
      contrib: evaluate(n.ast, (x) => (x === d ? now[x] : base[x])) - f0,
    }))
    .sort((a, b) => Math.abs(b.contrib) - Math.abs(a.contrib));
  const sum = parts.reduce((a, p) => a + p.contrib, 0);
  return { total, parts, interaction: total - sum };
}

/** 沿"贡献最大的上游"一路回溯到输入参数，得到主要传导路径（从输入到本节点） */
export function mainPath(graph, id, now, base, maxLen = 40) {
  const path = [id];
  let cur = id;
  const seen = new Set([id]);
  while (path.length < maxLen) {
    const a = attribute(graph, cur, now, base);
    if (!a || !a.parts.length) break;
    // 贡献相近时优先选非输入节点，路径更有信息量
    const next = a.parts[0].id;
    if (seen.has(next)) break;
    seen.add(next);
    path.push(next);
    cur = next;
  }
  return path.reverse();
}
