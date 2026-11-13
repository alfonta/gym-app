import type { BodyweightEntry, Sex, SetLog, Workout } from '../types';

// ───── Plate calculator ─────

export interface PlateResult {
  perSide: number[];
  /** Weight that could not be loaded with the available plates. */
  remainder: number;
  achievable: number;
}

export function calcPlates(target: number, bar: number, plates: number[]): PlateResult {
  const sorted = [...plates].sort((a, b) => b - a);
  let side = Math.max(0, (target - bar) / 2);
  const perSide: number[] = [];
  for (const p of sorted) {
    while (side >= p - 1e-9) {
      perSide.push(p);
      side -= p;
    }
  }
  const loaded = perSide.reduce((a, b) => a + b, 0) * 2;
  return { perSide, remainder: Math.round(side * 2 * 100) / 100, achievable: bar + loaded };
}

// ───── 1RM ─────

/** Epley estimate. Only meaningful for low/moderate reps. */
export function epley1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + Math.min(reps, 12) / 30);
}

export function best1RM(sets: Pick<SetLog, 'weight_kg' | 'reps'>[]): number {
  return sets.reduce((m, s) => Math.max(m, epley1RM(s.weight_kg, s.reps)), 0);
}

// ───── Nutrition ─────

export interface NutritionTargets {
  calories: number;
  protein: number;
}

/** Mifflin-St Jeor × moderate activity, plus a small surplus when the goal is to gain. */
export function nutritionTargets(weight: number, height: number, age: number, sex: Sex, goalWeight: number): NutritionTargets {
  const bmr = 10 * weight + 6.25 * height - 5 * age + (sex === 'male' ? 5 : -161);
  const tdee = bmr * 1.55;
  const delta = goalWeight > weight ? 300 : goalWeight < weight ? -400 : 0;
  return {
    calories: Math.round((tdee + delta) / 50) * 50,
    protein: Math.round((weight * 1.8) / 5) * 5,
  };
}

// ───── Dates / stats ─────

export function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Sunday that starts the week containing `d` (Israeli week). */
export function weekStart(d: Date): string {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  c.setDate(c.getDate() - c.getDay());
  return ymd(c);
}

export interface WeekVolume {
  week: string;
  volume: number;
}

/** Volume = sets × reps × weight, per week, for the last `weeks` weeks. */
export function weeklyVolume(workouts: Workout[], sets: SetLog[], timedExerciseIds: Set<string>, weeks = 8, now = new Date()): WeekVolume[] {
  const byWorkout = new Map(workouts.map((w) => [w.id, weekStart(new Date(w.date))]));
  const totals = new Map<string, number>();
  for (const s of sets) {
    if (timedExerciseIds.has(s.exercise_id)) continue;
    const wk = byWorkout.get(s.workout_id);
    if (!wk) continue;
    totals.set(wk, (totals.get(wk) ?? 0) + s.weight_kg * s.reps);
  }
  const out: WeekVolume[] = [];
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - start.getDay() - 7 * (weeks - 1));
  for (let i = 0; i < weeks; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + 7 * i);
    const key = ymd(d);
    out.push({ week: key, volume: Math.round(totals.get(key) ?? 0) });
  }
  return out;
}

export interface TrendPoint {
  date: string;
  weight: number;
  trend: number;
}

/** 7-day trailing average: daily weight is noisy, the trend is what matters. */
export function weightTrend(entries: BodyweightEntry[]): TrendPoint[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((e, i) => {
    const t = new Date(e.date).getTime();
    const window = sorted.slice(0, i + 1).filter((x) => t - new Date(x.date).getTime() < 7 * 86400000);
    const avg = window.reduce((a, x) => a + x.weight_kg, 0) / window.length;
    return { date: e.date, weight: e.weight_kg, trend: Math.round(avg * 100) / 100 };
  });
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
}
