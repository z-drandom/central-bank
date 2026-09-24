// 公式实验室：用户自己写表达式，复用同一套解析、求值和渲染。
import { parse, evaluate, depsOf } from '../engine/expr.js';
import { formulaLines } from './format.js';

/**
 * 把用户表达式作为临时节点挂到依赖图上求值。
 * 返回 { ok, value, base, lines, deps } 或 { ok:false, error }
 */
export function evalCustom(sim, src, { label = '自定义指标', unit = 'yi', disp } = {}) {
  let ast;
  try {
    ast = parse(src);
  } catch (e) {
    return { ok: false, error: `写法有误：${e.message}` };
  }
  const deps = [...depsOf(ast)];
  const missing = deps.filter((d) => !sim.has(d));
  if (missing.length) return { ok: false, error: `找不到变量：${missing.join('、')}（变量名可在公式手册里搜到，如 rc26、drate26）` };
  if (!deps.length) return { ok: false, error: '至少要引用一个模型里的变量' };
  const g = sim.graph;
  const node = { id: '__lab', sym: 'X', label, expr: src, ast, deps, unit, disp, mod: 'macro', kind: 'identity' };
  // 临时挂载，渲染完即移除，不改动依赖图结构
  g.specs.set('__lab', node);
  try {
    const value = evaluate(ast, (x) => sim.values[x]);
    const base = evaluate(ast, (x) => sim.base[x]);
    const values = { ...sim.values, __lab: value };
    const lines = formulaLines(g, '__lab', values, { html: true });
    return { ok: true, value, base, lines, deps };
  } finally {
    g.specs.delete('__lab');
  }
}

export const LAB_EXAMPLES = [
  ['中央收入占全国收入比重', 'rc26 / r26', 'pct'],
  ['中央本级支出占中央支出比重', 'own26 / ec26', 'pct'],
  ['赤字占全国支出比重', 'd26 / e26', 'pct'],
  ['国防 + 科技支出', 'def26 + sci26', 'yi'],
  ['2021 年实际赤字比预算赤字多多少', 'f1_realdef - f1_def', 'wy'],
  ['2035 年比 2026 年负债率上升', 'p_d_2035 - p_d_2026', 'pct'],
];
