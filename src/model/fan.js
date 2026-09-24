// 不确定性扇形图：在假设区间内均匀抽样，重算整张依赖图，统计各年指标的分位数。
// 这不是概率预测，只回答"假设在这个范围内变动时，结果会落在哪里"。
export const FAN_RANGES = [
  { id: 'pg', label: '2027 年后名义增速', lo: -0.015, hi: 0.015, kind: 'add' },
  { id: 'pshift', label: '利率变动', lo: -0.005, hi: 0.01, kind: 'add' },
  { id: 'psp', label: '每年新增专项债', lo: 0.7, hi: 1.3, kind: 'mul' },
  { id: 'peps', label: '收入弹性', lo: -0.2, hi: 0.2, kind: 'add' },
];

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function quantile(sorted, q) {
  const pos = (sorted.length - 1) * q;
  const i = Math.floor(pos);
  const f = pos - i;
  return sorted[i] + (sorted[Math.min(i + 1, sorted.length - 1)] - sorted[i]) * f;
}

/** 返回 { years, q: {p10,p25,p50,p75,p90}: [...], n } */
export function fan(graph, inputs, key, years, { n = 300, seed = 7, ranges = FAN_RANGES } = {}) {
  const r = rng(seed);
  const samples = years.map(() => []);
  const usable = ranges.filter((x) => graph.isInput(x.id));
  for (let k = 0; k < n; k++) {
    const patch = { ...inputs };
    for (const x of usable) {
      const cur = inputs[x.id] ?? graph.specs.get(x.id).base;
      const u = x.lo + (x.hi - x.lo) * r();
      patch[x.id] = x.kind === 'mul' ? cur * u : cur + u;
    }
    const v = graph.compute(patch);
    years.forEach((y, i) => samples[i].push(v[`${key}_${y}`]));
  }
  const q = { p10: [], p25: [], p50: [], p75: [], p90: [] };
  for (const s of samples) {
    s.sort((a, b) => a - b);
    q.p10.push(quantile(s, 0.1));
    q.p25.push(quantile(s, 0.25));
    q.p50.push(quantile(s, 0.5));
    q.p75.push(quantile(s, 0.75));
    q.p90.push(quantile(s, 0.9));
  }
  return { years, q, n };
}
