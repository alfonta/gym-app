// The manual's rule tables are rendered from the same data solve() uses, so they cannot disagree.
import { h, s } from './dom.js';
import * as chopsticks from './logic/chopsticks.js';
import * as bottle from './logic/bottle.js';
import * as kanji from './logic/kanji.js';
import * as conveyor from './logic/conveyor.js';
import * as maze from './logic/maze.js';
import * as password from './logic/password.js';

const $ = (id) => document.getElementById(id);

// Chopsticks
for (const [n, rules] of Object.entries(chopsticks.RULES)) {
  $('chopsticks-rules').append(h('div', { class: 'rule-box' }, h('h3', { text: `${n} מקלות` }), h('ol', {}, rules.map((r) => h('li', { text: r.text })))));
}

// Soy bottle
$('bottle-rules').append(...bottle.RULES.map((r) => h('li', { text: r.text })));
$('bottle-strips').querySelector('tbody').append(...Object.entries(bottle.STRIPS).map(([key, strip]) =>
  h('tr', {}, h('td', {}, h('span', { class: `swatch sw-${key}` }), strip.name), h('td', { class: 'big', text: String(strip.line) }))));

// Kanji columns
const letters = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];
$('kanji-columns').append(...kanji.COLUMNS.map((col, i) =>
  h('div', { class: 'kanji-col' }, h('div', { class: 'kanji-col-title', lang: 'he', text: `עמודה ${letters[i]}` }), col.map((k) => h('div', { class: 'kanji', text: k })))));

// Conveyor tables
const plate = (key) => h('span', { class: 'plate-name' }, h('span', { class: `swatch sw-${key}` }), h('b', { text: conveyor.PLATES[key].color }), ` (${conveyor.PLATES[key].sushi})`);
for (const [parity, title] of [['even', 'הספרה האחרונה זוגית (2, 4, 6, 8)'], ['odd', 'הספרה האחרונה אי־זוגית (3, 5, 7, 9)']]) {
  $('conveyor-tables').append(h('div', { class: 'rule-box' }, h('h3', { text: title }),
    h('table', {},
      h('thead', {}, h('tr', {}, h('th', { text: 'הבהבה' }), h('th', { text: '0 טעויות — לוחצים' }), h('th', { text: 'טעות 1 — לוחצים' }), h('th', { text: '2 טעויות ומעלה — לוחצים' }))),
      h('tbody', {}, conveyor.PLATE_KEYS.map((key) => h('tr', {}, h('th', {}, plate(key)), conveyor.MAPS[parity].map((map) => h('td', {}, plate(map[key])))))))));
}

// Mazes
const P = 10; // padding
const C = 16; // cell size
maze.MAZES.forEach((mz, i) => {
  const svg = s('svg', { viewBox: '0 0 116 116', class: 'maze-svg', role: 'img', 'aria-label': `מבוך ${i + 1}` });
  svg.append(s('rect', { x: P, y: P, width: C * 6, height: C * 6, class: 'mz-frame' }));
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) svg.append(s('circle', { cx: P + C * c + C / 2, cy: P + C * r + C / 2, r: 1.1, class: 'mz-dot' }));
  svg.append(s('circle', { cx: P + C * mz.marker[1] + C / 2, cy: P + C * mz.marker[0] + C / 2, r: 5.2, class: 'mz-ginger' }));
  mz.v.forEach((row, r) => row.split('').forEach((w, c) => {
    if (w === '1') svg.append(s('line', { x1: P + C * (c + 1), y1: P + C * r, x2: P + C * (c + 1), y2: P + C * (r + 1), class: 'mz-wall' }));
  }));
  mz.h.forEach((row, r) => row.split('').forEach((w, c) => {
    if (w === '1') svg.append(s('line', { x1: P + C * c, y1: P + C * (r + 1), x2: P + C * (c + 1), y2: P + C * (r + 1), class: 'mz-wall' }));
  }));
  const [mr, mc] = mz.marker;
  $('maze-list').append(h('figure', { class: 'maze-fig' }, svg,
    h('figcaption', { dir: 'rtl', text: `מבוך ${i + 1} · ג'ינג'ר: שורה ${mr + 1}, עמודה ${mc + 1} משמאל` })));
});

// Password words
$('password-words').append(...[...password.WORDS].sort().map((w) => h('span', { class: 'word', text: w })));

// Keep the phone awake while the manual is open (silently ignored where unsupported).
async function keepAwake() {
  try {
    if ('wakeLock' in navigator && document.visibilityState === 'visible') await navigator.wakeLock.request('screen');
  } catch { /* not allowed right now */ }
}
keepAwake();
document.addEventListener('visibilitychange', keepAwake);
document.addEventListener('click', keepAwake, { once: true });
