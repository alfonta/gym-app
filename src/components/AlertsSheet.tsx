import { useState } from 'react';
import { Sheet } from './Sheet';
import { beep, primeAudio } from '../hooks';
import { notifyStatus, requestNotify, type NotifyStatus } from '../notify';
import { useStore } from '../store';
import { usualMinutes } from '../engine/overdue';

const STATUS: Record<NotifyStatus, string> = {
  granted: 'התראות מערכת מופעלות.',
  default: 'התראות מערכת עוד לא הופעלו.',
  denied: 'התראות מערכת חסומות. אפשר לשנות בהגדרות הטלפון, תחת התראות.',
  unsupported: 'הדפדפן הזה לא תומך בהתראות מערכת. באייפון זה עובד רק כשהאפליקציה מותקנת במסך הבית.',
};

export function AlertsSheet({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<NotifyStatus>(notifyStatus());
  const workouts = useStore((s) => s.workouts);
  return (
    <Sheet title="התראות וצלילים" onClose={onClose}>
      <h3>סוף המנוחה</h3>
      <p className="muted">בסוף כל מנוחה יש צפצוף והבזק ירוק על המסך, גם כשהאימון ממוזער.</p>
      <button className="btn ghost block" onClick={() => { primeAudio(); setTimeout(beep, 50); }}>בדיקת צליל</button>

      <h3>התראות מערכת</h3>
      <p className={status === 'granted' ? 'muted' : 'warn'} role="status">{STATUS[status]}</p>
      {status === 'default' && (
        <button className="btn primary block" onClick={async () => setStatus(await requestNotify())}>אפשר התראות</button>
      )}
      <div className="note-box">
        <strong>חשוב לדעת על אייפון</strong>
        <p>אפליקציית רשת באייפון לא יכולה להתריע כשהיא ברקע או כשהמסך נעול. זו מגבלה של iOS, ועקיפה שלה דורשת שרת, ואין לאפליקציה הזו שרת. לכן:</p>
        <ul>
          <li>בזמן אימון המסך נשאר דולק, והצפצוף וההבזק עובדים כל עוד האפליקציה פתוחה.</li>
          <li>כשהטלפון על שקט אין צליל, רק ההבזק.</li>
          <li>אם יצאת מהאפליקציה, כשתחזור תראה מיד שהמנוחה נגמרה.</li>
        </ul>
        <p>באנדרואיד ובמחשב מגיעה גם התראת מערכת כשהאפליקציה ברקע.</p>
      </div>

      <h3>אימון שנשאר פתוח</h3>
      <p className="muted">
        אם לא סומן סט 45 דקות, או שהאימון ארוך בהרבה מהרגיל אצלך (כ-{usualMinutes(workouts)} דקות), האפליקציה שואלת אם לסגור אותו.
        המשך נשמר עד הסט האחרון, כך שהזמן שהאימון נשאר פתוח לא נכנס לסטטיסטיקה.
      </p>
    </Sheet>
  );
}
