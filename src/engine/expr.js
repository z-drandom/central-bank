// 极简表达式语言：同一棵语法树既用于求值，也用于渲染公式卡片，
// 保证"显示出来的公式"与"实际参与计算的公式"永远一致。
//
// 语法：数字、变量名、+ - * / ^、括号、函数 sum/min/max/abs。

const FUNCS = {
  sum: (...xs) => xs.reduce((a, b) => a + b, 0),
  min: (...xs) => Math.min(...xs),
  max: (...xs) => Math.max(...xs),
  abs: (x) => Math.abs(x),
};

export function tokenize(src) {
  const toks = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\n' || c === '\t') { i++; continue; }
    if ((c >= '0' && c <= '9') || c === '.') {
      const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i));
      if (!m) throw new SyntaxError(`数字格式错误 @${i}: ${src}`);
      toks.push({ t: 'num', v: parseFloat(m[0]) });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
      toks.push({ t: 'id', v: m[0] });
      i += m[0].length;
      continue;
    }
    if ('+-*/^(),'.includes(c)) { toks.push({ t: c }); i++; continue; }
    throw new SyntaxError(`无法识别的字符 "${c}" @${i}: ${src}`);
  }
  toks.push({ t: 'eof' });
  return toks;
}

export function parse(src) {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const next = () => toks[p++];
  const expect = (t) => {
    if (peek().t !== t) throw new SyntaxError(`期望 "${t}"，得到 "${peek().t}"：${src}`);
    return next();
  };

  function expr() {
    let a = term();
    while (peek().t === '+' || peek().t === '-') {
      const op = next().t;
      a = { k: 'bin', op, a, b: term() };
    }
    return a;
  }
  function term() {
    let a = unary();
    while (peek().t === '*' || peek().t === '/') {
      const op = next().t;
      a = { k: 'bin', op, a, b: unary() };
    }
    return a;
  }
  function unary() {
    if (peek().t === '-') { next(); return { k: 'neg', a: unary() }; }
    return power();
  }
  function power() {
    const a = primary();
    if (peek().t === '^') { next(); return { k: 'bin', op: '^', a, b: unary() }; }
    return a;
  }
  function primary() {
    const tk = next();
    if (tk.t === 'num') return { k: 'num', v: tk.v };
    if (tk.t === 'id') {
      if (peek().t === '(') {
        next();
        if (!FUNCS[tk.v]) throw new SyntaxError(`未知函数 ${tk.v}：${src}`);
        const args = [];
        if (peek().t !== ')') {
          args.push(expr());
          while (peek().t === ',') { next(); args.push(expr()); }
        }
        expect(')');
        return { k: 'call', fn: tk.v, args };
      }
      return { k: 'var', id: tk.v };
    }
    if (tk.t === '(') {
      const e = expr();
      expect(')');
      return e;
    }
    throw new SyntaxError(`意外的 "${tk.t}"：${src}`);
  }

  const ast = expr();
  expect('eof');
  return ast;
}

export function evaluate(ast, get) {
  switch (ast.k) {
    case 'num': return ast.v;
    case 'var': {
      const v = get(ast.id);
      // 未定义说明依赖图出错，必须报错；NaN/Infinity 属于数值越界，让它传播，由界面显示为"—"
      if (v === undefined) throw new Error(`变量 ${ast.id} 无值`);
      return v;
    }
    case 'neg': return -evaluate(ast.a, get);
    case 'bin': {
      const a = evaluate(ast.a, get);
      const b = evaluate(ast.b, get);
      switch (ast.op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return a / b;
        case '^': return a ** b;
      }
      throw new Error(`未知运算符 ${ast.op}`);
    }
    case 'call': return FUNCS[ast.fn](...ast.args.map((x) => evaluate(x, get)));
  }
  throw new Error(`未知节点 ${ast.k}`);
}

export function depsOf(ast, out = new Set()) {
  switch (ast.k) {
    case 'var': out.add(ast.id); break;
    case 'neg': depsOf(ast.a, out); break;
    case 'bin': depsOf(ast.a, out); depsOf(ast.b, out); break;
    case 'call': ast.args.forEach((x) => depsOf(x, out)); break;
  }
  return out;
}

// ---------- 渲染 ----------
// 优先级：加减 1，乘除 2，负号 3，乘方 4，原子 9。
function prec(n) {
  if (n.k === 'bin') return n.op === '+' || n.op === '-' ? 1 : n.op === '^' ? 4 : 2;
  if (n.k === 'neg') return 3;
  if (n.k === 'call' && n.fn === 'sum') return n.args.length > 1 ? 1 : 9;
  return 9;
}

const OP_TEXT = { '+': ' + ', '-': ' − ', '*': ' × ', '/': ' ÷ ' };

/**
 * 把语法树渲染成字符串。
 * @param leaf (id) => string   变量如何显示（符号 / 中文名 / 代入值）
 * @param num  (v) => string    常数如何显示
 * @param wrap (s) => string    加括号的方式
 */
export function render(ast, { leaf, num = (v) => String(v), wrap = (s) => `(${s})`, sup = (s) => `^${s}` }) {
  function r(n) {
    switch (n.k) {
      case 'num': return num(n.v);
      case 'var': return leaf(n.id);
      case 'neg': {
        const inner = r(n.a);
        return '−' + (prec(n.a) < 3 ? wrap(inner) : inner);
      }
      case 'bin': {
        const p = prec(n);
        let a = r(n.a);
        let b = r(n.b);
        if (n.op === '^') {
          if (prec(n.a) <= 4) a = wrap(a);
          return a + sup(b);
        }
        if (prec(n.a) < p) a = wrap(a);
        const pb = prec(n.b);
        if (pb < p || (pb === p && (n.op === '-' || n.op === '/'))) b = wrap(b);
        return a + OP_TEXT[n.op] + b;
      }
      case 'call': {
        const parts = n.args.map((x) => (n.fn === 'sum' && x.k === 'neg' ? wrap(r(x)) : r(x)));
        if (n.fn === 'sum') return parts.join(' + ');
        if (n.fn === 'abs') return `|${parts[0]}|`;
        return `${n.fn}{${parts.join(', ')}}`;
      }
    }
    return '?';
  }
  return r(ast);
}

export { FUNCS };
