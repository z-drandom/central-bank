import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/model/sim.js';
import { GLOSSARY } from '../src/model/glossary.js';

test('名词解释引用的数字都存在于模型中', () => {
  const sim = new Sim();
  for (const g of GLOSSARY) for (const id of g.ids) assert.ok(sim.has(id), `${g.term} → ${id}`);
});
