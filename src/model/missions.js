// 随机任务（无尽模式）：每道题都由模型现场出。
// 出题方法保证有解：先在允许的旋钮里随机挑两个、各拨几步，算出指标此时的值，把它（向"容易"的方向取整）作为目标。
// 生成的任务与挑战关卡同构（setup / goals / solution），直接复用任务卡追踪。
import { Sim } from './sim.js';
import { stepOf } from './sensitivity.js';
import { fmt } from './format.js';

// cmp：'<=' 压到目标以下，'>=' 抬到目标以上，'==' 精确命中（容差 tol，按显示单位：百分比为百分点）
export const MISSION_TEMPLATES = [
  {
    id: 'debt', level: 1, tab: 'proj', icon: '📉', title: '控债十年',
    modes: { proj: 'rate' }, targets: [{ id: 'p_d_2035', cmp: '<=' }],
    levers: ['pdr', 'psp', 'pstb', 'pswap'],
    story: (g) => `新官上任，部长给你的第一个 KPI：2035 年政府负债率不超过 ${g[0]}。只能动推演期的借债类旋钮。`,
  },
  {
    id: 'other', level: 1, tab: 'b26', icon: '🧮', title: '保住"其它"',
    modes: { c26: 'rate', absorb: 'other' }, targets: [{ id: 'oth26', cmp: '>=' }],
    levers: ['dr26', 'g_tr', 'tsoe26', 'tstab26', 'g_def', 'g_sci'],
    shocks: [[{ id: 'g_nom', set: 0.035 }, '名义增速只有 3.5%'], [{ id: 'rcg', add: 0.004 }, '国债利率上升 0.4 个百分点'], [{ id: 'g_def', set: 0.1 }, '国防支出要增长 10%']],
    story: (g, shock) => `${shock}，中央本级"其它"支出被挤压。想办法让它不低于 ${g[0]}。`,
  },
  {
    id: 'self', level: 2, tab: 'b26', icon: '🏙️', title: '地方自立',
    modes: { l26: 'deficit' }, targets: [{ id: 'self26', cmp: '>=' }],
    levers: ['s_vat', 's_cit', 's_pit', 'g_tr', 'tl26'],
    story: (g) => `地方政府想"自己的饭自己挣"：把地方财政自给率提高到 ${g[0]} 以上。提示：自给率 = 地方收入 ÷ 地方支出，分子分母都能动。`,
  },
  {
    id: 'exact', level: 2, tab: 'b26', icon: '🎯', title: '精确制导',
    modes: { c26: 'spend' }, targets: [{ id: 'drate26', cmp: '==', tol: 0.03 }],
    levers: ['g_def', 'g_tr', 'g_sci', 'tstab26', 'tsoe26'], stepScale: 2,
    story: (g) => `支出锚定下，赤字率由支出倒推。把 2026 年赤字率调到正好 ${g[0]}（误差 ±0.03 个百分点以内）。`,
  },
  {
    id: 'books', level: 2, tab: 'fb', icon: '📚', title: '四本账腾挪',
    modes: { fb1: 'deficit', fb2: 'cap' }, targets: [{ id: 'f1_other', cmp: '>=' }],
    levers: ['f3_k', 'f2_a', 'f1_def', 'f2_bond'],
    shocks: [[{ id: 'f2_land', mul: 0.7 }, '土地出让收入少了三成'], [{ id: 'f4_exp', mul: 1.08 }, '社保基金支出多了 8%']],
    story: (g, shock) => `${shock}（四本账，2021 年数据）。在账本之间腾挪，让一般预算"其他支出"不低于 ${g[0]}。`,
  },
  {
    id: 'twin', level: 3, tab: 'b26', icon: '⚖️', title: '鱼与熊掌',
    modes: { c26: 'rate', absorb: 'other', l26: 'deficit' }, targets: [{ id: 'drate26', cmp: 'auto' }, { id: 'el26', cmp: 'auto' }],
    levers: ['dr26', 'g_tr', 'tstab26', 'tl26'],
    story: (g, shock, texts) => `两个目标同时要：${texts.join('；')}。一个旋钮顾不了两头——试试「影响与敏感度 → 双目标求解」。`,
  },
];

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function applyChanges(sim, changes) {
  const out = {};
  for (const c of changes) {
    const b = sim.inputs[c.id];
    out[c.id] = 'set' in c ? c.set : 'mul' in c ? b * c.mul : b + c.add;
  }
  sim.setMany(out);
}

const CMP_TEXT = { '<=': '不超过', '>=': '不低于', '==': '等于' };

/** 生成一道任务。返回与挑战关卡同构的对象；失败（极少）时返回 null */
export function makeMission({ seed = Date.now(), level = null, template = null } = {}) {
  const r = rng(seed);
  const pool = MISSION_TEMPLATES.filter((t) => (template ? t.id === template : level == null || t.level <= level));
  const tpl = template ? pool[0] : pool[Math.floor(r() * pool.length)];
  if (!tpl) return null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const sim = new Sim(tpl.modes);
    let shockText = '';
    let shock = [];
    if (tpl.shocks) {
      const [ch, text] = tpl.shocks[Math.floor(r() * tpl.shocks.length)];
      shock = [ch];
      shockText = text;
      applyChanges(sim, shock);
    }
    const start = { ...sim.values };
    // 随机挑两个旋钮，各拨 0.5–1.5 步（比率类一步 = 1 个百分点，金额类一步 = 10%）
    const levers = [...tpl.levers].sort(() => r() - 0.5).slice(0, 2);
    const solution = [];
    const set = {};
    for (const id of levers) {
      const sp = sim.spec(id);
      const k = (1 + Math.floor(r() * 3)) * 0.5 * (r() < 0.5 ? -1 : 1);
      const [lo, hi] = sp.range;
      const x = Math.min(hi, Math.max(lo, sim.inputs[id] + k * (tpl.stepScale ?? 1) * stepOf(sp)));
      set[id] = x;
      solution.push({ id, set: x });
    }
    sim.setMany(set);
    const v = sim.values;
    const goals = [];
    const goalText = [];
    const fullText = [];
    let ok = true;
    for (const t of tpl.targets) {
      const sp = sim.spec(t.id);
      const now = v[t.id];
      const was = start[t.id];
      const pct = sp.unit === 'pct';
      const gap = Math.abs(now - was) / Math.max(Math.abs(was), 1e-9);
      if (!Number.isFinite(now) || gap < (pct ? 0.003 : 0.004)) { ok = false; break; }
      let cmp = t.cmp === 'auto' ? (now < was ? '<=' : '>=') : t.cmp;
      if (cmp === '<=' && now >= was) { ok = false; break; } // 必须比起点"更好"才算任务
      if (cmp === '>=' && now <= was) { ok = false; break; }
      // 目标取整到显示精度，并向"容易"的方向取整，保证参考解仍然满足
      const unit = pct ? 1e-4 : sp.unit === 'wy' ? 0.01 : 1;
      const goal = cmp === '<=' ? Math.ceil(now / unit) * unit : cmp === '>=' ? Math.floor(now / unit) * unit : now;
      const tol = t.tol != null ? t.tol / (pct ? 100 : 1) : 0;
      const text = `${sp.label}${CMP_TEXT[cmp]} ${fmt(sp, goal)}${cmp === '==' ? `（±${t.tol}${pct ? ' 个百分点' : ''}）` : ''}`;
      goalText.push(fmt(sp, goal));
      fullText.push(text);
      const id = t.id;
      goals.push({
        text, id, goal, cmp, tol,
        test: cmp === '<=' ? (x) => x[id] <= goal + 1e-9 : cmp === '>=' ? (x) => x[id] >= goal - 1e-9 : (x) => Math.abs(x[id] - goal) <= tol + 1e-12,
      });
    }
    if (!ok) continue;
    // 起点不能已经达成
    if (goals.every((g) => g.test(start))) continue;
    return {
      id: 'mission', mission: true, template: tpl.id, level: tpl.level, icon: tpl.icon, seed,
      title: `${tpl.icon} ${tpl.title}`, tab: tpl.tab,
      story: tpl.story(goalText, shockText, fullText),
      setup: { modes: tpl.modes, changes: shock },
      goals, allowed: tpl.levers, solution,
      hint: `可以动：${tpl.levers.map((id) => sim.spec(id).label).join('、')}。其他旋钮一动，星级最多一颗。`,
    };
  }
  return null;
}
