// 兼容性：构建目标是 ES2020（覆盖 Safari 14 / 较旧的国产浏览器内核），esbuild 只转语法、不补 API，
// 所以源码里不能用 ES2022 以后才有的内置方法。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function files(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await files(p)));
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

test('源码不使用 ES2022+ 内置方法（.at、findLast、hasOwn、structuredClone、toSorted、replaceAll）', async () => {
  const bad = [];
  for (const f of await files('src')) {
    const src = await readFile(f, 'utf8');
    src.split('\n').forEach((line, i) => {
      if (/\.at\(|\.findLast(Index)?\(|Object\.hasOwn\(|structuredClone\(|\.toSorted\(|\.toReversed\(|\.replaceAll\(/.test(line)) bad.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(bad, []);
});

test('相图配色不支持 color-mix 时有降级样式', async () => {
  const css = await readFile('src/styles.css', 'utf8');
  assert.match(css, /@supports not \(color: color-mix/);
});

// 注意：含 var() 的声明在解析时一律当作有效，到计算时才失效并回到初始值（透明），
// 所以"同一条规则里先写纯色、再写 color-mix"兜不住，必须放进 @supports 降级块。
test('每一处 color-mix 都在 @supports 降级块里有同选择器、同属性的纯色兜底', async () => {
  const css = (await readFile('src/styles.css', 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
  const sup = css.indexOf('@supports not (color: color-mix');
  const end = css.indexOf('\n}', sup);
  const covered = new Set();
  const bad = [];
  const norm = (p) => (p === 'background-color' ? 'background' : p);
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const inSup = m.index > sup && m.index < end;
    const sels = m[1].replace(/^[\s\S]*@supports[^{]*\{/, '').split(',').map((s) => s.trim().replace(/\s+/g, ' '));
    for (const d of m[2].split(';')) {
      const p = /^\s*([\w-]+)\s*:\s*([\s\S]*)$/.exec(d);
      if (!p) continue;
      if (inSup) { if (!/color-mix/.test(p[2])) sels.forEach((s) => covered.add(`${s}|${norm(p[1])}`)); }
      else if (/color-mix/.test(p[2])) sels.forEach((s) => bad.push(`${s}|${norm(p[1])}`));
    }
  }
  assert.ok(bad.length >= 30, `应扫描到全部 color-mix 声明，实际 ${bad.length}`);
  assert.deepEqual(bad.filter((k) => !covered.has(k)), []);
});

test('脚本里拼的 color-mix 内联样式先检测浏览器支持', async () => {
  const bad = [];
  for (const f of await files('src')) {
    const src = await readFile(f, 'utf8');
    if (/color-mix\(/.test(src) && !/CSS\.supports\([^)]*color-mix/.test(src)) bad.push(f);
  }
  assert.deepEqual(bad, []);
});
