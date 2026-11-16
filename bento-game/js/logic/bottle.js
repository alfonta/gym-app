// Soy-sauce bottle: quick tap, or hold to pour soy into the dish up to the right line.
import { pick } from './rng.js';
import { hasVowel, litCount, lanternCount } from './features.js';

export const id = 'bottle';
export const name = 'בקבוק הסויה';
export const COLORS = { red: 'אדום', black: 'שחור', green: 'ירוק', white: 'לבן' };
export const LABELS = ['לחץ', 'החזק', 'ביטול', 'בום'];
// Strip colour -> dish line to pour up to.
export const STRIPS = { blue: { name: 'כחול', line: 4 }, yellow: { name: 'צהוב', line: 2 }, pink: { name: 'ורוד', line: 5 }, white: { name: 'לבן', line: 3 } };

export const TAP_MS = 500; // released sooner than this = tap
export const LINE_MS = 900; // the dish fills one line every LINE_MS
export const LINES = 5;
export const TOLERANCE = 0.4; // in lines, either side of the target line
export const OVERFLOW_MS = LINE_MS * (LINES + 0.7);

export const RULES = [
  { text: 'אם הבקבוק אדום וכתוב עליו "החזק" — לחיצה קצרה.', test: (s) => s.color === 'red' && s.label === 'החזק', action: 'tap' },
  { text: 'אחרת, אם כתוב עליו "בום" ויש שני פנסים דולקים או יותר — לחיצה קצרה.', test: (s, f) => s.label === 'בום' && litCount(f) >= 2, action: 'tap' },
  { text: 'אחרת, אם הבקבוק ירוק ובמספר הסידורי יש תנועה — לחיצה קצרה.', test: (s, f) => s.color === 'green' && hasVowel(f), action: 'tap' },
  { text: 'אחרת, אם הבקבוק לבן ואין על הבנטו אף פנס — לחיצה קצרה.', test: (s, f) => s.color === 'white' && lanternCount(f) === 0, action: 'tap' },
  { text: 'בכל מקרה אחר — להחזיק ולמזוג (ראו למטה).', test: () => true, action: 'hold' },
];

function roll(rng) {
  return { color: pick(rng, Object.keys(COLORS)), label: pick(rng, LABELS), strip: pick(rng, Object.keys(STRIPS)) };
}

export function generate(rng, f) {
  // Plain random states are "hold" most of the time, so aim for a tap in ~40% of bombs.
  const want = rng() < 0.4 ? 'tap' : 'hold';
  let state = roll(rng);
  for (let i = 0; i < 200 && solve(state, f).action !== want; i++) state = roll(rng);
  return state;
}

export function solve(state, f) {
  const rule = RULES.findIndex((r) => r.test(state, f));
  const action = RULES[rule].action;
  return action === 'tap' ? { action, rule } : { action, rule, line: STRIPS[state.strip].line };
}

export const levelAt = (heldMs) => heldMs / LINE_MS;

// Judge a press that lasted heldMs. Returns { ok, did } where `did` describes the action.
export function judge(state, f, heldMs) {
  const s = solve(state, f);
  if (heldMs < TAP_MS) return { ok: s.action === 'tap', did: 'לחיצה קצרה' };
  const level = levelAt(heldMs);
  const did = level > LINES + TOLERANCE ? 'הצלוחית עלתה על גדותיה' : `מזיגה עד גובה ${level.toFixed(1)}`;
  return { ok: s.action === 'hold' && Math.abs(level - s.line) <= TOLERANCE, did };
}

export function debugText(state, f) {
  const s = solve(state, f);
  return s.action === 'tap' ? `לחיצה קצרה (כלל ${s.rule + 1})` : `להחזיק ולמזוג עד קו ${s.line}`;
}
