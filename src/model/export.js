// 导出全部节点为 CSV：编号、名称、模块、类型、单位、原图基线、当前值、变化量、公式。
// 数值按存储单位原样输出（亿元、万亿元、比率用小数），便于在表格软件里复算。
import { MODULES } from './specs.js';

const UNIT = { yi: '亿元', wy: '万亿元', pct: '比率', num: '数值' };
const q = (x) => {
  const s = String(x ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCSV(sim) {
  const g = sim.graph;
  const head = ['id', '名称', '模块', '类型', '单位', '原图基线', '当前值', '变化量', '公式'];
  const rows = [head.join(',')];
  for (const id of g.order) {
    const s = g.specs.get(id);
    const kind = s.expr == null ? (s.fixed ? '原图数据' : '可调参数') : '公式';
    const b = sim.base[id];
    const v = sim.values[id];
    const num = (x) => (Number.isFinite(x) ? String(Number(x.toPrecision(12))) : '');
    rows.push([id, s.label, MODULES[s.mod]?.short ?? s.mod, kind, UNIT[s.unit] ?? s.unit, num(b), num(v), num(v - b), s.expr ?? ''].map(q).join(','));
  }
  return rows.join('\n');
}
