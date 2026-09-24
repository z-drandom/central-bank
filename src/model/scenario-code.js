// 情景代码：把情景压成一段可复制的文本（base64 编码的 JSON），便于分享。
export function encodeScenario(sc) {
  const json = JSON.stringify({ v: 1, ...sc });
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return 'FS1.' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeScenario(code) {
  const t = String(code).trim().replace(/^FS1\./, '').replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(t + '==='.slice((t.length + 3) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const obj = JSON.parse(new TextDecoder().decode(bytes));
  if (!obj || typeof obj !== 'object' || obj.v !== 1) throw new Error('不是有效的情景代码');
  return { m: obj.m ?? {}, i: obj.i ?? {} };
}
