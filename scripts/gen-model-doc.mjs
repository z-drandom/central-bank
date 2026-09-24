// 由模型规格自动生成 docs/MODEL.md：列出每个输入参数和每条公式（公式 / 读法 / 代入）。
// 用法：node scripts/gen-model-doc.mjs [--check]
import { writeFile, readFile } from 'node:fs/promises';
import { Sim } from '../src/model/sim.js';
import { MODULES, MODE_OPTIONS, DEFAULT_MODES, PROJ_START } from '../src/model/specs.js';
import { formulaLines, fmt, kindOf, symText } from '../src/model/format.js';

export function generate() {
  const sim = new Sim();
  const g = sim.graph;
  const v = sim.values;
  const out = [];
  out.push('# 模型说明（自动生成）');
  out.push('');
  out.push('> 本文件由 `node scripts/gen-model-doc.mjs` 根据 `src/model/specs.js` 生成，请勿手改。每条公式与模拟器实际计算用的表达式完全相同；"代入"一行使用原图基线数值。');
  out.push('');
  out.push(`共 ${g.specs.size} 个节点：${g.inputs().length} 个输入参数，${g.specs.size - g.inputs().length} 条公式（默认平衡规则下）。`);
  out.push('');
  out.push('## 平衡规则');
  out.push('');
  for (const [k, def] of Object.entries(MODE_OPTIONS)) {
    out.push(`- **${def.label}**（默认：${def.options[DEFAULT_MODES[k]].label}）`);
    for (const o of Object.values(def.options)) out.push(`  - ${o.label}：${o.desc}`);
  }
  out.push('');
  for (const [mk, m] of Object.entries(MODULES)) {
    const nodes = g.order.map((id) => g.specs.get(id)).filter((s) => s.mod === mk);
    if (!nodes.length) continue;
    out.push(`## ${m.img ? `图${m.img} ` : ''}${m.name}`);
    out.push('');
    const inputs = nodes.filter((s) => s.expr == null);
    if (inputs.length) {
      out.push('### 输入参数');
      out.push('');
      out.push('| 符号 | 名称 | 基线值 | 性质 | 来源 / 依据 |');
      out.push('| --- | --- | --- | --- | --- |');
      for (const s of inputs) {
        out.push(`| \`${symText(s.sym)}\` | ${s.label} | ${fmt(s, s.base)} | ${kindOf(s).text} | ${(s.src ?? '').replace(/\|/g, '\\|')} |`);
      }
      out.push('');
    }
    const fx = nodes.filter((s) => s.expr != null && (mk !== 'proj' || /_(2026|2027)$/.test(s.id) || !/_\d{4}$/.test(s.id)));
    if (fx.length) {
      out.push('### 公式');
      out.push('');
      if (mk === 'proj') out.push(`（逐年公式只列出 ${PROJ_START} 与 ${PROJ_START + 1} 年，之后各年形式相同。）`, '');
      for (const s of fx) {
        const L = formulaLines(g, s.id, v, { html: false });
        out.push(`#### ${s.label}（${kindOf(s).text}）`);
        out.push('');
        out.push('```');
        out.push(`公式：${L.sym}`);
        out.push(`读法：${L.read}`);
        if (L.pron) out.push(`拟音：${L.pron}`);
        out.push(`代入：${L.subst}`);
        out.push('```');
        if (s.note) out.push('', s.note);
        out.push('');
      }
    }
  }
  return out.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const text = generate();
  if (process.argv.includes('--check')) {
    const cur = await readFile('docs/MODEL.md', 'utf8').catch(() => '');
    if (cur !== text) {
      console.error('docs/MODEL.md 已过期，请运行 npm run docs');
      process.exit(1);
    }
    console.log('docs/MODEL.md 与模型一致');
  } else {
    await writeFile('docs/MODEL.md', text);
    console.log(`docs/MODEL.md 已生成（${text.split('\n').length} 行）`);
  }
}
