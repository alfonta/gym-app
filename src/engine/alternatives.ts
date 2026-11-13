import type { Exercise } from '../types';

export type Availability = Record<string, boolean>;

/** An exercise is usable only if every piece of equipment it needs is available. */
export function isExerciseAvailable(ex: Exercise, availability: Availability): boolean {
  return ex.equipment_ids.every((id) => availability[id] !== false);
}

function score(target: Exercise, cand: Exercise): number {
  let s = 0;
  if (cand.pattern === target.pattern) s += 4;
  if (cand.is_compound === target.is_compound) s += 2;
  if (cand.tracking === target.tracking) s += 1;
  if (cand.uses_barbell === target.uses_barbell) s += 0.5;
  return s;
}

/**
 * Ranked alternatives for the same muscle group that the gym can actually support.
 * Replaces the rigid alternative_1 / alternative_2 columns: it never runs dry as
 * long as any available exercise for that muscle exists.
 */
export function getAlternatives(
  target: Exercise,
  all: Exercise[],
  availability: Availability,
  excludeIds: string[] = [],
  limit = 3,
): Exercise[] {
  const exclude = new Set([target.id, ...excludeIds]);
  return all
    .filter((e) => !exclude.has(e.id))
    .filter((e) => e.muscle_group === target.muscle_group && e.is_core === target.is_core)
    .filter((e) => isExerciseAvailable(e, availability))
    .map((e, i) => ({ e, s: score(target, e), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.e);
}

/**
 * Fallback used when building a workout: the planned exercise if its equipment
 * is available, otherwise the best available alternative, otherwise null
 * (the slot is skipped).
 */
export function resolveExercise(
  target: Exercise,
  all: Exercise[],
  availability: Availability,
  excludeIds: string[] = [],
): Exercise | null {
  if (isExerciseAvailable(target, availability) && !excludeIds.includes(target.id)) return target;
  return getAlternatives(target, all, availability, excludeIds, 1)[0] ?? null;
}
