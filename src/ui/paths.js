// 路径分解面板：A 通过哪几条公式路径影响 B（链式法则），与直接重算对照。
import { h, esc } from './dom.js';
import { fmtDelta, fmtExact } from '../model/format.js';
import { pathEffects } from '../model/paths.js';
import { stepOf, stepText } from '../model/sensitivity.js';

export function createPaths(app) {
  let pair = null;
  const el = h('div', { class: 'paths', hidden: true, role: 'region', 'aria-label': '路径分解' });

  function show(from, to) {
    pair = [from, to];
    el.hidden = false;
    render();
    requestAnimationFrame(() => el.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
  }
  function hide() { pair = null; el.hidden = true; el.innerHTML = ''; }

  function render() {
    if (!pair) return;
    const g = app.sim.graph;
    const [from, to] = pair;
    if (!g.specs.has(from) || !g.specs.has(to) || !g.isInput(from)) { hide(); return; }
    const A = g.specs.get(from);
    const B = g.specs.get(to);
    const step = stepOf(A);
    const r = pathEffects(g, app.v, from, to, { k: 5 });
    el.innerHTML = '';
    const head = h('div', { class: 'paths-head' },
      h('h4', {}, `路径分解：${A.label} → ${B.label}`),
      h('button', { class: 'btn ghost', type: 'button', onclick: hide, 'aria-label': '关闭路径分解' }, '✕'),
    );
    el.append(head);
    if (!r) {
      el.append(h('p', { class: 'note' }, `在当前平衡规则下，${A.label}和${B.label}之间没有公式路径：无论怎么调，它都不会影响后者。换一个平衡规则，路径可能就接上了。`));
      return;
    }
    const direct = g.compute({ ...app.sim.inputs, [from]: app.sim.inputs[from] + step })[to] - app.v[to];
    const dB = (x) => fmtExact(B, x, { delta: true });
    el.append(h('p', { class: 'hint', style: { margin: '0 0 8px' } },
      `${A.label}${stepText(A, step).replace('±', '+')}。两者之间共有 ${r.count.toLocaleString('en-US')} 条公式路径，经过 ${r.nodes} 个数字；下面是贡献最大的 ${r.paths.length} 条，每个方块下的数字是沿这条路传到该处的变化量。`));
    const list = h('div', { class: 'path-list' });
    for (const p of r.paths) {
      const crumbs = h('div', { class: 'crumbs' });
      let cum = step;
      p.path.forEach((id, i) => {
        if (i) { cum *= p.edges[i - 1]; crumbs.append(h('span', { class: 'arrow' }, '→')); }
        const s = g.specs.get(id);
        crumbs.append(h('button', { class: 'crumb path-node', type: 'button', onclick: () => app.openCard(id) },
          s.short ?? s.label, h('small', { class: `num ${cum >= 0 ? 'up' : 'down'}` }, fmtDelta(s, cum))));
      });
      list.append(h('div', { class: 'path-row' }, crumbs, h('b', { class: `num path-sum ${p.prod >= 0 ? 'up' : 'down'}` }, dB(p.prod * step))));
    }
    const restTiny = Math.abs(r.rest * step) <= 1e-9 * Math.max(1, Math.abs(r.total * step));
    if (r.count > r.paths.length && !restTiny) {
      list.append(h('div', { class: 'path-row' }, h('span', { class: 'hint' }, `其余 ${(r.count - r.paths.length).toLocaleString('en-US')} 条路径合计`), h('b', { class: 'num path-sum' }, dB(r.rest * step))));
    }
    el.append(list);
    const vals = r.paths.map((p) => p.prod * step).concat(r.count > r.paths.length && !restTiny ? [r.rest * step] : []);
    const sumText = vals.map((v, i) => {
      const t = dB(v).replace(/^[+−]/, '');
      if (i === 0) return v < 0 ? `−${t}` : t;
      return v < 0 ? ` − ${t}` : ` + ${t}`;
    }).join('');
    const chain = r.total * step;
    const same = Math.abs(chain - direct) <= 1e-6 * Math.max(1, Math.abs(direct));
    el.append(h('div', { class: 'fx-table', style: { marginTop: '10px' } },
      h('div', { class: 'k' }, '公式'), h('div', { class: 'v' }, 'ΔB ≈ Σ路径 [ Π边 ∂(下游)/∂(上游) ] × ΔA'),
      h('div', { class: 'k' }, '读法'), h('div', { class: 'v read' }, 'A 对 B 的影响 = 每条路径上各段"局部影响"相乘，再把所有路径加起来（链式法则）'),
      h('div', { class: 'k' }, '拟音'), h('div', { class: 'v read' }, '∂ 读"偏"；Σ 读"西格玛"（求和）；Π 读"派"（连乘）'),
      h('div', { class: 'k' }, '代入'), h('div', { class: 'v subst', html: `ΔB ≈ ${esc(sumText)} = <b>${esc(dB(chain))}</b>；直接重算 = <b>${esc(dB(direct))}</b>${same ? '（两者相等：这条链上都是线性关系）' : `（差额 ${esc(dB(direct - chain))} 来自非线性：乘除、取最大/最小等，局部斜率随位置变化）`}` }),
    ));
  }

  return { el, show, hide, update: render };
}
