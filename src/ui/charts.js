// 折线图与分解柱状图（SVG 字符串）。点位带 data-node，可点开公式卡片。
import { esc } from './dom.js';

// 刻度与标签里的负号统一用减号 −（与全站数字格式一致）
const neg = (x) => String(x).replace(/^-/, '−');

function niceTicks(lo, hi, n = 5) {
  const span = hi - lo || 1;
  const step0 = span / n;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n) ?? mag * 10;
  const out = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-12; t += step) out.push(+t.toFixed(10));
  return out;
}

/**
 * series: [{ label, cls, pts: [{x, y, id}], base: [{x, y}] }]
 * refs: [{ y, label }]
 */
export function lineChart({ series, width = 640, height = 260, yFmt = (v) => `${(v * 100).toFixed(0)}%`, yMin, yMax, refs = [], title = '' }) {
  // 除以零等情况会产生非有限值：这些点不画，整条线都无法计算时给出说明
  const fin = (p) => Number.isFinite(p.y);
  series = series.map((se) => ({ ...se, pts: se.pts.filter(fin), base: se.base?.filter(fin) })).filter((se) => se.pts.length);
  refs = refs.filter((r) => Number.isFinite(r.y));
  if (!series.length) return `<svg viewBox="0 0 ${width} 60" role="img" aria-label="${esc(title)}：无法计算"><text x="12" y="34" class="t-small">无法计算：分母为 0（例如收入被调到 0）</text></svg>`;
  const m = { l: 46, r: 96, t: 16, b: 26 };
  const W = width - m.l - m.r;
  const H = height - m.t - m.b;
  const all = series.flatMap((s) => [...s.pts, ...(s.base ?? [])]);
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y).concat(refs.map((r) => r.y));
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let lo = yMin ?? Math.min(0, ...ys);
  let hi = yMax ?? Math.max(...ys) * 1.08;
  if (hi - lo < 1e-9) hi = lo + 1;
  const ticks = niceTicks(lo, hi);
  lo = Math.min(lo, ticks[0]);
  hi = Math.max(hi, ticks[ticks.length - 1]);
  const X = (x) => m.l + ((x - x0) / (x1 - x0 || 1)) * W;
  const Y = (y) => m.t + (1 - (y - lo) / (hi - lo)) * H;
  let s = '';
  for (const t of ticks) {
    s += `<line class="grid-line" x1="${m.l}" x2="${m.l + W}" y1="${Y(t)}" y2="${Y(t)}"/><text class="axis-t" x="${m.l - 6}" y="${Y(t) + 4}" text-anchor="end">${esc(neg(yFmt(t)))}</text>`;
  }
  for (let x = x0; x <= x1; x++) {
    if ((x - x0) % 2 === 0 || (x === x1 && (x1 - x0) % 2 === 0)) s += `<text class="axis-t" x="${X(x)}" y="${m.t + H + 17}" text-anchor="middle">${x}</text>`;
  }
  for (const r of refs) {
    s += `<line x1="${m.l}" x2="${m.l + W}" y1="${Y(r.y)}" y2="${Y(r.y)}" stroke="var(--gold)" stroke-dasharray="4 4"/><text x="${m.l + W + 4}" y="${Y(r.y) + 4}" class="t-small" style="fill:var(--gold)">${esc(r.label)}</text>`;
  }
  const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
  // 末端标签避让：按 y 排序后保证间距
  const ends = series.map((se, i) => ({ i, y: Y(se.pts[se.pts.length - 1].y) })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < 30) ends[k].y = ends[k - 1].y + 30;
  const endY = new Map(ends.map((e) => [e.i, e.y]));
  for (const [si, se] of series.entries()) {
    if (se.base && se.base.length && se.base.some((p, i) => !se.pts[i] || Math.abs(p.y - se.pts[i].y) > 1e-9)) {
      s += `<path d="${path(se.base)}" fill="none" class="${se.cls}" stroke-width="1.5" stroke-dasharray="5 4" opacity="0.55"/>`;
    }
    if (se.area) {
      s += `<path d="${path(se.pts)}L${X(se.pts[se.pts.length - 1].x)},${Y(Math.max(lo, 0))}L${X(se.pts[0].x)},${Y(Math.max(lo, 0))}Z" class="${se.cls.replace('stroke', 'fill')}" opacity="0.08"/>`;
    }
    s += `<path d="${path(se.pts)}" fill="none" class="${se.cls}" stroke-width="${se.thin ? 1.6 : 2.4}" stroke-linejoin="round"${se.thin ? ' stroke-dasharray="1 0"' : ''}/>`;
    if (se.thin) {
      // 对照线：只画小方块标记，不可点击
      for (const p of se.pts) s += `<rect x="${(X(p.x) - 2.5).toFixed(1)}" y="${(Y(p.y) - 2.5).toFixed(1)}" width="5" height="5" class="${se.cls.replace('stroke', 'fill')}"><title>${esc(se.label)} ${p.x}：${esc(neg(yFmt(p.y)))}</title></rect>`;
    } else for (const p of se.pts) {
      s += `<circle data-node="${p.id}" cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${p === se.pts[se.pts.length - 1] ? 4.5 : 3}" class="${se.cls.replace('stroke', 'fill')}"><title>${p.x}：${esc(neg(yFmt(p.y)))}</title></circle>`;
    }
    const last = se.pts[se.pts.length - 1];
    const ly = endY.get(si);
    s += `<text ${last.id ? `data-node="${last.id}"` : ''} x="${X(last.x) + 8}" y="${ly + 4}" class="t-name" style="font-size:12px">${esc(neg(yFmt(last.y)))}</text>`;
    s += `<text x="${X(last.x) + 8}" y="${ly + 18}" class="t-small">${esc(se.label)}</text>`;
  }
  return `<svg viewBox="0 0 ${width} ${height}" role="group" aria-label="${esc(title)}">${s}</svg>`;
}

/**
 * 堆叠柱：每年若干分量（可正可负），外加净值圆点。
 * years: [y], parts: [{ label, cls, vals: [{v, id}] }], net: [{v, id}]
 */
export function stackChart({ years, parts, net, width = 640, height = 240, yFmt = (v) => `${(v * 100).toFixed(1)}`, unit = '个百分点', title = '' }) {
  // 非有限值（除以零）按 0 处理且不画柱
  const fz = (x) => (Number.isFinite(x) ? x : 0);
  parts = parts.map((pt) => ({ ...pt, vals: pt.vals.map((x) => ({ ...x, v: fz(x.v), bad: !Number.isFinite(x.v) })) }));
  net = net.map((x) => ({ ...x, v: fz(x.v) }));
  const m = { l: 46, r: 12, t: 14, b: 26 };
  const W = width - m.l - m.r;
  const H = height - m.t - m.b;
  let lo = 0, hi = 0;
  years.forEach((_, i) => {
    let p = 0, n = 0;
    for (const part of parts) {
      const v = part.vals[i].v;
      if (v >= 0) p += v; else n += v;
    }
    hi = Math.max(hi, p, net[i].v);
    lo = Math.min(lo, n, net[i].v);
  });
  const ticks = niceTicks(lo, hi, 5);
  lo = Math.min(lo, ticks[0]);
  hi = Math.max(hi, ticks[ticks.length - 1]);
  const Y = (y) => m.t + (1 - (y - lo) / (hi - lo || 1)) * H;
  const bw = (W / years.length) * 0.56;
  const X = (i) => m.l + (W / years.length) * (i + 0.5);
  let s = '';
  for (const t of ticks) s += `<line class="grid-line" x1="${m.l}" x2="${m.l + W}" y1="${Y(t)}" y2="${Y(t)}"/><text class="axis-t" x="${m.l - 6}" y="${Y(t) + 4}" text-anchor="end">${esc(neg(yFmt(t)))}</text>`;
  s += `<line x1="${m.l}" x2="${m.l + W}" y1="${Y(0)}" y2="${Y(0)}" class="stroke-muted"/>`;
  years.forEach((yr, i) => {
    let p = 0, n = 0;
    for (const part of parts) {
      const { v, id, bad } = part.vals[i];
      if (bad) continue;
      const y0 = v >= 0 ? p : n;
      const y1 = y0 + v;
      if (v >= 0) p = y1; else n = y1;
      const top = Y(Math.max(y0, y1));
      const hh = Math.abs(Y(y0) - Y(y1));
      s += `<rect data-node="${id}" x="${(X(i) - bw / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(hh, 0.5).toFixed(1)}" class="${part.cls}"><title>${yr} ${esc(part.label)}：${esc(neg(yFmt(v)))} ${unit}</title></rect>`;
    }
    s += `<circle data-node="${net[i].id}" cx="${X(i)}" cy="${Y(net[i].v)}" r="4.2" class="fill-ink" stroke="var(--surface)" stroke-width="1.5"><title>${yr} 负债率变动：${esc(neg(yFmt(net[i].v)))} ${unit}</title></circle>`;
    s += `<text class="axis-t" x="${X(i)}" y="${m.t + H + 17}" text-anchor="middle">${String(yr).slice(2)}</text>`;
  });
  return `<svg viewBox="0 0 ${width} ${height}" role="group" aria-label="${esc(title)}">${s}</svg>`;
}

/** 扇形图：p10–p90 与 p25–p75 两层区间 + 中位数 + 当前路径 */
export function fanChart({ years, q, current, width = 760, height = 280, refs = [], yFmt = (v) => `${(v * 100).toFixed(0)}%`, title = '' }) {
  const m = { l: 46, r: 110, t: 16, b: 26 };
  const W = width - m.l - m.r;
  const H = height - m.t - m.b;
  const all = [...q.p10, ...q.p90, ...current.map((p) => p.y), ...refs.map((r) => r.y)];
  let lo = Math.min(...all) * 0.96;
  let hi = Math.max(...all) * 1.03;
  const ticks = niceTicks(lo, hi);
  lo = Math.min(lo, ticks[0]);
  hi = Math.max(hi, ticks[ticks.length - 1]);
  const x0 = years[0], x1 = years[years.length - 1];
  const X = (x) => m.l + ((x - x0) / (x1 - x0 || 1)) * W;
  const Y = (y) => m.t + (1 - (y - lo) / (hi - lo)) * H;
  const band = (a, b, cls) => `<path d="${years.map((y, i) => `${i ? 'L' : 'M'}${X(y).toFixed(1)},${Y(b[i]).toFixed(1)}`).join('')}${[...years].reverse().map((y, i) => `L${X(y).toFixed(1)},${Y(a[years.length - 1 - i]).toFixed(1)}`).join('')}Z" class="${cls}"/>`;
  let s = '';
  for (const t of ticks) s += `<line class="grid-line" x1="${m.l}" x2="${m.l + W}" y1="${Y(t)}" y2="${Y(t)}"/><text class="axis-t" x="${m.l - 6}" y="${Y(t) + 4}" text-anchor="end">${esc(neg(yFmt(t)))}</text>`;
  years.forEach((x, i) => { if (i % 2 === 0 || (i === years.length - 1 && i % 2 === 0)) s += `<text class="axis-t" x="${X(x)}" y="${m.t + H + 17}" text-anchor="middle">${x}</text>`; });
  for (const r of refs) s += `<line x1="${m.l}" x2="${m.l + W}" y1="${Y(r.y)}" y2="${Y(r.y)}" stroke="var(--gold)" stroke-dasharray="4 4"/><text x="${m.l + W + 4}" y="${Y(r.y) + 4}" class="t-small" style="fill:var(--gold)">${esc(r.label)}</text>`;
  s += band(q.p10, q.p90, 'fan-outer');
  s += band(q.p25, q.p75, 'fan-inner');
  s += `<path d="${years.map((y, i) => `${i ? 'L' : 'M'}${X(y).toFixed(1)},${Y(q.p50[i]).toFixed(1)}`).join('')}" fill="none" class="stroke-xfer" stroke-width="1.5" stroke-dasharray="5 4"/>`;
  s += `<path d="${current.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('')}" fill="none" class="stroke-xfer" stroke-width="2.4"/>`;
  for (const p of current) s += `<circle data-node="${p.id}" cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3" class="fill-xfer"/>`;
  const li = years.length - 1;
  const lx = X(x1) + 8;
  s += `<text x="${lx}" y="${Y(q.p90[li]) + 4}" class="t-small">90%：${esc(neg(yFmt(q.p90[li])))}</text>`;
  s += `<text x="${lx}" y="${Y(current[current.length - 1].y) + 4}" class="t-name" style="font-size:12px">当前 ${esc(neg(yFmt(current[current.length - 1].y)))}</text>`;
  s += `<text x="${lx}" y="${Y(q.p10[li]) + 4}" class="t-small">10%：${esc(neg(yFmt(q.p10[li])))}</text>`;
  return `<svg viewBox="0 0 ${width} ${height}" role="group" aria-label="${esc(title)}">${s}</svg>`;
}
