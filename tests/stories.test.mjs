import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/model/sim.js';
import { STORIES, stateAt } from '../src/model/stories.js';

test('每条讲解的每一步：状态可重放、高亮的节点都存在、文字能生成', () => {
  for (const story of STORIES) {
    story.steps.forEach((st, k) => {
      const sim = stateAt(new Sim(), story, k);
      for (const id of st.focus ?? []) assert.ok(sim.has(id), `${story.id} 第 ${k + 1} 步：节点 ${id} 不存在`);
      const T = (id) => { assert.ok(sim.has(id), `${story.id}#${k + 1} T(${id})`); return String(sim.values[id]); };
      const D = (id) => { assert.ok(sim.has(id), `${story.id}#${k + 1} D(${id})`); return String(sim.values[id] - sim.base[id]); };
      const txt = st.text(T, D);
      assert.ok(txt.length > 20);
      const moved = (id) => Math.abs(sim.values[id] - sim.base[id]) > 1e-9 * Math.max(1, Math.abs(sim.base[id]));
      if (st.expectSame) {
        // 文字声称"不变"的步骤：高亮的数字必须确实没变
        assert.ok((st.focus ?? []).every((id) => !moved(id)), `${story.id} 第 ${k + 1} 步声称不变，但高亮节点有变化`);
      } else {
        // 讲的"变化"必须真的发生了：focus 里至少一个节点相对基线有变化
        assert.ok((st.focus ?? []).some(moved), `${story.id} 第 ${k + 1} 步的高亮节点都没有变化`);
      }
    });
  }
});

test('讲解"一笔增值税的旅程"的数字与分税制一致', () => {
  const story = STORIES.find((s) => s.id === 'vat');
  const sim = stateAt(new Sim(), story, 3);
  const dVat = sim.values.t_vat - sim.base.t_vat;
  assert.ok(Math.abs((sim.values.rc25 - sim.base.rc25) - dVat * 0.5) < 1e-6);
  assert.ok(Math.abs((sim.values.rc26 - sim.base.rc26) - dVat * 0.5 * (1 + sim.values.g_rc)) < 1e-6);
});
