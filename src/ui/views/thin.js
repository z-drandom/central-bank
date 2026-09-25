// 读薄：三个旋钮、三句话、一句话。每一课先猜、再拧、再看公式；数字都在独立的模型副本上现算，互不干扰。
import { h, esc, load, save } from '../dom.js';
import { Sim } from '../../model/sim.js';
import { LESSONS, THIN_KEY, summary } from '../../model/thin.js';

const fmtLever = (id, x) => (id === 'sp26' ? `${(x / 1e4).toFixed(1)} 万亿` : `${(x * 100).toFixed(1)}%`);
const sgn = (x) => (x > 0 ? '+' : x < 0 ? '−' : '±');
const yiDelta = (x) => `${sgn(x)}${Math.round(Math.abs(x)).toLocaleString('en-US')} 亿`;

/** 冰山：水面上是赤字，水面下是不算赤字的借债。刻度固定（按滑杆最大值），拖动时水下部分看得见地变长。
 *  标签避让：水面上的标签不低于水面，水面下的标签从水面下 16px 起，相邻标签至少隔 16px。 */
function iceberg(parts, scaleMax) {
  const k = 210 / scaleMax;
  let y = 0;
  let bars = '';
  const marks = [];
  for (const p of parts) {
    const hgt = Math.max(1, p.value * k);
    bars += `<rect x="0" y="${y.toFixed(1)}" width="46" height="${hgt.toFixed(1)}" class="ib-${p.cls}"/>`;
    marks.push({ p, mid: y + Math.min(hgt, 40) / 2 + 5 });
    y += hgt;
  }
  const water = parts.filter((p) => p.above).reduce((a, p) => a + Math.max(1, p.value * k), 0);
  let lastY = -Infinity;
  let labels = '';
  for (const { p, mid } of marks) {
    let ty = Math.max(mid, lastY + 16);
    ty = p.above ? Math.min(ty, water - 8) : Math.max(ty, water + 18);
    lastY = ty;
    labels += `<text x="58" y="${ty.toFixed(1)}" class="ib-t">${esc(p.label)} ${(p.value / 1e4).toFixed(2)} 万亿${p.note ? `<tspan class="ib-n">（${esc(p.note)}）</tspan>` : ''}</text>`;
  }
  const bottom = Math.max(y + 12, lastY + 22); // 底部说明单独占一行
  return `<svg viewBox="0 -14 340 ${(bottom + 18).toFixed(0)}" class="iceberg" role="img" aria-label="政府债务增加额的构成：水面上是赤字，水面下是不计入赤字的借债">
    <rect x="-4" y="${water.toFixed(1)}" width="348" height="${(bottom - water).toFixed(1)}" class="ib-sea"/>
    ${bars}
    <line x1="-4" x2="344" y1="${water.toFixed(1)}" y2="${water.toFixed(1)}" class="ib-line"/>
    <text x="340" y="${(water - 5).toFixed(1)}" text-anchor="end" class="ib-w">↑ 算进赤字</text>
    <text x="340" y="${(bottom - 4).toFixed(1)}" text-anchor="end" class="ib-w">↓ 水面下：不算赤字</text>
    ${labels}
  </svg>`;
}

/** 终点：2025–2035 年是模型推演（实线），之后按 2035 年的比率外推（虚线），水平虚线是终点 d* */
function endpointChart(r) {
  const W = 340, Hh = 190, m = { l: 36, r: 8, t: 10, b: 22 };
  const x0 = 2025, x1 = 2080, yMax = 3.5;
  const X = (x) => m.l + ((x - x0) / (x1 - x0)) * (W - m.l - m.r);
  const Y = (y) => m.t + (1 - Math.min(y, yMax) / yMax) * (Hh - m.t - m.b);
  const line = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
  const split = (pts) => [pts.filter((p) => !p.extra), pts.filter((p, i) => p.extra || (pts[i + 1]?.extra && !p.extra))];
  const [a, b] = split(r.path);
  const [a0, b0] = split(r.basePath);
  const dstar = r.nums[0];
  const ds = r.dstar;
  let s = '';
  for (const t of [0, 1, 2, 3]) s += `<line class="grid-line" x1="${m.l}" x2="${W - m.r}" y1="${Y(t)}" y2="${Y(t)}"/><text class="axis-t" x="${m.l - 5}" y="${Y(t) + 4}" text-anchor="end">${t * 100}%</text>`;
  for (const x of [2025, 2035, 2050, 2080]) s += `<text class="axis-t" x="${X(x)}" y="${Hh - 6}" text-anchor="${x === 2080 ? 'end' : 'middle'}">${x}</text>`;
  s += `<line x1="${X(2035)}" x2="${X(2035)}" y1="${m.t}" y2="${Hh - m.b}" class="ep-div"/>`;
  s += `<path d="${line(a0)}" class="ep-base"/><path d="${line(b0)}" class="ep-base" stroke-dasharray="4 4"/>`;
  if (Number.isFinite(r.baseDstar)) s += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(r.baseDstar)}" y2="${Y(r.baseDstar)}" class="ep-star0"/>`;
  s += `<path d="${line(a)}" class="ep-now"/><path d="${line(b)}" class="ep-now" stroke-dasharray="5 4"/>`;
  if (Number.isFinite(ds)) {
    const off = ds > yMax;
    const below = ds > 2.9; // 贴近顶部时标签放到线下
    s += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(ds)}" y2="${Y(ds)}" class="ep-star"/><text x="${W - m.r - 2}" y="${Y(ds) + (below ? 14 : -5)}" text-anchor="end" class="ep-t">终点 ${esc(dstar.value)}${off ? '（在图外）' : ''}</text>`;
  }
  s += `<text x="${X(2030)}" y="${Y(0) - 6}" text-anchor="middle" class="axis-t">推演</text><text x="${X(2057)}" y="${Y(0) - 6}" text-anchor="middle" class="axis-t">按 2035 年比率外推</text>`;
  return `<svg viewBox="0 0 ${W} ${Hh}" class="ep-chart" role="img" aria-label="政府负债率路径：2035 年以后按不变比率外推，趋近终点 ${esc(dstar.value)}">${s}</svg>`;
}

export default function thin(app) {
  const st = load(THIN_KEY, null) ?? { answers: {} };
  if (typeof st.answers !== 'object' || !st.answers) st.answers = {};
  const persist = () => save(THIN_KEY, st);
  const nIn = app.sim.graph.inputs().filter((n) => !n.fixed && n.range).length;
  const nFx = app.sim.graph.specs.size - app.sim.graph.inputs().length;

  const cards = LESSONS.map((L) => {
    const sim = new Sim();
    const base = { ...sim.values };
    const el = h('article', { class: 'lesson', id: `ls-${L.id}`, 'aria-labelledby': `ls-${L.id}-h` });
    const q = h('p', { class: 'ls-q' });
    const opts = h('div', { class: 'ls-opts', role: 'group', 'aria-label': '你的猜测' });
    const verdict = h('p', { class: 'ls-verdict', role: 'status' });
    const title = h('h3', { id: `ls-${L.id}-h` });
    const moral = h('p', { class: 'ls-moral' });
    const out = h('output', { class: 'num' });
    const range = h('input', { type: 'range', min: L.lever.min, max: L.lever.max, step: L.lever.step, 'aria-label': L.lever.label });
    const tryBtn = h('button', { class: 'chip', type: 'button', onclick: () => setVal(L.lever.try) }, `试试 ${fmtLever(L.lever.id, L.lever.try)}`);
    const resetBtn = h('button', { class: 'chip', type: 'button', onclick: () => setVal(base[L.lever.id]) }, '回到原图');
    const nums = h('div', { class: 'ls-nums' });
    const vis = h('div', { class: 'ls-vis' });
    const say = h('p', { class: 'ls-say', 'aria-live': 'polite' });
    const fx = h('div', { class: 'ls-fx' });
    const body = h('div', { class: 'ls-body', hidden: true },
      title, moral,
      h('div', { class: 'ls-lever' }, h('label', {}, L.lever.label, ' ', out), range, h('div', { class: 'ls-chips' }, tryBtn, resetBtn)),
      nums, vis, say, fx,
      h('div', { class: 'ls-foot' },
        h('span', { class: 'hint' }, `出处：${L.source}`),
        h('button', { class: 'btn', type: 'button', onclick: () => {
          app.applyPreset({ fresh: true, label: `读薄${L.no} ${L.title}`, changes: [{ id: L.lever.id, set: sim.values[L.lever.id] }], go: L.tab });
        } }, '在完整模型里看 →'),
      ),
    );
    el.append(h('span', { class: 'ls-no', 'aria-hidden': 'true' }, L.no), q, opts, verdict, body);
    q.textContent = L.q;
    range.addEventListener('input', () => { sim.set(L.lever.id, parseFloat(range.value)); draw(); });

    function setVal(x) { sim.set(L.lever.id, x); range.value = String(x); draw(); }
    function renderOpts() {
      const a = st.answers[L.id];
      opts.replaceChildren(...L.options.map((t, i) => h('button', {
        class: `btn ls-opt ${a == null ? '' : i === L.answer ? 'right' : i === a ? 'wrong' : 'dim'}`,
        type: 'button', disabled: a != null, 'aria-pressed': String(a === i),
        onclick: () => { st.answers[L.id] = i; persist(); app.track?.('thin', L.id); renderOpts(); onAnswer(); },
      }, t)));
      verdict.textContent = a == null ? '' : a === L.answer ? '猜对了。' : `其实是「${L.options[L.answer]}」。`;
      verdict.className = `ls-verdict ${a == null ? '' : a === L.answer ? 'ok' : 'no'}`;
      body.hidden = a == null;
      el.classList.toggle('open', a != null);
      if (a != null) draw();
    }
    function draw() {
      const r = L.read(sim.values, base);
      title.textContent = L.title;
      moral.textContent = r.moral;
      out.textContent = fmtLever(L.lever.id, sim.values[L.lever.id]);
      nums.innerHTML = r.nums.map((n) => {
        const d = n.delta != null ? `<small class="${n.delta < 0 ? 'down' : 'up'}">${yiDelta(n.delta)}</small>`
          : n.deltaPct != null ? `<small class="${n.deltaPct < 0 ? 'down' : 'up'}">${sgn(n.deltaPct)}${Math.abs(n.deltaPct * 100).toFixed(0)} 个百分点</small>` : '';
        return `<div class="ls-num"><span>${esc(n.label)}</span><b class="num">${esc(n.value)}</b>${d}</div>`;
      }).join('');
      if (L.id === 'iceberg') vis.innerHTML = iceberg(r.parts, 58900 + L.lever.max + 20000);
      else if (L.id === 'endpoint') vis.innerHTML = endpointChart({ ...r, dstar: sim.values.p_dstar, baseDstar: base.p_dstar });
      else vis.innerHTML = '';
      vis.hidden = !vis.innerHTML;
      say.textContent = r.say;
      fx.innerHTML = `<div><span class="k">公式</span>${esc(r.fx.sym)}</div><div><span class="k">代入</span><span class="num">${esc(r.fx.subst)}</span></div>`;
    }
    range.value = String(base[L.lever.id]);
    renderOpts();
    return { L, el, renderOpts, reset: () => setVal(base[L.lever.id]) };
  });

  const sum = summary();
  const sumBox = h('section', { class: 'lesson sum', id: 'ls-sum', 'aria-label': '读薄成一句话' });
  function renderSum() {
    const done = LESSONS.filter((L) => st.answers[L.id] != null).length;
    const right = LESSONS.filter((L) => st.answers[L.id] === L.answer).length;
    if (done < LESSONS.length) {
      sumBox.innerHTML = `<p class="hint">三句都看完，这里会把它们压成一句。（还剩 ${LESSONS.length - done} 句）</p>`;
      return;
    }
    sumBox.innerHTML = `<span class="ls-no" aria-hidden="true">薄</span><p class="ls-q">读薄成一句话</p><h3>${esc(sum.line)}</h3><ul>${sum.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul><p class="hint">三题猜对 ${right} 题。</p>`;
    sumBox.append(h('div', { class: 'ls-foot' },
      h('button', { class: 'btn ghost', type: 'button', onclick: () => { st.answers = {}; persist(); for (const c of cards) { c.reset(); c.renderOpts(); } renderSum(); window.scrollTo?.({ top: 0 }); } }, '重新猜一遍'),
      h('button', { class: 'btn primary', type: 'button', onclick: () => app.go('overview') }, '读厚：打开完整模型 →'),
    ));
  }
  function onAnswer() {
    renderSum();
    if (LESSONS.every((L) => st.answers[L.id] != null)) app.celebrate?.();
  }
  renderSum();

  const el = h('div', { class: 'thin' },
    h('header', { class: 'thin-hero' },
      h('h2', {}, '三个旋钮，读懂中国财政'),
      h('p', {}, `这台沙盘有 ${nIn} 个旋钮、${nFx} 条公式。拧起来最让人"原来如此"的，只有三个。每个先猜，再拧，再看公式。`),
    ),
    ...cards.map((c) => c.el),
    sumBox,
    h('div', { class: 'thin-thick' },
      h('p', {}, h('b', {}, '想读厚？'), ` 四张原图的每一个数、十年推演、影响矩阵、挑战关卡，以及全部 ${nFx} 条公式的代入，都在完整模型里。`),
      h('button', { class: 'btn', type: 'button', onclick: () => app.go('overview') }, `读厚：${nIn} 个旋钮 →`),
    ),
  );

  return {
    id: 'thin',
    thin: true,
    title: '读薄',
    heading: '三个旋钮，读懂中国财政',
    el,
    update() {},
    hideChanges: true,
    bare: true,
  };
}
