// 读薄：三句话里的每个结论、每个数字都要和模型一致。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/model/sim.js';
import { LESSONS, readLesson, summary, debtPath } from '../src/model/thin.js';

const byId = Object.fromEntries(LESSONS.map((L) => [L.id, L]));
const nums = (s) => [...s.matchAll(/-?\d[\d,]*\.?\d*/g)].map((m) => parseFloat(m[0].replace(/,/g, '')));

test('读薄：三课的旋钮都是可调输入，区间在滑杆范围内，"试试"的值在区间内', () => {
  const s = new Sim();
  for (const L of LESSONS) {
    assert.ok(s.isInput(L.lever.id), L.id);
    const [lo, hi] = s.spec(L.lever.id).range;
    assert.ok(L.lever.min >= lo && L.lever.max <= hi, `${L.id} 区间超出滑杆`);
    assert.ok(L.lever.try >= L.lever.min && L.lever.try <= L.lever.max);
    assert.ok(L.answer >= 0 && L.answer < L.options.length);
  }
});

test('读薄①：增速从 5% 掉到 3%，按比例能借的变少（答案"变少"）；代入式成立；保住支出所需的赤字率确实保住支出', () => {
  const L = byId.ruler;
  const b = new Sim().values;
  const s = new Sim();
  s.set('g_nom', 0.03);
  assert.ok(s.values.d26 < b.d26 && s.values.e26 < b.e26);
  assert.equal(L.options[L.answer], '变少');
  const r = readLesson(L, 0.03);
  const [d, rate, gdp] = nums(r.fx.subst);
  assert.ok(Math.abs(d - (rate / 100) * gdp) < 0.01, r.fx.subst);
  // 句子里的"赤字率得提到 x%"：把赤字率调到这个值，支出回到原图
  const need = parseFloat(r.say.match(/提到 ([\d.]+)%/)[1]) / 100;
  s.set('dr26', need);
  // 句子里的赤字率保留两位小数，误差不超过半个 0.01 个百分点 × GDP
  assert.ok(Math.abs(s.values.e26 - b.e26) <= 0.00005 * s.values.gdp26, `${s.values.e26} vs ${b.e26}`);
  // 反方向：经济热，能借的变多
  assert.match(readLesson(L, 0.07).say, /多/);
});

test('读薄②：政府债务增加额 = 赤字 + 专项债 + 置换 + 特别国债；最接近的选项就是答案；负债率变化的分解精确成立', () => {
  const L = byId.iceberg;
  for (const sp of [null, 0, 20000, 80000]) {
    const r = readLesson(L, sp);
    const s = new Sim();
    if (sp != null) s.set('sp26', sp);
    const v = s.values;
    assert.ok(Math.abs((v.gov1 - v.gov0) - (v.d26 + v.sp26 + v.swap26 + v.stb26)) < 1e-6);
    assert.ok(Math.abs(r.dd - (v.drate26 + v.p_sfa_2026 - r.dil)) < 1e-12, '分解');
    const [dd, dr, sf, dil] = nums(r.fx.subst);
    assert.ok(Math.abs(dd - (dr + sf - dil)) <= 0.011, r.fx.subst); // 各项两位小数，合计误差不超过舍入
    assert.equal(r.parts.reduce((a, p) => a + p.value, 0), v.gov1 - v.gov0);
  }
  const b = new Sim().values;
  const dB = (b.gov1 - b.gov0) / 1e4;
  const opt = L.options.map((t) => Math.abs(nums(t)[0] - dB));
  assert.equal(opt.indexOf(Math.min(...opt)), L.answer);
});

test('读薄③：赤字率不变时负债率会停下来（答案"涨到某个水平就停下"）；外推路径单调趋近终点；增速越低终点越高且越陡', () => {
  const L = byId.endpoint;
  assert.equal(L.options[L.answer], '涨到某个水平就停下');
  const v = new Sim().values;
  const path = debtPath(v, 3000);
  const tail = path.slice(-2);
  assert.ok(Math.abs(tail[1].y - v.p_dstar) < 1e-6, `外推终值 ${tail[1].y} vs d* ${v.p_dstar}`);
  for (let i = 12; i < path.length; i++) assert.ok(path[i].y >= path[i - 1].y - 1e-12 && path[i].y <= v.p_dstar + 1e-9);
  const ds = [0.06, 0.045, 0.03, 0.02].map((g) => readLesson(L, g));
  const d = ds.map((r) => nums(r.fx.subst)[0]);
  assert.ok(d[0] < d[1] && d[1] < d[2] && d[2] < d[3]);
  assert.ok(d[3] - d[2] > d[2] - d[1], '越往下越陡');
  for (const r of ds) {
    const [dstar, dr, sf, onePlusG, g] = nums(r.fx.subst);
    assert.ok(Math.abs(dstar - ((dr + sf) * onePlusG / g) * 100) < 0.6, r.fx.subst); // 各项已四舍五入
  }
  // 句子里的倍数与终点一致
  const r3 = readLesson(L, 0.03);
  assert.match(r3.say, /终点 216%/);
  assert.match(r3.say, /1\.55 倍/);
});

test('读薄：一句话总结里的例子都由模型现算', () => {
  const s = summary();
  assert.equal(s.points.length, 3);
  const b = new Sim().values;
  const cold = new Sim();
  cold.set('g_nom', 0.03);
  assert.match(s.points[0], new RegExp(`能借的少 ${Math.round(b.d26 - cold.values.d26).toLocaleString('en-US')} 亿`));
  assert.match(s.points[1], new RegExp(`增加 ${((b.gov1 - b.gov0) / 1e4).toFixed(2)} 万亿`));
  assert.match(s.points[2], /从 140% 升到 216%/);
  for (const p of s.points) assert.ok(!/NaN|Infinity|undefined/.test(p), p);
});

test('读薄：每一课在滑杆两端都给出有限的数字和完整的句子', () => {
  for (const L of LESSONS) {
    for (const x of [L.lever.min, L.lever.max]) {
      const r = readLesson(L, x);
      const text = [r.say, r.moral, r.fx.subst, ...r.nums.map((n) => n.value)].join(' ');
      assert.ok(!/NaN|Infinity|undefined/.test(text), `${L.id}@${x}: ${text}`);
    }
  }
});
