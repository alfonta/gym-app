// The bomb page: start screen, game loop, end screens.
import { h } from './dom.js';
import { initAudio, sfx, isMuted, setMuted } from './audio.js';
import { generateBomb, DIFFICULTIES, DIFFICULTY_ORDER, MODULES, MODULE_IDS } from './logic/index.js';
import { MODULE_UI } from './modules-ui.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
let urlSeed = /^\d+$/.test(params.get('seed') || '') ? Number(params.get('seed')) : null;
const app = document.getElementById('app');
const manualUrl = new URL('manual.html', location.href.split(/[?#]/)[0]).href;
let game = null;

const newSeed = () => 1 + Math.floor(Math.random() * 999999);
const fmt = (ms) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

function muteButton() {
  const btn = h('button', { class: 'chip', type: 'button' });
  const draw = () => { btn.textContent = isMuted() ? '🔇 צליל כבוי' : '🔊 צליל פועל'; };
  btn.addEventListener('click', () => { setMuted(!isMuted()); initAudio(); draw(); });
  draw();
  return btn;
}

function fullscreenButton() {
  const root = document.documentElement;
  const request = root.requestFullscreen || root.webkitRequestFullscreen;
  if (!request) return null;
  return h('button', { class: 'chip', type: 'button', text: '⛶ מסך מלא', onclick: () => {
    const current = document.fullscreenElement || document.webkitFullscreenElement;
    try {
      const result = current ? (document.exitFullscreen || document.webkitExitFullscreen).call(document) : request.call(root);
      if (result && result.catch) result.catch(() => {});
    } catch { /* fullscreen refused */ }
  } });
}

function qrBlock() {
  const box = h('div', { class: 'qr' });
  try {
    const qr = window.qrcode(0, 'M');
    qr.addData(manualUrl);
    qr.make();
    box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  } catch {
    box.textContent = 'לא הצלחנו לצייר קוד QR — הקלידו את הכתובת';
  }
  return h('div', { class: 'qr-block' }, h('div', { class: 'qr-title', text: 'המדריך למומחה — סרקו בטלפון' }), box,
    h('a', { class: 'qr-url', href: manualUrl, target: '_blank', rel: 'noopener', dir: 'ltr', text: manualUrl }));
}

function showStart() {
  stopGame();
  const levels = DIFFICULTY_ORDER.map((key) => {
    const d = DIFFICULTIES[key];
    return h('button', { class: 'level', type: 'button', onclick: () => startGame(key, urlSeed ?? newSeed()) },
      h('span', { class: 'level-name', text: d.name }),
      h('span', { class: 'level-info', text: `${d.modules} חידות · ${fmt(d.seconds * 1000)} · ${d.strikes === 1 ? 'טעות אחת מותרת' : `${d.strikes} טעויות מותרות`}` }));
  });
  const practice = MODULE_IDS.map((id) => h('button', { class: 'chip', type: 'button', text: MODULES[id].name, onclick: () => startGame('easy', urlSeed ?? newSeed(), id) }));
  app.replaceChildren(h('main', { class: 'start' },
    h('h1', { text: 'פצצת הבנטו 🍱' }),
    h('p', { class: 'tagline', text: 'משחק לשניים: אחד רואה את הבנטו, השנייה מחזיקה את המדריך. רק ביחד מנטרלים.' }),
    h('div', { class: 'start-grid' },
      h('section', { class: 'card roles' },
        h('h2', { text: 'איך משחקים' }),
        h('p', {}, h('b', { text: 'המנטרל/ת ' }), 'יושב/ת מול המסך, רואה את הבנטו ולוחץ/ת — אבל אסור להציץ במדריך.'),
        h('p', {}, h('b', { text: 'המומחה/ית ' }), 'מחזיק/ה את המדריך בטלפון. המומחה יושב עם הגב לטלוויזיה!'),
        h('p', { text: 'מתארים בקול מה רואים, שואלים שאלות, ופותרים את כל החידות לפני שהטיימר נגמר. כל טעות ממלאת טיפת סויה — יותר מדי טעויות, והאורז על התקרה.' }),
        h('h2', { text: 'בחרו רמה' }),
        h('div', { class: 'levels' }, levels),
        h('div', { class: 'practice' }, h('span', { class: 'practice-title', text: 'אימון על חידה אחת (בלי לחץ):' }), h('div', { class: 'chips' }, practice)),
        h('div', { class: 'chips' }, muteButton(), fullscreenButton()),
        urlSeed !== null && h('p', { class: 'note' }, 'הבנטו הבא ייווצר ממספר הזרע ', h('bdi', { dir: 'ltr', text: String(urlSeed) }))),
      h('section', { class: 'card' }, qrBlock()))));
}

function stopGame() {
  if (!game) return;
  clearInterval(game.interval);
  game.over = true;
  game.controllers.forEach((c) => c.destroy && c.destroy());
  game = null;
}

function startGame(difficulty, seed, practiceModule = null) {
  stopGame();
  initAudio();
  urlSeed = null; // a ?seed= link applies to the first bomb only
  const bomb = generateBomb(seed, difficulty, practiceModule);
  const { config, features } = bomb;
  const g = { bomb, strikes: 0, solved: 0, over: false, controllers: [], deadline: performance.now() + config.seconds * 1000, lastShown: null, lastHalf: null };
  game = g;

  const timerEl = h('div', { class: 'timer', dir: 'ltr', text: fmt(config.seconds * 1000) });
  const drops = Number.isFinite(config.strikes) ? Array.from({ length: config.strikes }, () => h('span', { class: 'drop' })) : [];
  const strikeNote = h('span', { class: 'strike-note' });
  const drawStrikes = () => {
    drops.forEach((d, i) => d.classList.toggle('full', i < g.strikes));
    if (!Number.isFinite(config.strikes)) strikeNote.textContent = `טעויות: ${g.strikes}`;
    else strikeNote.textContent = g.strikes >= config.strikes ? 'הטעות הבאה — בום!' : `טעויות: ${g.strikes} מתוך ${config.strikes}`;
  };
  drawStrikes();

  const lanterns = features.lanterns.length
    ? features.lanterns.map((l) => h('div', { class: `lantern ${l.lit ? 'lit' : 'unlit'}` },
      h('span', { class: 'lantern-body' }, h('bdi', { dir: 'ltr', text: l.label })), h('span', { class: 'lantern-state', text: l.lit ? 'דולק' : 'כבוי' })))
    : [h('span', { class: 'no-lanterns', text: 'אין פנסים' })];

  const edge = h('header', { class: 'edge' },
    h('div', { class: 'feature' }, h('span', { class: 'feature-title', text: 'מספר סידורי' }), h('bdi', { class: 'serial', dir: 'ltr', text: features.serial })),
    h('div', { class: 'feature lanterns' }, lanterns),
    h('div', { class: 'timer-wrap' }, timerEl),
    h('div', { class: 'feature strikes' }, h('div', { class: 'drops' }, drops), strikeNote),
    h('div', { class: 'feature meta' },
      h('span', { class: 'seed' }, `${config.name} · זרע `, h('bdi', { dir: 'ltr', text: String(seed) })),
      h('button', { class: 'chip small', type: 'button', text: '✕ יציאה', onclick: showStart })));

  const box = h('div', { class: `box n${bomb.modules.length}` });
  const screen = h('div', { class: 'game' }, edge, box);
  const debugLines = [];
  const refreshDebug = () => debugLines.forEach((fn) => fn());

  bomb.modules.forEach((mod) => {
    const light = h('div', { class: 'light', text: '✓ הושלם' });
    const cell = h('section', { class: `module m-${mod.type}` }, light);
    let done = false;
    const api = {
      features,
      strikes: () => g.strikes,
      active: () => !g.over && !done,
      changed: refreshDebug,
      solved: () => {
        if (!api.active()) return;
        done = true;
        cell.classList.add('solved');
        g.solved++;
        refreshDebug();
        if (g.solved === bomb.modules.length) win();
        else sfx.chime();
      },
      strike: (what) => {
        if (!api.active()) return;
        g.strikes++;
        g.lastMistake = what;
        sfx.buzz();
        drawStrikes();
        cell.classList.remove('shake');
        screen.classList.remove('flash');
        void cell.offsetWidth; // restart the animations
        cell.classList.add('shake');
        screen.classList.add('flash');
        refreshDebug();
        if (g.strikes > config.strikes) explode(`${what}.`);
      },
    };
    const controller = MODULE_UI[mod.type](mod, api);
    g.controllers.push(controller);
    cell.append(h('div', { class: 'module-body' }, controller.el));
    if (DEBUG) {
      const line = h('div', { class: 'debug' });
      debugLines.push(() => { line.textContent = `${MODULES[mod.type].name}: ${controller.debug()}`; });
      cell.append(line);
    }
    box.append(cell);
  });
  refreshDebug();
  app.replaceChildren(screen);

  const finish = () => {
    g.over = true;
    clearInterval(g.interval);
    g.controllers.forEach((c) => c.destroy && c.destroy());
  };
  const again = (label, fn) => h('button', { class: 'level end-btn', type: 'button', text: label, onclick: fn });

  function explode(reason) {
    if (g.over) return;
    finish();
    sfx.explosion();
    const rice = Array.from({ length: 40 }, (_, i) => h('span', { class: 'rice', style: `--x:${(Math.random() * 2 - 1).toFixed(2)};--y:${(Math.random() * 2 - 1).toFixed(2)};--d:${(i % 8) * 40}ms` }));
    screen.append(h('div', { class: 'overlay boom' }, h('div', { class: 'rice-burst' }, rice), h('div', { class: 'end-card' },
      h('h1', { text: 'הבנטו התפוצץ! יש אורז על התקרה 🍚' }),
      h('p', { class: 'end-reason' }, h('b', { text: 'מה קרה? ' }), reason),
      h('p', { text: `הספקתם לפתור ${g.solved} מתוך ${bomb.modules.length} חידות.` }),
      h('div', { class: 'end-buttons' },
        again('נסו שוב — אותו בנטו', () => startGame(difficulty, seed, practiceModule)),
        again('בנטו חדש', () => startGame(difficulty, newSeed(), practiceModule)),
        again('למסך הפתיחה', showStart)))));
  }

  function win() {
    if (g.over) return;
    const left = g.deadline - performance.now();
    finish();
    sfx.win();
    const colors = ['#d8343a', '#f6cf3b', '#3fae5a', '#f58a3c', '#ffffff', '#f49ac1'];
    const confetti = Array.from({ length: 70 }, (_, i) => h('span', { class: 'confetti', style: `left:${Math.random() * 100}%;background:${colors[i % colors.length]};animation-delay:${(Math.random() * 1.5).toFixed(2)}s;animation-duration:${(2.5 + Math.random() * 2).toFixed(2)}s` }));
    const next = DIFFICULTY_ORDER[DIFFICULTY_ORDER.indexOf(difficulty) + 1];
    screen.append(h('div', { class: 'overlay win' }, h('div', { class: 'confetti-layer' }, confetti), h('div', { class: 'end-card' },
      h('h1', { text: 'הבנטו נוטרל! אתם צוות מושלם 🍣' }),
      h('p', {}, 'זמן שנשאר: ', h('bdi', { dir: 'ltr', text: fmt(left) }), ` · טעויות: ${g.strikes}`),
      h('div', { class: 'end-buttons' },
        practiceModule
          ? again('עוד אימון כזה', () => startGame(difficulty, newSeed(), practiceModule))
          : next
            ? again(`לשלב הבא: ${DIFFICULTIES[next].name}`, () => startGame(next, newSeed()))
            : again('עוד בנטו של שף', () => startGame(difficulty, newSeed())),
        !practiceModule && next && again('עוד בנטו באותה רמה', () => startGame(difficulty, newSeed())),
        again('למסך הפתיחה', showStart)))));
  }

  g.interval = setInterval(() => {
    if (g.over) return;
    const left = g.deadline - performance.now();
    const shown = Math.ceil(left / 1000);
    if (shown !== g.lastShown) {
      g.lastShown = shown;
      timerEl.textContent = fmt(left);
      timerEl.classList.toggle('urgent', left <= 30000);
      if (left > 0) (left <= 30000 ? sfx.tickFast : sfx.tick)();
    }
    // Last 30 seconds: an extra tick on every half second.
    const half = Math.ceil(left / 500);
    if (left <= 30000 && left > 0 && half !== g.lastHalf && half % 2 === 1) sfx.tickFast();
    g.lastHalf = half;
    if (left <= 0) explode('נגמר הזמן.');
  }, 100);
}

showStart();
