// DOM components for the six modules. Each factory gets (mod, api) and returns
// { el, debug(), destroy() }. All rules come from the pure logic modules.
import { h, s } from './dom.js';
import { sfx } from './audio.js';
import * as chopsticks from './logic/chopsticks.js';
import * as bottle from './logic/bottle.js';
import * as kanji from './logic/kanji.js';
import * as conveyor from './logic/conveyor.js';
import * as maze from './logic/maze.js';
import * as password from './logic/password.js';

const ORDINALS = ['הראשון', 'השני', 'השלישי', 'הרביעי', 'החמישי', 'השישי'];

function chopsticksUI(mod, api) {
  const { colors } = mod.state;
  const answer = chopsticks.solve(mod.state, api.features).index;
  const el = h('div', { class: 'chopsticks' });
  colors.forEach((color, i) => {
    const stick = h('button', { class: `stick c-${color}`, type: 'button', 'aria-label': `צ'ופסטיק ${chopsticks.COLORS[color]}` },
      h('span', { class: 'half a' }), h('span', { class: 'half b' }));
    stick.addEventListener('click', () => {
      if (!api.active() || stick.classList.contains('broken')) return;
      stick.classList.add('broken');
      sfx.snap();
      if (i === answer) api.solved();
      else api.strike(`נשבר ה${chopsticks.COLORS[color]} (${ORDINALS[i]} מלמעלה)`);
    });
    el.append(stick);
  });
  return { el, debug: () => chopsticks.debugText(mod.state, api.features) };
}

function bottleUI(mod, api) {
  const state = mod.state;
  const fill = h('div', { class: 'dish-fill' });
  const dish = h('div', { class: 'dish' }, fill);
  const scale = bottle.LINES + 0.7;
  for (let line = 1; line <= bottle.LINES; line++) {
    dish.append(h('div', { class: 'dish-line', style: `bottom:${(line / scale) * 100}%` }, h('span', { text: String(line) })));
  }
  const strip = h('div', { class: 'strip' });
  const btn = h('button', { class: `bottle c-${state.color}`, type: 'button' },
    h('span', { class: 'bottle-cap' }), h('span', { class: 'bottle-body' }, h('span', { class: 'bottle-label', text: state.label })));
  const el = h('div', { class: 'bottle-module' }, dish, btn, strip);

  let downAt = null;
  let raf = 0;
  const reset = () => {
    downAt = null;
    cancelAnimationFrame(raf);
    btn.classList.remove('down');
    strip.className = 'strip';
  };
  const release = () => {
    if (downAt === null) return;
    const held = performance.now() - downAt;
    reset();
    if (!api.active()) return;
    const result = bottle.judge(state, api.features, held);
    if (result.ok) {
      api.solved();
    } else {
      api.strike(`בבקבוק הסויה: ${result.did}`);
      setTimeout(() => { if (downAt === null) fill.style.height = '0%'; }, 700);
    }
  };
  const frame = () => {
    if (downAt === null) return;
    const held = performance.now() - downAt;
    fill.style.height = `${Math.min(100, (bottle.levelAt(held) / scale) * 100)}%`;
    if (held >= bottle.TAP_MS) strip.className = `strip on s-${state.strip}`;
    if (held >= bottle.OVERFLOW_MS) return release();
    raf = requestAnimationFrame(frame);
  };
  btn.addEventListener('pointerdown', (e) => {
    if (!api.active() || downAt !== null) return;
    e.preventDefault();
    try { btn.setPointerCapture(e.pointerId); } catch { /* not critical */ }
    downAt = performance.now();
    fill.style.height = '0%';
    btn.classList.add('down');
    raf = requestAnimationFrame(frame);
  });
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointercancel', release);
  btn.addEventListener('lostpointercapture', release);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
  return { el, debug: () => bottle.debugText(state, api.features), destroy: reset };
}

function kanjiUI(mod, api) {
  const { order } = kanji.solve(mod.state);
  let progress = 0;
  const el = h('div', { class: 'kanji-pad', lang: 'ja' });
  mod.state.keys.forEach((key) => {
    const btn = h('button', { class: 'kanji-key', type: 'button', text: key });
    btn.addEventListener('click', () => {
      if (!api.active() || btn.classList.contains('pressed')) return;
      if (key === order[progress]) {
        btn.classList.add('pressed');
        sfx.click();
        progress++;
        if (progress === order.length) api.solved();
      } else {
        api.strike(`בלוח הקאנג'י נלחץ ${key} לא לפי הסדר`);
      }
    });
    el.append(btn);
  });
  return { el, debug: () => kanji.debugText(mod.state) };
}

const SUSHI_ART = {
  // Tuna nigiri: red slab on rice.
  red: () => [s('ellipse', { cx: 50, cy: 64, rx: 34, ry: 14, fill: '#fff', stroke: '#c9c2b4', 'stroke-width': 2 }),
    s('path', { d: 'M16 52 Q50 22 84 52 Q50 64 16 52Z', fill: '#d8343a' })],
  // Salmon nigiri: orange slab with white stripes.
  orange: () => [s('ellipse', { cx: 50, cy: 64, rx: 34, ry: 14, fill: '#fff', stroke: '#c9c2b4', 'stroke-width': 2 }),
    s('path', { d: 'M16 52 Q50 22 84 52 Q50 64 16 52Z', fill: '#f58a3c' }),
    s('path', { d: 'M32 42 l8 16 M46 36 l8 22 M60 38 l8 18', stroke: '#fff', 'stroke-width': 4, 'stroke-linecap': 'round', fill: 'none' })],
  // Cucumber maki: round roll seen from above.
  green: () => [s('circle', { cx: 50, cy: 50, r: 32, fill: '#1d2b24' }), s('circle', { cx: 50, cy: 50, r: 25, fill: '#fff' }),
    s('circle', { cx: 50, cy: 50, r: 11, fill: '#3fae5a' })],
  // Tamago: yellow block tied with a nori band.
  yellow: () => [s('ellipse', { cx: 50, cy: 66, rx: 34, ry: 13, fill: '#fff', stroke: '#c9c2b4', 'stroke-width': 2 }),
    s('rect', { x: 18, y: 34, width: 64, height: 24, rx: 5, fill: '#f6cf3b' }),
    s('rect', { x: 43, y: 31, width: 14, height: 44, rx: 3, fill: '#1d2b24' })],
};

function conveyorUI(mod, api) {
  const { sequence } = mod.state;
  let stage = 1;
  let input = 0;
  let timers = [];
  const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
  const clear = () => { timers.forEach(clearTimeout); timers = []; };

  const plates = {};
  const row = h('div', { class: 'plates' });
  const pips = h('div', { class: 'pips' });
  const drawPips = () => {
    pips.replaceChildren(...sequence.map((_, i) => h('span', { class: `pip${i < stage - 1 ? ' done' : ''}${i === stage - 1 ? ' current' : ''}` })),
      h('span', { class: 'pip-text', text: `נלחצו ${input} מתוך ${stage}` }));
  };
  const flash = (key, ms) => {
    plates[key].classList.add('lit');
    sfx.plate(key);
    later(() => plates[key].classList.remove('lit'), ms);
  };
  const play = () => {
    clear();
    input = 0;
    drawPips();
    for (let i = 0; i < stage; i++) later(() => { if (api.active()) flash(sequence[i], 450); }, i * 750);
    later(() => { if (api.active()) play(); }, (stage - 1) * 750 + 450 + 3000);
  };
  conveyor.PLATE_KEYS.forEach((key) => {
    const btn = h('button', { class: `plate p-${key}`, type: 'button', 'aria-label': `צלחת ${conveyor.PLATES[key].color}` },
      s('svg', { viewBox: '0 0 100 100' }, ...SUSHI_ART[key]()));
    btn.addEventListener('click', () => {
      if (!api.active()) return;
      clear();
      Object.values(plates).forEach((p) => p.classList.remove('lit'));
      const expected = conveyor.mappingFor(api.features, api.strikes())[sequence[input]];
      if (key !== expected) {
        api.strike(`במסוע נלחצה צלחת ה${conveyor.PLATES[key].sushi} (${conveyor.PLATES[key].color}) בטעות`);
        input = 0;
        drawPips();
        later(() => { if (api.active()) play(); }, 1200);
        return;
      }
      flash(key, 200);
      input++;
      if (input === stage) {
        if (stage === sequence.length) { clear(); api.solved(); return; }
        stage++;
        input = 0;
        drawPips();
        later(() => { if (api.active()) play(); }, 1100);
      } else {
        drawPips();
        // Mid-entry: give the team time to talk before the sequence starts over.
        later(() => { if (api.active()) play(); }, 6000);
      }
    });
    plates[key] = btn;
    row.append(btn);
  });
  drawPips();
  later(() => { if (api.active()) play(); }, 1500);
  return {
    el: h('div', { class: 'conveyor' }, h('div', { class: 'belt' }, row), pips),
    debug: () => conveyor.debugText(mod.state, api.features, { strikes: api.strikes(), stage }),
    destroy: clear,
  };
}

function mazeUI(mod, api) {
  const state = mod.state;
  const mz = maze.MAZES[state.mazeIndex];
  let pos = state.start.slice();
  const cx = (c) => 10 + c * 16;
  const svg = s('svg', { viewBox: '0 0 100 100', class: 'maze-grid' });
  svg.append(s('rect', { x: 1, y: 1, width: 98, height: 98, rx: 6, class: 'maze-bg' }));
  for (let r = 0; r < maze.SIZE; r++) for (let c = 0; c < maze.SIZE; c++) svg.append(s('rect', { x: cx(c) - 2, y: cx(r) - 2, width: 4, height: 4, rx: 1, class: 'maze-dot' }));
  svg.append(s('circle', { cx: cx(mz.marker[1]), cy: cx(mz.marker[0]), r: 6.2, class: 'maze-ginger' }));
  svg.append(s('path', { d: `M${cx(state.target[1])} ${cx(state.target[0]) - 5.5} l5.5 10 h-11 Z`, class: 'maze-target' }));
  const me = s('circle', { r: 4.2, class: 'maze-me' });
  svg.append(me);
  const draw = () => { me.setAttribute('cx', cx(pos[1])); me.setAttribute('cy', cx(pos[0])); };
  draw();
  const move = (dir) => {
    if (!api.active()) return;
    if (!maze.canMove(mz, pos, dir)) {
      api.strike(`במבוך: נתקעתם בקיר בתנועה ${maze.DIRS[dir].name}`);
      return;
    }
    pos = [pos[0] + maze.DIRS[dir].dr, pos[1] + maze.DIRS[dir].dc];
    sfx.click();
    draw();
    if (pos[0] === state.target[0] && pos[1] === state.target[1]) api.solved();
    else api.changed();
  };
  const arrow = (dir) => h('button', { class: `arrow a-${dir}`, type: 'button', 'aria-label': maze.DIRS[dir].name, text: { up: '▲', down: '▼', left: '◀', right: '▶' }[dir], onclick: () => move(dir) });
  const onKey = (e) => {
    const dir = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.key];
    if (!dir || !api.active()) return;
    e.preventDefault();
    move(dir);
  };
  document.addEventListener('keydown', onKey);
  const el = h('div', { class: 'maze', dir: 'ltr' }, svg,
    h('div', { class: 'arrows' }, arrow('up'), arrow('left'), arrow('down'), arrow('right')));
  return { el, debug: () => maze.debugText({ ...state, pos }), destroy: () => document.removeEventListener('keydown', onKey) };
}

function passwordUI(mod, api) {
  const { columns, start } = mod.state;
  const answer = password.solve(mod.state).word;
  const idx = start.slice();
  const letters = [];
  const cols = columns.map((col, i) => {
    const letter = h('div', { class: 'pw-letter', text: col[idx[i]] });
    letters.push(letter);
    const step = (d) => () => {
      if (!api.active()) return;
      idx[i] = (idx[i] + d + col.length) % col.length;
      letter.textContent = col[idx[i]];
      sfx.click();
    };
    return h('div', { class: 'pw-col' },
      h('button', { class: 'pw-btn', type: 'button', 'aria-label': 'אות קודמת', text: '▲', onclick: step(-1) }), letter,
      h('button', { class: 'pw-btn', type: 'button', 'aria-label': 'אות הבאה', text: '▼', onclick: step(1) }));
  });
  const submit = h('button', { class: 'pw-submit', type: 'button', text: 'שלח', onclick: () => {
    if (!api.active()) return;
    const word = columns.map((col, i) => col[idx[i]]).join('');
    if (word === answer) api.solved();
    else api.strike(`נשלחה סיסמה שגויה: ${word}`);
  } });
  return { el: h('div', { class: 'password' }, h('div', { class: 'pw-cols', dir: 'ltr' }, cols), submit), debug: () => password.debugText(mod.state) };
}

export const MODULE_UI = { chopsticks: chopsticksUI, bottle: bottleUI, kanji: kanjiUI, conveyor: conveyorUI, maze: mazeUI, password: passwordUI };
