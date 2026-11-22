import { useEffect, useRef, useState } from 'react';
import { beep, useNow } from '../hooks';
import { notifyIfHidden } from '../notify';
import { useCatalog, useStore } from '../store';
import { overdueState, usualMinutes } from '../engine/overdue';

/**
 * Lives at app level while a workout is in progress, so alerts also work when
 * the workout screen is minimised: end of rest (sound, on-screen flash, and a
 * system notification when the app is in the background and still running),
 * plus a notification if the workout looks left open.
 */
export function WorkoutAlerts() {
  const active = useStore((s) => s.active)!;
  const workouts = useStore((s) => s.workouts);
  const cat = useCatalog();
  const rest = active.rest;
  const [flash, setFlash] = useState(false);
  const fired = useRef<number | null>(null);
  const now = useNow(30000);
  const item = active.items[active.current_index];
  const nextSet = item ? cat.get(item.exercise_id).name : '';

  // A precise timeout for the end of the rest; the on-screen countdown can be throttled in the background.
  useEffect(() => {
    if (!rest) return;
    const fire = () => {
      if (fired.current === rest.ends_at) return;
      fired.current = rest.ends_at;
      // Skip everything if the rest ended long ago (the app was reopened later).
      if (Date.now() - rest.ends_at > 3000) return;
      beep();
      void notifyIfHidden('rest', String(rest.ends_at), 'המנוחה נגמרה', nextSet ? `הסט הבא: ${nextSet}` : 'קדימה לסט הבא');
      if (document.visibilityState === 'visible') {
        setFlash(true);
        setTimeout(() => setFlash(false), 2500);
      }
    };
    const ms = rest.ends_at - Date.now();
    if (ms <= 0) {
      fire();
      return;
    }
    const id = setTimeout(fire, ms);
    return () => clearTimeout(id);
  }, [rest?.ends_at]); // eslint-disable-line react-hooks/exhaustive-deps

  // Left open: notify once per workout while the app sits in the background.
  useEffect(() => {
    if (overdueState(active, usualMinutes(workouts), now).forgotten) {
      void notifyIfHidden('overdue', active.id, 'האימון עדיין פתוח', 'נראה ששכחת לסגור את האימון. פתח את האפליקציה כדי לסיים אותו.');
    }
  }, [now, active, workouts]);

  if (!flash) return null;
  return (
    <div className="rest-flash" role="alert" onClick={() => setFlash(false)}>
      <strong>המנוחה נגמרה</strong>
      {nextSet && <span>{nextSet}</span>}
    </div>
  );
}
