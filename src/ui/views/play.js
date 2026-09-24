// 挑战关卡 + 先猜后算
import { h, esc, load, save } from '../dom.js';
import { CHALLENGES, evalGoals } from '../../model/challenges.js';
import { QUIZ, gradeQuestion } from '../../model/quiz.js';
import { formulaLines, fmt, fmtDelta } from '../../model/format.js';
import { EVENTS, playEvent } from '../../model/events.js';

const STORE = 'fiscal-sandbox-progress-v1';

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
  app.sim.resetAll();
  app.applyPreset({ label: ch.title, modes: ch.setup.modes, changes: ch.setup.changes });
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
  const min = h('button', { class: 'btn ghost', 'aria-label': '收起任务卡', onclick: () => { el.classList.toggle('mini'); } }, '—');
  const el = h('aside', { class: 'tracker', hidden: true, role: 'status', 'aria-live': 'polite' },
    h('div', { class: 'tracker-head' }, h('span', { class: 'hint' }, '挑战中'), title, h('span', { style: { flex: 1 } }), min,
      h('button', { class: 'btn ghost', onclick: () => stop(), 'aria-label': '结束挑战' }, '✕')),
    list,
    effort,
    h('div', { class: 'tracker-foot' },
      h('button', { class: 'btn', onclick: () => app.activeChallenge && startChallenge(app, app.activeChallenge) }, '重来'),
      h('button', { class: 'btn ghost', onclick: () => app.go('play') }, '所有关卡'),
    ),
    stamp,
  );
  let done = false;
  function show() { done = false; el.hidden = false; el.classList.remove('mini'); update(); }
  function stop() { app.activeChallenge = null; el.hidden = true; app.go('play'); }
  function update() {
    const ch = app.activeChallenge;
    if (!ch) { el.hidden = true; return; }
    title.textContent = ch.title;
    const goals = evalGoals(ch, app.v, app.b);
    const met = goals.filter((g) => g.met).length;
    list.innerHTML = goals.map((g) => `<div class="goal ${g.met ? 'met' : 'miss'}" data-node="${g.id}" style="cursor:pointer"><span class="st">${g.met ? '✓' : '✗'}</span><span>${esc(g.text)}</span><span class="gv">${app.sim.has(g.id) ? esc(fmt(app.sim.spec(g.id), app.v[g.id], { unit: false, dp: app.sim.spec(g.id).unit === 'pct' ? 2 : undefined })) : ''}</span></div>`).join('');
    const all = met === goals.length;
    // 动了几个旋钮：与挑战开始时的状态相比
    const st = app.challengeStart;
    const moved = st ? Object.keys(app.sim.inputs).filter((k) => app.sim.inputs[k] !== st.inputs[k]).length
      + Object.keys(app.sim.modes).filter((k) => app.sim.modes[k] !== st.modes[k]).length : 0;
    const ref = ch.solution.length;
    const stars = moved <= ref ? 3 : moved <= ref + 2 ? 2 : 1;
    effort.innerHTML = `动了 <b>${moved}</b> 个旋钮（参考解 ${ref} 个）${all ? ` · <span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>` : ''}`;
    stamp.hidden = !all;
    if (all && !done) {
      done = true;
      const p = load(STORE, { stars: {}, quiz: {} });
      p.stars[ch.id] = Math.max(p.stars[ch.id] ?? 0, stars);
      save(STORE, p);
      app.flash(`「${ch.title}」达成！${'★'.repeat(stars)}${stars < 3 ? '（旋钮用得越少星越多）' : ''}`);
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
      app.sim.resetAll();
      app.applyPreset({ label: `事件：${ev.title}`, modes: ev.modes, changes: ev.changes, go: tab });
      if (fix) app.set(fix.id, fix.to);
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
  const el = h('div', {},
    rank,
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
    rank.innerHTML = `<span class="rank-seal">${esc(t[1].slice(-2))}</span><div><b>你的级别：${esc(t[1])}</b><div class="hint">${esc(t[2])} · 已过 ${done} / ${CHALLENGES.length} 关 · 测验答对 ${right} / ${QUIZ.length} 题${t[1] !== '部长' ? '（全部通关且测验答对 ' + (QUIZ.length - 2) + ' 题以上为"部长"）' : ''}</div></div>`;
  }

  function update() {
    renderRank();
    renderGrid();
    if (!quizBox.childElementCount) renderQuiz();
  }

  return {
    id: 'play',
    title: '挑战',
    heading: '当一回财政部长',
    lead: `${CHALLENGES.length} 个关卡：减收、加支、卖地收入下滑、老龄化、税制改革、外贸冲击、十年化债。每关都有不止一种解法；参考解经过测试验证可以过关。下面还有 ${QUIZ.length} 道"先猜后算"——先凭直觉选，再看模型怎么算。`,
    mods: [],
    el,
    update,
    hideChanges: true,
  };
}
