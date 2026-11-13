import { useEffect, useState } from 'react';
import { EXERCISE_MAP } from './data/exercises';
import { TEMPLATE_MAP } from './data/programs';
import { useHydrated } from './hooks';
import { useStore, type WorkoutSummary } from './store';
import { ActiveWorkoutScreen, fireConfetti } from './screens/ActiveWorkout';
import { Home } from './screens/Home';
import { History } from './screens/History';
import { Profile } from './screens/Profile';
import { ProfileForm } from './screens/ProfileForm';
import { Sheet } from './components/Sheet';

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

  useEffect(() => {
    if (summary && summary.prs.length > 0) fireConfetti();
  }, [summary]);

  if (!hydrated) return <div className="splash">טוען…</div>;

  if (!profile) {
    return (
      <div className="page onboarding">
        <h1>ברוך הבא 💪</h1>
        <p className="muted">כמה פרטים כדי להתאים את התוכנית ואת יעדי התזונה. הכול נשמר רק על המכשיר הזה.</p>
        <ProfileForm submitLabel="מתחילים" />
      </div>
    );
  }

  if (active && inWorkout) {
    return (
      <ActiveWorkoutScreen
        onMinimize={() => setInWorkout(false)}
        onFinished={(s) => { setSummary(s); setTab('home'); }}
      />
    );
  }

  return (
    <div className="shell">
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
        <Sheet title="האימון נשמר 🎉" onClose={() => setSummary(null)}>
          <div className="stats">
            <div><strong>{summary.workout.total_duration_minutes}</strong><span>דקות</span></div>
            <div><strong>{summary.sets}</strong><span>סטים</span></div>
            <div><strong>{summary.volume.toLocaleString()}</strong><span>ק"ג נפח</span></div>
          </div>
          <p className="muted">{TEMPLATE_MAP[summary.workout.split_type].name}</p>
          {summary.prs.length > 0 && (
            <div className="pr-list">
              <h3>🏆 שיאים חדשים</h3>
              {summary.prs.map((p, i) => (
                <div key={i}>{EXERCISE_MAP[p.exercise_id]?.name}: {p.weight_kg} ק"ג × {p.reps}</div>
              ))}
            </div>
          )}
          <button className="btn primary block" onClick={() => setSummary(null)}>סגור</button>
        </Sheet>
      )}
    </div>
  );
}
