// 视图共用的小工具：SVG 标签、变化量、颜色
import { fmt, fmtDelta, dispKind } from '../model/format.js';
import { changed } from '../engine/graph.js';
import { esc } from './dom.js';

export function isChanged(app, id) {
  return app.sim.has(id) && changed(app.v[id], app.b[id]);
}

export function val(app, id, o = {}) {
  return fmt(app.sim.spec(id), app.v[id], { unit: false, ...o });
}

export function deltaParts(app, id, scale) {
  if (!isChanged(app, id)) return null;
  const s = app.sim.spec(id);
  const d = app.v[id] - app.b[id];
  let k = dispKind(s);
  if (scale && (k === 'yi' || k === 'wanyi')) k = scale;
  let txt;
  if (k === 'pct') {
    const a = Math.abs(d) * 100;
    txt = `${d >= 0 ? '+' : '−'}${a.toFixed(a < 0.01 ? (a < 0.001 ? 4 : 3) : 2)}pp`;
  }
  else if (k === 'wanyi') txt = `${d >= 0 ? '+' : '−'}${(Math.abs(d) / 1e4).toFixed(2)}`;
  else if (k === 'yi') txt = `${d >= 0 ? '+' : '−'}${Math.abs(d).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  else txt = fmtDelta(s, d, { unit: false });
  return { up: d >= 0, text: `${d >= 0 ? '▲' : '▼'}${txt}` };
}

/** SVG 文字标签：名称 / 数值 / 变化量，整组可点击打开公式卡片 */
export function svgLabel(app, id, x, y, o = {}) {
  if (!app.sim.has(id)) return '';
  const s = app.sim.spec(id);
  const anchor = o.anchor ?? 'start';
  const name = o.name ?? s.short ?? s.label;
  const value = o.value ?? val(app, id);
  const dp = deltaParts(app, id);
  const lines = [];
  let dy = 0;
  if (name !== '') {
    lines.push(`<text class="t-name ${o.nameCls ?? ''}" text-anchor="${anchor}" y="${dy}">${esc(name)}</text>`);
    dy += o.lh ?? 15;
  }
  lines.push(`<text class="t-val ${o.valCls ?? ''}" text-anchor="${anchor}" y="${dy}">${esc(value)}${o.suffix ? `<tspan class="t-small"> ${esc(o.suffix)}</tspan>` : ''}</text>`);
  if (dp && o.delta !== false) {
    if (o.inlineDelta) {
      lines[lines.length - 1] = lines[lines.length - 1].replace('</text>', `<tspan class="${dp.up ? 't-up' : 't-down'}" dx="6">${esc(dp.text)}</tspan></text>`);
    } else {
      dy += 14;
      lines.push(`<text class="${dp.up ? 't-up' : 't-down'}" text-anchor="${anchor}" y="${dy}">${esc(dp.text)}</text>`);
    }
  }
  return `<g data-node="${id}" transform="translate(${x.toFixed(1)},${y.toFixed(1)})">${lines.join('')}</g>`;
}

export function deltaHTML(app, id) {
  const dp = deltaParts(app, id);
  return dp ? `<span class="${dp.up ? 'up' : 'down'}">${esc(dp.text)}</span>` : '';
}

export const COLOR = { rev: 'rev', exp: 'exp', def: 'def', xfer: 'xfer', hid: 'hid', ink: 'ink', muted: 'muted', gold: 'gold' };

/** 账本式恒等式的一项：名称在上、数值在下，可点击 */
export function termHTML(app, id, o = {}) {
  if (!app.sim.has(id)) return '';
  const s = app.sim.spec(id);
  const dp = deltaParts(app, id, o.fmt?.scale);
  const auto = !app.sim.isInput(id);
  return `<span class="term ${o.cls ?? ''} ${dp ? 'changed' : ''}" data-node="${id}" tabindex="0" role="button" title="${esc(s.label)}${auto ? '（公式计算）' : '（参数）'}">
    <span class="term-l">${esc(o.label ?? s.short ?? s.label)}</span>
    <span class="term-v num">${esc(val(app, id, o.fmt))}</span>
    ${dp ? `<span class="term-d ${dp.up ? 'up' : 'down'}">${esc(dp.text)}</span>` : ''}
  </span>`;
}

/** 一行恒等式：items = [id | {id,label,cls} | '+' | '−' | '=' | '×' | '÷'] */
export function ledgerHTML(app, items, o = {}) {
  const parts = items.map((x) => {
    if (typeof x === 'string' && x.length <= 2 && !app.sim.has(x)) return `<span class="op">${esc(x)}</span>`;
    const obj = typeof x === 'string' ? { id: x } : x;
    return termHTML(app, obj.id, o.scale ? { fmt: { scale: o.scale }, ...obj } : obj);
  });
  return `<div class="ledger ${o.cls ?? ''}">${o.title ? `<span class="ledger-t">${esc(o.title)}</span>` : ''}${parts.join('')}</div>`;
}
