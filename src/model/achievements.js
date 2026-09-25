// 成就：奖励"去试一试"。两类条件——
//  state：看当前数值（例如把赤字率推到 6% 以上）；
//  stat：看累计行为（打开过多少张卡片、用过哪些工具、通过几关）。
// 统计由界面在相应动作时记录（app.track），这里只做判定，便于单元测试。

export const ACHIEVEMENTS = [
  // 入门
  { id: 'thin', icon: '💡', title: '一语点醒', desc: '读完"读薄"的三句话', hint: '顶栏"读薄"：先猜，再拧', stat: (s) => (s.thin?.length ?? 0) >= 3 },
  { id: 'first-turn', icon: '🔧', title: '初次上手', desc: '第一次拧动旋钮', hint: '拖任意一个滑杆', stat: (s) => s.set >= 1 },
  { id: 'curious', icon: '🔍', title: '刨根问底', desc: '打开过 20 张公式卡片', hint: '点数字看公式', stat: (s) => s.card >= 20 },
  { id: 'rules', icon: '⚖️', title: '规则玩家', desc: '试过 5 种不同的平衡规则', hint: '在参数面板切换"平衡规则"', stat: (s) => (s.modes?.length ?? 0) >= 5 },
  { id: 'finder', icon: '⌕', title: '一搜即得', desc: '用全局查找打开过卡片', hint: '按 / 或 Ctrl+K', stat: (s) => s.finder >= 1 },
  { id: 'timewalker', icon: '⏪', title: '时光旅人', desc: '用"历史"回到过去的状态', hint: '顶栏"历史"', stat: (s) => s.history >= 1 },
  // 工具
  { id: 'replay', icon: '🎬', title: '回放导演', desc: '把一次传导回放看完', hint: '总览页"回放传导路径"', stat: (s) => s.replay >= 1 },
  { id: 'paths', icon: '🕵️', title: '路径侦探', desc: '用链式法则拆过一次"谁影响谁"', hint: '影响矩阵里点任一格', stat: (s) => s.paths >= 1 },
  { id: 'phase', icon: '🗺️', title: '相图探险家', desc: '在双参数相图上点格子，把两个参数一起设过去', hint: '影响与敏感度 → 双参数相图', stat: (s) => s.phase >= 1 },
  { id: 'newton', icon: '🍎', title: '牛顿的信徒', desc: '用双目标求解同时达成两个目标', hint: '影响与敏感度 → 双目标求解', stat: (s) => s.solve2 >= 1 },
  { id: 'shapley', icon: '🍰', title: '公平分蛋糕', desc: '看过一次 Shapley 归因', hint: '改两个参数后打开结果的卡片', stat: (s) => s.shapley >= 1 },
  { id: 'storyteller', icon: '📖', title: '听书人', desc: '听完 3 条讲解', hint: '总览页"跟着讲解走一遍"', stat: (s) => (s.stories?.length ?? 0) >= 3 },
  // 玩法
  { id: 'challenger', icon: '🏁', title: '初试锋芒', desc: '通过任意一个挑战关卡', hint: '挑战页', stat: (s) => (s.challenges?.length ?? 0) >= 1 },
  { id: 'minister', icon: '🎖️', title: '满堂红', desc: '通过全部挑战关卡', hint: '挑战页', stat: (s, n) => (s.challenges?.length ?? 0) >= n.challenges },
  { id: 'three-stars', icon: '⭐', title: '三星部长', desc: '以三颗星通过一个关卡或任务', hint: '旋钮用得越少星越多', stat: (s) => s.threeStars >= 1 },
  { id: 'quizzer', icon: '🧠', title: '直觉在线', desc: '先猜后算答对 8 题', hint: '挑战页下方的测验', stat: (s) => (s.quiz?.length ?? 0) >= 8 },
  { id: 'streak3', icon: '🔥', title: '连胜三场', desc: '随机任务连胜 3 次', hint: '挑战页"随机任务"', stat: (s) => s.bestStreak >= 3 },
  { id: 'streak10', icon: '🌋', title: '十连胜', desc: '随机任务连胜 10 次', hint: '别放弃任何一题', stat: (s) => s.bestStreak >= 10 },
  { id: 'lightning', icon: '⚡', title: '闪电手', desc: '30 秒内完成一道随机任务', hint: '任务卡上有计时；点"可以动"里的旋钮名直接开滑杆', stat: (s) => s.fast >= 1 },
  { id: 'show-off', icon: '📣', title: '晒战绩', desc: '复制过一次任务战绩', hint: '完成随机任务或今日任务后点"晒战绩"', stat: (s) => s.share >= 1 },
  // 极端玩法（看数值）
  { id: 'big-spender', icon: '💸', title: '大手笔', desc: '把 2026 年赤字率推到 6% 以上', hint: '积极财政，积极到底', state: (v) => v.drate26 >= 0.06 },
  { id: 'hawk', icon: '🦅', title: '铁公鸡', desc: '把 2026 年赤字率压到 2% 以下', hint: '紧缩到极致', state: (v) => v.drate26 <= 0.02 },
  { id: 'century', icon: '💯', title: '破百', desc: '让 2035 年政府负债率超过 100%', hint: '十年推演', state: (v) => v.p_d_2035 >= 1 },
  { id: 'clean', icon: '🧹', title: '化债先锋', desc: '2026 年置换隐性债务达到 4 万亿', hint: '债务页', state: (v) => v.swap26 >= 40000 },
  { id: 'reformer', icon: '🏛️', title: '分税制改革家', desc: '让地方财政自给率超过 55%', hint: '调中央分享比例', state: (v) => v.self26 >= 0.55 },
];

export const COUNTS = { challenges: 8 };

/**
 * 把一个界面事件记入统计。事件名与 stat 读取的字段一一对应：
 * set（拧旋钮）、card（开卡片）、mode（换规则）、story、thin（读薄的一课）、quiz、challenge、mission（含用时 secs）、
 * finder、history、replay、paths、phase、solve2、shapley、share 等计数类事件。
 */
export function recordEvent(stats, ev, payload) {
  const s = stats;
  const addTo = (k, x) => { const arr = s[k] ?? []; if (!arr.includes(x)) arr.push(x); s[k] = arr; };
  switch (ev) {
    case 'mode': addTo('modes', payload); break;
    case 'story': addTo('stories', payload); break;
    case 'thin': addTo('thin', payload); break;
    case 'quiz': addTo('quiz', payload); break;
    case 'challenge':
      addTo('challenges', payload.id);
      if (payload.stars === 3) s.threeStars = (s.threeStars ?? 0) + 1;
      break;
    case 'mission':
      s.missions = (s.missions ?? 0) + 1;
      s.bestStreak = Math.max(s.bestStreak ?? 0, payload.streak ?? 0);
      if (payload.stars === 3) s.threeStars = (s.threeStars ?? 0) + 1;
      if (payload.secs != null && payload.secs <= 30) s.fast = (s.fast ?? 0) + 1;
      break;
    default: s[ev] = (s[ev] ?? 0) + 1;
  }
  return s;
}

/** 返回新解锁的成就 id（按定义顺序） */
export function checkAchievements(unlocked, stats, values, counts = COUNTS) {
  const out = [];
  for (const a of ACHIEVEMENTS) {
    if (unlocked.includes(a.id)) continue;
    let ok = false;
    try { ok = a.state ? !!(values && a.state(values)) : !!a.stat(stats, counts); } catch { ok = false; }
    if (ok) out.push(a.id);
  }
  return out;
}
