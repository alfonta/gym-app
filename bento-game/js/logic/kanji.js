// Kanji keypad: press the four kanji in the order they appear in their manual column.
import { randInt, shuffle } from './rng.js';

export const id = 'kanji';
export const name = "לוח הקאנג'י";
export const POOL = '魚米酒茶海山火水月日木金花鳥犬猫竹雨雪星光心夢侍忍鬼龍桜刀門'.split('');
// Any two columns share at most 3 kanji, so every set of 4 belongs to exactly one column.
export const COLUMNS = [
  '魚米酒茶海山火',
  '火水月日魚木金',
  '花鳥米犬月猫竹',
  '雨酒雪星日花光',
  '心夢茶侍鳥雪忍',
  '鬼龍桜刀門海心',
].map((c) => c.split(''));

export const columnsContaining = (keys) => COLUMNS.filter((col) => keys.every((k) => col.includes(k)));

export function generate(rng) {
  for (;;) {
    const col = COLUMNS[randInt(rng, COLUMNS.length)];
    const keys = shuffle(rng, col).slice(0, 4);
    if (columnsContaining(keys).length === 1) return { keys };
  }
}

export function solve(state) {
  const col = columnsContaining(state.keys)[0];
  return { order: col.filter((k) => state.keys.includes(k)) };
}

export function debugText(state) {
  return 'סדר: ' + solve(state).order.join(' ← ');
}
