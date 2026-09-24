import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/model/sim.js';
import { summarize } from '../src/model/summary.js';

test('一句话总结：列出改动、相关规则和变化最大的关键数字', () => {
  const sim = new Sim();
  assert.equal(summarize(sim), null);
  sim.set('t_vat', 60000);
  const s = summarize(sim);
  assert.equal(s.inputs[0].id, 't_vat');
  assert.ok(s.rules.some((r) => r.includes('2025 平衡规则')));
  assert.ok(s.rules.some((r) => r.includes('中央平衡规则')));
  assert.ok(s.heads.length >= 3);
  assert.ok(s.heads.every((h) => h.id !== 't_vat'));
});
