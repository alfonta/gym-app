// Wasabi maze: 6x6 grid with invisible walls. A pink ginger slice tells which maze it is.
import { randInt } from './rng.js';

export const id = 'maze';
export const name = 'מבוך הוואסאבי';
export const SIZE = 6;
// v[r][c] === '1': wall between (r,c) and (r,c+1). h[r][c] === '1': wall between (r,c) and (r+1,c).
// marker: [row, col] of the ginger slice, unique per maze.
export const MAZES = [
  { marker: [0, 4], v: ['00000', '10000', '11010', '10100', '01000', '00000'], h: ['011100', '001001', '000011', '000110', '001100'] },
  { marker: [2, 0], v: ['10000', '11001', '00010', '00101', '00011', '00110'], h: ['000100', '000100', '010110', '001000', '010000'] },
  { marker: [1, 2], v: ['00000', '00010', '10111', '00010', '10000', '01000'], h: ['011000', '001000', '100001', '011110', '000010'] },
  { marker: [0, 1], v: ['00000', '00000', '00000', '10000', '00101', '00000'], h: ['001010', '110110', '011110', '010100', '110010'] },
  { marker: [2, 1], v: ['00010', '10000', '11000', '00110', '00010', '00001'], h: ['011110', '001110', '001001', '010000', '000000'] },
  { marker: [0, 3], v: ['01000', '00000', '10110', '11000', '00010', '00001'], h: ['010010', '011010', '000001', '000110', '110000'] },
  { marker: [1, 4], v: ['00000', '00100', '10100', '00111', '00011', '00101'], h: ['001011', '000010', '001000', '010000', '110000'] },
  { marker: [5, 2], v: ['00000', '01110', '00100', '01001', '00101', '00010'], h: ['000001', '010010', '101000', '010110', '000010'] },
  { marker: [2, 3], v: ['00000', '11001', '01000', '00110', '10000', '01010'], h: ['011100', '000110', '000000', '011001', '000010'] },
];

export const DIRS = {
  up: { dr: -1, dc: 0, name: 'למעלה', arrow: '↑' },
  down: { dr: 1, dc: 0, name: 'למטה', arrow: '↓' },
  left: { dr: 0, dc: -1, name: 'שמאלה', arrow: '←' },
  right: { dr: 0, dc: 1, name: 'ימינה', arrow: '→' },
};

export function canMove(maze, [r, c], dir) {
  const { dr, dc } = DIRS[dir];
  const nr = r + dr;
  const nc = c + dc;
  if (nr < 0 || nc < 0 || nr >= SIZE || nc >= SIZE) return false;
  if (dc !== 0) return maze.v[r][Math.min(c, nc)] === '0';
  return maze.h[Math.min(r, nr)][c] === '0';
}

// Shortest path (list of direction keys) from `from` to `to`, or null if unreachable.
export function shortestPath(maze, from, to) {
  const key = (p) => p[0] * SIZE + p[1];
  const prev = new Map([[key(from), null]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    if (cur[0] === to[0] && cur[1] === to[1]) {
      const path = [];
      let k = key(cur);
      while (prev.get(k)) {
        path.unshift(prev.get(k).dir);
        k = prev.get(k).from;
      }
      return path;
    }
    for (const dir of Object.keys(DIRS)) {
      if (!canMove(maze, cur, dir)) continue;
      const next = [cur[0] + DIRS[dir].dr, cur[1] + DIRS[dir].dc];
      if (prev.has(key(next))) continue;
      prev.set(key(next), { dir, from: key(cur) });
      queue.push(next);
    }
  }
  return null;
}

export function generate(rng) {
  const mazeIndex = randInt(rng, MAZES.length);
  const maze = MAZES[mazeIndex];
  const cell = () => [randInt(rng, SIZE), randInt(rng, SIZE)];
  const onMarker = (p) => p[0] === maze.marker[0] && p[1] === maze.marker[1];
  for (;;) {
    const start = cell();
    const target = cell();
    if (onMarker(start) || onMarker(target)) continue;
    if (shortestPath(maze, start, target).length >= 4) return { mazeIndex, start, target };
  }
}

export function solve(state) {
  return { path: shortestPath(MAZES[state.mazeIndex], state.pos || state.start, state.target) };
}

export function debugText(state) {
  return `מבוך ${state.mazeIndex + 1}: ` + solve(state).path.map((d) => DIRS[d].arrow).join(' ');
}
