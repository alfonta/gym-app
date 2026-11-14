import type { Effort, Exercise } from '../types';

export interface PastSession {
  /** Working sets of one exercise in one workout, in order. */
  sets: { weight_kg: number; reps: number }[];
  effort: Effort | null;
}

export interface Suggestion {
  weight_kg: number;
  target_reps: number;
  action: 'start' | 'increase' | 'hold' | 'decrease';
  message: string;
}

export function roundToStep(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

/**
 * Double progression.
 *  - Work inside [repMin, repMax] at a fixed weight, adding reps.
 *  - All sets at repMax (and not rated "hard") → add one increment, restart at repMin.
 *  - Rated "easy" and all sets within 1 rep of the top → also increase.
 *  - Below repMin in the last two sessions at the same weight → drop ~10%.
 * `history` is newest first.
 */
export function suggestNext(
  ex: Exercise,
  repMin: number,
  repMax: number,
  history: PastSession[],
  plannedSets = 3,
): Suggestion | null {
  const last = history[0];
  if (!last || last.sets.length === 0) return null;

  const weight = Math.max(...last.sets.map((s) => s.weight_kg));
  const top = last.sets.filter((s) => s.weight_kg === weight);
  const minReps = Math.min(...top.map((s) => s.reps));

  // Bodyweight / timed work progresses by reps or seconds only.
  if (ex.tracking !== 'weight_reps') {
    const step = ex.tracking === 'time' ? 5 : 1;
    const target = Math.min(repMax, minReps + step);
    const unit = ex.tracking === 'time' ? 'שניות' : 'חזרות';
    return {
      weight_kg: weight,
      target_reps: Math.max(repMin, target),
      action: 'hold',
      message: minReps >= repMax ? `הגעת לתקרה. נסה גרסה קשה יותר או הוסף משקל.` : `נסה להגיע ל-${Math.max(repMin, target)} ${unit}.`,
    };
  }

  // A workout that was cut short is not proof the weight is mastered.
  const enough = top.length >= Math.min(plannedSets, 3);
  const allTop = enough && minReps >= repMax;
  const nearTop = enough && minReps >= repMax - 1;
  if ((allTop && last.effort !== 'hard') || (nearTop && last.effort === 'easy')) {
    const next = weight + ex.increment_kg;
    return {
      weight_kg: next,
      target_reps: repMin,
      action: 'increase',
      message: `השלמת את כל הסטים בפעם הקודמת. מעלים ל-${next} ק"ג.`,
    };
  }

  const failed = (s: PastSession) => {
    const w = Math.max(...s.sets.map((x) => x.weight_kg));
    return w === weight && Math.min(...s.sets.filter((x) => x.weight_kg === w).map((x) => x.reps)) < repMin;
  };
  const prev = history[1];
  if (failed(last) && prev && prev.sets.length > 0 && failed(prev)) {
    const next = Math.max(ex.increment_kg, roundToStep(weight * 0.9, ex.increment_kg));
    return {
      weight_kg: next,
      target_reps: repMax - 2,
      action: 'decrease',
      message: `פעמיים מתחת ל-${repMin} חזרות. מורידים ל-${next} ק"ג כדי לבנות מחדש.`,
    };
  }

  const target = Math.min(repMax, Math.max(repMin, minReps + 1));
  return {
    weight_kg: weight,
    target_reps: target,
    action: 'hold',
    message: `אותו משקל, המטרה ${target} חזרות בכל סט.`,
  };
}

/** Warm-up ramp for the anchor lift. */
export function warmupSets(targetKg: number, barKg: number, step = 2.5): { weight_kg: number; reps: number }[] {
  if (targetKg <= barKg + 10) return [];
  return [
    { pct: 0.5, reps: 8 },
    { pct: 0.7, reps: 5 },
    { pct: 0.85, reps: 2 },
  ].map(({ pct, reps }) => ({ weight_kg: Math.max(barKg, roundToStep(targetKg * pct, step)), reps }));
}
