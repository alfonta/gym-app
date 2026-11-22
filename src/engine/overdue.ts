import type { ActiveWorkout, Workout } from '../types';

// Detects a workout that was probably left open by mistake. Rule-based:
// a long silence since the last ticked set, or a session far longer than usual.

const FALLBACK_MINUTES = 75;

/** Typical session length: median of the last 10 workouts (75 until there are 3). */
export function usualMinutes(workouts: Pick<Workout, 'date' | 'total_duration_minutes'>[]): number {
  const recent = [...workouts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10)
    .map((w) => w.total_duration_minutes).filter((m) => m > 0).sort((a, b) => a - b);
  if (recent.length < 3) return FALLBACK_MINUTES;
  const mid = Math.floor(recent.length / 2);
  return recent.length % 2 ? recent[mid] : Math.round((recent[mid - 1] + recent[mid]) / 2);
}

/** Last moment there is proof of training: the start or the latest ticked set. */
export function lastActivity(active: Pick<ActiveWorkout, 'started_at' | 'items'>): number {
  let t = active.started_at;
  for (const it of active.items) for (const s of it.sets) {
    if (s.done && s.completed_at) t = Math.max(t, new Date(s.completed_at).getTime() || 0);
  }
  return t;
}

export interface Overdue {
  forgotten: boolean;
  elapsed_min: number;
  idle_min: number;
  usual_min: number;
  /** Suggested end time for saving: a couple of minutes after the last ticked set. */
  end_at: number;
}

export function overdueState(active: ActiveWorkout, usual: number, now: number): Overdue {
  const last = lastActivity(active);
  const elapsed = (now - active.started_at) / 60000;
  const idle = (now - last) / 60000;
  const long = elapsed >= Math.max(usual * 1.5, usual + 30) && idle >= 15;
  const snoozed = !!active.overdue_snooze_until && active.overdue_snooze_until > now;
  return {
    forgotten: !snoozed && (idle >= 45 || long),
    elapsed_min: Math.floor(elapsed),
    idle_min: Math.floor(idle),
    usual_min: usual,
    end_at: Math.min(now, last + 2 * 60000),
  };
}

export function formatMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} דק׳`;
  return r === 0 ? `${h === 1 ? 'שעה' : `${h} שעות`}` : `${h === 1 ? 'שעה' : `${h} שעות`} ו-${r} דק׳`;
}
