import test from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../js/logic/rng.js';
import { generateFeatures, hasVowel, LANTERN_LABELS } from '../js/logic/features.js';
import * as chopsticks from '../js/logic/chopsticks.js';
import * as bottle from '../js/logic/bottle.js';
import * as kanji from '../js/logic/kanji.js';
import * as conveyor from '../js/logic/conveyor.js';
import * as maze from '../js/logic/maze.js';
import * as password from '../js/logic/password.js';
import { generateBomb, DIFFICULTIES, MODULE_IDS, MODULES } from '../js/logic/index.js';

const SEEDS = 1000;
const each = (fn) => {
  for (let seed = 1; seed <= SEEDS; seed++) {
    const rng = mulberry32(seed);
    fn(rng, generateFeatures(rng), seed);
  }
};

test('features: serial shape, vowel balance, lanterns', () => {
  let vowels = 0;
  each((rng, f) => {
    assert.match(f.serial, /^[A-Z0-9]{5}[0-9]$/);
    assert.ok(/[A-Z]/.test(f.serial));
    if (hasVowel(f)) vowels++;
    assert.ok(f.lanterns.length <= 3);
    assert.equal(new Set(f.lanterns.map((l) => l.label)).size, f.lanterns.length);
    for (const l of f.lanterns) assert.ok(LANTERN_LABELS.includes(l.label) && typeof l.lit === 'boolean');
  });
  assert.ok(vowels > SEEDS * 0.4 && vowels < SEEDS * 0.6, `vowel share ${vowels}`);
});

test('chopsticks: valid state, solution in range, every rule reachable', () => {
  const hit = new Set();
  each((rng, f) => {
    const s = chopsticks.generate(rng, f);
    assert.ok(s.colors.length >= 3 && s.colors.length <= 6);
    for (const c of s.colors) assert.ok(c in chopsticks.COLORS);
    const sol = chopsticks.solve(s, f);
    assert.ok(Number.isInteger(sol.index) && sol.index >= 0 && sol.index < s.colors.length);
    hit.add(`${s.colors.length}:${sol.rule}`);
  });
  for (const [n, rules] of Object.entries(chopsticks.RULES)) {
    assert.equal(rules.at(-1).test([], {}), true, 'last rule is a catch-all');
    rules.forEach((_, i) => assert.ok(hit.has(`${n}:${i}`), `rule ${n}:${i} never fires`));
  }
});

test('bottle: valid state, judge agrees with solve', () => {
  const actions = { tap: 0, hold: 0 };
  each((rng, f) => {
    const s = bottle.generate(rng, f);
    assert.ok(s.color in bottle.COLORS && bottle.LABELS.includes(s.label) && s.strip in bottle.STRIPS);
    const sol = bottle.solve(s, f);
    actions[sol.action]++;
    assert.equal(bottle.judge(s, f, 100).ok, sol.action === 'tap');
    for (let line = 1; line <= bottle.LINES; line++) {
      assert.equal(bottle.judge(s, f, line * bottle.LINE_MS).ok, sol.action === 'hold' && sol.line === line);
    }
    assert.equal(bottle.judge(s, f, bottle.OVERFLOW_MS).ok, false);
  });
  assert.ok(actions.tap > SEEDS * 0.2 && actions.hold > SEEDS * 0.4, JSON.stringify(actions));
  assert.ok(bottle.TAP_MS < bottle.LINE_MS * (1 - bottle.TOLERANCE), 'a tap can never look like a pour');
  assert.equal(new Set(Object.values(bottle.STRIPS).map((s) => s.line)).size, 4);
});

test('kanji: columns well formed, keys belong to exactly one column', () => {
  assert.equal(new Set(kanji.POOL).size, 30);
  assert.equal(kanji.COLUMNS.length, 6);
  for (const col of kanji.COLUMNS) {
    assert.equal(new Set(col).size, 7);
    for (const k of col) assert.ok(kanji.POOL.includes(k));
  }
  each((rng, f) => {
    const s = kanji.generate(rng, f);
    assert.equal(new Set(s.keys).size, 4);
    assert.equal(kanji.columnsContaining(s.keys).length, 1);
    const { order } = kanji.solve(s);
    assert.deepEqual([...order].sort(), [...s.keys].sort());
  });
});

test('conveyor: mappings are permutations, solution uses them', () => {
  for (const parity of ['even', 'odd']) {
    assert.equal(conveyor.MAPS[parity].length, 3);
    for (const map of conveyor.MAPS[parity]) {
      assert.deepEqual(Object.keys(map).sort(), [...conveyor.PLATE_KEYS].sort());
      assert.deepEqual(Object.values(map).sort(), [...conveyor.PLATE_KEYS].sort());
    }
  }
  const all = [...conveyor.MAPS.even, ...conveyor.MAPS.odd].map((mp) => JSON.stringify(mp));
  assert.equal(new Set(all).size, 6);
  each((rng, f) => {
    const s = conveyor.generate(rng, f);
    assert.ok(s.sequence.length >= 3 && s.sequence.length <= 5);
    for (const strikes of [0, 1, 2, 5]) {
      const { presses } = conveyor.solve(s, f, { strikes });
      assert.equal(presses.length, s.sequence.length);
      presses.forEach((p, i) => assert.equal(p, conveyor.mappingFor(f, strikes)[s.sequence[i]]));
    }
  });
});

test('maze: fixed mazes are connected with unique markers; generated paths are valid', () => {
  assert.equal(maze.MAZES.length, 9);
  assert.equal(new Set(maze.MAZES.map((mz) => mz.marker.join())).size, 9);
  for (const mz of maze.MAZES) {
    assert.equal(mz.v.length, 6);
    assert.equal(mz.h.length, 5);
    mz.v.forEach((row) => assert.match(row, /^[01]{5}$/));
    mz.h.forEach((row) => assert.match(row, /^[01]{6}$/));
    for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) assert.ok(maze.shortestPath(mz, [0, 0], [r, c]), 'connected');
  }
  each((rng, f) => {
    const s = maze.generate(rng, f);
    const mz = maze.MAZES[s.mazeIndex];
    assert.notDeepEqual(s.start, mz.marker);
    assert.notDeepEqual(s.target, mz.marker);
    const { path } = maze.solve(s);
    assert.ok(path.length >= 4);
    let pos = s.start;
    for (const dir of path) {
      assert.ok(maze.canMove(mz, pos, dir));
      pos = [pos[0] + maze.DIRS[dir].dr, pos[1] + maze.DIRS[dir].dc];
    }
    assert.deepEqual(pos, s.target);
  });
});

test('password: exactly one listed word can be formed', () => {
  assert.equal(new Set(password.WORDS).size, 25);
  for (const w of password.WORDS) assert.match(w, /^[A-Z]{5}$/);
  each((rng, f) => {
    const s = password.generate(rng, f);
    assert.equal(s.columns.length, 5);
    for (const col of s.columns) assert.equal(new Set(col).size, 6);
    s.start.forEach((i) => assert.ok(i >= 0 && i < 6));
    assert.equal(password.formableWords(s.columns).length, 1);
    assert.ok(password.WORDS.includes(password.solve(s).word));
  });
});

test('bomb: distinct module types per difficulty, deterministic per seed', () => {
  for (const [key, d] of Object.entries(DIFFICULTIES)) {
    for (let seed = 1; seed <= 200; seed++) {
      const bomb = generateBomb(seed, key);
      assert.equal(bomb.modules.length, d.modules);
      assert.equal(new Set(bomb.modules.map((mod) => mod.type)).size, d.modules);
      assert.deepEqual(generateBomb(seed, key), bomb);
      for (const mod of bomb.modules) assert.equal(typeof MODULES[mod.type].debugText(mod.state, bomb.features, { strikes: 0 }), 'string');
    }
  }
  for (const type of MODULE_IDS) assert.equal(generateBomb(7, 'easy', type).modules[0].type, type);
});
