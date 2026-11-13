import { useMemo, useState } from 'react';
import { EXERCISES, EXERCISE_MAP } from '../data/exercises';
import { PROGRAM_LABEL, TEMPLATES, TEMPLATE_MAP, nextTemplate } from '../data/programs';
import { resolveExercise } from '../engine/alternatives';
import { formatClock, weekStart } from '../engine/calc';
import { primeAudio, useNow } from '../hooks';
import { useStore } from '../store';
import type { WorkoutTemplate } from '../types';

export function Home({ onOpenWorkout }: { onOpenWorkout: () => void }) {
  const profile = useStore((s) => s.profile)!;
  const workouts = useStore((s) => s.workouts);
  const equipment = useStore((s) => s.equipment);
  const active = useStore((s) => s.active);
  const startWorkout = useStore((s) => s.startWorkout);
  const now = useNow(1000);
  const [showAll, setShowAll] = useState(false);

  const last = useMemo(() => [...workouts].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null, [workouts]);
  const next = nextTemplate(profile.program, last?.split_type ?? null);
  const thisWeek = workouts.filter((w) => weekStart(new Date(w.date)) === weekStart(new Date())).length;

  const start = (t: WorkoutTemplate) => {
    primeAudio();
    startWorkout(t.id);
    onOpenWorkout();
  };

  const preview = (t: WorkoutTemplate) => {
    const used: string[] = [];
    return t.slots.flatMap((s) => {
      const ex = resolveExercise(EXERCISE_MAP[s.exercise_id], EXERCISES, equipment, used);
      if (!ex) return [];
      used.push(ex.id);
      return [{ slot: s, ex, swapped: ex.id !== s.exercise_id }];
    });
  };

  const others = TEMPLATES.filter((t) => t.id !== next.id);

  return (
    <>
      <header className="page-head">
        <h1>האימון של היום</h1>
        <span className="muted">{PROGRAM_LABEL[profile.program]} · השבוע: {thisWeek} אימונים</span>
      </header>

      {active ? (
        <section className="card highlight">
          <div className="tag">אימון פעיל</div>
          <h2>{TEMPLATE_MAP[active.split_type].name}</h2>
          <p className="muted">זמן שעבר: {formatClock((now - active.started_at) / 1000)}</p>
          <button className="btn primary block" onClick={onOpenWorkout}>חזור לאימון</button>
        </section>
      ) : (
        <section className="card highlight">
          <div className="tag">הבא בתור</div>
          <h2>{next.name}</h2>
          <p className="muted">{next.subtitle}</p>
          <ul className="plan">
            {preview(next).map(({ slot, ex, swapped }) => (
              <li key={ex.id} className={slot.role}>
                <span>{ex.name}{swapped && <em> (חלופה לפי הציוד)</em>}</span>
                <small>{slot.sets}×{slot.rep_min}–{slot.rep_max}{ex.tracking === 'time' ? ' שנ׳' : ''}</small>
              </li>
            ))}
          </ul>
          <button className="btn primary block big" onClick={() => start(next)}>התחל אימון</button>
        </section>
      )}

      {!active && (
        <section className="card">
          <button className="row-btn" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
            <span>בחר אימון אחר (או יום רביעי בשבוע)</span><span>{showAll ? '▴' : '▾'}</span>
          </button>
          {showAll && others.map((t) => (
            <button key={t.id} className="row-btn sub" onClick={() => start(t)}>
              <span><strong>{t.name}</strong><small>{t.subtitle}</small></span><span>←</span>
            </button>
          ))}
        </section>
      )}

      {last && (
        <p className="muted center">
          אימון אחרון: {TEMPLATE_MAP[last.split_type].name}, {new Date(last.date).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' })}
        </p>
      )}
    </>
  );
}
