import { useMemo, useState } from 'react';
import { EXERCISE_MAP } from '../data/exercises';
import { TEMPLATE_MAP } from '../data/programs';
import { useStore } from '../store';
import type { SetLog } from '../types';

export function History() {
  const workouts = useStore((s) => s.workouts);
  const sets = useStore((s) => s.sets);
  const deleteWorkout = useStore((s) => s.deleteWorkout);
  const [open, setOpen] = useState<string | null>(null);

  const sorted = useMemo(() => [...workouts].sort((a, b) => b.date.localeCompare(a.date)), [workouts]);

  const grouped = (workoutId: string) => {
    const out: { exercise_id: string; sets: SetLog[] }[] = [];
    for (const s of sets.filter((x) => x.workout_id === workoutId).sort((a, b) => a.order_index - b.order_index)) {
      const g = out.find((o) => o.exercise_id === s.exercise_id);
      if (g) g.sets.push(s);
      else out.push({ exercise_id: s.exercise_id, sets: [s] });
    }
    return out;
  };

  return (
    <>
      <header className="page-head"><h1>היסטוריה</h1><span className="muted">{sorted.length} אימונים</span></header>
      {sorted.length === 0 && <p className="muted center">עדיין אין אימונים שמורים.</p>}
      {sorted.map((w) => (
        <section key={w.id} className="card">
          <button className="row-btn" onClick={() => setOpen(open === w.id ? null : w.id)} aria-expanded={open === w.id}>
            <span>
              <strong>{TEMPLATE_MAP[w.split_type]?.name ?? w.split_type}</strong>
              <small>{new Date(w.date).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric', year: '2-digit' })} · {w.total_duration_minutes} דק׳</small>
            </span>
            <span>{open === w.id ? '▴' : '▾'}</span>
          </button>
          {open === w.id && (
            <div className="hist">
              {grouped(w.id).map((g) => {
                const ex = EXERCISE_MAP[g.exercise_id];
                return (
                  <div key={g.exercise_id} className="hist-ex">
                    <strong>{ex?.name ?? g.exercise_id}</strong>
                    <span dir="ltr">
                      {g.sets.map((s) => (ex?.tracking === 'time' ? `${s.reps}s` : `${s.weight_kg}×${s.reps}`) + (s.is_pr ? '🏆' : '')).join('  ')}
                    </span>
                  </div>
                );
              })}
              <button className="btn ghost sm danger-text" onClick={() => { if (confirm('למחוק את האימון הזה?')) deleteWorkout(w.id); }}>מחק אימון</button>
            </div>
          )}
        </section>
      ))}
    </>
  );
}
