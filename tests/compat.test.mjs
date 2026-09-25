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
