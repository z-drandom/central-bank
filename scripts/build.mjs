// 打包为单文件：dist/index.html（完整网页，可直接双击打开）与 dist/artifact.html（无 html/head/body 外壳的片段）
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const FONTS = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,500;1,400&family=Noto+Sans+SC:wght@400;500;700&family=Noto+Serif+SC:wght@700;900&display=swap';

const result = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  minify: true,
  target: ['es2020'],
  write: false,
  legalComments: 'none',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = await readFile('src/styles.css', 'utf8');

const head = `<title>中国财政沙盘</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<style>${css}</style>`;
const body = `<div id="app"></div>
<script>${js}</script>`;

await mkdir('dist', { recursive: true });
await writeFile('dist/artifact.html', `${head}\n${body}\n`);
await writeFile(
  'dist/index.html',
  `<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`,
);
const kb = (Buffer.byteLength(js) + Buffer.byteLength(css)) / 1024;
console.log(`dist/index.html, dist/artifact.html 已生成（JS+CSS ${kb.toFixed(0)} KB）`);
