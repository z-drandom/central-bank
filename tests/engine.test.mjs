import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, evaluate, render, depsOf } from '../src/engine/expr.js';
import { Graph } from '../src/engine/graph.js';

const ev = (src, vars = {}) => evaluate(parse(src), (x) => vars[x]);
const plain = (src) =>
  render(parse(src), { leaf: (x) => x })
    .replaceAll('×', '*')
    .replaceAll('÷', '/')
    .replaceAll('−', '-');

test('运算优先级与结合性', () => {
  assert.equal(ev('1 + 2 * 3'), 7);
  assert.equal(ev('(1 + 2) * 3'), 9);
  assert.equal(ev('-2^2'), -4);
  assert.equal(ev('2^3^2'), 512);
  assert.equal(ev('8 / 4 / 2'), 1);
  assert.equal(ev('10 - 3 - 2'), 5);
  assert.equal(ev('2 * -3'), -6);
  assert.equal(ev('1e4 * 2.5'), 25000);
});

test('函数', () => {
  assert.equal(ev('sum(1, 2, 3)'), 6);
  assert.equal(ev('min(a, b)', { a: 3, b: 2 }), 2);
  assert.equal(ev('max(0, a - b)', { a: 3, b: 5 }), 0);
  assert.equal(ev('abs(-4)'), 4);
  assert.throws(() => parse('foo(1)'));
});

test('语法错误会报错', () => {
  assert.throws(() => parse('1 +'));
  assert.throws(() => parse('(1 + 2'));
  assert.throws(() => parse('1 $ 2'));
  assert.throws(() => ev('a + 1', {}));
});

test('依赖提取', () => {
  assert.deepEqual([...depsOf(parse('a * (b + c) - sum(d, a)'))].sort(), ['a', 'b', 'c', 'd']);
});

test('渲染只在必要时加括号', () => {
  assert.equal(plain('(a + b) * c'), '(a + b) * c');
  assert.equal(plain('a - (b - c)'), 'a - (b - c)');
  assert.equal(plain('a - (b + c)'), 'a - (b + c)');
  assert.equal(plain('a + (b + c)'), 'a + b + c');
  assert.equal(plain('a / (b * c)'), 'a / (b * c)');
  assert.equal(plain('(a / b) * c'), 'a / b * c');
  assert.equal(plain('a * (1 + g)'), 'a * (1 + g)');
  assert.equal(plain('-(a + b)'), '-(a + b)');
  assert.equal(plain('x - sum(a, b)'), 'x - (a + b)');
  assert.equal(plain('x * sum(a, b)'), 'x * (a + b)');
});

// 随机表达式：渲染再解析后求值必须不变——保证公式卡片上显示的式子与计算一致
function rnd(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
function randomExpr(r, depth) {
  if (depth <= 0 || r() < 0.25) return r() < 0.5 ? ['a', 'b', 'c', 'd'][Math.floor(r() * 4)] : String(1 + Math.floor(r() * 9));
  const k = r();
  if (k < 0.1) return `-(${randomExpr(r, depth - 1)})`;
  if (k < 0.2) return `sum(${randomExpr(r, depth - 1)}, ${randomExpr(r, depth - 1)})`;
  const op = ['+', '-', '*', '/'][Math.floor(r() * 4)];
  return `(${randomExpr(r, depth - 1)} ${op} ${randomExpr(r, depth - 1)})`;
}

test('渲染-解析往返求值一致（500 个随机表达式）', () => {
  const r = rnd(42);
  const vars = { a: 1.7, b: -2.3, c: 3.1, d: 0.6 };
  for (let i = 0; i < 500; i++) {
    const src = randomExpr(r, 5);
    const v1 = ev(src, vars);
    const v2 = ev(plain(src), vars);
    if (!Number.isFinite(v1)) continue;
    assert.ok(Math.abs(v1 - v2) <= 1e-9 * Math.max(1, Math.abs(v1)), `${src} → ${plain(src)}: ${v1} vs ${v2}`);
  }
});

test('依赖图：拓扑求值、上下游、循环检测', () => {
  const g = new Graph([
    { id: 'x', base: 2 },
    { id: 'y', base: 3 },
    { id: 's', expr: 'x + y' },
    { id: 'p', expr: 's * x' },
    { id: 'q', expr: 'p - y' },
  ]);
  const v = g.compute({ x: 4 });
  assert.equal(v.s, 7);
  assert.equal(v.p, 28);
  assert.equal(v.q, 25);
  assert.deepEqual(g.upstream('q'), ['x', 'y', 's', 'p'].filter((id) => g.upstream('q').includes(id)).sort((a, b) => g.rank.get(a) - g.rank.get(b)));
  assert.deepEqual(new Set(g.upstream('q')), new Set(['x', 'y', 's', 'p']));
  assert.deepEqual(new Set(g.downstream('x')), new Set(['s', 'p', 'q']));
  assert.throws(() => new Graph([{ id: 'a', expr: 'b + 1' }, { id: 'b', expr: 'a + 1' }]), /循环/);
  assert.throws(() => new Graph([{ id: 'a', expr: 'zz + 1' }]), /不存在/);
  assert.throws(() => new Graph([{ id: 'a', base: 1 }, { id: 'a', base: 2 }]), /重复/);
});
