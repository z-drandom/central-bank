import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { generate } from '../scripts/gen-model-doc.mjs';

test('docs/MODEL.md 与模型规格同步（改了公式请运行 npm run docs）', async () => {
  const cur = await readFile(new URL('../docs/MODEL.md', import.meta.url), 'utf8');
  assert.equal(cur, generate());
});
