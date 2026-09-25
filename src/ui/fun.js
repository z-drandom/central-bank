// 好玩的部分：彩纸、成就徽章弹窗、成就统计与成就墙。
import { h, esc, load, save } from './dom.js';
import { ACHIEVEMENTS, checkAchievements, recordEvent } from '../model/achievements.js';
import { CHALLENGES } from '../model/challenges.js';

const KEY = 'fiscal-sandbox-achievements-v1';
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 一小阵彩纸；系统开启"减少动态效果"时不放 */
export function confetti({ x, y, n = 40 } = {}) {
  if (reduced() || typeof document === 'undefined') return;
  const cx = x ?? window.innerWidth / 2;
  const cy = y ?? window.innerHeight * 0.3;
  const colors = ['var(--up)', 'var(--gold)', 'var(--xfer)', 'var(--rev)', 'var(--hid)', 'var(--exp)'];
  const layer = document.createElement('div');
  layer.className = 'confetti';
  layer.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    const ang = Math.random() * Math.PI * 2;
    const dist = 90 + Math.random() * 190;
    p.style.left = `${cx}px`;
    p.style.top = `${cy}px`;
    p.style.background = colors[i % colors.length];
    p.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
    p.style.setProperty('--dy', `${Math.sin(ang) * dist - 60}px`);
    p.style.setProperty('--rot', `${Math.round(Math.random() * 720 - 360)}deg`);
    p.style.animationDelay = `${Math.random() * 90}ms`;
    if (i % 3 === 0) p.style.borderRadius = '50%';
    layer.append(p);
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 1700);
}

export function createAchievements(app) {
  let data = load(KEY, null) ?? { unlocked: [], stats: {} };
  if (!Array.isArray(data.unlocked) || typeof data.stats !== 'object') data = { unlocked: [], stats: {} };
  const counts = { challenges: CHALLENGES.length };
  const listeners = new Set();
  let saveTimer = null;
  const persist = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => save(KEY, data), 400); };

  // 徽章弹窗：一次一个，排队显示
  const toast = h('div', { class: 'badge-toast', hidden: true, role: 'status', 'aria-live': 'polite' });
  const queue = [];
  let showing = false;
  function next() {
    const a = queue.shift();
    if (!a) { showing = false; toast.hidden = true; return; }
    showing = true;
    toast.innerHTML = `<span class="bt-icon" aria-hidden="true">${esc(a.icon)}</span><span><small>解锁成就 · ${data.unlocked.length}/${ACHIEVEMENTS.length}</small><b>${esc(a.title)}</b><em>${esc(a.desc)}</em></span>`;
    toast.hidden = false;
    toast.classList.remove('in');
    void toast.offsetWidth;
    toast.classList.add('in');
    const r = toast.getBoundingClientRect();
    confetti({ x: r.left + r.width / 2, y: r.top + r.height / 2, n: 28 });
    setTimeout(next, 3200);
  }

  function check() {
    const newly = checkAchievements(data.unlocked, data.stats, app.v, counts);
    if (!newly.length) return;
    data.unlocked.push(...newly);
    save(KEY, data);
    for (const id of newly) queue.push(ACHIEVEMENTS.find((a) => a.id === id));
    if (!showing) next();
    for (const fn of listeners) fn();
  }

  /** 记录一个行为（统计规则见 model/achievements.js 的 recordEvent） */
  function track(ev, payload) {
    recordEvent(data.stats, ev, payload);
    persist();
    check();
  }

  app.onUpdate(() => check());

  function wall() {
    const got = new Set(data.unlocked);
    return h('div', { class: 'badge-wall' }, ACHIEVEMENTS.map((a) => h('div', { class: `badge ${got.has(a.id) ? 'on' : ''}`, title: got.has(a.id) ? a.desc : `怎么解锁：${a.hint}` },
      h('span', { class: 'b-icon', 'aria-hidden': 'true' }, got.has(a.id) ? a.icon : '?'),
      h('b', {}, a.title),
      h('small', {}, got.has(a.id) ? a.desc : a.hint),
    )));
  }

  return {
    el: toast, track, wall, check,
    onChange: (fn) => listeners.add(fn),
    get count() { return data.unlocked.length; },
    get total() { return ACHIEVEMENTS.length; },
    get stats() { return data.stats; },
    reset() { data = { unlocked: [], stats: {} }; save(KEY, data); for (const fn of listeners) fn(); },
  };
}
