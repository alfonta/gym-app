// Password box: five letter wheels; exactly one word from the list can be spelled.
import { randInt, pick, shuffle } from './rng.js';

export const id = 'password';
export const name = 'תיבת הסיסמה';
export const WORDS = ['SUSHI', 'RAMEN', 'MOCHI', 'KYOTO', 'TOKYO', 'NINJA', 'MANGA', 'KANJI', 'HAIKU', 'OSAKA', 'NIKKO', 'GINZA', 'SHOJI', 'BENTO', 'ONSEN', 'KENDO', 'TORII', 'SHOGI', 'ANIME', 'EMOJI', 'SHISO', 'DASHI', 'UNAGI', 'IKURA', 'WAGYU'];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
export const LETTERS_PER_COLUMN = 6;

export const formableWords = (columns) => WORDS.filter((w) => w.split('').every((ch, i) => columns[i].includes(ch)));

export function generate(rng) {
  for (;;) {
    const word = pick(rng, WORDS);
    const columns = word.split('').map((ch) => {
      const decoys = shuffle(rng, ALPHABET.filter((l) => l !== ch)).slice(0, LETTERS_PER_COLUMN - 1);
      return shuffle(rng, [ch, ...decoys]);
    });
    if (formableWords(columns).length !== 1) continue;
    return { columns, start: columns.map(() => randInt(rng, LETTERS_PER_COLUMN)) };
  }
}

export function solve(state) {
  return { word: formableWords(state.columns)[0] };
}

export function debugText(state) {
  return 'המילה: ' + solve(state).word;
}
