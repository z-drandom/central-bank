// 挑战关卡 + 先猜后算
import { h, esc, load, save } from '../dom.js';
import { CHALLENGES, evalGoals } from '../../model/challenges.js';
import { QUIZ, gradeQuestion } from '../../model/quiz.js';
import { formulaLines, fmt, fmtDelta } from '../../model/format.js';
import { EVENTS, playEvent } from '../../model/events.js';
import { makeMission } from '../../model/missions.js';

const STORE = 'fiscal-sandbox-progress-v1';
const MSTORE = 'fiscal-sandbox-missions-v1';
const mload = () => load(MSTORE, null) ?? { streak: 0, best: 0, done: 0, level: 1 };

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const daySeed = (s) => [...s].reduce((a, c) => (a * 131 + c.charCodeAt(0)) >>> 0, 17);

/** 今日任务：用日期作种子，同一天所有人拿到同一道题 */
export function startDaily(app) {
  const d = today();
  const m = makeMission({ seed: daySeed(d), level: 3 });
  if (!m) return;
  m.daily = d;
  m.title = `📅 今日任务 · ${m.title}`;
  startChallenge(app, m);
}

/** 开一道随机任务。若上一道任务还没完成就换题，连胜中断 */
export function startMission(app, level) {
  const m0 = mload();
  const lv = level ?? m0.level ?? 1;
  const cur = app.activeChallenge;
  if (cur?.mission && !cur.completed && m0.streak > 0) {
    m0.streak = 0;
    app.flash('上一题没完成，连胜中断');
  }
  m0.level = lv;
  save(MSTORE, m0);
  let m = null;
  for (let k = 0; k < 5 && !m; k++) m = makeMission({ seed: (Date.now() + k * 7919) >>> 0, level: lv });
  if (!m) return;
  startChallenge(app, m);
}

function shuffleOrder(n, seedStr) {
  let s = [...seedStr].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const idx = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

export function startChallenge(app, ch) {
  const cur = app.activeChallenge;
  if (cur?.mission && !cur.completed && !ch.mission) { const m0 = mload(); if (m0.streak) { m0.streak = 0; save(MSTORE, m0); } }
  app.applyPreset({ fresh: true, label: ch.title, modes: ch.setup.modes, changes: ch.setup.changes });
  app.challengeStart = app.sim.snapshot();
  app.activeChallenge = ch;
  app.go(ch.tab);
  app.tracker?.show();
}

/** 浮动任务卡：挑战进行中在任何页面都可见 */
export function createTracker(app) {
  const progress = load(STORE, { stars: {}, quiz: {} });
  const list = h('div');
  const title = h('b');
  const stamp = h('span', { class: 'stamp', hidden: true }, '达成');
  const effort = h('div', { class: 'hint' });
  const tag = h('span', { class: 'hint' }, '挑战中');
  const storyLine = h('div', { class: 'hint tr-story' });
  const levers = h('div', { class: 'tr-levers' });
  const nextBtn = h('button', { class: 'btn primary', hidden: true, onclick: () => startMission(app) }, '下一题 🎲');
  const min = h('button', { class: 'btn ghost', 'aria-label': '收起任务卡', onclick: () => { el.classList.toggle('mini'); } }, '—');
  const el = h('aside', { class: 'tracker', hidden: true, role: 'status', 'aria-live': 'polite' },
    h('div', { class: 'tracker-head' }, tag, title, h('span', { style: { flex: 1 } }), min,
      h('button', { class: 'btn ghost', onclick: () => stop(), 'aria-label': '结束挑战' }, '✕')),
    storyLine,
    levers,
    list,
    effort,
    h('div', { class: 'tracker-foot' },
      nextBtn,
      h('button', { class: 'btn', onclick: () => app.activeChallenge && startChallenge(app, { ...app.activeChallenge, completed: false }) }, '重来'),
      h('button', { class: 'btn ghost', onclick: () => app.go('play') }, '挑战页'),
    ),
    stamp,
  );
  let done = false;
  function show() { done = false; el.hidden = false; el.classList.remove('mini'); update(); }
  function stop() {
    const ch = app.activeChallenge;
    if (ch?.mission && !ch.completed) { const m0 = mload(); if (m0.streak) { m0.streak = 0; save(MSTORE, m0); app.flash('放弃了这一题，连胜中断'); } }
    app.activeChallenge = null; el.hidden = true; app.go('play');
  }
  function update() {
    const ch = app.activeChallenge;
    if (!ch) { el.hidden = true; return; }
    title.textContent = ch.title;
    tag.textContent = ch.mission ? `随机任务 · 连胜 ${mload().streak}` : '挑战中';
    storyLine.textContent = ch.mission ? ch.story : '';
    storyLine.hidden = !ch.mission;
    levers.hidden = !ch.allowed;
    if (ch.allowed && levers.dataset.for !== String(ch.seed)) {
      levers.dataset.for = String(ch.seed);
      levers.replaceChildren(h('span', { class: 'hint' }, '可以动：'), ...ch.allowed.filter((id) => app.sim.has(id)).map((id) => h('button', { class: 'chip', type: 'button', title: '打开卡片，里面有滑杆', onclick: () => app.openCard(id) }, app.sim.spec(id).label)));
    }
    const goals = evalGoals(ch, app.v, app.b);
    const met = goals.filter((g) => g.met).length;
    list.innerHTML = goals.map((g) => `<div class="goal ${g.met ? 'met' : 'miss'}" data-node="${g.id}" style="cursor:pointer"><span class="st">${g.met ? '✓' : '✗'}</span><span>${esc(g.text)}</span><span class="gv">${app.sim.has(g.id) ? esc(fmt(app.sim.spec(g.id), app.v[g.id], { unit: false, dp: app.sim.spec(g.id).unit === 'pct' ? 2 : undefined })) : ''}</span></div>`).join('');
    const all = met === goals.length;
    // 动了几个旋钮：与挑战开始时的状态相比
    const st = app.challengeStart;
    const moved = st ? Object.keys(app.sim.inputs).filter((k) => app.sim.inputs[k] !== st.inputs[k]).length
      + Object.keys(app.sim.modes).filter((k) => app.sim.modes[k] !== st.modes[k]).length : 0;
    const ref = ch.solution.length;
    // 随机任务只许动规定的旋钮，动了别的最多一颗星
    const outside = ch.allowed && st ? Object.keys(app.sim.inputs).filter((k) => app.sim.inputs[k] !== st.inputs[k] && !ch.allowed.includes(k)) : [];
    let stars = moved <= ref ? 3 : moved <= ref + 2 ? 2 : 1;
    if (outside.length || (ch.allowed && st && Object.keys(app.sim.modes).some((k) => app.sim.modes[k] !== st.modes[k]))) stars = 1;
    effort.innerHTML = `动了 <b>${moved}</b> 个旋钮（参考解 ${ref} 个）${outside.length ? ` · <span class="down">动了规定外的：${esc(outside.map((k) => app.sim.spec(k)?.label ?? k).slice(0, 2).join('、'))}</span>` : ''}${all ? ` · <span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>` : ''}`;
    stamp.hidden = !all;
    nextBtn.hidden = !(ch.mission && all);
    if (all && !done) {
      done = true;
      if (ch.mission) {
        if (!ch.completed) {
          ch.completed = true;
          const m0 = mload();
          m0.streak += 1;
          m0.best = Math.max(m0.best, m0.streak);
          m0.done += 1;
          save(MSTORE, m0);
          tag.textContent = `随机任务 · 连胜 ${m0.streak}`;
          app.flash(`完成！${'★'.repeat(stars)} 连胜 ${m0.streak}${m0.streak === m0.best && m0.streak > 1 ? '（新纪录）' : ''}`);
          if (ch.daily) m0.daily = { date: ch.daily, stars: Math.max(stars, m0.daily?.date === ch.daily ? m0.daily.stars : 0) };
          save(MSTORE, m0);
          app.track?.('mission', { stars, streak: m0.streak });
          app.celebrate?.();
        }
      } else {
        const p = load(STORE, { stars: {}, quiz: {} });
        const first = !p.stars[ch.id];
        p.stars[ch.id] = Math.max(p.stars[ch.id] ?? 0, stars);
        save(STORE, p);
        app.flash(`「${ch.title}」达成！${'★'.repeat(stars)}${stars < 3 ? '（旋钮用得越少星越多）' : ''}`);
        app.track?.('challenge', { id: ch.id, stars });
        if (first || stars === 3) app.celebrate?.();
      }
    }
    if (!all) done = false;
  }
  void progress;
  return { el, show, update };
}

export default function play(app) {
  const grid = h('div', { class: 'play-grid' });
  const quizBox = h('div', { class: 'sheet', id: 'quiz' });
  const rank = h('div', { class: 'rank' });
  const evBox = h('div');
  let lastEv = null;
  function drawEvent() {
    let ev;
    do { ev = EVENTS[Math.floor(Math.random() * EVENTS.length)]; } while (EVENTS.length > 1 && ev.id === lastEv);
    lastEv = ev.id;
    const r = playEvent(ev);
    const ts = r.sim.spec(r.target);
    const tab = { oth26: 'b26', drate26: 'b26', el26: 'b26', f1_other: 'fb', p_d_2035: 'proj' }[r.target] ?? 'overview';
    const applyEvent = (fix) => {
      const changes = fix ? [...ev.changes, { id: fix.id, set: fix.to }] : ev.changes;
      app.applyPreset({ fresh: true, label: `事件：${ev.title}${fix ? '（含对冲方案）' : ''}`, modes: ev.modes, changes, go: tab });
    };
    evBox.innerHTML = '';
    evBox.append(h('div', { class: 'event-card' },
      h('div', { class: 'lvl' }, '事件卡'),
      h('h4', {}, ev.title),
      h('p', {}, ev.story),
      h('p', { class: 'note', html: `冲击：<b>${esc(ts.label)}</b> 从 ${esc(fmt(ts, r.goal))} 变为 <b>${esc(fmt(ts, r.now))}</b>（${esc(fmtDelta(ts, r.now - r.goal))}）。要把它拉回原图水平，只动一个旋钮的话：` }),
      h('div', { class: 'fixes' }, r.fixes.map((f) => {
        const sp = r.sim.spec(f.id);
        return h('div', { class: 'fix' },
          h('span', { html: `把 <b>${esc(sp.label)}</b> 从 ${esc(fmt(sp, f.from))} 调到 <b>${esc(fmt(sp, f.to))}</b>` }),
          h('button', { class: 'btn', onclick: () => applyEvent(f) }, '用这个方案'),
        );
      })),
      h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' } },
        h('button', { class: 'btn primary', onclick: () => applyEvent(null) }, '只施加冲击，我自己来'),
        h('button', { class: 'btn ghost', onclick: drawEvent }, '换一张'),
      ),
      h('p', { class: 'hint' }, '每个方案都是用"反向求解"在同一套公式上算出来的；只列政策能动的旋钮。方案之间可以组合，每个只需动一部分。'),
    ));
  }
  // 随机任务（无尽模式）
  const mStats = h('div', { class: 'm-stats' });
  const dailyBtn = h('button', { class: 'btn big', id: 'daily-go', onclick: () => startDaily(app) }, '📅 今日任务');
  const lvSeg = h('div', { class: 'seg', role: 'group', 'aria-label': '难度', style: { display: 'inline-flex' } });
  for (const [lv, t] of [[1, '入门'], [2, '进阶'], [3, '高手']]) {
    lvSeg.append(h('button', { type: 'button', 'data-lv': lv, onclick: () => { const m0 = mload(); m0.level = lv; save(MSTORE, m0); renderMissions(); } }, t));
  }
  const missionSheet = h('div', { class: 'sheet mission-sheet', id: 'missions' },
    h('h3', {}, '🎲 随机任务 · 无尽模式', h('small', {}, '每题现场出、保证有解：只许动规定的几个旋钮，把指标拧到目标。连胜越多越好')),
    h('div', { class: 'm-row' },
      lvSeg,
      h('button', { class: 'btn primary big', id: 'mission-go', onclick: () => startMission(app) }, '来一道题'),
      dailyBtn,
      mStats,
    ),
  );
  function renderMissions() {
    const m0 = mload();
    for (const b of lvSeg.children) b.setAttribute('aria-pressed', String(Number(b.dataset.lv) === (m0.level ?? 1)));
    const dd = m0.daily?.date === today() ? m0.daily.stars : 0;
    dailyBtn.textContent = dd ? `📅 今日任务 ${'★'.repeat(dd)}${'☆'.repeat(3 - dd)}` : '📅 今日任务';
    dailyBtn.title = '同一天所有人拿到同一道题（高手难度），可以和朋友比星级';
    mStats.innerHTML = `<span>当前连胜 <b class="num">${m0.streak}</b></span><span>最佳 <b class="num">${m0.best}</b></span><span>已完成 <b class="num">${m0.done}</b></span>`;
  }
  const wallBox = h('div');
  const wallTitle = h('small', {});
  const wallSheet = h('div', { class: 'sheet', id: 'badges' }, h('h3', {}, '🏅 成就墙', wallTitle), wallBox);
  let wallCount = -1;
  function renderWall(force = false) {
    const a = app.achievements;
    if (!a || (!force && a.count === wallCount)) return; // 成就墙只在解锁数变化时重建
    wallCount = a.count;
    wallTitle.textContent = `已解锁 ${a.count} / ${a.total}；灰色的鼠标移上去看怎么解锁`;
    wallBox.replaceChildren(a.wall());
  }
  app.achievements?.onChange(() => { renderWall(true); renderRank(); });
  app.startMission = (lv) => startMission(app, lv);
  const el = h('div', {},
    rank,
    missionSheet,
    h('div', { class: 'sheet', style: { marginBottom: '16px' } },
      h('h3', {}, '事件卡', h('small', {}, `${EVENTS.length} 张随机冲击：看它打到哪里，再看系统算出的对冲办法`)),
      h('button', { class: 'btn primary', onclick: drawEvent }, '抽一张事件卡'),
      evBox,
    ),
    h('div', { class: 'sheet', style: { marginBottom: '16px' } },
      h('h3', {}, '挑战关卡', h('small', {}, '每关先给一个冲击，再由你调参数达成全部目标。任务卡会跟着你切换页面')),
      grid,
    ),
    quizBox,
    wallSheet,
  );
  let qi = 0;
  let answered = null;
  let score = load(STORE, { stars: {}, quiz: {} }).quiz ?? {};

  function renderGrid() {
    const p = load(STORE, { stars: {}, quiz: {} });
    grid.innerHTML = '';
    for (const ch of CHALLENGES) {
      const active = app.activeChallenge?.id === ch.id;
      const goals = active ? evalGoals(ch, app.v, app.b) : ch.goals.map((g) => ({ ...g, met: null }));
      const hint = h('p', { class: 'hint', hidden: true }, `提示：${ch.hint}`);
      const n = p.stars[ch.id] ?? 0;
      const stars = n ? '★'.repeat(n) + '☆'.repeat(3 - n) : '';
      grid.append(h('div', { class: `sheet ch-card ${active ? 'active-ch' : ''}` },
        stars ? h('span', { class: 'stamp' }, '达成') : null,
        stars ? h('span', { class: 'stars', title: '最好成绩：旋钮用得越少星越多' }, stars) : null,
        h('span', { class: 'lvl' }, `${ch.level} · 去「${{ b26: '2026 预算', fb: '四本账', y25: '2025 执行', proj: '十年推演', debt: '债务' }[ch.tab]}」页`),
        h('h4', {}, ch.title),
        h('p', {}, ch.story),
        h('div', {}, goals.map((g) => h('div', { class: `goal ${g.met === true ? 'met' : g.met === false ? 'miss' : ''}` },
          h('span', { class: 'st' }, g.met === true ? '✓' : g.met === false ? '✗' : '·'), h('span', {}, g.text), h('span')))),
        hint,
        h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' } },
          h('button', { class: 'btn primary', onclick: () => startChallenge(app, ch) }, active ? '重新开始' : '开始挑战'),
          h('button', { class: 'btn ghost', onclick: () => { hint.hidden = !hint.hidden; } }, '看提示'),
        ),
      ));
    }
  }

  function renderQuiz() {
    const q = QUIZ[qi];
    const r = gradeQuestion(app.sim, q);
    const order = shuffleOrder(q.choices.length, q.id);
    const correctCount = Object.values(score).filter(Boolean).length;
    quizBox.innerHTML = '';
    const opts = h('div', { class: 'quiz-opts' });
    order.forEach((i, k) => {
      const c = r.choices[i];
      const cls = answered == null ? '' : i === r.correctIndex ? 'right' : i === answered ? 'wrong' : '';
      opts.append(h('button', { class: `quiz-opt ${cls}`, disabled: answered != null, onclick: () => pick(i, r) }, `${'ABCD'[k]}. ${c.text}`));
    });
    quizBox.append(
      h('h3', {}, '先猜后算', h('small', {}, `第 ${qi + 1} / ${QUIZ.length} 题 · 已答对 ${correctCount} 题 · 答案由模型现算`)),
      h('p', { style: { fontSize: '15px', margin: '6px 0 10px', fontWeight: 600 } }, q.q),
      opts,
    );
    if (answered != null) {
      const s = r.sim;
      const spec = s.spec(q.target);
      const L = formulaLines(s.graph, q.target, s.values);
      const dtext = q.fmt ? q.fmt(r.delta) : fmtDelta(spec, r.delta);
      quizBox.append(
        h('div', { class: 'quiz-exp', style: { marginTop: '12px' } },
          h('p', { style: { margin: '0 0 6px' } }, h('b', {}, answered === r.correctIndex ? '答对了。' : '差一点。'), ` 模型计算：${spec.label} ${fmt(spec, s.base[q.target])} → ${fmt(spec, s.values[q.target])}，变化 ${dtext}。`),
          h('p', { style: { margin: 0 } }, q.explain),
        ),
        L ? h('div', { class: 'fx-table', style: { marginTop: '10px' } },
          h('div', { class: 'k' }, '公式'), h('div', { class: 'v', html: L.sym }),
          h('div', { class: 'k' }, '读法'), h('div', { class: 'v read', html: L.read }),
          ...(L.pron ? [h('div', { class: 'k' }, '拟音'), h('div', { class: 'v read' }, L.pron)] : []),
          h('div', { class: 'k' }, '代入'), h('div', { class: 'v subst', html: L.subst }),
        ) : null,
      );
    }
    quizBox.append(h('div', { style: { display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' } },
      h('button', { class: 'btn', disabled: qi === 0, onclick: () => { qi--; answered = null; renderQuiz(); } }, '上一题'),
      h('button', { class: 'btn primary', onclick: () => { qi = (qi + 1) % QUIZ.length; answered = null; renderQuiz(); } }, qi === QUIZ.length - 1 ? '从头再来' : '下一题'),
      answered != null ? h('button', { class: 'btn', onclick: () => {
        // 在副本上从原图基线施加题目设定，再整体载入（可撤销回到做题前的状态）
        const s = app.sim.clone();
        s.resetAll();
        if (q.setup.modes) s.setModes(q.setup.modes);
        s.apply(q.setup.changes ?? []);
        app.restore(s.snapshot(), '已载入题目情景（可撤销）');
        app.go(q.tab);
        if (q.phase) app.showPhase?.(q.phase);
      } }, '在沙盘里看这个情景') : null,
    ));
  }

  function pick(i, r) {
    answered = i;
    score[QUIZ[qi].id] = i === r.correctIndex;
    if (i === r.correctIndex) app.track?.('quiz', QUIZ[qi].id);
    const p = load(STORE, { stars: {}, quiz: {} });
    p.quiz = score;
    save(STORE, p);
    renderQuiz();
    renderRank();
  }

  function renderRank() {
    const p = load(STORE, { stars: {}, quiz: {} });
    const done = CHALLENGES.filter((c) => p.stars[c.id]).length;
    const right = Object.values(p.quiz ?? {}).filter(Boolean).length;
    const titles = [
      [0, '见习科员', '从第一关开始吧'],
      [1, '科员', '会算账了'],
      [3, '处长', '知道缺口会往哪里跑'],
      [5, '司长', '能在几本账之间调度资金'],
      [CHALLENGES.length, '部长', '全部关卡通关'],
    ];
    let t = titles[0];
    for (const x of titles) if (done >= x[0]) t = x;
    if (t[1] === '部长' && right < QUIZ.length - 2) t = titles[3];
    const badges = app.achievements ? ` · 成就 ${app.achievements.count} / ${app.achievements.total}` : '';
    rank.innerHTML = `<span class="rank-seal">${esc(t[1].slice(-2))}</span><div><b>你的级别：${esc(t[1])}</b><div class="hint">${esc(t[2])} · 已过 ${done} / ${CHALLENGES.length} 关 · 测验答对 ${right} / ${QUIZ.length} 题${badges}${t[1] !== '部长' ? '（全部通关且测验答对 ' + (QUIZ.length - 2) + ' 题以上为"部长"）' : ''}</div></div>`;
  }

  function update() {
    renderRank();
    renderMissions();
    renderWall();
    renderGrid();
    if (!quizBox.childElementCount) renderQuiz();
  }

  return {
    id: 'play',
    title: '挑战',
    heading: '当一回财政部长',
    lead: `随机任务无穷无尽、每题保证有解；${CHALLENGES.length} 个关卡：减收、加支、压赤字、卖地收入下滑、老龄化、税制改革、外贸冲击、十年化债。每关都有不止一种解法；参考解经过测试验证可以过关。下面还有 ${QUIZ.length} 道"先猜后算"——先凭直觉选，再看模型怎么算。`,
    mods: [],
    el,
    update,
    hideChanges: true,
  };
}
