// Chopsticks: break exactly the right one. Rule text and rule logic live side by side
// so the manual (which renders `text`) and solve() can never drift apart.
import { randInt, pick } from './rng.js';
import { hasVowel, lastDigitOdd, litCount } from './features.js';

export const id = 'chopsticks';
export const name = "צ'ופסטיקס";
export const COLORS = { red: 'אדום', blue: 'כחול', yellow: 'צהוב', black: 'שחור', white: 'לבן', green: 'ירוק' };
const COLOR_KEYS = Object.keys(COLORS);
const count = (c, x) => c.filter((v) => v === x).length;

export const RULES = {
  3: [
    { text: 'אם כל השלושה בצבעים שונים, ויש לפחות פנס דולק אחד — שברו את הראשון.', test: (c, f) => new Set(c).size === 3 && litCount(f) >= 1, pick: () => 0 },
    { text: 'אחרת, אם אין אף אדום — שברו את השני.', test: (c) => count(c, 'red') === 0, pick: () => 1 },
    { text: 'אחרת, אם העליון שחור — שברו את השלישי.', test: (c) => c[0] === 'black', pick: () => 2 },
    { text: 'אחרת — שברו את האדום העליון ביותר.', test: () => true, pick: (c) => c.indexOf('red') },
  ],
  4: [
    { text: 'אם יש יותר מירוק אחד, ובמספר הסידורי יש תנועה — שברו את הירוק התחתון ביותר.', test: (c, f) => count(c, 'green') > 1 && hasVowel(f), pick: (c) => c.lastIndexOf('green') },
    { text: 'אחרת, אם אין אף כחול — שברו את הראשון.', test: (c) => count(c, 'blue') === 0, pick: () => 0 },
    { text: 'אחרת, אם העליון והתחתון באותו צבע — שברו את השלישי.', test: (c) => c[0] === c[3], pick: () => 2 },
    { text: 'אחרת, אם יש בדיוק לבן אחד — שברו את הרביעי.', test: (c) => count(c, 'white') === 1, pick: () => 3 },
    { text: 'אחרת — שברו את השני.', test: () => true, pick: () => 1 },
  ],
  5: [
    { text: 'אם התחתון ירוק, והספרה האחרונה במספר הסידורי זוגית — שברו את השלישי.', test: (c, f) => c[4] === 'green' && !lastDigitOdd(f), pick: () => 2 },
    { text: 'אחרת, אם יש בדיוק אדום אחד ויותר משחור אחד — שברו את הראשון.', test: (c) => count(c, 'red') === 1 && count(c, 'black') > 1, pick: () => 0 },
    { text: 'אחרת, אם אין אף לבן — שברו את החמישי.', test: (c) => count(c, 'white') === 0, pick: () => 4 },
    { text: 'אחרת — שברו את הרביעי.', test: () => true, pick: () => 3 },
  ],
  6: [
    { text: 'אם אין אף צהוב, ובמספר הסידורי יש תנועה — שברו את השלישי.', test: (c, f) => count(c, 'yellow') === 0 && hasVowel(f), pick: () => 2 },
    { text: 'אחרת, אם יש בדיוק צהוב אחד ויותר מלבן אחד — שברו את הרביעי.', test: (c) => count(c, 'yellow') === 1 && count(c, 'white') > 1, pick: () => 3 },
    { text: 'אחרת, אם אין אף אדום — שברו את השישי.', test: (c) => count(c, 'red') === 0, pick: () => 5 },
    { text: 'אחרת — שברו את השני.', test: () => true, pick: () => 1 },
  ],
};

export function generate(rng) {
  const n = 3 + randInt(rng, 4);
  return { colors: Array.from({ length: n }, () => pick(rng, COLOR_KEYS)) };
}

export function solve(state, f) {
  const rules = RULES[state.colors.length];
  const rule = rules.findIndex((r) => r.test(state.colors, f));
  return { index: rules[rule].pick(state.colors), rule };
}

export function debugText(state, f) {
  const s = solve(state, f);
  return `לשבור את מספר ${s.index + 1} מלמעלה (כלל ${s.rule + 1})`;
}
