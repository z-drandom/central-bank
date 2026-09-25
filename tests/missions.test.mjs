import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/model/sim.js';
import { makeMission, MISSION_TEMPLATES, shareText, fmtSecs } from '../src/model/missions.js';

// 按界面的方式开局：原图基线 → 切规则 → 施加冲击
function startState(m) {
  const s = new Sim();
  s.setModes(m.setup.modes ?? {});
  s.apply(m.setup.changes ?? []);
  return s;
}

test('随机任务：每类模板 60 个种子都能出题；开局未达成，参考解能达成，且只用允许的旋钮', () => {
  for (const tpl of MISSION_TEMPLATES) {
    let made = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const m = makeMission({ seed: seed * 7919 + tpl.id.length, template: tpl.id });
      if (!m) continue;
      made++;
      const s = startState(m);
      assert.ok(!m.goals.every((g) => g.test(s.values, s.base)), `${tpl.id}#${seed} 开局就已达成`);
      for (const c of m.solution) assert.ok(m.allowed.includes(c.id), `${tpl.id} 参考解用了不允许的 ${c.id}`);
      s.setMany(Object.fromEntries(m.solution.map((c) => [c.id, c.set])));
      const miss = m.goals.filter((g) => !g.test(s.values, s.base));
      assert.equal(miss.length, 0, `${tpl.id}#${seed} 参考解未达成：${miss.map((g) => `${g.text}（实际 ${s.values[g.id]}）`).join('；')}`);
      assert.ok(m.story.length > 10 && !/undefined|NaN/.test(m.story + m.goals.map((g) => g.text).join('')), m.story);
    }
    assert.ok(made >= 54, `${tpl.id} 只出了 ${made}/60 题`);
  }
});

test('随机任务：同一种子出同一道题；按难度筛选模板', () => {
  const a = makeMission({ seed: 42 });
  const b = makeMission({ seed: 42 });
  assert.equal(a.story, b.story);
  for (let seed = 1; seed < 40; seed++) assert.ok(makeMission({ seed, level: 1 }).level <= 1);
});

test('晒战绩：用时格式与战绩文字（今日任务带日期、去掉标题前缀，逐条列出目标）', () => {
  assert.equal(fmtSecs(7), '7 秒');
  assert.equal(fmtSecs(59), '59 秒');
  assert.equal(fmtSecs(65), '1 分 05 秒');
  const m = makeMission({ seed: 7, level: 3 });
  m.daily = '2026-09-25';
  m.title = `📅 今日任务 · ${m.title}`;
  const text = shareText(m, { stars: 2, secs: 72, moved: 3, ref: 2, streak: 4 });
  const lines = text.split('\n');
  assert.equal(lines[0], '中国财政沙盘 · 今日任务 2026-09-25');
  assert.ok(!lines[1].includes('今日任务'), lines[1]);
  assert.equal(lines[2], '★★☆ · 用时 1 分 12 秒 · 动了 3 个旋钮（参考解 2 个） · 连胜 4');
  assert.equal(lines.length, 3 + m.goals.length);
  assert.ok(lines.slice(3).every((l) => l.startsWith('🟩 ')));
  const r = makeMission({ seed: 8, level: 1 });
  assert.match(shareText(r, { stars: 3, secs: 20, moved: 2, ref: 2, streak: 1 }), /^中国财政沙盘 · 随机任务（入门）\n/);
  assert.ok(!/连胜/.test(shareText(r, { stars: 3, secs: 20, moved: 2, ref: 2, streak: 1 })), '连胜 1 不写');
});
