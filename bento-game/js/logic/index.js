// Module registry, difficulty table and bomb generation.
import { mulberry32, shuffle } from './rng.js';
import { generateFeatures } from './features.js';
import * as chopsticks from './chopsticks.js';
import * as bottle from './bottle.js';
import * as kanji from './kanji.js';
import * as conveyor from './conveyor.js';
import * as maze from './maze.js';
import * as password from './password.js';

export const MODULES = { chopsticks, bottle, kanji, conveyor, maze, password };
export const MODULE_IDS = Object.keys(MODULES);

// `strikes` = mistakes the bomb tolerates; one more and it explodes.
export const DIFFICULTIES = {
  easy: { name: 'קל', modules: 3, seconds: 300, strikes: 3 },
  medium: { name: 'בינוני', modules: 4, seconds: 300, strikes: 3 },
  hard: { name: 'קשה', modules: 5, seconds: 240, strikes: 2 },
  chef: { name: 'שף מומחה', modules: 6, seconds: 270, strikes: 1 },
};
export const DIFFICULTY_ORDER = ['easy', 'medium', 'hard', 'chef'];
// Practice: a single chosen module, generous timer, mistakes never explode.
export const PRACTICE = { name: 'אימון', modules: 1, seconds: 600, strikes: Infinity };

export function generateBomb(seed, difficulty, practiceModule) {
  const rng = mulberry32(seed);
  const features = generateFeatures(rng);
  const config = practiceModule ? PRACTICE : DIFFICULTIES[difficulty];
  const types = practiceModule ? [practiceModule] : shuffle(rng, MODULE_IDS).slice(0, config.modules);
  const modules = types.map((type) => ({ type, state: MODULES[type].generate(rng, features) }));
  return { seed, difficulty, practiceModule: practiceModule || null, config, features, modules };
}
