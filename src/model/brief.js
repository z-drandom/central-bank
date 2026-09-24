// 本次分析摘要（纯文本）：改了什么、在什么规则下、关键结果及其公式、情景代码。
import { summarize } from './summary.js';
import { fmt, fmtDelta, formulaLines } from './format.js';
import { encodeScenario } from './scenario-code.js';
import { shapley } from './shapley.js';

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
    const r = sim.isInput(h.id) ? null : shapley(sim.graph, sim.inputs, h.id);
    if (r && r.exact && r.ids.length >= 2) {
      const spec = sim.spec(h.id);
      const tiny = 1e-9 * Math.max(1, Math.abs(r.total));
      const rows = r.rows.filter((x) => Math.abs(x.phi) > tiny);
      const zero = r.rows.length - rows.length;
      lines.push(`  按参数归因（Shapley）：${rows.map((x) => `${sim.spec(x.id).label} ${fmtDelta(spec, x.phi)}`).join('；')}${zero ? `（另有 ${zero} 个改过的参数在上游但贡献为 0：它的影响在公式里正好抵消）` : ''}`);
    }
  }
  lines.push('顶栏指标：' + KPI.filter((id) => sim.has(id)).map((id) => `${sim.spec(id).label} ${fmt(sim.spec(id), sim.values[id])}`).join('；'));
  lines.push(`情景代码（在"总览 → 情景对比"粘贴可复现）：${encodeScenario(sim.toScenario())}`);
  return lines.join('\n');
}
