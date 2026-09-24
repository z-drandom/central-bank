import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/model/sim.js';
import { encodeScenario, decodeScenario } from '../src/model/scenario-code.js';

test('情景：快照/恢复、编码/解码往返后数值完全一致', () => {
  const a = new Sim();
  a.setModes({ c26: 'spend', fb4: 'gap' });
  a.setMany({ t_vat: 60000, dr26: 0.05, f4_exp: 9.5, pswap: 10000 });
  a.set('oth26', 8000);
  const code = encodeScenario(a.toScenario());
  assert.match(code, /^FS1\./);
  const b = new Sim();
  b.fromScenario(decodeScenario(code));
  for (const id of Object.keys(a.values)) assert.equal(b.values[id], a.values[id], id);
  const c = new Sim();
  c.restore(a.snapshot());
  assert.deepEqual(c.values, a.values);
  assert.throws(() => decodeScenario('FS1.bm90IGpzb24'));
});

test('只切换规则、不改参数时，情景代码里没有参数（没有浮点残差）', async () => {
  const { MODE_OPTIONS } = await import('../src/model/specs.js');
  for (const [k, def] of Object.entries(MODE_OPTIONS)) {
    for (const v of Object.keys(def.options)) {
      const sim = new Sim();
      sim.setMode(k, v);
      assert.deepEqual(sim.toScenario().i, {}, `${k}=${v}`);
    }
  }
});
