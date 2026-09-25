// 数值越界或出现经济上需要注意的状态时给出提示
import { fmt } from '../model/format.js';

const W = (id, when, text, level = 'warn') => ({ id, when, text, level });

export const WARNINGS = [
  W('rev25', (v) => !(v.rev25 > 0) || !(v.r26 > 0), () => '一般公共预算收入被调到了 0：所有"占收入比重"和"增速"都要除以收入，现在无法计算，显示为"—"。把任一税种或非税收入调回来即可恢复。'),
  W('oth26', (v) => v.oth26 < 0, (v, s) => `中央本级"其它"支出变成 ${fmt(s('oth26'), v.oth26)}：在"赤字率锚定"下，减收或增支已经超过"其它"能吸收的范围。可以提高赤字率、改用"支出锚定"，或把吸收项改为转移支付。`),
  W('kprop', (v) => v.kprop < 0.7, (v) => `本级支出分摊系数只有 ${(v.kprop * 100).toFixed(1)}%：各项支出都要按计划的这个比例执行，压减幅度已经很大。`),
  W('kprop', (v) => v.kprop > 1.3, (v) => `本级支出分摊系数达 ${(v.kprop * 100).toFixed(1)}%：各项都超计划安排，说明赤字或调入远超原计划需要。`, 'info'),
  W('e_other', (v) => v.e_other < 0, (v, s) => `2025 年"其它"支出变成 ${fmt(s('e_other'), v.e_other)}：在"支出调整"规则下，减收已超过"其它"能压减的范围。`),
  W('dc26', (v) => v.dc26 < 0, (v, s) => `中央赤字为 ${fmt(s('dc26'), v.dc26)}：负数意味着中央预算出现盈余（全国赤字小于地方赤字）。`, 'info'),
  W('f3_exp', (v) => v.f3_exp < 0, () => '国有资本经营支出为负：调出比例和结转下年之和超过了收入总量。'),
  W('tr26', (v) => v.tr26 < 0, (v, s) => `对地方转移支付变成 ${fmt(s('tr26'), v.tr26)}，这在现实中不可能发生。`),
  W('tl26', (v) => v.tl26 < 0, (v, s) => `地方"调入资金及使用结转结余"为 ${fmt(s('tl26'), v.tl26)}：负数意味着地方有结余，可结转下年或补充稳定调节基金。`, 'info'),
  W('tstab26', (v) => v.tstab26 < 0, (v, s) => `从稳定调节基金调入为 ${fmt(s('tstab26'), v.tstab26)}：负数意味着中央有结余，可以补充稳定调节基金。`, 'info'),
  W('tstab26', (v) => v.tstab26 > 5000, (v, s) => `需要从中央预算稳定调节基金调入 ${fmt(s('tstab26'), v.tstab26)}。基金余额有限，大规模调用难以持续。`),
  W('tin25', (v) => v.tin25 < 0, (v, s) => `2025 年调入资金为 ${fmt(s('tin25'), v.tin25)}：负数意味着收入足够，出现结余。`, 'info'),
  W('el26', (v) => v.el26 < v.rl26, () => '地方支出低于地方自有收入，地方出现净结余。', 'info'),
  W('f2_cut', (v) => (v.f2_cut ?? 0) > 1e-9, (v, s) => `政府性基金预算"不列赤字"：收入不够，计划支出被迫压减 ${fmt(s('f2_cut'), v.f2_cut)}。可以增发专项债或下调计划支出。`),
  W('f4_bal', (v) => v.f4_bal < 0, (v, s) => `社保基金当年收不抵支 ${fmt(s('f4_bal'), -v.f4_bal)}，需要动用累计结余。改用"补贴兜底"规则可看到财政需要多补多少。`),
  W('f1_other', (v) => v.f1_other < 0, (v, s) => `第一本账"其他支出"为 ${fmt(s('f1_other'), v.f1_other)}：补贴和调出已经超过总支出。`),
  W('f2_next', (v) => v.f2_next < -1e-9, () => '政府性基金结余分配比例之和超过 100%，结转下年变成负数。'),
  W('hsel1', (v) => v.hsel - v.swap26 < 0, () => '置换规模超过了所选口径的隐性债务余额，超出部分按 0 处理。', 'info'),
  W('p_d_2035', (v) => v.p_d_2035 > 1.2, (v, s) => `按当前假设，2035 年政府负债率将达 ${fmt(s('p_d_2035'), v.p_d_2035)}。`, 'info'),
];

export function activeWarnings(app) {
  const v = app.v;
  const s = (id) => app.sim.spec(id);
  const out = [];
  for (const w of WARNINGS) {
    try {
      if (app.sim.has(w.id) && w.when(v)) out.push({ ...w, msg: w.text(v, s) });
    } catch {
      /* 某些规则下节点不存在 */
    }
  }
  return out;
}
