import type { BodyweightEntry, Exercise, Sex, SetLog, Workout } from '../types';

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
export function nutritionTargets(weight: number, height: number, age: number, sex: Sex, goalWeight: number | null): NutritionTargets {
  const bmr = 10 * weight + 6.25 * height - 5 * age + (sex === 'male' ? 5 : -161);
  const tdee = bmr * 1.55;
  // No target weight → assume the app's default purpose: a lean gain.
  const delta = goalWeight === null || goalWeight > weight ? 300 : goalWeight < weight ? -400 : 0;
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

export interface WeeklyRate {
  kg_per_week: number;
  pct_per_week: number;
}

/**
 * Change of the trend line per week, measured against the trend at least a
 * week earlier. Null until there is enough data to say anything.
 */
export function weeklyRate(trend: TrendPoint[]): WeeklyRate | null {
  const last = trend[trend.length - 1];
  if (!last) return null;
  const t = new Date(last.date).getTime();
  const base = [...trend].reverse().find((p) => t - new Date(p.date).getTime() >= 7 * 86400000);
  if (!base) return null;
  const days = (t - new Date(base.date).getTime()) / 86400000;
  const kg = ((last.trend - base.trend) / days) * 7;
  return { kg_per_week: Math.round(kg * 100) / 100, pct_per_week: Math.round((kg / base.trend) * 1000) / 10 };
}

export type GainStatus = 'slow' | 'good' | 'fast';

/** Lean-gain guideline: roughly 0.25–0.5% of body weight per week. */
export function gainStatus(pctPerWeek: number): GainStatus {
  if (pctPerWeek < 0.1) return 'slow';
  if (pctPerWeek > 0.6) return 'fast';
  return 'good';
}

/** Rough session length in minutes: work + rest for every set, plus a warm-up. */
export function estimateMinutes(items: { sets: number; rest_seconds: number; is_core: boolean }[]): number {
  const seconds = items.reduce((a, i) => a + i.sets * (i.rest_seconds + (i.is_core ? 35 : 45)), 0);
  return Math.round((seconds / 60 + 5) / 5) * 5;
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
}

// ───── Derived data after editing history ─────

/**
 * Recomputes the PR flag of every set from scratch, in chronological order.
 * A PR is a new best estimated 1RM for that exercise, once there is an earlier
 * workout to beat. Called after any edit or deletion so flags never go stale.
 */
export function recomputePRs(workouts: Workout[], sets: SetLog[], isWeighted: (exerciseId: string) => boolean): SetLog[] {
  const order = new Map([...workouts].sort((a, b) => a.date.localeCompare(b.date)).map((w, i) => [w.id, i]));
  const sorted = [...sets].sort((a, b) => (order.get(a.workout_id) ?? 0) - (order.get(b.workout_id) ?? 0) || a.order_index - b.order_index);
  const priorBest = new Map<string, number>(); // best from earlier workouts
  const current = new Map<string, { workout: string; best: number }>();
  const flags = new Map<string, boolean>();
  for (const s of sorted) {
    const cur = current.get(s.exercise_id);
    if (cur && cur.workout !== s.workout_id) {
      priorBest.set(s.exercise_id, Math.max(priorBest.get(s.exercise_id) ?? 0, cur.best));
      current.delete(s.exercise_id);
    }
    const prior = priorBest.get(s.exercise_id) ?? 0;
    const today = current.get(s.exercise_id)?.best ?? 0;
    const e = isWeighted(s.exercise_id) ? epley1RM(s.weight_kg, s.reps) : 0;
    flags.set(s.id, prior > 0 && e > Math.max(prior, today) + 1e-6);
    current.set(s.exercise_id, { workout: s.workout_id, best: Math.max(today, e) });
  }
  return sets.map((s) => ({ ...s, is_pr: flags.get(s.id) ?? false }));
}

export function workoutVolume(sets: SetLog[], isTimed: (exerciseId: string) => boolean): number {
  return Math.round(sets.reduce((a, s) => a + (isTimed(s.exercise_id) ? 0 : s.weight_kg * s.reps), 0));
}

export interface ProgressPoint {
  date: string;
  /** Heaviest set of the session. */
  top_weight: number;
  top_reps: number;
  /** Estimated 1RM (weighted) or best reps / seconds (bodyweight, timed). */
  value: number;
}

/** One point per workout for a single exercise, oldest first. */
export function exerciseProgress(ex: Exercise, workouts: Workout[], sets: SetLog[]): ProgressPoint[] {
  const byWorkout = new Map<string, SetLog[]>();
  for (const s of sets) if (s.exercise_id === ex.id) byWorkout.set(s.workout_id, [...(byWorkout.get(s.workout_id) ?? []), s]);
  return workouts
    .filter((w) => byWorkout.has(w.id))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((w) => {
      const ss = byWorkout.get(w.id)!;
      const top = ss.reduce((m, s) => (s.weight_kg > m.weight_kg || (s.weight_kg === m.weight_kg && s.reps > m.reps) ? s : m));
      const value = ex.tracking === 'weight_reps' ? Math.round(best1RM(ss) * 10) / 10 : Math.max(...ss.map((s) => s.reps));
      return { date: w.date, top_weight: top.weight_kg, top_reps: top.reps, value };
    });
}

/** Plain-text summary for sharing. */
export function workoutText(title: string, workout: Workout, sets: SetLog[], getExercise: (id: string) => Exercise): string {
  const d = new Date(workout.date);
  const lines = [`${title} · ${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()} · ${workout.total_duration_minutes} דקות`];
  const groups: { id: string; sets: SetLog[] }[] = [];
  for (const s of [...sets].sort((a, b) => a.order_index - b.order_index)) {
    const g = groups.find((x) => x.id === s.exercise_id);
    if (g) g.sets.push(s); else groups.push({ id: s.exercise_id, sets: [s] });
  }
  for (const g of groups) {
    const ex = getExercise(g.id);
    const body = g.sets.map((s) => (ex.tracking === 'time' ? `${s.reps} שנ׳` : s.weight_kg > 0 ? `${s.weight_kg}×${s.reps}` : `${s.reps}`) + (s.is_pr ? ' (שיא)' : '')).join(', ');
    lines.push(`${ex.name}: ${body}`);
  }
  lines.push(`נפח כולל: ${workoutVolume(sets, (id) => getExercise(id).tracking === 'time').toLocaleString('en-US')} ק"ג`);
  return lines.join('\n');
}
