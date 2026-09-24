import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EVENTS, playEvent, LEVER } from '../src/model/events.js';

test('事件卡：每张都产生冲击，且给出的对冲方案都能把目标拉回原图水平', () => {
  for (const ev of EVENTS) {
    const r = playEvent(ev);
    assert.ok(Math.abs(r.now - r.goal) > 1e-9 * Math.max(1, Math.abs(r.goal)), `${ev.id}：没有冲击到 ${ev.defend}`);
    assert.ok(r.fixes.length >= 1, `${ev.id}：没有找到对冲方案`);
    for (const f of r.fixes) {
      assert.match(f.id, LEVER, `${ev.id}：${f.id} 不是政策旋钮`);
      const v = r.sim.graph.compute({ ...r.sim.inputs, [f.id]: f.to })[r.target];
      assert.ok(Math.abs(v - r.goal) < 1e-6 * Math.max(1, Math.abs(r.goal)), `${ev.id} 用 ${f.id} 对冲后 ${v} ≠ ${r.goal}`);
    }
  }
});
