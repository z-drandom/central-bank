// 本次分析摘要（纯文本）：改了什么、在什么规则下、关键结果及其公式、情景代码。
import { summarize } from './summary.js';
import { fmt, formulaLines } from './format.js';
import { encodeScenario } from './scenario-code.js';

const KPI = ['drate26', 'debt_gdp1', 'broad_gdp1', 'intburden26', 'self26', 'p_d_2035'];

export function brief(sim) {
  const sm = summarize(sim);
  const lines = ['【中国财政沙盘 · 分析摘要】'];
  if (!sm) {
    lines.push('当前与原图基线一致，没有改动。');
    return lines.join('\n');
  }
  lines.push(`改动：${sm.inputs.map((x) => `${x.label} ${x.d}`).join('；')}`);
  if (sm.rules.length) lines.push(`规则：${sm.rules.join('；')}`);
  lines.push('关键结果：');
  for (const h of sm.heads) {
    const L = formulaLines(sim.graph, h.id, sim.values, { html: false });
    lines.push(`- ${h.label} ${h.d}`);
    if (L) lines.push(`  ${L.subst}`);
  }
  lines.push('顶栏指标：' + KPI.filter((id) => sim.has(id)).map((id) => `${sim.spec(id).label} ${fmt(sim.spec(id), sim.values[id])}`).join('；'));
  lines.push(`情景代码（在"总览 → 情景对比"粘贴可复现）：${encodeScenario(sim.toScenario())}`);
  return lines.join('\n');
}
