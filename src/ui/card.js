// 公式卡片：点任何一个数字都会打开。显示 公式 / 读法 / 拟音 / 代入，以及上游、下游。
import { h, esc } from './dom.js';
import { fmt, fmtDelta, fmtRel, formulaLines, kindOf, symHTML } from '../model/format.js';
import { MODULES } from '../model/specs.js';
import { changed } from '../engine/graph.js';
import { makeSlider } from './controls.js';
import { attribute, mainPath } from '../engine/attrib.js';
import { shapley } from '../model/shapley.js';
import { createPaths } from './paths.js';
import { MATRIX_COLS } from '../model/matrix.js';

export function createCard(app) {
  const scrim = h('div', { class: 'scrim', onclick: () => close() });
  const body = h('div', { class: 'drawer-body' });
  const back = h('button', { class: 'btn ghost', onclick: () => goBack(), 'aria-label': '返回上一个' }, '← 返回');
  const drawer = h('aside', { class: 'drawer', role: 'dialog', 'aria-modal': 'false', 'aria-label': '公式卡片' },
    h('div', { class: 'drawer-head' },
      back,
      h('span', { class: 'grow hint' }, '公式卡片'),
      h('button', { class: 'btn ghost', onclick: () => close(), 'aria-label': '关闭' }, '关闭 ✕'),
    ),
    body,
  );
  let current = null;
  let history = [];
  let slider = null;
  let cardPaths = null; // 参数卡片里的路径分解（随滑杆刷新）

  let returnFocus = null;
  function open(id, { push = true } = {}) {
    if (!app.sim.has(id)) return;
    if (!current) returnFocus = document.activeElement;
    if (push && current && current !== id) history.push(current);
    current = id;
    render();
    drawer.classList.add('open');
    scrim.classList.add('open');
    // 键盘用户：焦点移到卡片标题
    requestAnimationFrame(() => body.querySelector('.card-title')?.focus({ preventScroll: true }));
  }
  function goBack() {
    const id = history.pop();
    if (id) open(id, { push: false });
  }
  function close() {
    drawer.classList.remove('open');
    scrim.classList.remove('open');
    current = null;
    history = [];
    app.highlight?.(null);
    if (returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && current) close();
  });

  function relItem(id) {
    const s = app.sim.spec(id);
    const c = changed(app.v[id], app.b[id]);
    return h('li', {}, h('button', { onclick: () => open(id) },
      h('span', { html: `${symHTML(s.sym)} ${esc(s.label)}` }),
      h('span', { class: `v ${c ? (app.v[id] >= app.b[id] ? 'up' : 'down') : ''}` }, fmt(s, app.v[id])),
    ));
  }

  function render() {
    const id = current;
    if (!id || !app.sim.has(id)) { close(); return; }
    const s = app.sim.spec(id);
    const v = app.v[id];
    const b = app.b[id];
    const k = kindOf(s);
    const mod = MODULES[s.mod];
    back.disabled = history.length === 0;
    body.innerHTML = '';
    slider = null;
    cardPaths = null;
    const isCh = changed(v, b);
    body.append(
      h('div', {},
        h('h2', { class: 'card-title', tabindex: '-1', html: `${esc(s.label)} <span style="font-size:0.8em">${symHTML(s.sym)}</span>` }),
        h('div', { class: 'tags' },
          h('span', { class: 'tag' }, `${mod.img ? `图${mod.img} ` : ''}${mod.name}`),
          h('span', { class: `tag k-${k.key}` }, k.text),
        ),
      ),
      h('div', { class: 'card-val' },
        h('span', { class: 'big num' }, fmt(s, v)),
        h('span', { class: 'cmp', html: isCh
          ? `基线 ${esc(fmt(s, b))}　<b class="${v >= b ? 'up' : 'down'}">${esc(fmtDelta(s, v - b))}</b> ${s.unit === 'pct' ? '' : esc(fmtRel(b, v))}`
          : '与基线（原图）一致' }),
      ),
    );
    if (s.expr != null) {
      const L = formulaLines(app.sim.graph, id, app.v, { html: true });
      const tbl = h('div', { class: 'fx-table' },
        h('div', { class: 'k' }, '公式'), h('div', { class: 'v', html: L.sym }),
        h('div', { class: 'k' }, '读法'), h('div', { class: 'v read', html: L.read }),
      );
      if (L.pron) tbl.append(h('div', { class: 'k' }, '拟音'), h('div', { class: 'v read' }, L.pron));
      tbl.append(h('div', { class: 'k' }, '代入'), h('div', { class: 'v subst', html: L.subst }));
      body.append(tbl);
      const T = formulaLines(app.sim.graph, id, app.v, { html: false });
      const plain = [`${s.label}（${k.text}）`, `公式：${T.sym}`, `读法：${T.read}`, ...(T.pron ? [`拟音：${T.pron}`] : []), `代入：${T.subst}`].join('\n');
      const copied = h('span', { class: 'hint', role: 'status' });
      const ta = h('textarea', { class: 'search', rows: 5, readonly: true, hidden: true, 'aria-label': '公式文本' }, plain);
      body.append(h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } },
        h('button', { class: 'btn', onclick: async () => {
          try { await navigator.clipboard.writeText(plain); copied.textContent = '已复制四行公式'; }
          catch { ta.hidden = false; ta.focus(); ta.select(); copied.textContent = '浏览器不允许自动复制，文本已选中'; }
        } }, '复制公式'), copied), ta);
    } else if (!s.fixed) {
      slider = makeSlider(app, id, { idPrefix: 'card-' });
      body.append(h('div', { class: 'card-ctl' }, slider.el));
    }
    if (s.expr != null && isCh) body.append(whyBlock(id));
    if (s.expr != null && isCh) { const sb = shapleyBlock(id); if (sb) body.append(sb); }
    if (s.note) body.append(h('p', { class: 'note' }, s.note));
    if (s.src) body.append(h('div', { class: 'src' }, `来源：${s.src}`));
    const TAB = { y25: 'y25', b26: 'b26', debt: 'debt', fb: 'fb', proj: 'proj', macro: 'b26' };
    if (TAB[s.mod]) {
      body.append(h('button', { class: 'btn', onclick: () => {
        const nid = id;
        close();
        app.go(TAB[s.mod]);
        requestAnimationFrame(() => {
          app.highlight(nid);
          const el = document.querySelector('#main .hl');
          if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          else app.flash('这个数字在该页的图里没有单独画出，可在参数面板或表格中找到');
        });
      } }, '在图上找到它 →'));
    }

    const deps = s.deps ?? [];
    if (deps.length) {
      const ul = h('ul');
      deps.forEach((d) => ul.append(relItem(d)));
      body.append(h('div', { class: 'rel' }, h('h4', {}, `由谁决定（直接上游 ${deps.length} 项）`), ul));
    }
    const dn = app.sim.graph.dependents.get(id) ?? [];
    if (dn.length) {
      const ul = h('ul');
      dn.slice(0, 40).forEach((d) => ul.append(relItem(d)));
      const all = app.sim.graph.downstream(id).length;
      body.append(h('div', { class: 'rel' }, h('h4', {}, `影响谁（直接下游 ${dn.length} 项，全部下游 ${all} 项）`), ul));
    }
    // 旋钮 → 关键结果的路径分解
    if (app.sim.isInput(id) && !s.fixed) {
      const down = new Set(app.sim.graph.downstream(id));
      const outs = MATRIX_COLS.filter(([c]) => down.has(c));
      if (outs.length) {
        const sel = h('select', { class: 'btn', 'aria-label': '选择要追踪的关键结果', style: { maxWidth: '100%' } },
          h('option', { value: '' }, '选一个关键结果…'),
          ...outs.map(([c, t]) => h('option', { value: c }, t)));
        const pv = createPaths(app);
        sel.addEventListener('change', () => (sel.value ? pv.show(id, sel.value) : pv.hide()));
        cardPaths = pv;
        body.append(h('div', { class: 'rel' }, h('h4', {}, '它沿哪几条路影响关键结果'), sel, pv.el));
      }
    }
  }

  function whyBlock(id) {
    const g = app.sim.graph;
    const s = app.sim.spec(id);
    const a = attribute(g, id, app.v, app.b);
    const box = h('div', { class: 'why' }, h('h4', {}, '为什么变了'));
    const path = mainPath(g, id, app.v, app.b);
    if (path.length > 1) {
      const crumbs = h('div', { class: 'crumbs' });
      path.forEach((p, i) => {
        if (i) crumbs.append(h('span', { class: 'arrow' }, '→'));
        crumbs.append(h('button', { class: `crumb ${p === id ? 'here' : ''}`, onclick: () => open(p) }, app.sim.spec(p).short ?? app.sim.spec(p).label));
      });
      box.append(h('div', { class: 'hint' }, '主要传导路径（每一步取贡献最大的上游）：'), crumbs);
    }
    const max = Math.max(...a.parts.map((p) => Math.abs(p.contrib)), Math.abs(a.interaction), 1e-12);
    const ul = h('div', { class: 'contrib' });
    for (const p of a.parts) {
      const ps = app.sim.spec(p.id);
      ul.append(h('button', { class: 'contrib-row', onclick: () => open(p.id) },
        h('span', { class: 'c-name' }, ps.label, h('small', {}, ` ${fmtDelta(ps, p.delta)}`)),
        h('span', { class: 'c-bar' }, h('i', { class: p.contrib >= 0 ? 'pos' : 'neg', style: { width: `${(Math.abs(p.contrib) / max) * 100}%` } })),
        h('span', { class: `c-val num ${p.contrib >= 0 ? 'up' : 'down'}` }, fmtDelta(s, p.contrib, { unit: false })),
      ));
    }
    if (Math.abs(a.interaction) > 1e-9 * Math.max(1, Math.abs(a.total))) {
      ul.append(h('div', { class: 'contrib-row' },
        h('span', { class: 'c-name' }, '交互项', h('small', {}, ' 几项同时变化的乘积效应')),
        h('span', { class: 'c-bar' }, h('i', { class: 'mix', style: { width: `${(Math.abs(a.interaction) / max) * 100}%` } })),
        h('span', { class: 'c-val num' }, fmtDelta(s, a.interaction, { unit: false })),
      ));
    }
    box.append(ul, h('div', { class: 'hint' }, `合计 ${fmtDelta(s, a.total)}。贡献 = 只让这一项上游变化、其他保持基线时本项的变化。`));
    return box;
  }

  /** 按"你改的参数"归因：只在上游改了至少两个参数时出现 */
  function shapleyBlock(id) {
    const g = app.sim.graph;
    const s = app.sim.spec(id);
    const r = shapley(g, app.sim.inputs, id);
    if (!r || r.ids.length < 2) return null;
    const box = h('div', { class: 'why shap' }, h('h4', {}, `按你改的 ${r.ids.length} 个参数归因`));
    const val = (x) => x.phi ?? x.alone;
    const max = Math.max(...r.rows.map((x) => Math.abs(val(x))), Math.abs(r.interaction), 1e-12);
    const ul = h('div', { class: 'contrib' });
    const tiny = 1e-9 * Math.max(1, Math.abs(r.total));
    const dt = (d) => (Math.abs(d) <= tiny ? '0' : fmtDelta(s, d, { unit: false }));
    for (const x of r.rows) {
      const ps = g.specs.get(x.id);
      const v = val(x);
      const zero = Math.abs(v) <= tiny;
      ul.append(h('button', { class: 'contrib-row', onclick: () => open(x.id) },
        h('span', { class: 'c-name' }, ps.label, h('small', {}, zero ? ' 在上游，但影响在公式里正好抵消' : ` 单独改：${dt(x.alone)}`)),
        h('span', { class: 'c-bar' }, h('i', { class: v >= 0 ? 'pos' : 'neg', style: { width: `${(Math.abs(v) / max) * 100}%` } })),
        h('span', { class: `c-val num ${zero ? '' : v >= 0 ? 'up' : 'down'}` }, dt(v)),
      ));
    }
    if (!r.exact) {
      ul.append(h('div', { class: 'contrib-row' },
        h('span', { class: 'c-name' }, '交互项', h('small', {}, ' 总变化 − 各参数单独效果之和')),
        h('span', { class: 'c-bar' }, h('i', { class: 'mix', style: { width: `${(Math.abs(r.interaction) / max) * 100}%` } })),
        h('span', { class: 'c-val num' }, fmtDelta(s, r.interaction, { unit: false })),
      ));
    }
    box.append(ul);
    const small = Math.abs(r.interaction) <= 1e-9 * Math.max(1, Math.abs(r.total));
    const note = r.exact
      ? `右侧数字是 Shapley 贡献，合计正好等于总变化 ${fmtDelta(s, r.total)}。各参数"单独改"的效果之和为 ${fmtDelta(s, r.sumAlone)}，${small ? '与总变化相同：这几个参数之间没有交互作用。' : `差额 ${fmtDelta(s, r.interaction)} 是交互作用，按对称原则分摊到相关参数上。`}`
      : `参数多于 10 个，只列出各参数单独改的效果，余下的 ${fmtDelta(s, r.interaction)} 为交互项。合计 ${fmtDelta(s, r.total)}。`;
    box.append(h('div', { class: 'hint' }, note));
    if (r.exact) {
      const tbl = h('div', { class: 'fx-table' },
        h('div', { class: 'k' }, '公式'), h('div', { class: 'v' }, 'φᵢ = Σₛ |S|! × (n − |S| − 1)! ÷ n! × [f(S ∪ {i}) − f(S)]（S 取遍不含 i 的参数组合）'),
        h('div', { class: 'k' }, '读法'), h('div', { class: 'v read' }, '参数 i 的贡献 = 把你改的参数按所有可能的先后顺序逐个改回来，i 被改动那一步带来的变化的平均值'),
        h('div', { class: 'k' }, '拟音'), h('div', { class: 'v read' }, 'φ 读"斐"；Σ 读"西格玛"；! 读"阶乘"'),
      );
      if (r.ids.length === 2) {
        const [a, b] = r.ids;
        const la = g.specs.get(a).short ?? g.specs.get(a).label;
        const rowA = r.rows.find((x) => x.id === a);
        const f = (d) => fmtDelta(s, d, { unit: false });
        tbl.append(h('div', { class: 'k' }, '代入'), h('div', { class: 'v subst' },
          `φ(${la}) = ½ × [单独改它 ${f(rowA.alone)}] + ½ × [两个都改 ${f(r.total)} − 只改另一个 ${f(r.rows.find((x) => x.id === b).alone)}] = ${f(rowA.phi)}`));
      } else {
        tbl.append(h('div', { class: 'k' }, '代入'), h('div', { class: 'v subst' }, `n = ${r.ids.length}，共 2^${r.ids.length} = ${2 ** r.ids.length} 种参数组合，各重算一次依赖图`));
      }
      box.append(tbl);
    }
    return box;
  }

  function update() {
    if (!current) return;
    if (slider && app.sim.isInput(current)) {
      // 只刷新数值与滑杆，避免拖动时整卡重绘
      slider.sync();
      const s = app.sim.spec(current);
      const big = body.querySelector('.big');
      if (big) big.textContent = fmt(s, app.v[current]);
      const cmp = body.querySelector('.cmp');
      const v = app.v[current];
      const b = app.b[current];
      if (cmp) cmp.innerHTML = changed(v, b)
        ? `基线 ${esc(fmt(s, b))}　<b class="${v >= b ? 'up' : 'down'}">${esc(fmtDelta(s, v - b))}</b> ${s.unit === 'pct' ? '' : esc(fmtRel(b, v))}`
        : '与基线（原图）一致';
      cardPaths?.update();
      return;
    }
    render();
  }

  return { el: [scrim, drawer], open, close, update, get current() { return current; } };
}
