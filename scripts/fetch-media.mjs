// Downloads the two demo frames for every exercise from the public-domain
// free-exercise-db project into public/media so the app works offline.
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const src = readFileSync(new URL('../src/data/exercises.ts', import.meta.url), 'utf8');
const folders = [...new Set([...src.matchAll(/media: '([^']+)'/g)].map((m) => m[1]))];
const base = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';
let failed = 0;
for (const f of folders) {
  const dir = new URL(`../public/media/${f}/`, import.meta.url);
  mkdirSync(dir, { recursive: true });
  for (const n of [0, 1]) {
    const out = new URL(`${n}.jpg`, dir);
    if (existsSync(out)) continue;
    try {
      const buf = execFileSync('curl', ['-fsSL', '-m', '30', `${base}/${encodeURIComponent(f)}/${n}.jpg`], { maxBuffer: 1e8 });
      writeFileSync(out, buf);
    } catch {
      failed++;
      console.error('FAILED', f, n);
    }
  }
}
console.log(`folders: ${folders.length}, failed: ${failed}`);
