import { useMemo, useRef, useState } from 'react';
import { BarChart, WeightChart } from '../components/Charts';
import { Sheet } from '../components/Sheet';
import { EQUIPMENT } from '../data/equipment';
import { EXERCISES, EXERCISE_MAP } from '../data/exercises';
import { ANCHOR_EXERCISE_IDS } from '../data/programs';
import { isExerciseAvailable } from '../engine/alternatives';
import { best1RM, gainStatus, weeklyRate, weeklyVolume, weightTrend, ymd } from '../engine/calc';
import { usePhoto } from '../hooks';
import { exportBackup, importBackup, savePhoto, useStore } from '../store';
import type { BodyMeasurement } from '../types';
import { ProfileForm } from './ProfileForm';

const TIMED = new Set(EXERCISES.filter((e) => e.tracking === 'time').map((e) => e.id));
const shortDate = (d: string) => `${Number(d.slice(8, 10))}/${Number(d.slice(5, 7))}`;
const numOrNull = (v: string) => (v.trim() === '' || !(Number(v.replace(',', '.')) > 0) ? null : Number(v.replace(',', '.')));

/** Downscale before storing so photos do not blow up local storage. */
function readImage(file: File, maxSide = 1100): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('לא ניתן לקרוא את התמונה')); };
    img.src = url;
  });
}

function Photo({ id, label }: { id: string | null; label: string }) {
  const src = usePhoto(id);
  return (
    <figure className="photo">
      {src ? <img src={src} alt={label} /> : <div className="photo-empty">אין תמונה</div>}
      <figcaption>{label}</figcaption>
    </figure>
  );
}

function PhotoCompare({ measurements }: { measurements: BodyMeasurement[] }) {
  const [side, setSide] = useState<'front' | 'back'>('front');
  const key = side === 'front' ? 'photo_front_url' : 'photo_back_url';
  const withPhoto = measurements.filter((m) => m[key]);
  if (withPhoto.length === 0) return <p className="muted">עדיין אין תמונות. הוסף מדידה עם תמונה כדי להשוות לפני ואחרי.</p>;
  const first = withPhoto[0];
  const latest = withPhoto[withPhoto.length - 1];
  return (
    <>
      <div className="chips">
        <button className={`chip ${side === 'front' ? 'on' : ''}`} onClick={() => setSide('front')}>פרונט</button>
        <button className={`chip ${side === 'back' ? 'on' : ''}`} onClick={() => setSide('back')}>גב</button>
      </div>
      <div className="compare">
        <Photo id={first[key]} label={`לפני · ${shortDate(first.date)}`} />
        <Photo id={latest[key]} label={withPhoto.length > 1 ? `אחרי · ${shortDate(latest.date)}` : 'אחרי · בקרוב'} />
      </div>
    </>
  );
}

function MeasurementSheet({ onClose }: { onClose: () => void }) {
  const saveMeasurement = useStore((s) => s.saveMeasurement);
  const [arms, setArms] = useState('');
  const [chest, setChest] = useState('');
  const [thighs, setThighs] = useState('');
  const [front, setFront] = useState<string | null>(null);
  const [back, setBack] = useState<string | null>(null);
  const [error, setError] = useState('');

  const pick = (setter: (v: string) => void) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try { setter(await readImage(f)); } catch (err) { setError((err as Error).message); }
  };

  const save = async () => {
    const m = { arms_cm: numOrNull(arms), chest_cm: numOrNull(chest), thighs_cm: numOrNull(thighs) };
    if (!m.arms_cm && !m.chest_cm && !m.thighs_cm && !front && !back) {
      setError('הזן לפחות היקף אחד או תמונה.');
      return;
    }
    saveMeasurement({
      date: ymd(new Date()), ...m,
      photo_front_url: front ? await savePhoto(front) : null,
      photo_back_url: back ? await savePhoto(back) : null,
    });
    onClose();
  };

  return (
    <Sheet title="מדידה חדשה" onClose={onClose}>
      <div className="grid3">
        <label className="field"><span>חזה (ס"מ)</span><input inputMode="decimal" value={chest} onChange={(e) => setChest(e.target.value)} /></label>
        <label className="field"><span>זרועות</span><input inputMode="decimal" value={arms} onChange={(e) => setArms(e.target.value)} /></label>
        <label className="field"><span>ירכיים</span><input inputMode="decimal" value={thighs} onChange={(e) => setThighs(e.target.value)} /></label>
      </div>
      <div className="grid2">
        <label className="file-btn">{front ? '✓ תמונת פרונט' : '📷 תמונת פרונט'}<input type="file" accept="image/*" onChange={pick(setFront)} /></label>
        <label className="file-btn">{back ? '✓ תמונת גב' : '📷 תמונת גב'}<input type="file" accept="image/*" onChange={pick(setBack)} /></label>
      </div>
      {error && <p className="warn">{error}</p>}
      <button className="btn primary block" onClick={save}>שמור מדידה</button>
    </Sheet>
  );
}

function EquipmentSheet({ onClose }: { onClose: () => void }) {
  const equipment = useStore((s) => s.equipment);
  const setEquipment = useStore((s) => s.setEquipment);
  const availableCount = EXERCISES.filter((e) => isExerciseAvailable(e, equipment)).length;
  return (
    <Sheet title="הציוד שלי" onClose={onClose}>
      <p className="muted">תרגילים ייבחרו רק אם כל הציוד שלהם מסומן כזמין. כרגע זמינים {availableCount} מתוך {EXERCISES.length} תרגילים.</p>
      {EQUIPMENT.map((e) => (
        <label key={e.id} className="toggle">
          <span>{e.name}</span>
          <input type="checkbox" checked={equipment[e.id] !== false} onChange={(ev) => setEquipment(e.id, ev.target.checked)} />
        </label>
      ))}
    </Sheet>
  );
}

function BackupSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');

  const doExport = async () => {
    const blob = new Blob([await exportBackup()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gym-backup-${ymd(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg('קובץ הגיבוי נוצר.');
  };

  const doImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!confirm('הייבוא יחליף את כל הנתונים הקיימים במכשיר. להמשיך?')) return;
    try {
      await importBackup(await f.text());
      setMsg('הנתונים שוחזרו.');
    } catch (err) {
      setMsg(`הייבוא נכשל: ${(err as Error).message}`);
    }
  };

  return (
    <section className="card">
      <h2>גיבוי</h2>
      <p className="muted">הנתונים נשמרים רק על המכשיר הזה. כדאי לייצא גיבוי מדי פעם.</p>
      <div className="grid2">
        <button className="btn ghost" onClick={doExport}>ייצוא לקובץ</button>
        <button className="btn ghost" onClick={() => fileRef.current?.click()}>ייבוא מקובץ</button>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={doImport} />
      {msg && <p className="muted" role="status">{msg}</p>}
    </section>
  );
}

export function Profile() {
  const profile = useStore((s) => s.profile)!;
  const bodyweight = useStore((s) => s.bodyweight);
  const measurements = useStore((s) => s.measurements);
  const workouts = useStore((s) => s.workouts);
  const sets = useStore((s) => s.sets);
  const logBodyweight = useStore((s) => s.logBodyweight);
  const deleteMeasurement = useStore((s) => s.deleteMeasurement);

  const [weightInput, setWeightInput] = useState('');
  const [sheet, setSheet] = useState<'measure' | 'equipment' | 'edit' | null>(null);

  const trend = useMemo(() => weightTrend(bodyweight).slice(-60), [bodyweight]);
  const volume = useMemo(() => weeklyVolume(workouts, sets, TIMED), [workouts, sets]);
  const prs = useMemo(
    () => ANCHOR_EXERCISE_IDS
      .map((id) => ({ ex: EXERCISE_MAP[id], best: best1RM(sets.filter((s) => s.exercise_id === id)) }))
      .filter((x) => x.best > 0),
    [sets],
  );
  const todayLogged = bodyweight.find((b) => b.date === ymd(new Date()));
  const latestTrend = trend[trend.length - 1]?.trend ?? profile.current_weight;
  const goal = profile.goal_weight;
  const toGoal = goal === null ? null : Math.round((goal - latestTrend) * 10) / 10;
  const rate = useMemo(() => weeklyRate(weightTrend(bodyweight)), [bodyweight]);
  const gaining = goal === null || goal >= latestTrend;
  const signed = (v: number) => (v > 0 ? `+${v}` : String(v));
  const coachNote = (() => {
    if (!rate) return 'שקול את עצמך בבוקר, לפחות 3 פעמים בשבוע. אחרי שבוע וחצי של שקילות יופיע כאן קצב השינוי השבועי.';
    if (!gaining) return 'בודקים את המגמה אחת לשבועיים, לא את השקילה הבודדת.';
    const status = gainStatus(rate.pct_per_week);
    if (status === 'slow') return 'המשקל כמעט לא עולה. הוסף כ-150 קלוריות ליום ובדוק שוב בעוד שבועיים.';
    if (status === 'fast') return 'העלייה מהירה מדי, וחלק גדול ממנה יהיה שומן. הורד כ-150 קלוריות ליום.';
    return 'קצב טוב לעלייה נקייה. ממשיכים כך ובודקים שוב בעוד שבועיים.';
  })();

  const submitWeight = () => {
    const w = numOrNull(weightInput);
    if (!w) return;
    logBodyweight(w);
    setWeightInput('');
  };

  return (
    <>
      <header className="page-head"><h1>פרופיל והתקדמות</h1></header>

      <section className="card">
        <h2>משקל גוף</h2>
        <div className="quick-weight">
          <input inputMode="decimal" value={weightInput} placeholder={todayLogged ? `היום: ${todayLogged.weight_kg}` : 'משקל בוקר'} onChange={(e) => setWeightInput(e.target.value)} aria-label="משקל בוקר" />
          <button className="btn primary" onClick={submitWeight}>{todayLogged ? 'עדכן' : 'שמור'}</button>
        </div>
        <WeightChart points={trend.map((t) => ({ label: shortDate(t.date), value: t.weight, trend: t.trend }))} goal={goal} />
        <div className="stats">
          <div><strong>{latestTrend}</strong><span>מגמה (ממוצע 7 ימים)</span></div>
          <div><strong dir="ltr">{rate ? signed(rate.kg_per_week) : '—'}</strong><span>ק"ג בשבוע</span></div>
          {toGoal !== null && <div><strong dir="ltr">{signed(toGoal)}</strong><span>נותר ליעד {goal}</span></div>}
        </div>
        <p className="muted small">{coachNote}</p>
      </section>

      <section className="card">
        <h2>נפח אימון שבועי</h2>
        <BarChart bars={volume.map((v) => ({ label: shortDate(v.week), value: v.volume }))} />
        <p className="muted small">נפח = סטים × חזרות × משקל, בק"ג.</p>
      </section>

      <section className="card">
        <h2>🏆 ארון גביעים</h2>
        {prs.length === 0 && <p className="muted">שיאי 1RM משוערים בתרגילי העוגן יופיעו כאן אחרי האימון הראשון.</p>}
        <div className="trophies">
          {prs.map(({ ex, best }) => (
            <div key={ex.id} className="trophy"><strong>{Math.round(best * 10) / 10}</strong><span>{ex.name}</span></div>
          ))}
        </div>
        {prs.length > 0 && <p className="muted small">1RM משוער בק"ג לפי נוסחת Epley.</p>}
      </section>

      <section className="card">
        <div className="card-head"><h2>היקפים ותמונות</h2><button className="btn sm" onClick={() => setSheet('measure')}>+ מדידה</button></div>
        <PhotoCompare measurements={measurements} />
        {measurements.length > 0 && (
          <table className="mtable">
            <thead><tr><th>תאריך</th><th>חזה</th><th>זרועות</th><th>ירכיים</th><th /></tr></thead>
            <tbody>
              {[...measurements].reverse().map((m) => (
                <tr key={m.id}>
                  <td>{shortDate(m.date)}</td><td>{m.chest_cm ?? '—'}</td><td>{m.arms_cm ?? '—'}</td><td>{m.thighs_cm ?? '—'}</td>
                  <td><button className="link danger-text" onClick={() => { if (confirm('למחוק את המדידה?')) deleteMeasurement(m.id); }} aria-label="מחק מדידה">✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2>תזונה ובסיס</h2>
        <div className="stats">
          <div><strong>{profile.daily_calories_goal.toLocaleString()}</strong><span>קלוריות ביום</span></div>
          <div><strong>{profile.daily_protein_goal}</strong><span>גרם חלבון ביום</span></div>
        </div>
        <button className="row-btn" onClick={() => setSheet('equipment')}><span>ניהול מלאי הציוד בחדר הכושר</span><span>←</span></button>
        <button className="row-btn" onClick={() => setSheet('edit')}><span>עריכת פרופיל, תוכנית ופלטות</span><span>←</span></button>
      </section>

      <BackupSection />

      {sheet === 'measure' && <MeasurementSheet onClose={() => setSheet(null)} />}
      {sheet === 'equipment' && <EquipmentSheet onClose={() => setSheet(null)} />}
      {sheet === 'edit' && (
        <Sheet title="עריכת פרופיל" onClose={() => setSheet(null)}>
          <ProfileForm submitLabel="שמור" onSaved={() => setSheet(null)} />
        </Sheet>
      )}
    </>
  );
}
