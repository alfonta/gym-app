import { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { EXERCISES, EXERCISE_MAP, MUSCLE_LABEL } from '../data/exercises';
import { TEMPLATE_MAP } from '../data/programs';
import { getAlternatives } from '../engine/alternatives';
import { calcPlates, formatClock } from '../engine/calc';
import { suggestNext, warmupSets } from '../engine/progression';
import { beep, primeAudio, useNow, useWakeLock } from '../hooks';
import { historyFor, useStore, type WorkoutSummary } from '../store';
import type { Effort, Exercise } from '../types';
import { Sheet } from '../components/Sheet';

const EFFORTS: { id: Effort; label: string }[] = [
  { id: 'easy', label: 'קל' },
  { id: 'ok', label: 'בינוני' },
  { id: 'hard', label: 'קשה' },
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
  if (failed) return <div className="media media-empty">אין הדגמה זמינה</div>;
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

function RestBar({ nextName, progress }: { nextName: string | null; progress: number }) {
  const rest = useStore((s) => s.active?.rest ?? null);
  const adjustRest = useStore((s) => s.adjustRest);
  const skipRest = useStore((s) => s.skipRest);
  const now = useNow(250);
  const beeped = useRef<number | null>(null);
  // `now` can lag by one tick, so never show more than the full duration.
  const remaining = rest ? Math.min(rest.total_seconds, Math.ceil((rest.ends_at - now) / 1000)) : 0;
  const over = !!rest && remaining <= 0;

  useEffect(() => {
    if (rest && over && beeped.current !== rest.ends_at) {
      beeped.current = rest.ends_at;
      // Skip the sound if the timer expired long ago (e.g. app reopened later).
      if (Date.now() - rest.ends_at < 3000) beep();
    }
  }, [rest, over]);

  return (
    <footer className="restbar">
      {rest && (
        <div className={`rest ${over ? 'rest-over' : ''}`}>
          <button className="btn ghost sm" onClick={() => adjustRest(-15)} disabled={over} aria-label="פחות 15 שניות"><span dir="ltr">−15</span></button>
          <div className="rest-center">
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
  const now = useNow(1000);
  useWakeLock(true);

  const [swapOpen, setSwapOpen] = useState(false);
  const [plateFor, setPlateFor] = useState<number | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [shake, setShake] = useState<number | null>(null);

  const idx = active.current_index;
  const item = active.items[idx];
  const ex = EXERCISE_MAP[item.exercise_id];
  const tpl = TEMPLATE_MAP[active.split_type];
  const timed = ex.tracking === 'time';
  const showWeight = ex.tracking !== 'time';

  const history = useMemo(() => historyFor(ex.id, workouts, logs), [ex.id, workouts, logs]);
  const last = history[0];
  const suggestion = useMemo(() => suggestNext(ex, item.rep_min, item.rep_max, history), [ex, item.rep_min, item.rep_max, history]);

  const totalSets = active.items.reduce((a, i) => a + i.sets.length, 0);
  const doneSets = active.items.reduce((a, i) => a + i.sets.filter((s) => s.done).length, 0);
  const itemDone = item.sets.every((s) => s.done);
  const nextItem = active.items[idx + 1];

  const alternatives = useMemo(
    () => getAlternatives(ex, EXERCISES, equipment, active.items.map((i) => i.exercise_id)),
    [ex, equipment, active.items],
  );

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
    const weight = showWeight ? (num(s.weight) ?? g.weight) : 0;
    const reps = num(s.reps) ?? g.reps;
    if (weight === null || reps === null || reps <= 0) {
      setShake(setIdx);
      setTimeout(() => setShake(null), 450);
      return;
    }
    if (st().completeSet(idx, setIdx, weight, reps)) fireConfetti();
  };

  const applySuggestion = () => {
    if (!suggestion) return;
    item.sets.forEach((s, i) => {
      if (!s.done) st().editSet(idx, i, { weight: String(suggestion.weight_kg) });
    });
  };

  const finish = () => {
    setConfirmFinish(false);
    onFinished(st().finishWorkout());
  };

  const warmups = item.role === 'anchor' && ex.uses_barbell
    ? warmupSets(suggestion?.weight_kg ?? num(item.sets[0].weight) ?? 0, profile.bar_weight_kg)
    : [];

  return (
    <div className="aw">
      <header className="aw-header">
        <button className="btn danger" onClick={() => (doneSets === totalSets ? finish() : setConfirmFinish(true))}>סיים אימון</button>
        <div className="aw-title">
          <strong>{tpl.name}</strong>
          <span className="aw-clock" role="timer">{formatClock((now - active.started_at) / 1000)}</span>
        </div>
        <button className="btn ghost sm" onClick={onMinimize} aria-label="מזער">⌄</button>
      </header>

      <nav className="strip" aria-label="תרגילים">
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
            <ol className="howto">
              {ex.instructions_tips.map((t) => <li key={t}>{t}</li>)}
            </ol>
          </details>
          <p className="safety">⚠️ {ex.safety_tip}</p>
        </section>

        {suggestion && ex.tracking === 'weight_reps' && (
          <section className={`suggest ${suggestion.action}`}>
            <span>{suggestion.message}</span>
            {suggestion.action !== 'hold' && <button className="btn sm" onClick={applySuggestion}>החל</button>}
          </section>
        )}
        {suggestion && ex.tracking !== 'weight_reps' && <section className="suggest hold"><span>{suggestion.message}</span></section>}
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
              <div key={i} className={`set-row ${s.done ? 'done' : ''} ${shake === i ? 'shake' : ''} ${showWeight ? '' : 'no-weight'}`}>
                <span className="set-n">{s.is_pr ? '🏆' : i + 1}</span>
                {showWeight && (
                  <div className="weight-cell">
                    <input
                      inputMode="decimal" value={s.weight} disabled={s.done}
                      placeholder={g.weight !== null ? String(g.weight) : '—'}
                      onChange={(e) => st().editSet(idx, i, { weight: e.target.value })}
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
                  onChange={(e) => st().editSet(idx, i, { reps: e.target.value })}
                  aria-label={`${timed ? 'שניות' : 'חזרות'} סט ${i + 1}`}
                />
                <button
                  className={`check ${s.done ? 'on' : ''}`}
                  onClick={() => (s.done ? st().uncompleteSet(idx, i) : complete(i))}
                  aria-label={s.done ? `בטל סט ${i + 1}` : `סיים סט ${i + 1}`}
                  aria-pressed={s.done}
                >✓</button>
              </div>
            );
          })}
          <div className="set-tools">
            <button className="btn ghost sm" onClick={() => st().addSet(idx)}>+ סט</button>
            <button className="btn ghost sm" onClick={() => st().removeSet(idx)} disabled={item.sets.length <= 1 || item.sets[item.sets.length - 1].done}>− סט</button>
          </div>
        </section>

        {itemDone && item.role !== 'core' && (
          <section className="effort">
            <span>איך הרגיש התרגיל?</span>
            <div className="chips">
              {EFFORTS.map((e) => (
                <button key={e.id} className={`chip ${item.effort === e.id ? 'on' : ''}`} onClick={() => st().setEffort(idx, e.id)}>{e.label}</button>
              ))}
            </div>
          </section>
        )}

        <div className="nav-row">
          <button className="btn ghost" disabled={idx === 0} onClick={() => st().setCurrentIndex(idx - 1)}>→ הקודם</button>
          {nextItem
            ? <button className={`btn ${itemDone ? 'primary' : 'ghost'}`} onClick={() => st().setCurrentIndex(idx + 1)}>הבא ←</button>
            : <button className={`btn ${doneSets === totalSets ? 'primary' : 'ghost'}`} onClick={() => (doneSets === totalSets ? finish() : setConfirmFinish(true))}>סיום</button>}
        </div>
      </main>

      <RestBar nextName={nextItem ? EXERCISE_MAP[nextItem.exercise_id].name : null} progress={totalSets ? doneSets / totalSets : 0} />

      {swapOpen && (
        <Sheet title={`חלופות ל${ex.name}`} onClose={() => setSwapOpen(false)}>
          {alternatives.length === 0 && <p className="muted">אין חלופה זמינה עם הציוד שסומן. אפשר לעדכן את רשימת הציוד בפרופיל.</p>}
          {alternatives.map((a) => (
            <button key={a.id} className="alt" onClick={() => { st().swapExercise(idx, a.id); setSwapOpen(false); }}>
              <img src={`${import.meta.env.BASE_URL}${a.media_urls[0]}`} alt="" />
              <span>
                <strong>{a.name}</strong>
                <small>{MUSCLE_LABEL[a.muscle_group]} · {a.is_compound ? 'מורכב' : 'בידוד'}</small>
              </span>
            </button>
          ))}
          {item.sets.some((s) => s.done) && <p className="warn">החלפה תאפס את הסטים שכבר סומנו בתרגיל הזה.</p>}
        </Sheet>
      )}

      {plateFor !== null && <PlateSheet initial={plateFor} onClose={() => setPlateFor(null)} />}

      {confirmFinish && (
        <Sheet title="לסיים את האימון?" onClose={() => setConfirmFinish(false)}>
          <p>הושלמו {doneSets} מתוך {totalSets} סטים. רק סטים שסומנו יישמרו.</p>
          <div className="stack">
            <button className="btn danger" onClick={finish}>{doneSets > 0 ? 'סיים ושמור' : 'סיים בלי לשמור'}</button>
            <button className="btn ghost" onClick={() => setConfirmFinish(false)}>המשך אימון</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
