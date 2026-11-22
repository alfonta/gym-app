import { useMemo, useState } from 'react';
import { Sheet } from '../components/Sheet';
import { PROGRAM_LABEL, TEMPLATES, TEMPLATE_MAP, initialRotation, scheduleOf, weekPointer } from '../data/programs';
import { estimateMinutes, formatClock, weekStart, ymd } from '../engine/calc';
import { primeAudio, useNow } from '../hooks';
import { backupAgeDays, planSplit, useStore } from '../store';
import type { SplitType } from '../types';
import { downloadBackup } from './Profile';
import { CustomWorkoutSheet } from './Library';
import { INJURY_LABEL, activeInjuries } from '../engine/injury';

const BACKUP_EVERY_DAYS = 14;

export function Home({ onOpenWorkout }: { onOpenWorkout: () => void }) {
  const profile = useStore((s) => s.profile)!;
  const workouts = useStore((s) => s.workouts);
  const equipment = useStore((s) => s.equipment);
  const active = useStore((s) => s.active);
  const startWorkout = useStore((s) => s.startWorkout);
  const bodyweight = useStore((s) => s.bodyweight);
  const logBodyweight = useStore((s) => s.logBodyweight);
  const swapPrefs = useStore((s) => s.swap_prefs);
  const overrides = useStore((s) => s.template_overrides);
  const lastBackup = useStore((s) => s.last_backup_at);
  const snoozeUntil = useStore((s) => s.backup_snooze_until);
  const snoozeBackup = useStore((s) => s.snoozeBackup);
  const customExercises = useStore((s) => s.custom_exercises);
  const rotationIndex = useStore((s) => s.rotation_index);
  const [weightInput, setWeightInput] = useState('');
  const now = useNow(1000);
  const [showAll, setShowAll] = useState(false);
  const [previewId, setPreviewId] = useState<SplitType | null>(null);
  const [building, setBuilding] = useState(false);
  const injured = activeInjuries(profile.injuries);

  const last = useMemo(() => [...workouts].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null, [workouts]);
  const schedule = scheduleOf(profile);
  const weekWorkouts = workouts.filter((w) => weekStart(new Date(w.date)) === weekStart(new Date())).sort((a, b) => a.date.localeCompare(b.date));
  const thisWeek = weekWorkouts.length;
  // Default: every week starts again from day 1. Otherwise the order carries on across weeks.
  const pointer = profile.weekly_reset !== false
    ? weekPointer(schedule, weekWorkouts.map((w) => w.split_type))
    : rotationIndex ?? initialRotation(schedule, last?.split_type ?? null);
  const next = TEMPLATE_MAP[schedule[pointer % schedule.length]];

  const start = (id: SplitType) => {
    primeAudio();
    setPreviewId(null);
    startWorkout(id);
    onOpenWorkout();
  };

  const plan = (id: SplitType) => {
    const rows = planSplit(id, { template_overrides: overrides, custom_exercises: customExercises, equipment, swap_prefs: swapPrefs, workouts, profile });
    return {
      rows,
      minutes: estimateMinutes(rows.map(({ slot, ex }) => ({ sets: slot.sets, rest_seconds: ex.rest_time_seconds, is_core: ex.is_core }))),
    };
  };

  const PlanList = ({ id }: { id: SplitType }) => (
    <ul className="plan">
      {plan(id).rows.map(({ slot, ex, chosen, equipment_swap, injury }) => (
        <li key={ex.id} className={slot.role}>
          <span>
            {ex.name}
            {injury === 'replaced' ? <em> (הותאם לפציעה)</em> : injury === 'reduced' ? <em> (מופחת)</em>
              : chosen ? <em> (הבחירה שלך)</em> : equipment_swap ? <em> (חלופה לפי הציוד)</em> : null}
          </span>
          <small>{slot.sets}×{slot.rep_min}–{slot.rep_max}{ex.tracking === 'time' ? ' שנ׳' : ''}</small>
        </li>
      ))}
    </ul>
  );

  const weighedToday = bodyweight.some((b) => b.date === ymd(new Date()));
  const hoursSinceLast = last ? (now - new Date(last.date).getTime()) / 3600000 : null;
  const backupAge = backupAgeDays({ last_backup_at: lastBackup, workouts }, now);
  const snoozed = !!snoozeUntil && new Date(snoozeUntil).getTime() > now;
  const backupDue = backupAge !== null && backupAge >= BACKUP_EVERY_DAYS && !snoozed;

  const saveWeight = () => {
    const w = Number(weightInput.replace(',', '.'));
    if (!(w > 0)) return;
    logBodyweight(w);
    setWeightInput('');
  };

  const others = [...TEMPLATES, ...(overrides.custom ? [TEMPLATE_MAP.custom] : [])].filter((t) => t.id !== next.id);

  return (
    <>
      <header className="page-head">
        <h1>האימון של היום</h1>
        <span className="muted">{PROGRAM_LABEL[profile.program]} · השבוע: {thisWeek} מתוך {schedule.length} אימונים</span>
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
          <div className="tag">
            {thisWeek < schedule.length
              ? `הבא בתור · אימון ${thisWeek + 1} מתוך ${schedule.length} השבוע`
              : `השלמת את ${schedule.length} האימונים של השבוע 💪 · אימון נוסף`}
          </div>
          <h2>{next.name}</h2>
          <p className="muted">{next.subtitle} · כ-{plan(next.id).minutes} דקות</p>
          <PlanList id={next.id} />
          {hoursSinceLast !== null && hoursSinceLast < 20 && (
            <p className="warn">התאמנת לפני פחות מיממה. לשריר נדרשת מנוחה כדי לגדול, עדיף יום הפסקה בין אימונים.</p>
          )}
          <button className="btn primary block big" onClick={() => start(next.id)}>התחל אימון</button>
        </section>
      )}

      {injured.length > 0 && (
        <p className="injury-banner" role="status">
          מצב פציעה פעיל: {injured.map(([a, l]) => `${INJURY_LABEL[a]} (${l === 'avoid' ? 'להימנע' : 'להפחית'})`).join(', ')}. האימונים הותאמו. לשינוי: פרופיל, מצב פציעה.
        </p>
      )}

      {backupDue && (
        <section className="card backup-due">
          <h2>הגיע הזמן לגבות</h2>
          <p className="muted">
            {lastBackup ? `עברו ${backupAge} ימים מהגיבוי האחרון.` : 'עדיין לא גיבית את הנתונים.'}
            {' '}הכול נשמר רק על המכשיר הזה. מחיקת האפליקציה או החלפת טלפון מוחקות את ההיסטוריה.
          </p>
          <div className="grid2">
            <button className="btn primary" onClick={() => void downloadBackup()}>גבה עכשיו</button>
            <button className="btn ghost" onClick={() => snoozeBackup(7)}>הזכר לי בעוד שבוע</button>
          </div>
        </section>
      )}

      {!weighedToday && (
        <section className="card">
          <h2>שקילת בוקר</h2>
          <div className="quick-weight">
            <input inputMode="decimal" value={weightInput} placeholder={`${profile.current_weight} ק"ג`} onChange={(e) => setWeightInput(e.target.value)} aria-label="משקל היום" />
            <button className="btn primary" onClick={saveWeight}>שמור</button>
          </div>
          <p className="muted small">אחרי השירותים ולפני אוכל. מספיק 3 פעמים בשבוע, והמגמה מופיעה בפרופיל.</p>
        </section>
      )}

      {!active && (
        <section className="card">
          <button className="row-btn" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
            <span>בחר אימון אחר (או יום רביעי בשבוע)</span><span>{showAll ? '▴' : '▾'}</span>
          </button>
          {showAll && (
            <button className="row-btn sub" onClick={() => setBuilding(true)}>
              <span><strong>+ אימון מותאם אישית</strong><small>בחר שרירים או תרגילים, והאימון ייבנה אוטומטית</small></span><span>←</span>
            </button>
          )}
          {showAll && others.map((t) => (
            <button key={t.id} className="row-btn sub" onClick={() => setPreviewId(t.id)}>
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

      {building && <CustomWorkoutSheet onClose={() => setBuilding(false)} onStart={() => { primeAudio(); setBuilding(false); onOpenWorkout(); }} />}

      {previewId && (
        <Sheet title={TEMPLATE_MAP[previewId].name} onClose={() => setPreviewId(null)}>
          <p className="muted">{TEMPLATE_MAP[previewId].subtitle} · כ-{plan(previewId).minutes} דקות</p>
          <PlanList id={previewId} />
          <button className="btn primary block big" onClick={() => start(previewId)}>התחל את האימון הזה</button>
        </Sheet>
      )}
    </>
  );
}
