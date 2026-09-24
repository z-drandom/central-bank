import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/model/sim.js';
import { CHALLENGES, evalGoals } from '../src/model/challenges.js';
import { QUIZ, gradeQuestion } from '../src/model/quiz.js';

function setupChallenge(ch) {
  const sim = new Sim();
  sim.setModes(ch.setup.modes ?? {});
  sim.apply(ch.setup.changes ?? []);
  return sim;
}

for (const ch of CHALLENGES) {
  test(`挑战「${ch.title}」：冲击后未达成，参考解可以达成`, () => {
    const sim = setupChallenge(ch);
    const before = evalGoals(ch, sim.values, sim.base);
    assert.ok(before.some((g) => !g.met), '冲击后不应已经全部达成');
    sim.apply(ch.solution);
    const after = evalGoals(ch, sim.values, sim.base);
    const miss = after.filter((g) => !g.met).map((g) => `${g.text}（${g.id}=${sim.values[g.id]}）`);
    assert.equal(miss.length, 0, `参考解未达成：${miss.join('；')}`);
  });
}

test('先猜后算：模型算出的正确选项与出题人预期一致，且与次近选项拉得开', () => {
  const sim = new Sim();
  for (const q of QUIZ) {
    const r = gradeQuestion(sim, q);
    assert.equal(r.correctIndex, q.answer, `${q.id}: 模型结果 ${r.delta}，选中 ${r.correctIndex}`);
    const dists = r.choices.map((c) => Math.abs(c.value - r.delta)).sort((a, b) => a - b);
    assert.ok(dists[1] > 3 * dists[0] + 1e-9, `${q.id}: 选项区分度不足 ${dists}`);
  }
  // 沙盒计算不影响原状态
  assert.equal(sim.changedIds().length, 0);
});
