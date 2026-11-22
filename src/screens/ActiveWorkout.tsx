import { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { MUSCLE_LABEL } from '../data/exercises';
import { TEMPLATE_MAP } from '../data/programs';
import { getAlternatives, isExerciseAvailable } from '../engine/alternatives';
import { calcPlates, formatClock } from '../engine/calc';
import { suggestNext, warmupSets } from '../engine/progression';
import { primeAudio, useNow, useWakeLock } from '../hooks';
import { formatMinutes, overdueState, usualMinutes } from '../engine/overdue';
import { historyFor, useCatalog, useStore, type WorkoutSummary } from '../store';
import { videoLink } from '../engine/catalog';
import { isBlocked } from '../engine/injury';
import { ExercisePicker } from './Library';
import { suggestMore } from '../engine/builder';
import { CardioForm, cardioLine } from '../components/CardioForm';
import type { Effort, Exercise } from '../types';
import { Sheet } from '../components/Sheet';

// Beginners judge effort poorly from a bare word, so each option says what it means.
const EFFORTS: { id: Effort; label: string; hint: string }[] = [
  { id: 'easy', label: 'קל', hint: 'נשארו 4+ חזרות' },
  { id: 'ok', label: 'בדיוק', hint: 'נשארו 1–3 חזרות' },
  { id: 'hard', label: 'קשה מדי', hint: 'עד כשל או טכניקה נשברה' },
];

const num = (v: string): number | null => {
  const n = Number(v.replace(',', '.'));
  return v.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : null;
};

export function fireConfetti(): void {
  void confetti({ particleCount: 140, spread: 80, origin: { y: 0.7 } });
}

/** Two frames cross-faded in a loop – stands in for an animation. */
function ExerciseMedia({ ex }: { ex: Exercise }) {
  const [frame, setFrame] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    const id = setInterval(() => setFrame((f) => 1 - f), 1100);
    return () => clearInterval(id);
  }, [ex.id]);
  if (failed || ex.media_urls.length === 0) return <div className="media media-empty small-media">אין הדגמה זמינה לתרגיל הזה</div>;
  return (
    <div className="media">
      {ex.media_urls.map((url, i) => (
        <img key={url} src={`${import.meta.env.BASE_URL}${url}`} alt="" className={i === frame ? 'on' : ''} onError={() => setFailed(true)} />
      ))}
    </div>
  );
}

function PlateSheet({ initial, onClose }: { initial: number; onClose: () => void }) {
  const profile = useStore((s) => s.profile)!;
  const [target, setTarget] = useState(String(initial || profile.bar_weight_kg));
  const t = num(target) ?? 0;
  const r = calcPlates(t, profile.bar_weight_kg, profile.plates_kg);
  return (
    <Sheet title="מחשבון פלטות" onClose={onClose}>
      <label className="field">
        <span>משקל יעד (ק"ג)</span>
        <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="משקל יעד" />
      </label>
      <div className="barbell" dir="ltr" aria-hidden>
        <div className="bar-sleeve" />
        {r.perSide.map((p, i) => (
          <div key={i} className="plate" style={{ height: 34 + p * 3.4, background: plateColor(p) }}>
            <span>{p}</span>
          </div>
        ))}
        <div className="bar-end" />
      </div>
      <p className="plate-text">
        {r.perSide.length === 0
          ? `מוט בלבד (${profile.bar_weight_kg} ק"ג)`
          : <>בכל צד: <span dir="ltr">{r.perSide.join(' + ')}</span></>}
      </p>
      <p className="muted">מוט {profile.bar_weight_kg} ק"ג · סה"כ {r.achievable} ק"ג</p>
      {r.remainder > 0 && <p className="warn">אי אפשר להגיע בדיוק ל-{t} ק"ג עם הפלטות הקיימות. חסרים {r.remainder} ק"ג.</p>}
    </Sheet>
  );
}

function plateColor(p: number): string {
  if (p >= 25) return '#d64545';
  if (p >= 20) return '#3b82f6';
  if (p >= 15) return '#eab308';
  if (p >= 10) return '#22c55e';
  if (p >= 5) return '#e5e7eb';
  return '#9ca3af';
}

/**
 * Manual stopwatch in the header. Tap: start → stop → reset.
 * `onStop` receives the measured seconds (used to fill timed sets like a plank).
 */
function Stopwatch({ onStop }: { onStop: (seconds: number) => void }) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [frozen, setFrozen] = useState<number | null>(null);
  const now = useNow(250);
  const running = startedAt !== null;
  const seconds = running ? Math.max(0, Math.floor((now - startedAt) / 1000)) : frozen;

  const tap = () => {
    primeAudio();
    if (running) {
      const s = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
      setStartedAt(null);
      setFrozen(s);
      onStop(s);
    } else if (frozen !== null) {
      setFrozen(null);
    } else {
      setStartedAt(Date.now());
    }
  };

  const label = running ? 'עצור סטופר' : frozen !== null ? 'אפס סטופר' : 'הפעל סטופר';
  return (
    <button className={`stopwatch ${running ? 'run' : frozen !== null ? 'stopped' : ''}`} onClick={tap} aria-label={label}>
      <span aria-hidden>{running ? '■' : frozen !== null ? '↺' : '⏱'}</span>
      <span className="sw-time" role="timer">{seconds === null ? 'סטופר' : formatClock(seconds)}</span>
    </button>
  );
}

function RestBar({ nextName, progress }: { nextName: string | null; progress: number }) {
  const rest = useStore((s) => s.active?.rest ?? null);
  const adjustRest = useStore((s) => s.adjustRest);
  const skipRest = useStore((s) => s.skipRest);
  const now = useNow(250);
  // `now` can lag by one tick, so never show more than the full duration.
  const remaining = rest ? Math.min(rest.total_seconds, Math.ceil((rest.ends_at - now) / 1000)) : 0;
  const over = !!rest && remaining <= 0;

  return (
    <footer className="restbar">
      {rest && (
        <div className={`rest ${over ? 'rest-over' : ''}`}>
          <button className="btn ghost sm" onClick={() => adjustRest(-15)} disabled={over} aria-label="פחות 15 שניות"><span dir="ltr">−15</span></button>
          <div className="rest-center">
            <div className="rest-label">{over ? 'המנוחה הסתיימה' : 'מנוחה'}</div>
            <div className="rest-time" role="timer">{over ? 'קדימה!' : formatClock(remaining)}</div>
            <div className="rest-track"><div style={{ width: `${over ? 100 : Math.min(100, 100 - (remaining / rest.total_seconds) * 100)}%` }} /></div>
          </div>
          <button className="btn ghost sm" onClick={() => adjustRest(15)} aria-label="עוד 15 שניות"><span dir="ltr">+15</span></button>
          <button className="btn ghost sm" onClick={skipRest}>{over ? 'סגור' : 'דלג'}</button>
        </div>
      )}
      <div className="next-line">{nextName ? `התרגיל הבא: ${nextName}` : 'זה התרגיל האחרון'}</div>
      <div className="progress" aria-label={`הושלמו ${Math.round(progress * 100)} אחוז`}><div style={{ width: `${progress * 100}%` }} /></div>
    </footer>
  );
}

export function ActiveWorkoutScreen({ onFinished, onMinimize }: { onFinished: (s: WorkoutSummary | null) => void; onMinimize: () => void }) {
  const active = useStore((s) => s.active)!;
  const workouts = useStore((s) => s.workouts);
  const logs = useStore((s) => s.sets);
  const equipment = useStore((s) => s.equipment);
  const profile = useStore((s) => s.profile)!;
  const st = useStore.getState;
  const cat = useCatalog();
  const now = useNow(1000);
  useWakeLock(true);

  const [swapOpen, setSwapOpen] = useState(false);
  const [plateFor, setPlateFor] = useState<number | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [shake, setShake] = useState<number | null>(null);
  const [inputHint, setInputHint] = useState(false);
  const [overview, setOverview] = useState(false);
  const [cardioOpen, setCardioOpen] = useState(false);
  // Frozen when the sheet opens, so added exercises stay listed (marked) instead of vanishing.
  const [more, setMore] = useState<Exercise[] | null>(null);
  const [addedMore, setAddedMore] = useState<string[]>([]);
  const cardio = active.cardio ?? [];
  // Sets whose values were copied in and still await an explicit confirmation.
  const [pending, setPending] = useState<number[]>([]);
  const [remember, setRemember] = useState(true);
  const [picker, setPicker] = useState<'swap' | 'add' | null>(null);

  const idx = active.current_index;
  const item = active.items[idx];
  const ex = cat.get(item.exercise_id);
  const planned = cat.get(item.planned_exercise_id);
  const tpl = TEMPLATE_MAP[active.split_type];
  const timed = ex.tracking === 'time';
  const showWeight = ex.tracking !== 'time';

  // Each exercise starts at the top of the screen.
  const stripRef = useRef<HTMLElement>(null);
  const effortRef = useRef<HTMLElement>(null);
  useEffect(() => {
    window.scrollTo({ top: 0 });
    setInputHint(false);
    setPending([]);
    stripRef.current?.querySelector('.cur')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [idx]);

  const history = useMemo(() => historyFor(ex.id, workouts, logs), [ex.id, workouts, logs]);
  const last = history[0];
  const suggestion = useMemo(
    () => suggestNext(ex, item.rep_min, item.rep_max, history, item.sets.length),
    [ex, item.rep_min, item.rep_max, history, item.sets.length],
  );

  const totalSets = active.items.reduce((a, i) => a + i.sets.length, 0);
  const doneSets = active.items.reduce((a, i) => a + i.sets.filter((s) => s.done).length, 0);
  const itemDone = item.sets.every((s) => s.done);
  const nextItem = active.items[idx + 1];

  // The rating appears below the fold – bring it into view once the last set is ticked.
  useEffect(() => {
    if (itemDone && item.role !== 'core' && !item.effort) effortRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [itemDone, item.role, item.effort]);

  const alternatives = useMemo(() => {
    const inWorkout = active.items.map((i) => i.exercise_id);
    // In injury mode, do not offer exercises that load an area the user must avoid.
    const alts = getAlternatives(ex, cat.all, equipment, [...inWorkout, planned.id], 12).filter((a) => !isBlocked(a, profile.injuries));
    // After a swap, always offer the way back to the planned exercise first.
    const original = ex.id !== planned.id && !planned.archived && !isBlocked(planned, profile.injuries) && isExerciseAvailable(planned, equipment) && !inWorkout.includes(planned.id) ? [planned] : [];
    return [...original, ...alts].slice(0, 3);
  }, [ex, planned, equipment, active.items, cat, profile.injuries]);

  // Ghost values: same set from the previous workout, else the previous set today.
  const ghost = (setIdx: number): { weight: number | null; reps: number | null } => {
    const prev = last?.sets[setIdx] ?? last?.sets[last.sets.length - 1];
    const today = [...item.sets.slice(0, setIdx)].reverse().find((s) => s.done);
    return {
      weight: prev?.weight_kg ?? (today ? Number(today.weight) : ex.is_bodyweight ? 0 : null),
      reps: prev?.reps ?? (today ? Number(today.reps) : null),
    };
  };

  const complete = (setIdx: number) => {
    primeAudio();
    const s = item.sets[setIdx];
    const g = ghost(setIdx);
    const typedWeight = num(s.weight);
    const typedReps = num(s.reps);
    // Added weight on a bodyweight exercise is 0 unless stated – that is not a copied result.
    const weightMissing = showWeight && typedWeight === null && !ex.is_bodyweight;
    const repsMissing = typedReps === null;
    if (weightMissing || repsMissing) {
      const canFill = (!weightMissing || g.weight !== null) && (!repsMissing || g.reps !== null);
      if (canFill) {
        // Never log a performance nobody entered: copy the suggestion in, visibly, and ask for a second tap.
        st().editSet(idx, setIdx, {
          ...(weightMissing ? { weight: String(g.weight) } : {}),
          ...(repsMissing ? { reps: String(g.reps) } : {}),
        });
        setPending((p) => [...p.filter((x) => x !== setIdx), setIdx]);
        setInputHint(false);
      } else {
        setShake(setIdx);
        setInputHint(true);
        setTimeout(() => setShake(null), 450);
      }
      return;
    }
    const weight = showWeight ? (typedWeight ?? 0) : 0;
    if (typedReps <= 0) {
      setShake(setIdx);
      setInputHint(true);
      setTimeout(() => setShake(null), 450);
      return;
    }
    setInputHint(false);
    setPending((p) => p.filter((x) => x !== setIdx));
    if (st().completeSet(idx, setIdx, weight, typedReps)) fireConfetti();
    // Core work has no effort rating, so move on by itself after the last set.
    const nowDone = item.sets.every((x, i) => x.done || i === setIdx);
    if (nowDone && item.role === 'core' && nextItem) st().setCurrentIndex(idx + 1);
  };

  const edit = (setIdx: number, patch: { weight?: string; reps?: string }) => {
    setPending((p) => p.filter((x) => x !== setIdx));
    st().editSet(idx, setIdx, patch);
  };

  const rate = (effort: Effort) => {
    st().setEffort(idx, effort);
    if (nextItem) st().setCurrentIndex(idx + 1);
  };

  const applySuggestion = () => {
    if (!suggestion) return;
    item.sets.forEach((s, i) => {
      if (!s.done) st().editSet(idx, i, { weight: String(suggestion.weight_kg) });
    });
  };

  // A stopped stopwatch fills the next open set of a timed exercise.
  const onStopwatch = (seconds: number) => {
    if (!timed || seconds <= 0) return;
    const open = item.sets.findIndex((s) => !s.done && s.reps.trim() === '');
    if (open >= 0) st().editSet(idx, open, { reps: String(seconds) });
  };

  const finish = () => {
    setConfirmFinish(false);
    onFinished(st().finishWorkout());
  };

  const discard = () => {
    if (!confirm('למחוק את האימון הזה בלי לשמור?')) return;
    setConfirmFinish(false);
    st().cancelWorkout();
    onFinished(null);
  };

  const warmups = item.role === 'anchor' && ex.uses_barbell
    ? warmupSets(suggestion?.weight_kg ?? num(item.sets[0].weight) ?? 0, profile.bar_weight_kg)
    : [];
  const firstTime = !last && !item.sets.some((s) => s.done);
  const overdue = overdueState(active, usualMinutes(workouts), now);
  const todayItems = active.items.map((it) => ({ ex: cat.get(it.exercise_id), sets: it.sets.length }));
  const todayMuscles = [...new Set((todayItems.some((t) => !t.ex.is_core) ? todayItems.filter((t) => !t.ex.is_core) : todayItems).map((t) => t.ex.muscle_group))];
  const openMore = () => {
    setAddedMore([]);
    setMore(suggestMore(todayItems, cat, equipment, (e) => !isBlocked(e, profile.injuries)));
  };
  const addMore = (e: Exercise) => {
    st().addActiveExercise(e.id, { beforeCore: true, focus: false });
    setAddedMore((cur) => [...cur, e.id]);
  };
  // Time still needed: work + rest for every set that is not ticked yet.
  const remainingMinutes = Math.ceil(active.items.reduce((sum, it) => {
    const e = cat.get(it.exercise_id);
    return sum + it.sets.filter((x) => !x.done).length * (e.rest_time_seconds + (e.is_core ? 35 : 45));
  }, 0) / 60);
  const video = videoLink(ex);

  return (
    <div className="aw">
      <header className="aw-header">
        <button className="icon-btn" onClick={onMinimize} aria-label="מזער">⌄</button>
        <div className="aw-title">
          <strong>{tpl.name}</strong>
          <span className="aw-clock" role="timer" aria-label="משך האימון">{formatClock((now - active.started_at) / 1000)}</span>
        </div>
        <Stopwatch onStop={onStopwatch} />
        <button className="finish-btn" onClick={() => (doneSets === totalSets ? finish() : setConfirmFinish(true))}>סיים אימון</button>
      </header>

      <nav className="strip" aria-label="תרגילים" ref={stripRef}>
        <button className="overview-btn" onClick={() => setOverview(true)} aria-label="סקירת האימון">☰ סקירה</button>
        {active.items.map((it, i) => {
          const d = it.sets.every((s) => s.done);
          return (
            <button key={i} className={`dot ${i === idx ? 'cur' : ''} ${d ? 'done' : ''} ${it.role === 'core' ? 'core' : ''}`} onClick={() => st().setCurrentIndex(i)} aria-label={`תרגיל ${i + 1}`}>
              {d ? '✓' : i + 1}
            </button>
          );
        })}
      </nav>

      <main className="aw-body">
        <section className="hero">
          <ExerciseMedia ex={ex} />
          <div className="hero-head">
            <div>
              <div className="tag">
                {item.role === 'anchor' ? 'תרגיל עוגן' : item.role === 'core' ? 'פינישר בטן' : MUSCLE_LABEL[ex.muscle_group]}
                {' · '}{item.sets.length} סטים × <span dir="ltr">{item.rep_min}–{item.rep_max}</span> {timed ? 'שניות' : 'חזרות'}
              </div>
              <h1>{ex.name}</h1>
            </div>
            <button className="btn swap" onClick={() => setSwapOpen(true)}>⇄ החלף תרגיל</button>
          </div>
          {/* Open by default the first time; collapsed once the exercise is familiar. */}
          <details className="howto-wrap" key={ex.id} open={!last}>
            <summary>איך מבצעים</summary>
            {ex.instructions_tips.length === 0 && <p className="muted small">לא נכתבו הוראות לתרגיל הזה.</p>}
            <ol className="howto">
              {ex.instructions_tips.map((t) => <li key={t}>{t}</li>)}
            </ol>
          </details>
          {video && (
            <a className="video-link" href={video.url} target="_blank" rel="noopener noreferrer">
              ▶ {video.isSearch ? 'חפש סרטון טכניקה ביוטיוב' : 'סרטון טכניקה'}
            </a>
          )}
          {ex.safety_tip && <p className="safety">⚠️ {ex.safety_tip}</p>}
        </section>

        {firstTime && ex.tracking === 'weight_reps' && (
          <section className="suggest start">
            <span>פעם ראשונה בתרגיל: בחר משקל קל שאיתו אתה מגיע ל-{item.rep_max} חזרות בטכניקה נקייה, כשנשארות לך עוד 2–3 חזרות בכוח. עדיף להתחיל קל מדי מאשר כבד מדי.</span>
          </section>
        )}
        {timed && !itemDone && (
          <section className="suggest hold"><span>הפעל את הסטופר למעלה. כשתעצור אותו, הזמן יוזן לסט.</span></section>
        )}
        {item.caution && (
          <section className="suggest decrease"><span>מצב פציעה: עבוד במשקל קל מהרגיל ובטווח תנועה נוח. אם מופיע כאב, עוצרים את התרגיל.</span></section>
        )}
        {suggestion && ex.tracking === 'weight_reps' && !(item.caution && suggestion.action === 'increase') && (
          <section className={`suggest ${suggestion.action}`}>
            <span>{suggestion.message}</span>
            {suggestion.action !== 'hold' && <button className="btn sm" onClick={applySuggestion}>החל</button>}
          </section>
        )}
        {suggestion && ex.tracking === 'bodyweight_reps' && <section className="suggest hold"><span>{suggestion.message}</span></section>}
        {warmups.length > 0 && !item.sets.some((s) => s.done) && (
          <p className="muted warmup">חימום מוצע:{' '}
            {warmups.map((w, i) => <span key={i}>{i > 0 && ', '}<span dir="ltr">{w.weight_kg}×{w.reps}</span></span>)}
          </p>
        )}

        <section className="sets">
          <div className={`set-row set-head ${showWeight ? '' : 'no-weight'}`}>
            <span>סט</span>
            {showWeight && <span>{ex.is_bodyweight ? 'תוספת ק"ג' : 'ק"ג'}</span>}
            <span>{timed ? 'שניות' : 'חזרות'}</span>
            <span />
          </div>
          {item.sets.map((s, i) => {
            const g = ghost(i);
            return (
              <div key={i} className={`set-row ${s.done ? 'done' : ''} ${pending.includes(i) && !s.done ? 'pending' : ''} ${shake === i ? 'shake' : ''} ${showWeight ? '' : 'no-weight'}`}>
                <span className="set-n">{s.is_pr ? '🏆' : i + 1}</span>
                {showWeight && (
                  <div className="weight-cell">
                    <input
                      inputMode="decimal" value={s.weight} disabled={s.done}
                      placeholder={g.weight !== null ? String(g.weight) : '—'}
                      onChange={(e) => edit(i, { weight: e.target.value })}
                      aria-label={`משקל סט ${i + 1}`}
                    />
                    {ex.uses_barbell && (
                      <button className="plate-btn" onClick={() => setPlateFor(num(s.weight) ?? g.weight ?? 0)} aria-label="מחשבון פלטות">🏋️</button>
                    )}
                  </div>
                )}
                <input
                  inputMode="numeric" value={s.reps} disabled={s.done}
                  placeholder={g.reps !== null ? String(g.reps) : '—'}
                  onChange={(e) => edit(i, { reps: e.target.value })}
                  aria-label={`${timed ? 'שניות' : 'חזרות'} סט ${i + 1}`}
                />
                <button
                  className={`check ${s.done ? 'on' : ''}`}
                  onClick={() => (s.done ? st().uncompleteSet(idx, i) : complete(i))}
                  aria-label={s.done ? `בטל סט ${i + 1}` : pending.includes(i) ? `אשר סט ${i + 1}` : `סיים סט ${i + 1}`}
                  aria-pressed={s.done}
                >{pending.includes(i) && !s.done ? 'אשר' : '✓'}</button>
              </div>
            );
          })}
          {pending.some((i) => !item.sets[i]?.done) && (
            <p className="copied-note" role="status">הערכים הועתקו מ{last ? 'האימון הקודם' : 'הסט הקודם'}. תקן אם צריך, ולחץ "אשר" רק אם זה מה שביצעת.</p>
          )}
          {inputHint && <p className="warn center" role="alert">הזן {showWeight ? 'משקל ו' : ''}{timed ? 'שניות' : 'חזרות'} לפני שמסמנים את הסט.</p>}
          <div className="set-tools">
            <button className="btn ghost sm" onClick={() => st().addSet(idx)}>+ סט</button>
            <button className="btn ghost sm" onClick={() => st().removeSet(idx)} disabled={item.sets.length <= 1 || item.sets[item.sets.length - 1].done}>− סט</button>
          </div>
        </section>

        {itemDone && item.role !== 'core' && (
          <section className="effort" ref={effortRef}>
            <span>איך היה הסט האחרון?</span>
            <div className="effort-row">
              {EFFORTS.map((e) => (
                <button key={e.id} className={`effort-btn ${item.effort === e.id ? 'on' : ''}`} onClick={() => rate(e.id)} aria-pressed={item.effort === e.id}>
                  <strong>{e.label}</strong>
                  <small>{e.hint}</small>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="set-tools">
          <button className="btn ghost sm" onClick={() => openMore()}>+ עוד בסגנון של היום</button>
          <button className="btn ghost sm" onClick={() => setPicker('add')}>+ תרגיל לאימון הזה</button>
          <button className="btn ghost sm" onClick={() => setCardioOpen(true)}>+ אירובי{cardio.length > 0 ? ` (${cardio.length})` : ''}</button>
          <button className="btn ghost sm danger-text" disabled={active.items.length <= 1}
            onClick={() => { if (!item.sets.some((x) => x.done) || confirm('להסיר את התרגיל מהאימון הזה? הסטים שסומנו בו יימחקו.')) st().removeActiveItem(idx); }}>
            הסר תרגיל
          </button>
        </div>

        <div className="nav-row">
          <button className="btn ghost" disabled={idx === 0} onClick={() => st().setCurrentIndex(idx - 1)}>→ הקודם</button>
          {nextItem
            ? <button className={`btn ${itemDone ? 'primary' : 'ghost'}`} onClick={() => st().setCurrentIndex(idx + 1)}>הבא ←</button>
            : <button className={`btn ${doneSets === totalSets ? 'primary' : 'ghost'}`} onClick={() => (doneSets === totalSets ? finish() : setConfirmFinish(true))}>סיום</button>}
        </div>
      </main>

      <RestBar nextName={nextItem ? cat.get(nextItem.exercise_id).name : null} progress={totalSets ? doneSets / totalSets : 0} />

      {swapOpen && (
        <Sheet title={`חלופות ל${ex.name}`} onClose={() => setSwapOpen(false)}>
          {alternatives.length === 0 && <p className="muted">אין חלופה זמינה עם הציוד שסומן. אפשר לעדכן את רשימת הציוד בפרופיל.</p>}
          {alternatives.map((a) => (
            <button key={a.id} className="alt" onClick={() => { st().swapExercise(idx, a.id, remember); setSwapOpen(false); }}>
              <img src={`${import.meta.env.BASE_URL}${a.media_urls[0]}`} alt="" />
              <span>
                <strong>{a.name}</strong>
                <small>{a.id === planned.id ? 'התרגיל המקורי בתוכנית' : `${MUSCLE_LABEL[a.muscle_group]} · ${a.is_compound ? 'מורכב' : 'בידוד'}`}</small>
              </span>
            </button>
          ))}
          <button className="btn ghost block" onClick={() => { setSwapOpen(false); setPicker('swap'); }}>כל התרגילים ל{MUSCLE_LABEL[ex.muscle_group]}…</button>
          <label className="toggle">
            <span>זכור את ההחלפה גם לאימונים הבאים</span>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          </label>
          {item.sets.some((s) => s.done) && <p className="warn">החלפה תאפס את הסטים שכבר סומנו בתרגיל הזה.</p>}
        </Sheet>
      )}

      {picker && (
        <ExercisePicker
          title={picker === 'swap' ? 'בחר תרגיל חלופי' : 'הוסף תרגיל לאימון הזה'}
          excludeIds={active.items.map((i) => i.exercise_id)}
          muscle={picker === 'swap' ? ex.muscle_group : undefined}
          onClose={() => setPicker(null)}
          onPick={(chosen) => {
            if (picker === 'swap') st().swapExercise(idx, chosen.id, remember);
            else st().addActiveExercise(chosen.id);
            setPicker(null);
          }}
        />
      )}

      {plateFor !== null && <PlateSheet initial={plateFor} onClose={() => setPlateFor(null)} />}

      {overdue.forgotten && !confirmFinish && (
        <Sheet title="נראה ששכחת לסגור את האימון" onClose={() => st().snoozeOverdue(30)}>
          <p>
            האימון פתוח כבר {formatMinutes(overdue.elapsed_min)}
            {doneSets > 0 ? `, והסט האחרון סומן לפני ${formatMinutes(overdue.idle_min)}.` : ', ועוד לא סומן בו אף סט.'}
            {' '}אימון רגיל אצלך נמשך כ-{overdue.usual_min} דקות.
          </p>
          <div className="stack">
            {doneSets > 0 && (
              <button className="btn primary" onClick={() => onFinished(st().finishWorkout(overdue.end_at))}>
                סיים ושמור · משך {formatMinutes(Math.max(1, Math.round((overdue.end_at - active.started_at) / 60000)))}
              </button>
            )}
            <button className="btn ghost" onClick={() => st().snoozeOverdue(30)}>אני עדיין מתאמן</button>
            <button className="btn ghost danger-text" onClick={discard}>בטל את האימון בלי לשמור</button>
          </div>
          {doneSets > 0 && <p className="muted small">המשך שיישמר נמדד עד שתי דקות אחרי הסט האחרון, כדי שהזמן שהאימון נשאר פתוח לא ייכנס לסטטיסטיקה.</p>}
        </Sheet>
      )}

      {overview && (
        <Sheet title={`${tpl.name} · סקירת האימון`} onClose={() => setOverview(false)}>
          <div className="stats">
            <div><strong>{doneSets}/{totalSets}</strong><span>סטים</span></div>
            <div><strong dir="ltr">{formatClock((now - active.started_at) / 1000)}</strong><span>זמן שעבר</span></div>
            <div><strong>{remainingMinutes}</strong><span>דקות נותרו (הערכה)</span></div>
          </div>
          {active.items.map((it, i) => {
            const e = cat.get(it.exercise_id);
            const done = it.sets.filter((x) => x.done);
            const state = done.length === it.sets.length ? 'done' : done.length > 0 ? 'partial' : '';
            const isTimed = e.tracking === 'time';
            return (
              <button key={i} className={`ov-row ${state} ${i === idx ? 'cur' : ''}`} aria-current={i === idx}
                onClick={() => { st().setCurrentIndex(i); setOverview(false); }}>
                <span className="ov-n">{state === 'done' ? '✓' : i + 1}</span>
                <span className="ov-main">
                  <strong>{e.name}</strong>
                  <small>
                    {it.role === 'anchor' ? 'עוגן' : it.role === 'core' ? 'בטן' : MUSCLE_LABEL[e.muscle_group]}
                    {' · '}{it.sets.length} × <span dir="ltr">{it.rep_min}–{it.rep_max}</span>{isTimed ? ' שנ׳' : ''}
                    {it.caution ? ' · ⚠️ מופחת' : ''}{i === idx ? ' · עכשיו' : ''}
                  </small>
                  {done.length > 0 && (
                    <small className="ov-log" dir="ltr">
                      {done.map((x) => (isTimed ? `${x.reps}s` : Number(x.weight) > 0 ? `${x.weight}×${x.reps}` : x.reps) + (x.is_pr ? '🏆' : '')).join('  ')}
                    </small>
                  )}
                </span>
                <span className="ov-count">{done.length}/{it.sets.length}</span>
              </button>
            );
          })}
          {cardio.map((c, i) => (
            <div key={i} className="ov-row done-cardio">
              <span className="ov-n">🏃</span>
              <span className="ov-main"><strong>אירובי</strong><small>{cardioLine(c)}</small></span>
              <button className="link danger-text" aria-label="הסר אירובי" onClick={() => st().removeActiveCardio(i)}>✕</button>
            </div>
          ))}
          <button className="btn ghost block" onClick={() => { setOverview(false); openMore(); }}>+ עוד תרגילים בסגנון של היום</button>
          <button className="btn ghost block" onClick={() => { setOverview(false); setCardioOpen(true); }}>+ הוסף אירובי לאימון</button>
          <p className="muted small">לחיצה על תרגיל קופצת אליו. אפשר לבצע את התרגילים בכל סדר.</p>
        </Sheet>
      )}

      {more && (
        <Sheet title="עוד בסגנון של היום" onClose={() => setMore(null)}>
          <p className="muted">תרגילים נוספים לשרירים שעבדת עליהם היום: {todayMuscles.map((m) => MUSCLE_LABEL[m]).join(', ')}.</p>
          {more.length === 0 && <p className="muted">אין עוד תרגילים זמינים לשרירים האלה עם הציוד והמגבלות הנוכחיים.</p>}
          {more.length >= 2 && addedMore.length === 0 && (
            <button className="btn primary block" onClick={() => more.slice(0, 2).forEach(addMore)}>הוסף את 2 המומלצים</button>
          )}
          {more.map((e) => {
            const added = addedMore.includes(e.id);
            return (
              <div key={e.id} className="list-row">
                <span>
                  <strong>{e.name}</strong>
                  <small>{MUSCLE_LABEL[e.muscle_group]} · {e.is_core ? 'בטן' : e.is_compound ? 'מורכב' : 'בידוד'}{e.is_custom ? ' · תרגיל שלי' : ''}</small>
                </span>
                <button className={`btn sm ${added ? 'ghost' : ''}`} disabled={added} onClick={() => addMore(e)} aria-label={added ? `${e.name} נוסף` : `הוסף ${e.name}`}>{added ? 'נוסף ✓' : 'הוסף'}</button>
              </div>
            );
          })}
          <p className="muted small">התרגילים נכנסים לפני פינישר הבטן, ונשמרים רק באימון הזה. התוכנית הקבועה לא משתנה. כדאי להוסיף אחד או שניים, לא יותר.</p>
          {addedMore.length > 0 && <button className="btn ghost block" onClick={() => setMore(null)}>סיום</button>}
        </Sheet>
      )}

      {cardioOpen && (
        <Sheet title="אירובי באימון הזה" onClose={() => setCardioOpen(false)}>
          {cardio.map((c, i) => (
            <div key={i} className="list-row">
              <span>{cardioLine(c)}</span>
              <button className="link danger-text" aria-label="הסר אירובי" onClick={() => st().removeActiveCardio(i)}>✕</button>
            </div>
          ))}
          <CardioForm weightKg={profile.current_weight} onSave={(c) => { st().addActiveCardio({ ...c, notes: '' }); setCardioOpen(false); }} />
        </Sheet>
      )}

      {confirmFinish && (
        <Sheet title="לסיים את האימון?" onClose={() => setConfirmFinish(false)}>
          <p>הושלמו {doneSets} מתוך {totalSets} סטים. רק סטים שסומנו יישמרו.{cardio.length > 0 ? ' האירובי שהוספת יישמר גם הוא.' : ''}</p>
          <div className="stack">
            {doneSets > 0 && <button className="btn primary" onClick={finish}>סיים ושמור</button>}
            <button className="btn ghost" onClick={() => setConfirmFinish(false)}>המשך אימון</button>
            {doneSets === 0 && cardio.length > 0 && <button className="btn primary" onClick={finish}>שמור רק את האירובי</button>}
            <button className="btn ghost danger-text" onClick={doneSets > 0 || cardio.length > 0 ? discard : finish}>בטל אימון בלי לשמור</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
