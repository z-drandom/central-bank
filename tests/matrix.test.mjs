import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/model/sim.js';
import { influenceMatrix, MATRIX_COLS } from '../src/model/matrix.js';

test('影响矩阵：空格恰好对应"不在下游"，非空格与直接重算一致', () => {
  const sim = new Sim();
  const rows = influenceMatrix(sim.graph, sim.inputs);
  for (const r of rows) {
    if (r.skipped) continue;
    const down = new Set(sim.graph.downstream(r.id));
    MATRIX_COLS.forEach(([c], j) => {
      assert.equal(r.cells[j] === null, !down.has(c), `${r.id} → ${c}`);
    });
  }
  // 赤字率锚定下，增值税不影响赤字率，但影响本级其它
  const vat = rows.find((r) => r.id === 't_vat');
  const j = MATRIX_COLS.findIndex(([c]) => c === 'drate26');
  const k = MATRIX_COLS.findIndex(([c]) => c === 'oth26');
  assert.equal(vat.cells[j], null);
  assert.ok(vat.cells[k] > 0);
  // 四本账与 2025/2026 模块没有数值联系
  const land = rows.find((r) => r.id === 'f2_land');
  assert.ok(land.cells.slice(0, 11).every((x) => x === null));
});
