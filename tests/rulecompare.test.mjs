import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/model/sim.js';
import { compareRules } from '../src/model/rulecompare.js';

test('规则对比：同一减收冲击在不同规则下由不同项目承担', () => {
  const sim = new Sim();
  sim.set('g_nom', 0.03);
  const r = Object.fromEntries(compareRules(sim).map((x) => [x.key, x]));
  // 赤字率锚定：赤字随 GDP 变小而减少，"其它"承担
  assert.ok(r['rate-other'].delta.oth26 < 0 && Math.abs(r['rate-other'].delta.tr26) < 1e-6);
  // 转移支付吸收：其它不变、转移支付减少、地方支出减少
  assert.ok(Math.abs(r['rate-tr'].delta.oth26) < 1e-6 && r['rate-tr'].delta.tr26 < 0 && r['rate-tr'].delta.el26 < 0);
  // 支出锚定：中央本级、转移支付都不变，赤字增加
  assert.ok(Math.abs(r.spend.delta.own26) < 1e-6 && r.spend.delta.d26 > 0);
  // 稳定基金兜底：赤字率不变、支出不变，稳定基金调入增加
  assert.ok(r.stab.delta.tstab26 > 0 && Math.abs(r.stab.delta.own26) < 1e-6);
  // 地方支出锚定：地方支出不变，地方调入资金增加
  assert.ok(Math.abs(r['spend-l'].delta.el26) < 1e-6 && r['spend-l'].delta.tl26 > 0);
});
