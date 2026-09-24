// 数字格式化与公式卡片（公式 / 读法 / 拟音 / 代入）生成。
import { render } from '../engine/expr.js';

const nf2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export const MINUS = '−';

function signed(s, v) {
  return v < 0 ? MINUS + s.replace(/^-/, '') : s;
}

/** 该节点展示用的量纲：'yi' 亿元 | 'wanyi' 万亿元(亿元存储) | 'wy' 万亿元 | 'pct' | 'num' */
export function dispKind(spec) {
  if (spec.unit === 'yi') return spec.disp === 'wy' ? 'wanyi' : 'yi';
  return spec.unit;
}

export function unitText(kind) {
  return { yi: '亿元', wanyi: '万亿元', wy: '万亿元', pct: '', num: '' }[kind] ?? '';
}

/** 普通展示（卡片、图表标签） */
export function fmt(spec, v, { unit = true, dp, scale } = {}) {
  if (v == null || !Number.isFinite(v)) return '—';
  let k = dispKind(spec);
  if (scale && (k === 'yi' || k === 'wanyi')) k = scale;
  let s;
  switch (k) {
    case 'yi': s = signed(nf2.format(Math.abs(v)), v); break;
    case 'wanyi': s = signed((Math.abs(v) / 1e4).toFixed(dp ?? 2), v); break;
    case 'wy': s = signed(Math.abs(v).toFixed(dp ?? 2), v); break;
    case 'pct': s = signed((Math.abs(v) * 100).toFixed(dp ?? spec.dp ?? 2), v) + '%'; break;
    default: s = signed(Math.abs(v).toFixed(dp ?? 2), v);
  }
  const u = unitText(k);
  return unit && u ? `${s} ${u}` : s;
}

/** 变化量展示：带正负号 */
export function fmtDelta(spec, d, { unit = true } = {}) {
  if (d == null || !Number.isFinite(d)) return '—';
  const k = dispKind(spec);
  let s;
  const a = Math.abs(d);
  switch (k) {
    case 'yi': s = nf2.format(a); break;
    case 'wanyi': s = (a / 1e4).toFixed(2); break;
    case 'wy': s = a.toFixed(2); break;
    case 'pct': s = (a * 100).toFixed(a * 100 < 0.01 ? (a * 100 < 0.001 ? 4 : 3) : 2) + ' 个百分点'; break;
    default: s = a.toFixed(2);
  }
  const u = k === 'pct' ? '' : unitText(k);
  return (d >= 0 ? '+' : MINUS) + s + (unit && u ? ` ${u}` : '');
}

/** 相对变化 */
export function fmtRel(base, now) {
  if (Math.abs(base) < 1e-12 || !Number.isFinite(now / base)) return '';
  const r = now / base - 1;
  return (r >= 0 ? '+' : MINUS) + (Math.abs(r) * 100).toFixed(1) + '%';
}

/** 紧凑数字（图表用），亿元 ≥ 1 万亿时仍按亿元显示两位小数，与原图一致 */
export function fmtShort(spec, v) {
  return fmt(spec, v, { unit: false });
}

export function fmtPlain(v) {
  return signed(nf0.format(Math.abs(v)), v);
}

// ---------- 符号 ----------
const PRON = {
  'ε': '艾普西隆', 'Δ': '德尔塔', 'Σ': '西格玛', 'σ': '西格玛', 'τ': '陶', 'θ': '西塔', 'ρ': '柔',
  'α': '阿尔法', 'β': '贝塔', 'κ': '卡帕', 'λ': '兰姆达', 'δ': '德尔塔（小写）', 'γ': '伽马', 'ω': '欧米伽',
};

export function symHTML(sym) {
  if (!sym) return '';
  let s = escapeHTML(sym);
  s = s.replace(/\^\{([^}]*)\}/g, '<sup>$1</sup>').replace(/_\{([^}]*)\}/g, '<sub>$1</sub>');
  s = s.replace(/\^([A-Za-z0-9*])/g, '<sup>$1</sup>').replace(/_([A-Za-z0-9])/g, '<sub>$1</sub>');
  return `<i class="sym">${s}</i>`;
}

export function symText(sym) {
  if (!sym) return '';
  return sym.replace(/\^\{([^}]*)\}/g, '^$1').replace(/_\{([^}]*)\}/g, '_$1');
}

export function escapeHTML(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function operandScale(graph, spec) {
  // 公式代入时，亿元类操作数统一用结果的尺度显示，避免"万亿 + 亿"混排
  const k = dispKind(spec);
  if (k === 'wanyi') return 'wanyi';
  if (k === 'yi') return 'yi';
  if (spec.deps?.some((d) => graph.specs.get(d).disp === 'wy')) return 'wanyi';
  return 'yi';
}

function fmtOperand(spec, v, scale) {
  const k = dispKind(spec);
  const neg = v < 0;
  let s;
  if (k === 'yi' || k === 'wanyi') {
    s = scale === 'wanyi' ? (Math.abs(v) / 1e4).toFixed(2) : nf2.format(Math.abs(v));
  } else if (k === 'wy') {
    s = Math.abs(v).toFixed(2);
  } else if (k === 'pct') {
    s = trimZeros((Math.abs(v) * 100).toFixed(4)) + '%';
  } else {
    s = trimZeros(Math.abs(v).toFixed(4));
  }
  return neg ? `(${MINUS}${s})` : s;
}

function trimZeros(s) {
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
}

function fmtResult(spec, v, scale) {
  const k = dispKind(spec);
  if (k === 'yi' || k === 'wanyi') {
    const s = scale === 'wanyi' ? (Math.abs(v) / 1e4).toFixed(2) : nf2.format(Math.abs(v));
    return (v < 0 ? MINUS : '') + s + ' ' + (scale === 'wanyi' ? '万亿元' : '亿元');
  }
  return fmt(spec, v);
}

/**
 * 公式卡片的四行：公式 / 读法 / 拟音 / 代入。
 * html=true 输出带 <sub>/<sup> 的 HTML；否则输出纯文本。
 */
export function formulaLines(graph, id, values, { html = true } = {}) {
  const spec = graph.specs.get(id);
  if (!spec || spec.expr == null) return null;
  const scale = operandScale(graph, spec);
  const wrap = (s) => `(${s})`;
  const sup = html ? (s) => `<sup>${s}</sup>` : (s) => `^${s}`;
  const S = html ? symHTML : symText;
  const lbl = html ? (t) => `<span class="lbl">${escapeHTML(t)}</span>` : (t) => t;

  const symLine = `${S(spec.sym)} = ${render(spec.ast, { leaf: (x) => S(graph.specs.get(x).sym), wrap, sup })}`;
  const readLine = `${lbl(spec.label)} = ${render(spec.ast, { leaf: (x) => lbl(graph.specs.get(x).label), wrap, sup })}`;
  const substLine = `${S(spec.sym)} = ${render(spec.ast, {
    leaf: (x) => fmtOperand(graph.specs.get(x), values[x], scale),
    num: (v) => trimZeros(String(v)),
    wrap,
    sup,
  })} = ${fmtResult(spec, values[id], scale)}`;

  const syms = [spec.sym, ...spec.deps.map((d) => graph.specs.get(d).sym)].join(' ');
  const found = [...new Set([...syms].filter((c) => PRON[c]))];
  const pronLine = found.length ? found.map((c) => `${c} 读"${PRON[c]}"`).join('；') : null;

  return { sym: symLine, read: readLine, pron: pronLine, subst: substLine };
}

export const KIND_TEXT = {
  input: '输入参数',
  identity: '会计恒等式',
  calib: '校准关系',
  assume: '假设关系',
};

export function kindOf(spec) {
  if (spec.expr == null) {
    if (spec.fixed) return { key: 'fixed', text: '固定常数' };
    if (spec.tag === 'assume') return { key: 'assume', text: '假设参数' };
    if (spec.tag === 'calib') return { key: 'calib', text: '校准参数' };
    return { key: 'input', text: '图中数据' };
  }
  return { key: spec.kind, text: KIND_TEXT[spec.kind] ?? '公式' };
}

// 公式的"符号行"与数值无关，按依赖图缓存（传导链列表每帧要用很多次）
const symCache = new WeakMap();
export function symLineText(graph, id) {
  let m = symCache.get(graph);
  if (!m) symCache.set(graph, (m = new Map()));
  if (!m.has(id)) {
    const spec = graph.specs.get(id);
    m.set(id, spec.expr == null ? null : `${symText(spec.sym)} = ${render(spec.ast, { leaf: (x) => symText(graph.specs.get(x).sym), wrap: (q) => `(${q})`, sup: (q) => `^${q}` })}`);
  }
  return m.get(id);
}

/**
 * 代入式用的精确格式：保证至少 sig（默认 4）位有效数字，避免"0.03 ÷ 0.01 = 4.81"这种因四舍五入而对不上的代入。
 * delta = true 时带正负号，百分比显示为"个百分点"。
 */
export function fmtExact(spec, v, { delta = false, unit = true, sig = 4 } = {}) {
  if (v == null || !Number.isFinite(v)) return '—';
  const k = dispKind(spec);
  const d = k === 'pct' ? v * 100 : k === 'wanyi' ? v / 1e4 : v;
  const a = Math.abs(d);
  let s;
  if (a === 0) s = '0';
  else if (a >= 1000) s = a.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  else {
    const dec = Math.min(8, Math.max(2, sig - 1 - Math.floor(Math.log10(a))));
    s = a.toFixed(dec);
    // 去掉多余的尾零，但至少保留两位小数
    while (/\.\d{3,}$/.test(s) && s.endsWith('0')) s = s.slice(0, -1);
  }
  const sign = d < 0 ? MINUS : delta && d > 0 ? '+' : '';
  const u = k === 'pct' ? (delta ? ' 个百分点' : '%') : unit ? { yi: ' 亿元', wanyi: ' 万亿元', wy: ' 万亿元' }[k] ?? '' : '';
  return `${sign}${s}${u}`;
}
