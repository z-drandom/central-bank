import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/model/sim.js';
import { ACHIEVEMENTS, COUNTS, checkAchievements, recordEvent } from '../src/model/achievements.js';
import { CHALLENGES } from '../src/model/challenges.js';

test('成就：id 唯一，关卡总数与实际一致', () => {
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
  assert.equal(COUNTS.challenges, CHALLENGES.length);
  for (const a of ACHIEVEMENTS) assert.ok(a.icon && a.title && a.desc && a.hint && (a.state || a.stat), a.id);
});

test('成就：基线状态一个数值类成就都不解锁；每个数值类成就都能在滑杆区间内达成', () => {
  const base = new Sim();
  assert.deepEqual(checkAchievements([], {}, base.values).filter((id) => ACHIEVEMENTS.find((a) => a.id === id).state), []);
  const ways = {
    'big-spender': { dr26: 0.065 }, hawk: { dr26: 0.015 }, century: { pdr: 0.06 }, clean: { swap26: 40000 }, reformer: { s_vat: 0 },
  };
  for (const a of ACHIEVEMENTS.filter((x) => x.state)) {
    const s = new Sim();
    const set = ways[a.id];
    assert.ok(set, `${a.id} 缺少达成方法`);
    for (const [k, v] of Object.entries(set)) { const [lo, hi] = s.spec(k).range; assert.ok(v >= lo && v <= hi, `${k} 超出滑杆`); }
    s.setMany(set);
    assert.ok(checkAchievements([], {}, s.values).includes(a.id), a.id);
  }
});

test('成就：行为类按统计判定，已解锁的不重复', () => {
  const stats = { set: 1, card: 20, modes: ['a', 'b', 'c', 'd', 'e'], challenges: CHALLENGES.map((c) => c.id), bestStreak: 10, quiz: [1, 2, 3, 4, 5, 6, 7, 8], paths: 1, phase: 1, solve2: 1, shapley: 1, replay: 1, stories: ['x', 'y', 'z'], threeStars: 1, finder: 1, history: 1 };
  const all = checkAchievements([], stats, new Sim().values);
  for (const a of ACHIEVEMENTS.filter((x) => x.stat)) assert.ok(all.includes(a.id), a.id);
  assert.deepEqual(checkAchievements(all, stats, new Sim().values), []);
});

test('成就：界面实际发出的事件序列能解锁每一个行为类成就（事件名与统计字段对得上）', () => {
  const E = (ev, n = 1, payload) => Array.from({ length: n }, (_, i) => [ev, typeof payload === 'function' ? payload(i) : payload]);
  const ways = {
    'first-turn': E('set'), curious: E('card', 20), rules: E('mode', 5, (i) => `k=${i}`), finder: E('finder'), timewalker: E('history'),
    replay: E('replay'), paths: E('paths'), phase: E('phase'), newton: E('solve2'), shapley: E('shapley'), storyteller: E('story', 3, (i) => `s${i}`),
    challenger: E('challenge', 1, { id: 'x', stars: 1 }), minister: E('challenge', CHALLENGES.length, (i) => ({ id: CHALLENGES[i].id, stars: 2 })),
    'three-stars': E('mission', 1, { stars: 3, streak: 1 }), quizzer: E('quiz', 8, (i) => `q${i}`),
    streak3: E('mission', 1, { stars: 1, streak: 3 }), streak10: E('mission', 1, { stars: 1, streak: 10 }),
  };
  for (const a of ACHIEVEMENTS.filter((x) => x.stat)) {
    const seq = ways[a.id];
    assert.ok(seq, `${a.id} 缺少事件序列`);
    const stats = {};
    const before = checkAchievements([], stats, null);
    assert.ok(!before.includes(a.id), `${a.id} 不应一开始就解锁`);
    for (const [ev, p] of seq) recordEvent(stats, ev, p);
    assert.ok(checkAchievements([], stats, null).includes(a.id), `${a.id}：事件 ${seq[0][0]} 解锁不了`);
  }
});
