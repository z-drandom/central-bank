import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/model/sim.js';
import { brief } from '../src/model/brief.js';
import { decodeScenario } from '../src/model/scenario-code.js';

test('分析摘要：含改动、规则、代入式和可复现的情景代码', () => {
  const sim = new Sim();
  assert.match(brief(sim), /没有改动/);
  sim.set('dr26', 0.05);
  const t = brief(sim);
  assert.match(t, /目标赤字率/);
  assert.match(t, /中央平衡规则：赤字率锚定/);
  assert.match(t, /= .*亿元/);
  const code = t.match(/FS1\.[A-Za-z0-9_-]+/)[0];
  const s2 = new Sim();
  s2.fromScenario(decodeScenario(code));
  assert.equal(s2.values.d26, sim.values.d26);
});
