// 敏感度分析：在当前状态下，把每个参数各向上、向下拨动一个标准步长，看目标变化多少。
// 步长：比率类参数 ±1 个百分点；金额类参数 ±10%（基线为 0 的取允许区间上限的 10%）。

export function stepOf(spec, mode = 'mixed') {
  if (mode === 'rel') return spec.base !== 0 ? Math.abs(spec.base) * 0.1 : (spec.range?.[1] ?? 1) * 0.1;
  if (spec.unit === 'pct') return 0.01;
  if (spec.unit === 'num') return 0.1;
  if (spec.base !== 0) return Math.abs(spec.base) * 0.1;
  return (spec.range?.[1] ?? 1) * 0.1;
}

export function stepText(spec, step) {
  if (spec.unit === 'pct') return `±${(step * 100).toFixed(step * 100 < 1 ? 2 : 0)} 个百分点`;
  if (spec.unit === 'num') return `±${step.toFixed(2)}`;
  if (spec.unit === 'wy') return `±${step.toFixed(2)} 万亿`;
  if (spec.disp === 'wy') return `±${(step / 1e4).toFixed(2)} 万亿`;
  return `±${Math.round(step).toLocaleString('en-US')} 亿`;
}

/**
 * 返回按 |影响| 排序的列表 [{id, step, up, down}]（up/down 为目标变化量）。
 * 只计算目标的上游参数（其余参数影响恒为 0）。
 */
export function tornado(graph, inputs, target, { mode = 'mixed', limit = 20 } = {}) {
  const now = graph.compute(inputs);
  const up = new Set(graph.upstream(target));
  const rows = [];
  for (const n of graph.inputs()) {
    if (n.fixed || !up.has(n.id)) continue;
    const step = stepOf(n, mode);
    const cur = inputs[n.id] ?? n.base;
    const vu = graph.compute({ ...inputs, [n.id]: cur + step })[target];
    const vd = graph.compute({ ...inputs, [n.id]: cur - step })[target];
    rows.push({ id: n.id, step, up: vu - now[target], down: vd - now[target] });
  }
  rows.sort((a, b) => Math.max(Math.abs(b.up), Math.abs(b.down)) - Math.max(Math.abs(a.up), Math.abs(a.down)));
  return { now: now[target], rows: rows.filter((r) => Math.abs(r.up) + Math.abs(r.down) > 1e-12).slice(0, limit), total: rows.length };
}

export const TARGETS = [
  ['drate26', '2026 赤字率'],
  ['debt_gdp1', '2026 年末政府负债率'],
  ['broad_gdp1', '2026 年末含隐债负债率'],
  ['intburden26', '付息 ÷ 一般预算收入'],
  ['self26', '地方财政自给率'],
  ['oth26', '中央本级"其它"支出'],
  ['el26', '地方一般公共预算支出'],
  ['e26', '全国一般公共预算支出'],
  ['p_d_2035', '2035 年政府负债率'],
  ['p_w_2035', '2035 年含隐债负债率'],
  ['p_ib_2035', '2035 年付息 ÷ 收入'],
  ['f1_other', '四本账：一般预算其他支出'],
  ['fc_gap', '四本账：广义赤字'],
];
