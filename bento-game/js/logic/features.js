// Bomb features: serial number and lanterns. The Expert asks about these.
import { randInt, pick, shuffle } from './rng.js';

export const VOWELS = ['A', 'E', 'I', 'O', 'U'];
// Generated serials avoid look-alikes (O/0, I/1), so only A, E, U appear as vowels.
const GEN_VOWELS = ['A', 'E', 'U'];
const CONSONANTS = 'BCDFGHJKLMNPRSTVWXYZ'.split('');
const DIGITS = '23456789'.split('');
export const LANTERN_LABELS = ['SOY', 'NRI', 'WSB', 'GRI', 'MSO'];

export function generateFeatures(rng) {
  const wantVowel = rng() < 0.5;
  // 5 leading characters: 3 letters + 2 digits in random order, then a final digit.
  const letters = [pick(rng, CONSONANTS), pick(rng, CONSONANTS), pick(rng, CONSONANTS)];
  if (wantVowel) letters[randInt(rng, 3)] = pick(rng, GEN_VOWELS);
  const head = shuffle(rng, [...letters, pick(rng, DIGITS), pick(rng, DIGITS)]);
  const serial = head.join('') + pick(rng, DIGITS);
  const count = randInt(rng, 4);
  const lanterns = shuffle(rng, LANTERN_LABELS)
    .slice(0, count)
    .map((label) => ({ label, lit: rng() < 0.5 }));
  return { serial, lanterns };
}

export const lastDigit = (f) => Number(f.serial[f.serial.length - 1]);
export const lastDigitOdd = (f) => lastDigit(f) % 2 === 1;
export const hasVowel = (f) => f.serial.split('').some((ch) => VOWELS.includes(ch));
export const litCount = (f) => f.lanterns.filter((l) => l.lit).length;
export const lanternCount = (f) => f.lanterns.length;
