// Sushi conveyor: plates flash in a sequence; the Defuser presses the mapped plates instead.
import { randInt, pick } from './rng.js';
import { lastDigitOdd } from './features.js';

export const id = 'conveyor';
export const name = 'המסוע';
export const PLATES = {
  red: { color: 'אדום', sushi: 'טונה' },
  orange: { color: 'כתום', sushi: 'סלמון' },
  green: { color: 'ירוק', sushi: 'מלפפון' },
  yellow: { color: 'צהוב', sushi: 'טמאגו' },
};
export const PLATE_KEYS = Object.keys(PLATES);
const m = (red, orange, green, yellow) => ({ red, orange, green, yellow });
// MAPS[parity][min(strikes, 2)] : flashed plate -> plate to press.
export const MAPS = {
  even: [m('green', 'red', 'yellow', 'orange'), m('orange', 'yellow', 'red', 'green'), m('yellow', 'green', 'orange', 'red')],
  odd: [m('orange', 'green', 'yellow', 'red'), m('yellow', 'red', 'orange', 'green'), m('green', 'yellow', 'red', 'orange')],
};

export const mappingFor = (f, strikes) => MAPS[lastDigitOdd(f) ? 'odd' : 'even'][Math.min(strikes, 2)];

export function generate(rng) {
  const stages = 3 + randInt(rng, 2);
  return { sequence: Array.from({ length: stages }, () => pick(rng, PLATE_KEYS)) };
}

// Full answer for the final stage; stage k expects its first k entries.
export function solve(state, f, ctx = {}) {
  const map = mappingFor(f, ctx.strikes || 0);
  return { presses: state.sequence.map((p) => map[p]) };
}

export function debugText(state, f, ctx) {
  const stage = (ctx && ctx.stage) || state.sequence.length;
  return 'ללחוץ: ' + solve(state, f, ctx).presses.slice(0, stage).map((p) => PLATES[p].color).join(' ← ');
}
