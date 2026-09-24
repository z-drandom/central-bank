// 影响矩阵：关键旋钮 × 关键结果。每格 = 旋钮拨动一步后结果的变化量；不在上游则为空。
import { stepOf } from './sensitivity.js';

export const MATRIX_ROWS = ['t_vat', 'nontax', 'rebate', 'g_nom', 'dr26', 'g_def', 'g_tr', 'tl26', 'rcg', 'swap26', 'sp26', 'f2_land', 'f4_exp', 'pg', 'pshift'];
export const MATRIX_COLS = [
  ['r26', '全国收入'], ['e26', '全国支出'], ['d26', '全国赤字'], ['drate26', '赤字率'], ['oth26', '本级其它'], ['el26', '地方支出'],
  ['gov1', '年末政府债务'], ['debt_gdp1', '年末负债率'], ['intburden26', '付息/收入'], ['p_d_2035', '2035 负债率'], ['p_ib_2035', '2035 付息/收入'], ['f1_other', '四本账其他支出'], ['fc_gap', '广义赤字'],
];

export function influenceMatrix(graph, inputs) {
  const now = graph.compute(inputs);
  const rows = [];
  for (const id of MATRIX_ROWS) {
    if (!graph.isInput(id)) { rows.push({ id, skipped: true, cells: [] }); continue; }
    const spec = graph.specs.get(id);
    const step = stepOf(spec);
    const v = graph.compute({ ...inputs, [id]: (inputs[id] ?? spec.base) + step });
    const down = new Set(graph.downstream(id));
    rows.push({
      id, step,
      cells: MATRIX_COLS.map(([c]) => (graph.specs.has(c) && down.has(c) ? v[c] - now[c] : null)),
    });
  }
  return rows;
}
