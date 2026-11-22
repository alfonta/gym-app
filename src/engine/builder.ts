import type { Exercise, MuscleGroup, TemplateSlot } from '../types';
import { isExerciseAvailable, type Availability } from './alternatives';
import { defaultSlot, type Catalog } from './catalog';

export interface BuildRequest {
  /** Muscle groups to train. */
  muscles: MuscleGroup[];
  /** Exercises the user insists on. Always included. */
  exerciseIds: string[];
  /** Target number of non-core exercises. */
  size: number;
  /** Add a short core finisher. */
  core: boolean;
}

/**
 * Builds a balanced workout from a wish list: the requested exercises first,
 * then the requested muscles filled round-robin (a compound movement for each
 * before any isolation work, and no two exercises of the same movement pattern
 * for one muscle while other patterns remain). The heaviest compound becomes
 * the anchor and opens the session; isolation and core come last.
 */
export function buildWorkout(
  req: BuildRequest, cat: Catalog, availability: Availability, allowed: (ex: Exercise) => boolean = () => true,
): TemplateSlot[] {
  const picked = req.exerciseIds.map((id) => cat.find(id)).filter((e): e is Exercise => !!e && !e.archived);
  const chosen: Exercise[] = [...new Map(picked.map((e) => [e.id, e])).values()];
  // The core finisher is an add-on: on its own it is not a request for a workout.
  if (chosen.length === 0 && req.muscles.length === 0) return [];
  const has = (id: string) => chosen.some((e) => e.id === id);
  const usable = (e: Exercise) => !has(e.id) && isExerciseAvailable(e, availability) && allowed(e);

  const muscles = [...new Set(req.muscles)].filter((m) => m !== 'core');
  const onlyCore = muscles.length === 0 && req.muscles.includes('core') && chosen.every((e) => e.is_core);
  const target = Math.max(req.size, chosen.filter((e) => !e.is_core).length);

  // Round-robin over the muscles until the target is reached or nothing is left.
  let progress = muscles.length > 0;
  while (progress && chosen.filter((e) => !e.is_core).length < target) {
    progress = false;
    for (const m of muscles) {
      if (chosen.filter((e) => !e.is_core).length >= target) break;
      const mine = chosen.filter((e) => e.muscle_group === m && !e.is_core);
      // Never more than two exercises of one movement pattern: a third hinge or a third
      // press adds fatigue, not stimulus. A shorter workout is better than a redundant one.
      const crowded = (e: Exercise) => chosen.filter((x) => x.pattern === e.pattern).length >= 2;
      const pool = cat.all.filter((e) => e.muscle_group === m && !e.is_core && usable(e) && !crowded(e));
      const fresh = pool.filter((e) => !mine.some((x) => x.pattern === e.pattern));
      const candidates = fresh.length ? fresh : pool;
      // First exercise for a muscle should be a compound when one exists.
      const next = (mine.length === 0 ? candidates.find((e) => e.is_compound) : undefined) ?? candidates[0];
      if (next) {
        chosen.push(next);
        progress = true;
      }
    }
  }

  const wantCore = req.core || req.muscles.includes('core');
  const coreTarget = onlyCore ? Math.max(req.size, 3) : wantCore ? Math.max(2, chosen.filter((e) => e.is_core).length) : 0;
  while (chosen.filter((e) => e.is_core).length < coreTarget) {
    const mine = chosen.filter((e) => e.is_core);
    const pool = cat.all.filter((e) => e.is_core && usable(e));
    const next = pool.find((e) => !mine.some((x) => x.pattern === e.pattern)) ?? pool[0];
    if (!next) break;
    chosen.push(next);
  }

  const compounds = chosen.filter((e) => !e.is_core && e.is_compound);
  const isolation = chosen.filter((e) => !e.is_core && !e.is_compound);
  const core = chosen.filter((e) => e.is_core);
  // The anchor is the most demanding lift: barbell compounds first, then the longest rest.
  const anchor = [...compounds].sort((a, b) => Number(b.uses_barbell) - Number(a.uses_barbell) || b.rest_time_seconds - a.rest_time_seconds)[0];
  const slots: TemplateSlot[] = [];
  if (anchor) slots.push({ exercise_id: anchor.id, role: 'anchor', sets: 4, rep_min: 6, rep_max: 10 });
  for (const e of compounds) if (e !== anchor) slots.push({ ...defaultSlot(e), rep_min: e.tracking === 'weight_reps' ? 8 : defaultSlot(e).rep_min });
  for (const e of isolation) slots.push({ ...defaultSlot(e), ...(e.tracking === 'weight_reps' ? { rep_min: 10, rep_max: 15 } : {}) });
  for (const e of core) slots.push(defaultSlot(e));
  return slots;
}

/**
 * Extra exercises in the style of the current workout: same muscle groups,
 * not already in the session, movement patterns that are not yet covered first,
 * isolation before compound (late in a session there is less to give).
 * Muscles that got the most sets today come first; picks alternate between them.
 */
export function suggestMore(
  current: { ex: Exercise; sets: number }[], cat: Catalog, availability: Availability,
  allowed: (ex: Exercise) => boolean = () => true, limit = 6,
): Exercise[] {
  const main = current.filter((c) => !c.ex.is_core);
  const source = main.length ? main : current;
  const weight = new Map<MuscleGroup, number>();
  for (const c of source) weight.set(c.ex.muscle_group, (weight.get(c.ex.muscle_group) ?? 0) + c.sets);
  const muscles = [...weight.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m);
  const taken = new Set(current.map((c) => c.ex.id));
  const patterns = new Map<string, number>();
  for (const c of current) patterns.set(c.ex.pattern, (patterns.get(c.ex.pattern) ?? 0) + 1);

  const queues = muscles.map((m) =>
    cat.all
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e.muscle_group === m && !taken.has(e.id) && isExerciseAvailable(e, availability) && allowed(e))
      .filter(({ e }) => main.length === 0 || !e.is_core)
      .sort((a, b) => (patterns.get(a.e.pattern) ?? 0) - (patterns.get(b.e.pattern) ?? 0)
        || Number(a.e.is_compound) - Number(b.e.is_compound) || a.i - b.i)
      .map(({ e }) => e));

  const out: Exercise[] = [];
  for (let round = 0; out.length < limit && queues.some((q) => q.length > round); round++) {
    for (const q of queues) {
      if (out.length >= limit) break;
      if (q[round]) out.push(q[round]);
    }
  }
  return out;
}
