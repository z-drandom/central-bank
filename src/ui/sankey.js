// 桑基图：节点按列排布，高度与金额成正比；连线宽度与流量成正比。
// 为了让"分项多、金额小"的列（税种、支出分类）的标签不重叠，节点可以设 minSlot：
// 节点本身仍按比例画，但在列里占一个最小高度的"槽位"。

export function layoutSankey({ nodes, links, width, height, nodeW = 12, gap = 8, padX = 0, colX, colAlign = {}, colOffset = {}, ky }) {
  const map = new Map(nodes.map((n) => [n.id, { ...n, ins: [], outs: [] }]));
  const L = links
    .filter((l) => l.v > 1e-9 && map.has(l.s) && map.has(l.t))
    .map((l) => ({ ...l }));
  for (const l of L) {
    map.get(l.s).outs.push(l);
    map.get(l.t).ins.push(l);
  }
  for (const n of map.values()) {
    const vin = n.ins.reduce((a, l) => a + l.v, 0);
    const vout = n.outs.reduce((a, l) => a + l.v, 0);
    n.value = Math.max(vin, vout, n.v ?? 0);
  }
  const cols = Math.max(...nodes.map((n) => n.col)) + 1;
  const xOf = colX ?? ((c) => padX + (c * (width - 2 * padX - nodeW)) / Math.max(1, cols - 1));

  // 比例尺：取"普通列"（没有 minSlot 的列）里合计最大的一列
  if (ky == null) {
    let best = Infinity;
    for (let c = 0; c < cols; c++) {
      const col = [...map.values()].filter((n) => n.col === c);
      if (!col.length || col.some((n) => n.minSlot)) continue;
      const sum = col.reduce((a, n) => a + n.value, 0);
      const extra = col.reduce((a, n) => a + (n.gapBefore ?? 0), 0) + gap * (col.length - 1);
      if (sum > 0) best = Math.min(best, (height - extra) / sum);
    }
    ky = Number.isFinite(best) ? best : 1;
  }

  const colH = [];
  for (let c = 0; c < cols; c++) {
    let y = 0;
    for (const n of [...map.values()].filter((x) => x.col === c)) {
      y += n.gapBefore ?? 0;
      const hgt = Math.max(n.value * ky, n.value > 0 ? 1 : 0);
      const slot = Math.max(hgt, n.minSlot ?? 0);
      n.x0 = n.x ?? xOf(c);
      n.x1 = n.x0 + nodeW;
      n.y0 = y + (n.slotAlign === 'top' ? 0 : (slot - hgt) / 2);
      n.y1 = n.y0 + hgt;
      n.slotTop = y;
      n.slotH = slot;
      y += slot + gap;
    }
    colH[c] = Math.max(0, y - gap);
  }
  const H = Math.max(height, ...colH);
  for (const n of map.values()) {
    const a = colAlign[n.col] ?? 'top';
    const off = colOffset[n.col] != null ? colOffset[n.col] : a === 'center' ? (H - colH[n.col]) / 2 : a === 'bottom' ? H - colH[n.col] : 0;
    n.y0 += off;
    n.y1 += off;
    n.slotTop += off;
  }
  // 连线端点：出线按目标位置排序，入线按来源位置排序
  const mid = (n) => (n.y0 + n.y1) / 2;
  for (const n of map.values()) {
    let y = n.y0;
    for (const l of [...n.outs].sort((a, b) => mid(map.get(a.t)) - mid(map.get(b.t)))) {
      l.sy0 = y;
      y += l.v * ky;
      l.sy1 = y;
    }
    y = n.y0;
    for (const l of [...n.ins].sort((a, b) => mid(map.get(a.s)) - mid(map.get(b.s)))) {
      l.ty0 = y;
      y += l.v * ky;
      l.ty1 = y;
    }
  }
  for (const l of L) {
    const s = map.get(l.s);
    const t = map.get(l.t);
    const x0 = s.x1;
    const x1 = t.x0;
    const xm = (x0 + x1) / 2;
    l.path = `M${x0},${l.sy0}C${xm},${l.sy0} ${xm},${l.ty0} ${x1},${l.ty0}L${x1},${l.ty1}C${xm},${l.ty1} ${xm},${l.sy1} ${x0},${l.sy1}Z`;
    const cy0 = (l.sy0 + l.sy1) / 2;
    const cy1 = (l.ty0 + l.ty1) / 2;
    l.center = `M${x0},${cy0}C${xm},${cy0} ${xm},${cy1} ${x1},${cy1}`;
    l.w = l.v * ky;
  }
  return { nodes: [...map.values()], links: L, height: H, ky };
}
