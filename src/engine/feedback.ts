import type { Effort, Exercise } from '../types';
import { best1RM } from './calc';
import { suggestNext, type PastSession } from './progression';

// Rule-based reading of a finished workout. It compares against the previous
// time each exercise was done; it knows nothing about sleep, food or stress.

export type Verdict = 'strong' | 'solid' | 'weak' | 'partial' | 'baseline';
export type Trend = 'up' | 'same' | 'down' | 'new';
export type NextStep = 'increase' | 'hold' | 'decrease';

export interface FeedbackItem {
  ex: Exercise;
  rep_min: number;
  rep_max: number;
  planned_sets: number;
  done: { weight_kg: number; reps: number }[];
  effort: Effort | null;
  caution: boolean;
  /** Earlier sessions of this exercise, newest first (not including today). */
  history: PastSession[];
}

export interface ExerciseFeedback {
  exercise_id: string;
  name: string;
  trend: Trend;
  next: NextStep;
  message: string;
}

export interface WorkoutFeedback {
  verdict: Verdict;
  headline: string;
  notes: string[];
  exercises: ExerciseFeedback[];
  completion: number; // 0..1
  volume_change_pct: number | null;
}

const score = (ex: Exercise, sets: { weight_kg: number; reps: number }[]): number =>
  ex.tracking === 'weight_reps' ? best1RM(sets) : Math.max(0, ...sets.map((s) => s.reps));

function trendOf(ex: Exercise, today: FeedbackItem['done'], prev: PastSession | undefined): Trend {
  if (!prev || prev.sets.length === 0) return 'new';
  const a = score(ex, today), b = score(ex, prev.sets);
  if (b <= 0) return 'new';
  if (a > b * 1.01) return 'up';
  if (a < b * 0.97) return 'down';
  // Same top performance: more total reps still counts as progress.
  const reps = (s: { reps: number }[]) => s.reduce((n, x) => n + x.reps, 0);
  if (today.length >= prev.sets.length && reps(today) > reps(prev.sets)) return 'up';
  if (today.length >= prev.sets.length && reps(today) < reps(prev.sets) - 1) return 'down';
  return 'same';
}

function nextFor(item: FeedbackItem): { next: NextStep; message: string } {
  const { ex } = item;
  const s = suggestNext(ex, item.rep_min, item.rep_max, [{ sets: item.done, effort: item.effort }, ...item.history], item.planned_sets);
  if (!s) return { next: 'hold', message: 'אין מספיק נתונים.' };
  if (item.caution) return { next: 'hold', message: 'מצב פציעה: להישאר על אותו עומס או פחות.' };
  if (ex.tracking !== 'weight_reps') return { next: 'hold', message: s.message };
  if (s.action === 'increase') return { next: 'increase', message: `להעלות ל-${s.weight_kg} ק"ג, ולהתחיל מ-${s.target_reps} חזרות.` };
  if (s.action === 'decrease') return { next: 'decrease', message: `להוריד ל-${s.weight_kg} ק"ג ולבנות מחדש.` };
  if (item.done.length < Math.min(item.planned_sets, 3)) return { next: 'hold', message: `להישאר על ${s.weight_kg} ק"ג ולהשלים את כל הסטים.` };
  return { next: 'hold', message: `להישאר על ${s.weight_kg} ק"ג, ולכוון ל-${s.target_reps} חזרות בכל סט.` };
}

export function workoutFeedback(items: FeedbackItem[], opts: { prs: number; volume: number; prevVolume: number | null }): WorkoutFeedback {
  const planned = items.reduce((n, i) => n + i.planned_sets, 0);
  const done = items.reduce((n, i) => n + i.done.length, 0);
  const completion = planned ? done / planned : 0;
  const worked = items.filter((i) => i.done.length > 0);
  const main = worked.filter((i) => !i.ex.is_core);

  const exercises: ExerciseFeedback[] = main.map((i) => ({
    exercise_id: i.ex.id, name: i.ex.name, trend: trendOf(i.ex, i.done, i.history[0]), ...nextFor(i),
  }));

  const compared = exercises.filter((e) => e.trend !== 'new');
  const up = compared.filter((e) => e.trend === 'up').length;
  const down = compared.filter((e) => e.trend === 'down').length;
  const hard = main.filter((i) => i.effort === 'hard').length;
  const easy = main.filter((i) => i.effort === 'easy').length;
  const volume_change_pct = opts.prevVolume && opts.prevVolume > 0 ? Math.round(((opts.volume - opts.prevVolume) / opts.prevVolume) * 100) : null;

  let verdict: Verdict;
  if (completion < 0.6) verdict = 'partial';
  else if (compared.length === 0) verdict = 'baseline';
  else if (down > compared.length / 2 || (down > up && down >= 2)) verdict = 'weak';
  else if (opts.prs > 0 || up >= Math.max(1, compared.length / 2)) verdict = 'strong';
  else verdict = 'solid';

  const headline: Record<Verdict, string> = {
    strong: 'אימון חזק',
    solid: 'אימון טוב ויציב',
    weak: 'אימון חלש מהרגיל',
    partial: 'אימון חלקי',
    baseline: 'אימון בסיס',
  };

  const notes: string[] = [];
  if (verdict === 'baseline') notes.push('זו הפעם הראשונה ברוב התרגילים, אז עדיין אין למה להשוות. המספרים של היום הם קו ההתחלה.');
  if (verdict === 'partial') notes.push(`הושלמו ${done} מתוך ${planned} סטים. אימון קצר עדיף על אימון שלא קרה, אבל קשה להסיק ממנו על התקדמות.`);
  if (compared.length > 0) notes.push(`מול הפעם הקודמת: ${up} תרגילים השתפרו, ${compared.length - up - down} נשארו דומים, ${down} ירדו.`);
  if (opts.prs > 0) notes.push(`${opts.prs === 1 ? 'שיא חדש אחד' : `${opts.prs} שיאים חדשים`} באימון הזה.`);
  if (volume_change_pct !== null && Math.abs(volume_change_pct) >= 5) notes.push(`נפח כולל ${volume_change_pct > 0 ? 'גבוה' : 'נמוך'} ב-${Math.abs(volume_change_pct)}% מהפעם הקודמת של האימון הזה.`);
  if (verdict === 'weak') notes.push('יום חלש אחד הוא נורמלי. שווה לבדוק שינה, אוכל ומנוחה. אם זה חוזר שני אימונים ברצף, כדאי להוריד מעט משקל.');
  if (hard >= 2 && hard >= main.length / 2) notes.push('דירגת את רוב התרגילים כ"קשה מדי". עדיף להישאר על אותם משקלים פעם הבאה ולא להעלות.');
  if (easy >= 2 && easy >= main.length / 2) notes.push('דירגת את רוב התרגילים כ"קל". יש מקום להעלות משקלים.');

  return { verdict, headline: headline[verdict], notes, exercises, completion, volume_change_pct };
}
