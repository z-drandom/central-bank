// 把 layoutSankey 的结果画成 SVG，节点标签与模型节点绑定（可点击、显示变化量）。
import { layoutSankey } from './sankey.js';
import { esc } from './dom.js';
import { val, deltaParts } from './common.js';

const LH = 15;

function labelBlock(app, n) {
  const L = n.label ?? {};
  if (L.pos === 'none') return '';
  const id = n.bind ?? n.id;
  if (!app.sim.has(id)) return '';
  const s = app.sim.spec(id);
  const name = L.name ?? s.short ?? s.label;
  const value = val(app, id);
  const dp = deltaParts(app, id);
  let growth = '';
  if (L.growthId && app.sim.has(L.growthId)) {
    const g = app.v[L.growthId];
    // 上年基数为 0 时增幅没有意义（除以零），不显示
    if (Number.isFinite(g)) growth = `${g >= 0 ? '▲' : '▼'}${(Math.abs(g) * 100).toFixed(1)}%`;
  }
  const lines = [];
  if (L.inline) {
    lines.push({ cls: 't-name', text: name, extra: `<tspan class="t-val" dx="6">${esc(value)}</tspan>${growth ? `<tspan class="t-small" dx="5">${esc(growth)}</tspan>` : ''}` });
  } else {
    lines.push({ cls: `t-name ${L.nameCls ?? ''}`, text: name });
    lines.push({ cls: `t-val ${L.valCls ?? ''}`, text: value, extra: growth ? `<tspan class="t-small" dx="5">${esc(growth)}</tspan>` : '' });
  }
  if (dp) lines.push({ cls: dp.up ? 't-up' : 't-down', text: dp.text });
  const hgt = lines.length * LH;
  const cy = (n.y0 + n.y1) / 2;
  let x, y, anchor;
  const pos = L.pos ?? 'right';
  if (pos === 'left') { x = n.x0 - 7; y = cy - hgt / 2 + 11; anchor = 'end'; }
  else if (pos === 'above') { x = (n.x0 + n.x1) / 2 + (L.dx ?? 0); y = n.y0 - hgt + 8 + (L.dy ?? 0); anchor = L.anchor ?? 'middle'; }
  else if (pos === 'below') { x = (n.x0 + n.x1) / 2 + (L.dx ?? 0); y = n.y1 + 14 + (L.dy ?? 0); anchor = L.anchor ?? 'middle'; }
  else { x = n.x1 + 7; y = cy - hgt / 2 + 11; anchor = 'start'; }
  if (L.dx && pos !== 'above' && pos !== 'below') x += L.dx;
  if (L.dy && pos !== 'above' && pos !== 'below') y += L.dy;
  const body = lines.map((l, i) => `<text class="${l.cls}" text-anchor="${anchor}" y="${i * LH}">${esc(l.text)}${l.extra ?? ''}</text>`).join('');
  return `<g class="halo" data-node="${id}" data-sk="${n.id}" tabindex="0" role="button" aria-label="${esc(name)} ${esc(value)}" transform="translate(${x.toFixed(1)},${y.toFixed(1)})">${body}</g>`;
}

export function renderSankey(app, def) {
  const lay = layoutSankey(def);
  const pad = def.padTop ?? 30;
  const W = def.width;
  const H = lay.height + pad + (def.padBottom ?? 20);
  let links = '';
  let flows = '';
  for (const l of lay.links) {
    links += `<path class="sk-link c-${l.color ?? 'link'}" d="${l.path}" data-node="${l.bind ?? l.t}" data-s="${l.s}" data-t="${l.t}"><title>${esc(l.title ?? '')}</title></path>`;
    if (l.w > 2.5 && def.flow !== false) {
      flows += `<path class="sk-flow" d="${l.center}" stroke-width="${Math.min(1.6, l.w / 3).toFixed(2)}"/>`;
    }
  }
  let nodes = '';
  let labels = '';
  for (const n of lay.nodes) {
    if (n.value <= 0 && !n.keep) continue;
    const id = n.bind ?? n.id;
    const hgt = Math.max(n.y1 - n.y0, 1);
    nodes += `<rect data-node="${id}" data-sk="${n.id}" class="fill-${n.color ?? 'ink'}" x="${n.x0}" y="${n.y0.toFixed(2)}" width="${n.x1 - n.x0}" height="${hgt.toFixed(2)}" rx="1.5"><title>${esc(app.sim.has(id) ? app.sim.spec(id).label : n.id)}</title></rect>`;
    labels += labelBlock(app, n);
  }
  const extra = typeof def.extra === 'function' ? def.extra(lay) : '';
  return `<svg viewBox="0 ${-pad} ${W} ${H}" role="group" aria-label="${esc(def.aria ?? '资金流向图')}">${links}${flows}${nodes}${extra}${labels}</svg>`;
}
