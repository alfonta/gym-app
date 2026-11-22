import { useEffect, useState } from 'react';
import { TEMPLATE_MAP } from './data/programs';
import { useHydrated } from './hooks';
import { useCatalog, useStore, type WorkoutSummary } from './store';
import { workoutText } from './engine/calc';
import { shareText } from './screens/History';
import { ActiveWorkoutScreen, fireConfetti } from './screens/ActiveWorkout';
import { Home } from './screens/Home';
import { History } from './screens/History';
import { Profile } from './screens/Profile';
import { ProfileForm } from './screens/ProfileForm';
import { Sheet } from './components/Sheet';
import { WorkoutAlerts } from './components/WorkoutAlerts';
import { cardioLine } from './components/CardioForm';

type Tab = 'home' | 'history' | 'profile';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'אימון', icon: '🏋️' },
  { id: 'history', label: 'היסטוריה', icon: '📅' },
  { id: 'profile', label: 'פרופיל', icon: '📈' },
];

export default function App() {
  const hydrated = useHydrated();
  const profile = useStore((s) => s.profile);
  const active = useStore((s) => s.active);
  const [tab, setTab] = useState<Tab>('home');
  const [inWorkout, setInWorkout] = useState(true);
  const [summary, setSummary] = useState<WorkoutSummary | null>(null);
  const [shareMsg, setShareMsg] = useState('');
  const cat = useCatalog();

  useEffect(() => {
    if (summary && summary.prs.length > 0) fireConfetti();
  }, [summary]);

  if (!hydrated) return <div className="splash">טוען…</div>;

  if (!profile) {
    return (
      <div className="page onboarding">
        <h1>ברוך הבא 💪</h1>
        <p className="muted">כמה פרטים כדי להתאים את התוכנית ואת יעדי התזונה. הכול נשמר רק על המכשיר הזה.</p>
        <p className="muted small">ההמלצות באפליקציה הן הנחיות כלליות ולא ייעוץ רפואי או אישי. אם יש לך מצב רפואי או כאב, התייעץ עם איש מקצוע לפני שמתחילים.</p>
        <ProfileForm submitLabel="מתחילים" />
      </div>
    );
  }

  if (active && inWorkout) {
    return (
      <>
      <WorkoutAlerts />
      <ActiveWorkoutScreen
        onMinimize={() => setInWorkout(false)}
        onFinished={(s) => { setSummary(s); setTab('home'); }}
      />
      </>
    );
  }

  return (
    <div className="shell">
      {active && <WorkoutAlerts />}
      <div className="page">
        {tab === 'home' && <Home onOpenWorkout={() => setInWorkout(true)} />}
        {tab === 'history' && <History />}
        {tab === 'profile' && <Profile />}
      </div>
      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)} aria-current={tab === t.id}>
            <span aria-hidden>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {summary && (
        <Sheet title="סיכום האימון" onClose={() => setSummary(null)}>
          <div className={`verdict ${summary.feedback.verdict}`}>
            <strong>{summary.feedback.headline}</strong>
            <span>האימון נשמר</span>
          </div>
          <div className="stats">
            <div><strong>{summary.workout.total_duration_minutes}</strong><span>דקות</span></div>
            <div><strong>{summary.sets}</strong><span>סטים</span></div>
            <div><strong>{summary.volume.toLocaleString()}</strong><span>ק"ג נפח</span></div>
          </div>
          <p className="muted">{TEMPLATE_MAP[summary.workout.split_type].name}</p>
          {summary.cardio.map((c) => <p key={c.id} className="muted">🏃 אירובי: {cardioLine(c)}</p>)}
          {summary.feedback.notes.map((n) => <p key={n} className="fb-note">{n}</p>)}
          {summary.feedback.exercises.length > 0 && (
            <div className="fb-list">
              <h3>לפעם הבאה</h3>
              {summary.feedback.exercises.map((e) => (
                <div key={e.exercise_id} className={`fb-row ${e.next}`}>
                  <span className="fb-arrow" aria-hidden>{e.next === 'increase' ? '↑' : e.next === 'decrease' ? '↓' : '＝'}</span>
                  <span>
                    <strong>{e.name}</strong>
                    <small>
                      {e.trend === 'up' ? 'השתפר מהפעם הקודמת. ' : e.trend === 'down' ? 'ירד מהפעם הקודמת. ' : e.trend === 'same' ? 'דומה לפעם הקודמת. ' : ''}
                      {e.message}
                    </small>
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="muted small">המשוב מחושב לפי המספרים שרשמת מול הפעם הקודמת. הוא לא יודע כמה ישנת או אכלת, אז קח אותו כהכוונה ולא כפסיקה.</p>
          {summary.prs.length > 0 && (
            <div className="pr-list">
              <h3>🏆 שיאים חדשים</h3>
              {summary.prs.map((p, i) => (
                <div key={i}>{cat.get(p.exercise_id).name}: {p.weight_kg} ק"ג × {p.reps}</div>
              ))}
            </div>
          )}
          <button className="btn ghost block" onClick={async () => {
            const st = useStore.getState();
            const text = workoutText(`אימון ${TEMPLATE_MAP[summary.workout.split_type].name}`, summary.workout, st.sets.filter((x) => x.workout_id === summary.workout.id), cat.get,
              [...summary.cardio.map((c) => `אירובי: ${cardioLine(c)}`), `משוב: ${summary.feedback.headline}`]);
            const r = await shareText(text);
            setShareMsg(r === 'copied' ? 'הסיכום הועתק.' : r === 'failed' ? 'השיתוף נכשל.' : '');
          }}>שתף סיכום</button>
          {shareMsg && <p className="muted center" role="status">{shareMsg}</p>}
          <button className="btn primary block" onClick={() => { setSummary(null); setShareMsg(''); }}>סגור</button>
        </Sheet>
      )}
    </div>
  );
}
