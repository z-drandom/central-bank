// 挑战关卡 + 先猜后算
import { h, esc, load, save } from '../dom.js';
import { CHALLENGES, evalGoals } from '../../model/challenges.js';
import { QUIZ, gradeQuestion } from '../../model/quiz.js';
import { formulaLines, fmt, fmtDelta } from '../../model/format.js';

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
  const min = h('button', { class: 'btn ghost', 'aria-label': '收起任务卡', onclick: () => { el.classList.toggle('mini'); } }, '—');
  const el = h('aside', { class: 'tracker', hidden: true, role: 'status', 'aria-live': 'polite' },
    h('div', { class: 'tracker-head' }, h('span', { class: 'hint' }, '挑战中'), title, h('span', { style: { flex: 1 } }), min,
      h('button', { class: 'btn ghost', onclick: () => stop(), 'aria-label': '结束挑战' }, '✕')),
    list,
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
    stamp.hidden = !all;
    if (all && !done) {
      done = true;
      const p = load(STORE, { stars: {}, quiz: {} });
      p.stars[ch.id] = Math.max(p.stars[ch.id] ?? 0, 3);
      save(STORE, p);
      app.flash(`「${ch.title}」达成！`);
    }
    if (!all) done = false;
  }
  void progress;
  return { el, show, update };
}

export default function play(app) {
  const grid = h('div', { class: 'play-grid' });
  const quizBox = h('div', { class: 'sheet', id: 'quiz' });
  const el = h('div', {},
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
      const stars = p.stars[ch.id] ? '★★★' : '';
      grid.append(h('div', { class: `sheet ch-card ${active ? 'active-ch' : ''}` },
        stars ? h('span', { class: 'stamp' }, '达成') : null,
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
        app.sim.resetAll();
        app.applyPreset({ label: '题目情景', modes: q.setup.modes, changes: q.setup.changes, go: q.tab });
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
  }

  function update() {
    renderGrid();
    if (!quizBox.childElementCount) renderQuiz();
  }

  return {
    id: 'play',
    title: '挑战',
    heading: '当一回财政部长',
    lead: '六个关卡：减收、加支、卖地收入下滑、老龄化、税制改革、十年化债。每关都有不止一种解法；参考解经过测试验证可以过关。下面还有十道"先猜后算"——先凭直觉选，再看模型怎么算。',
    mods: [],
    el,
    update,
    hideChanges: true,
  };
}
