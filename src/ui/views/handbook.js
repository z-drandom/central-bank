import { h } from '../dom.js';
export default function view(app) {
  const el = h('div', { class: 'sheet' }, '建设中');
  return { id: 'handbook', title: 'handbook', mods: [], el, update() {} };
}
