// 一句话总结：你改了什么、在什么规则下、主要结果是什么。
import { MODE_OPTIONS } from './specs.js';
import { fmtDelta } from './format.js';
import { changed } from '../engine/graph.js';

export const HEADLINES = [
  'rev25', 'tin25', 'def25', 'r26', 'e26', 'd26', 'drate26', 'oth26', 'own26', 'tr26', 'el26', 'tl26', 'tstab26',
  'gov1', 'debt_gdp1', 'broad_gdp1', 'intburden26', 'p_d_2035', 'p_iball_2035',
  'f1_exp', 'f1_other', 'f1_def', 'f2_cut', 'f4_sub', 'fc_gap',
];

const RULE_KEYS = { y25: ['y25'], b26: ['c26', 'absorb', 'l26'], debt: ['scope'], fb: ['fb1', 'fb2', 'fb4'], proj: ['proj'] };

export function summarize(sim, { max = 6 } = {}) {
  const inputs = sim.changedInputs();
  if (!inputs.length) return null;
  const mods = new Set(sim.changedIds().map((id) => sim.spec(id).mod));
  const rules = [];
  for (const [mod, keys] of Object.entries(RULE_KEYS)) {
    if (!mods.has(mod)) continue;
    for (const k of keys) {
      if (k === 'absorb' && sim.modes.c26 !== 'rate') continue;
      rules.push(`${MODE_OPTIONS[k].label}：${MODE_OPTIONS[k].options[sim.modes[k]].label}`);
    }
  }
  const heads = HEADLINES.filter((id) => sim.has(id) && !inputs.includes(id) && changed(sim.values[id], sim.base[id]))
    .map((id) => {
      const b = sim.base[id];
      const d = sim.values[id] - b;
      const rel = sim.spec(id).unit === 'pct' ? Math.abs(d) * 10 : Math.abs(d) / Math.max(1e-9, Math.abs(b));
      return { id, d, rel };
    })
    .sort((a, b) => b.rel - a.rel)
    .slice(0, max);
  return {
    inputs: inputs.map((id) => ({ id, label: sim.spec(id).label, d: fmtDelta(sim.spec(id), sim.values[id] - sim.base[id]) })),
    rules,
    heads: heads.map((x) => ({ id: x.id, label: sim.spec(x.id).label, d: fmtDelta(sim.spec(x.id), x.d) })),
  };
}
