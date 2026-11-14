import { useMemo, useState } from 'react';
import { Sheet } from '../components/Sheet';
import { TEMPLATE_MAP } from '../data/programs';
import { weekStart, workoutText, workoutVolume } from '../engine/calc';
import { useCatalog, useStore, type EditedSet } from '../store';
import type { CardioType, SetLog, Workout } from '../types';

const CARDIO_LABEL: Record<CardioType, string> = { walk: 'הליכה', run: 'ריצה', bike: 'אופניים', stairs: 'מדרגות', other: 'אחר' };
const dateLabel = (iso: string) => new Date(iso).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric', year: '2-digit' });
const toNum = (v: string) => Number(v.replace(',', '.'));

export async function shareText(text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return 'shared';
    }
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch (e) {
    if ((e as Error).name === 'AbortError') return 'shared';
    try {
      await navigator.clipboard.writeText(text);
      return 'copied';
    } catch {
      return 'failed';
    }
  }
}

type Row = { id: string | null; exercise_id: string; weight: string; reps: string };

/** Edits the sets of a saved workout. Derived data is recomputed by the store on save. */
function WorkoutEditor({ workout, sets, onClose }: { workout: Workout; sets: SetLog[]; onClose: () => void }) {
  const cat = useCatalog();
  const updateWorkoutSets = useStore((s) => s.updateWorkoutSets);
  const [rows, setRows] = useState<Row[]>(sets.map((s) => ({ id: s.id, exercise_id: s.exercise_id, weight: String(s.weight_kg), reps: String(s.reps) })));
  const [error, setError] = useState('');

  const patch = (i: number, p: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const exerciseIds = [...new Set(rows.map((r) => r.exercise_id))];

  const save = () => {
    const out: EditedSet[] = [];
    for (const r of rows) {
      const w = toNum(r.weight || '0');
      const reps = toNum(r.reps);
      if (!(reps > 0) || !(w >= 0) || !Number.isFinite(w)) return setError('בכל סט צריך מספר חזרות גדול מאפס ומשקל תקין.');
      out.push({ id: r.id, exercise_id: r.exercise_id, weight_kg: w, reps });
    }
    if (out.length === 0 && !confirm('לא נשארו סטים. האימון כולו יימחק. להמשיך?')) return;
    updateWorkoutSets(workout.id, out);
    onClose();
  };

  return (
    <Sheet title={`עריכת אימון · ${dateLabel(workout.date)}`} onClose={onClose}>
      {exerciseIds.map((id) => {
        const ex = cat.get(id);
        const timed = ex.tracking === 'time';
        const lastIdx = rows.map((r) => r.exercise_id).lastIndexOf(id);
        return (
          <div key={id} className="edit-ex">
            <strong>{ex.name}</strong>
            <div className={`edit-row edit-head ${timed ? 'no-weight' : ''}`}>
              {!timed && <span>{ex.is_bodyweight ? 'תוספת ק"ג' : 'ק"ג'}</span>}
              <span>{timed ? 'שניות' : 'חזרות'}</span>
              <span />
            </div>
            {rows.map((r, i) => r.exercise_id !== id ? null : (
              <div key={i} className={`edit-row ${timed ? 'no-weight' : ''}`}>
                {!timed && <input inputMode="decimal" value={r.weight} aria-label={`משקל ${ex.name}`} onChange={(e) => patch(i, { weight: e.target.value })} />}
                <input inputMode="numeric" value={r.reps} aria-label={`${timed ? 'שניות' : 'חזרות'} ${ex.name}`} onChange={(e) => patch(i, { reps: e.target.value })} />
                <button className="link danger-text" aria-label={`מחק סט ${ex.name}`} onClick={() => setRows((x) => x.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <button className="link" onClick={() => setRows((x) => { const n = [...x]; n.splice(lastIdx + 1, 0, { id: null, exercise_id: id, weight: x[lastIdx].weight, reps: '' }); return n; })}>+ סט</button>
          </div>
        );
      })}
      {rows.length === 0 && <p className="muted">כל הסטים הוסרו.</p>}
      <p className="muted small">אחרי השמירה, הנפח, השיאים והצעות המשקל מחושבים מחדש לפי הנתונים המתוקנים.</p>
      {error && <p className="warn" role="alert">{error}</p>}
      <div className="grid2">
        <button className="btn primary" onClick={save}>שמור שינויים</button>
        <button className="btn ghost" onClick={onClose}>בטל</button>
      </div>
    </Sheet>
  );
}

function CardioSheet({ onClose }: { onClose: () => void }) {
  const addCardio = useStore((s) => s.addCardio);
  const [type, setType] = useState<CardioType>('walk');
  const [minutes, setMinutes] = useState('');
  const [km, setKm] = useState('');
  const [error, setError] = useState('');
  const save = () => {
    if (!(toNum(minutes) > 0)) return setError('הזן משך בדקות.');
    addCardio({ date: new Date().toISOString(), type, minutes: toNum(minutes), distance_km: toNum(km) > 0 ? toNum(km) : null, notes: '' });
    onClose();
  };
  return (
    <Sheet title="אימון אירובי" onClose={onClose}>
      <div className="chips">
        {(Object.keys(CARDIO_LABEL) as CardioType[]).map((t) => <button key={t} className={`chip ${type === t ? 'on' : ''}`} onClick={() => setType(t)}>{CARDIO_LABEL[t]}</button>)}
      </div>
      <div className="grid2">
        <label className="field"><span>משך (דקות)</span><input inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-label="משך בדקות" /></label>
        <label className="field"><span>מרחק בק"מ (לא חובה)</span><input inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} aria-label="מרחק" /></label>
      </div>
      {error && <p className="warn" role="alert">{error}</p>}
      <button className="btn primary block" onClick={save}>שמור</button>
    </Sheet>
  );
}

export function History() {
  const workouts = useStore((s) => s.workouts);
  const sets = useStore((s) => s.sets);
  const cardio = useStore((s) => s.cardio);
  const deleteWorkout = useStore((s) => s.deleteWorkout);
  const deleteCardio = useStore((s) => s.deleteCardio);
  const cat = useCatalog();
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [cardioOpen, setCardioOpen] = useState(false);
  const [msg, setMsg] = useState('');

  const feed = useMemo(
    () => [
      ...workouts.map((w) => ({ kind: 'workout' as const, date: w.date, w })),
      ...cardio.map((c) => ({ kind: 'cardio' as const, date: c.date, c })),
    ].sort((a, b) => b.date.localeCompare(a.date)),
    [workouts, cardio],
  );
  const cardioWeek = cardio.filter((c) => weekStart(new Date(c.date)) === weekStart(new Date())).reduce((a, c) => a + c.minutes, 0);
  const setsOf = (id: string) => sets.filter((x) => x.workout_id === id).sort((a, b) => a.order_index - b.order_index);

  const grouped = (workoutId: string) => {
    const out: { exercise_id: string; sets: SetLog[] }[] = [];
    for (const s of setsOf(workoutId)) {
      const g = out.find((o) => o.exercise_id === s.exercise_id);
      if (g) g.sets.push(s);
      else out.push({ exercise_id: s.exercise_id, sets: [s] });
    }
    return out;
  };

  const share = async (w: Workout) => {
    const text = workoutText(`אימון ${TEMPLATE_MAP[w.split_type]?.name ?? ''}`, w, setsOf(w.id), cat.get);
    const r = await shareText(text);
    setMsg(r === 'copied' ? 'הסיכום הועתק. אפשר להדביק אותו בכל מקום.' : r === 'failed' ? 'לא הצלחתי לשתף או להעתיק.' : '');
  };

  const editingWorkout = workouts.find((w) => w.id === editing);

  return (
    <>
      <header className="page-head">
        <h1>היסטוריה</h1>
        <span className="muted">{workouts.length} אימונים{cardio.length > 0 ? ` · אירובי השבוע: ${cardioWeek} דקות` : ''}</span>
      </header>
      <button className="btn ghost block" onClick={() => setCardioOpen(true)}>+ הוסף אימון אירובי</button>
      {msg && <p className="muted center" role="status">{msg}</p>}
      {feed.length === 0 && <p className="muted center">עדיין אין אימונים שמורים.</p>}
      {feed.map((item) => item.kind === 'cardio' ? (
        <section key={item.c.id} className="card cardio-card">
          <div className="list-row">
            <span>
              <strong>🏃 {CARDIO_LABEL[item.c.type]}</strong>
              <small>{dateLabel(item.c.date)} · {item.c.minutes} דק׳{item.c.distance_km ? ` · ${item.c.distance_km} ק"מ` : ''}</small>
            </span>
            <button className="link danger-text" aria-label="מחק אירובי" onClick={() => { if (confirm('למחוק את האימון האירובי?')) deleteCardio(item.c.id); }}>✕</button>
          </div>
        </section>
      ) : (
        <section key={item.w.id} className="card">
          <button className="row-btn" onClick={() => setOpen(open === item.w.id ? null : item.w.id)} aria-expanded={open === item.w.id}>
            <span>
              <strong>{TEMPLATE_MAP[item.w.split_type]?.name ?? item.w.split_type}</strong>
              <small>{dateLabel(item.w.date)} · {item.w.total_duration_minutes} דק׳ · נפח {workoutVolume(setsOf(item.w.id), (id) => cat.get(id).tracking === 'time').toLocaleString('en-US')} ק"ג</small>
            </span>
            <span>{open === item.w.id ? '▴' : '▾'}</span>
          </button>
          {open === item.w.id && (
            <div className="hist">
              {grouped(item.w.id).map((g) => {
                const ex = cat.get(g.exercise_id);
                return (
                  <div key={g.exercise_id} className="hist-ex">
                    <strong>{ex.name}</strong>
                    <span dir="ltr">
                      {g.sets.map((s) => (ex.tracking === 'time' ? `${s.reps}s` : `${s.weight_kg}×${s.reps}`) + (s.is_pr ? '🏆' : '')).join('  ')}
                    </span>
                  </div>
                );
              })}
              <div className="grid3">
                <button className="btn ghost sm" onClick={() => setEditing(item.w.id)}>ערוך</button>
                <button className="btn ghost sm" onClick={() => void share(item.w)}>שתף</button>
                <button className="btn ghost sm danger-text" onClick={() => { if (confirm('למחוק את האימון הזה?')) deleteWorkout(item.w.id); }}>מחק</button>
              </div>
            </div>
          )}
        </section>
      ))}
      {editingWorkout && <WorkoutEditor workout={editingWorkout} sets={setsOf(editingWorkout.id)} onClose={() => setEditing(null)} />}
      {cardioOpen && <CardioSheet onClose={() => setCardioOpen(false)} />}
    </>
  );
}
