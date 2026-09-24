// 情景对比：把当前状态存为 A / B，与原图基线、当前状态并排比较；可复制/粘贴情景代码。
import { h, esc, load, save } from './dom.js';
import { Sim } from '../model/sim.js';
import { fmt } from '../model/format.js';
import { encodeScenario, decodeScenario } from '../model/scenario-code.js';

const KEY = 'fiscal-sandbox-scenarios-v1';
const ROWS = [
  ['r26', '2026 全国收入'], ['e26', '2026 全国支出'], ['d26', '2026 全国赤字'], ['drate26', '2026 赤字率'],
  ['oth26', '中央本级"其它"支出'], ['el26', '地方支出'], ['self26', '地方自给率'],
  ['gov1', '2026 年末政府债务'], ['debt_gdp1', '2026 年末负债率'], ['broad_gdp1', '含隐债负债率'], ['intburden26', '付息/收入'],
  ['p_d_2030', '2030 负债率'], ['p_d_2035', '2035 负债率'], ['p_w_2035', '2035 含隐债负债率'], ['p_ib_2035', '2035 付息/收入'], ['p_iball_2035', '2035 全口径付息/收入'],
  ['fc_gap', '四本账广义赤字'],
];

export function createScenarios(app) {
  let store = load(KEY, { A: null, B: null });
  const table = h('div', { class: 'tbl-wrap' });
  const codeBox = h('textarea', { id: 'scen-code', class: 'search', rows: 2, placeholder: '在这里粘贴情景代码，或点"复制当前情景代码"', 'aria-label': '情景代码', style: { fontFamily: 'var(--f-mono)', fontSize: '12px', resize: 'vertical' } });
  const msg = h('span', { class: 'hint', role: 'status' });
  const saveAs = (k) => {
    store[k] = { sc: app.sim.toScenario(), at: new Date().toLocaleString('zh-CN', { hour12: false }) };
    save(KEY, store);
    update();
    app.flash(`已存为情景 ${k}`);
  };
  const loadIt = (k) => {
    if (!store[k]) return;
    const s = new Sim();
    s.fromScenario(store[k].sc);
    app.restore(s.snapshot(), `已载入情景 ${k}`);
  };
  const el = h('div', { class: 'sheet', id: 'scenarios' },
    h('h3', {}, '情景对比', h('small', {}, '把当前的参数与规则存成 A、B，与原图并排比较')),
    h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' } },
      h('button', { class: 'btn primary', onclick: () => saveAs('A') }, '当前存为 A'),
      h('button', { class: 'btn primary', onclick: () => saveAs('B') }, '当前存为 B'),
      h('button', { class: 'btn', onclick: () => loadIt('A') }, '载入 A'),
      h('button', { class: 'btn', onclick: () => loadIt('B') }, '载入 B'),
    ),
    table,
    h('div', { style: { display: 'grid', gap: '6px', marginTop: '12px' } },
      codeBox,
      h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' } },
        h('button', { class: 'btn', onclick: copyCode }, '复制当前情景代码'),
        h('button', { class: 'btn', onclick: pasteCode }, '按代码载入'),
        msg,
      ),
    ),
  );

  async function copyCode() {
    const code = encodeScenario(app.sim.toScenario());
    codeBox.value = code;
    try {
      await navigator.clipboard.writeText(code);
      msg.textContent = '已复制。把它发给别人，对方粘贴后点"按代码载入"即可复现。';
    } catch {
      codeBox.focus();
      codeBox.select();
      msg.textContent = '浏览器不允许自动复制，代码已选中，请手动复制。';
    }
  }
  function pasteCode() {
    try {
      const sc = decodeScenario(codeBox.value);
      const s = new Sim();
      s.fromScenario(sc);
      app.restore(s.snapshot(), '已按代码载入情景');
      msg.textContent = `载入成功：${Object.keys(sc.i).length} 个参数、${Object.keys(sc.m).length} 条规则与原图不同。`;
    } catch (e) {
      msg.textContent = `无法识别这段代码：${e.message}。代码应以 FS1. 开头。`;
    }
  }

  function valuesOf(entry) {
    if (!entry) return null;
    const s = new Sim();
    s.fromScenario(entry.sc);
    return s.values;
  }

  function update() {
    store = load(KEY, store);
    const A = valuesOf(store.A);
    const B = valuesOf(store.B);
    const cell = (vals, id, ref) => {
      if (!vals || vals[id] == null) return '<td class="n hint">—</td>';
      const spec = app.sim.spec(id);
      const diff = ref != null && Math.abs(vals[id] - ref) > 1e-9 * Math.max(1, Math.abs(ref));
      return `<td class="n" style="${diff ? 'font-weight:600' : ''}">${esc(fmt(spec, vals[id], { unit: false, dp: spec.unit === 'pct' ? 1 : undefined }))}</td>`;
    };
    const desc = (e) => (e ? `<div class="hint" style="font-weight:400">${esc(e.at)} · 改了 ${Object.keys(e.sc.i).length} 项</div>` : '<div class="hint" style="font-weight:400">未保存</div>');
    table.innerHTML = `<table class="tbl"><thead><tr><th>指标</th><th class="n">原图基线</th><th class="n">情景 A${desc(store.A)}</th><th class="n">情景 B${desc(store.B)}</th><th class="n">当前</th></tr></thead><tbody>
      ${ROWS.filter(([id]) => app.sim.has(id)).map(([id, label]) => `<tr class="click" data-node="${id}"><td>${esc(label)}</td>${cell(app.b, id)}${cell(A, id, app.b[id])}${cell(B, id, app.b[id])}${cell(app.v, id, app.b[id])}</tr>`).join('')}
    </tbody></table>`;
  }

  update();
  return { el, update };
}
