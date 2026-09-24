// 依赖图：节点要么是输入参数（有 base 默认值），要么是一条公式（expr）。
// 按拓扑序求值；公式里引用的变量就是依赖边。
import { parse, evaluate, depsOf } from './expr.js';

const astCache = new Map();
function parseCached(src) {
  let ast = astCache.get(src);
  if (!ast) {
    ast = parse(src);
    astCache.set(src, ast);
  }
  return ast;
}

export class Graph {
  constructor(specs) {
    this.specs = new Map();
    for (const s of specs) {
      if (this.specs.has(s.id)) throw new Error(`重复的节点 id：${s.id}`);
      const node = { ...s };
      if (node.expr != null) {
        node.ast = parseCached(node.expr);
        node.deps = [...depsOf(node.ast)];
      } else {
        node.deps = [];
        if (typeof node.base !== 'number' || Number.isNaN(node.base)) {
          throw new Error(`输入节点 ${s.id} 缺少数值 base`);
        }
      }
      this.specs.set(s.id, node);
    }
    for (const n of this.specs.values()) {
      for (const d of n.deps) {
        if (!this.specs.has(d)) throw new Error(`节点 ${n.id} 引用了不存在的 ${d}（${n.expr}）`);
      }
    }
    this.dependents = new Map([...this.specs.keys()].map((k) => [k, []]));
    for (const n of this.specs.values()) for (const d of n.deps) this.dependents.get(d).push(n.id);
    this.order = this.#topo();
    this.rank = new Map(this.order.map((id, i) => [id, i]));
  }

  #topo() {
    const indeg = new Map();
    for (const n of this.specs.values()) indeg.set(n.id, n.deps.length);
    const queue = [...this.specs.values()].filter((n) => n.deps.length === 0).map((n) => n.id);
    const order = [];
    while (queue.length) {
      const id = queue.shift();
      order.push(id);
      for (const c of this.dependents.get(id)) {
        indeg.set(c, indeg.get(c) - 1);
        if (indeg.get(c) === 0) queue.push(c);
      }
    }
    if (order.length !== this.specs.size) {
      const stuck = [...indeg].filter(([, v]) => v > 0).map(([k]) => k);
      throw new Error(`依赖图存在循环：${stuck.join(', ')}`);
    }
    return order;
  }

  isInput(id) {
    const n = this.specs.get(id);
    return !!n && n.expr == null;
  }

  inputs() {
    return [...this.specs.values()].filter((n) => n.expr == null);
  }

  /** inputs: { id: value }，缺省时用 base */
  compute(inputs = {}) {
    const v = {};
    for (const id of this.order) {
      const n = this.specs.get(id);
      if (n.expr == null) v[id] = id in inputs ? inputs[id] : n.base;
      else v[id] = evaluate(n.ast, (x) => v[x]);
    }
    return v;
  }

  /** 只算 target 及其上游的求值函数（结果与 compute(inputs)[target] 完全相同，但快得多） */
  evaluator(target) {
    const nodes = [...this.upstream(target), target].map((id) => this.specs.get(id));
    return (inputs = {}) => {
      const v = {};
      for (const n of nodes) {
        if (n.expr == null) v[n.id] = n.id in inputs ? inputs[n.id] : n.base;
        else v[n.id] = evaluate(n.ast, (x) => v[x]);
      }
      return v[target];
    };
  }

  baseInputs() {
    const o = {};
    for (const n of this.inputs()) o[n.id] = n.base;
    return o;
  }

  /** 所有上游节点（不含自身），按拓扑序 */
  upstream(id) {
    const seen = new Set();
    const stack = [...this.specs.get(id).deps];
    while (stack.length) {
      const x = stack.pop();
      if (seen.has(x)) continue;
      seen.add(x);
      stack.push(...this.specs.get(x).deps);
    }
    return [...seen].sort((a, b) => this.rank.get(a) - this.rank.get(b));
  }

  /** 所有下游节点（不含自身），按拓扑序 */
  downstream(id) {
    const seen = new Set();
    const stack = [...this.dependents.get(id)];
    while (stack.length) {
      const x = stack.pop();
      if (seen.has(x)) continue;
      seen.add(x);
      stack.push(...this.dependents.get(x));
    }
    return [...seen].sort((a, b) => this.rank.get(a) - this.rank.get(b));
  }
}

/** 相对误差意义下"有变化"：避免浮点噪声 */
export function changed(a, b, eps = 1e-9) {
  if (a === b) return false;
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) / scale > eps;
}

/** 列出当前值相对基线有变化的节点（拓扑序） */
export function diff(graph, now, base) {
  const out = [];
  for (const id of graph.order) {
    if (changed(now[id], base[id])) out.push(id);
  }
  return out;
}
