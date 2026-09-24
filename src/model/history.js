// 撤销历史里每个状态的简短描述：相对原图改了哪些规则和参数。
import { DEFAULT_MODES, MODE_OPTIONS, buildSpecs } from './specs.js';
import { fmt } from './format.js';
import { changed } from '../engine/graph.js';

const cache = new Map();
function inputSpecs(modes) {
  const key = JSON.stringify(modes ?? {});
  if (!cache.has(key)) {
    const m = new Map();
    for (const s of buildSpecs({ ...DEFAULT_MODES, ...modes })) if (s.expr == null) m.set(s.id, s);
    cache.set(key, m);
  }
  return cache.get(key);
}

export function describeSnapshot(snap, { max = 3 } = {}) {
  const rules = Object.entries(snap.modes ?? {})
    .filter(([k, v]) => DEFAULT_MODES[k] !== v)
    .map(([k, v]) => `${MODE_OPTIONS[k]?.options?.[v]?.label ?? v}`);
  const specs = inputSpecs(snap.modes);
  const ins = [];
  for (const [id, v] of Object.entries(snap.inputs ?? {})) {
    const s = specs.get(id);
    if (s && changed(v, s.base)) ins.push(`${s.short ?? s.label} ${fmt(s, v)}`);
  }
  if (!rules.length && !ins.length) return { text: '原图基线（没有改动）', count: 0 };
  const shown = ins.slice(0, max);
  const more = ins.length - shown.length;
  const text = [rules.length ? `规则：${rules.join('、')}` : '', shown.join('；') + (more > 0 ? ` 等 ${ins.length} 项` : '')].filter(Boolean).join('　');
  return { text, count: ins.length + rules.length };
}
