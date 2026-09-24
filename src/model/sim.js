// 模拟器状态：平衡规则 + 输入参数 → 当前值；并维护同一规则下的基线值用于对比。
import { Graph, diff, changed } from '../engine/graph.js';
import { buildSpecs, DEFAULT_MODES, CARRY } from './specs.js';

export class Sim {
  constructor(modes = {}) {
    this.modes = { ...DEFAULT_MODES, ...modes };
    this.graph = new Graph(buildSpecs(this.modes));
    this.inputs = this.graph.baseInputs();
    this._refreshBase();
    this.recompute();
  }

  _refreshBase() {
    this.base = this.graph.compute(this.graph.baseInputs());
  }

  recompute() {
    this.values = this.graph.compute(this.inputs);
    return this.values;
  }

  spec(id) {
    return this.graph.specs.get(id);
  }

  has(id) {
    return this.graph.specs.has(id);
  }

  isInput(id) {
    return this.graph.isInput(id);
  }

  set(id, v) {
    if (!this.graph.isInput(id)) throw new Error(`${id} 在当前规则下不是输入参数`);
    this.inputs[id] = v;
    return this.recompute();
  }

  setMany(obj) {
    for (const [id, v] of Object.entries(obj)) {
      if (this.graph.isInput(id)) this.inputs[id] = v;
    }
    return this.recompute();
  }

  /**
   * 切换平衡规则。新变成输入参数的节点沿用它此刻的计算值，
   * 所以切换规则本身不改变任何数字，只改变之后由谁吸收冲击。
   */
  setMode(key, val) {
    if (this.modes[key] === val) return this.values;
    const prev = this.values;
    this.modes = { ...this.modes, [key]: val };
    const g = new Graph(buildSpecs(this.modes));
    const inputs = {};
    for (const n of g.inputs()) {
      if (n.id in this.inputs) inputs[n.id] = this.inputs[n.id];
      else if (n.id in prev) inputs[n.id] = prev[n.id];
      else if (CARRY[n.id]) inputs[n.id] = CARRY[n.id](prev);
      else inputs[n.id] = n.base;
    }
    this.graph = g;
    this.inputs = inputs;
    this._refreshBase();
    return this.recompute();
  }

  setModes(obj) {
    for (const [k, v] of Object.entries(obj)) this.setMode(k, v);
    return this.values;
  }

  reset(ids) {
    const list = ids ?? this.graph.inputs().map((n) => n.id);
    for (const id of list) {
      const n = this.graph.specs.get(id);
      if (n && n.expr == null) this.inputs[id] = n.base;
    }
    return this.recompute();
  }

  resetAll() {
    this.modes = { ...DEFAULT_MODES };
    this.graph = new Graph(buildSpecs(this.modes));
    this.inputs = this.graph.baseInputs();
    this._refreshBase();
    return this.recompute();
  }

  /** 预设情景：相对基线施加变化 [{id, mul}|{id, add}|{id, set}] */
  apply(changes) {
    for (const c of changes) {
      if (!this.graph.isInput(c.id)) continue;
      const b = this.graph.specs.get(c.id).base;
      if ('set' in c) this.inputs[c.id] = c.set;
      else if ('mul' in c) this.inputs[c.id] = b * c.mul;
      else if ('add' in c) this.inputs[c.id] = b + c.add;
    }
    return this.recompute();
  }

  changedIds() {
    return diff(this.graph, this.values, this.base);
  }

  changedInputs() {
    return this.graph.inputs().filter((n) => changed(this.values[n.id], this.base[n.id])).map((n) => n.id);
  }

  /** 可序列化的状态（用于撤销、情景保存） */
  snapshot() {
    return { modes: { ...this.modes }, inputs: { ...this.inputs } };
  }

  restore(snap) {
    this.modes = { ...DEFAULT_MODES, ...snap.modes };
    this.graph = new Graph(buildSpecs(this.modes));
    const inputs = this.graph.baseInputs();
    for (const [k, v] of Object.entries(snap.inputs ?? {})) if (k in inputs && Number.isFinite(v)) inputs[k] = v;
    this.inputs = inputs;
    this._refreshBase();
    return this.recompute();
  }

  /** 紧凑情景：只记录与默认不同的规则和与基线不同的参数 */
  toScenario() {
    const m = {};
    for (const [k, v] of Object.entries(this.modes)) if (DEFAULT_MODES[k] !== v) m[k] = v;
    const i = {};
    for (const n of this.graph.inputs()) if (this.inputs[n.id] !== n.base) i[n.id] = this.inputs[n.id];
    return { m, i };
  }

  fromScenario(sc) {
    return this.restore({ modes: sc.m ?? {}, inputs: sc.i ?? {} });
  }

  /** 快照：用于"先猜后算"等沙盒计算，不影响当前状态 */
  clone() {
    const s = Object.create(Sim.prototype);
    s.modes = { ...this.modes };
    s.graph = this.graph;
    s.inputs = { ...this.inputs };
    s.base = this.base;
    s.values = { ...this.values };
    return s;
  }
}
