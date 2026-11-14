import { useMemo, useState } from 'react';
import { Sheet } from '../components/Sheet';
import { EQUIPMENT } from '../data/equipment';
import { MUSCLE_LABEL } from '../data/exercises';
import { TEMPLATES, TEMPLATE_MAP } from '../data/programs';
import { isExerciseAvailable } from '../engine/alternatives';
import { DEFAULT_PATTERN, defaultSlot, getTemplate } from '../engine/catalog';
import { useCatalog, useStore } from '../store';
import type { Exercise, MuscleGroup, SplitType, TemplateSlot, Tracking } from '../types';

const MUSCLES = Object.keys(MUSCLE_LABEL) as MuscleGroup[];

/** Choose any available exercise, filtered by muscle and free text. */
export function ExercisePicker({ title, excludeIds = [], muscle, onPick, onClose }: {
  title: string; excludeIds?: string[]; muscle?: MuscleGroup; onPick: (ex: Exercise) => void; onClose: () => void;
}) {
  const cat = useCatalog();
  const equipment = useStore((s) => s.equipment);
  const [filter, setFilter] = useState<MuscleGroup | null>(muscle ?? null);
  const [q, setQ] = useState('');
  const list = useMemo(
    () => cat.all
      .filter((e) => !excludeIds.includes(e.id) && isExerciseAvailable(e, equipment))
      .filter((e) => !filter || e.muscle_group === filter)
      .filter((e) => q.trim() === '' || e.name.includes(q.trim()))
      .sort((a, b) => Number(!!b.is_custom) - Number(!!a.is_custom)),
    [cat, equipment, excludeIds, filter, q],
  );
  return (
    <Sheet title={title} onClose={onClose}>
      <label className="field"><input value={q} placeholder="חיפוש לפי שם" onChange={(e) => setQ(e.target.value)} aria-label="חיפוש תרגיל" /></label>
      <div className="chips scroll-x">
        <button className={`chip ${filter === null ? 'on' : ''}`} onClick={() => setFilter(null)}>הכול</button>
        {MUSCLES.map((m) => <button key={m} className={`chip ${filter === m ? 'on' : ''}`} onClick={() => setFilter(m)}>{MUSCLE_LABEL[m]}</button>)}
      </div>
      {list.length === 0 && <p className="muted">לא נמצאו תרגילים זמינים.</p>}
      {list.map((e) => (
        <button key={e.id} className="alt compact" onClick={() => onPick(e)}>
          <span>
            <strong>{e.name}</strong>
            <small>{MUSCLE_LABEL[e.muscle_group]}{e.is_custom ? ' · תרגיל שלי' : ''}</small>
          </span>
        </button>
      ))}
    </Sheet>
  );
}

const KINDS = [
  { id: 'compound', label: 'מורכב' },
  { id: 'isolation', label: 'בידוד' },
] as const;
const TRACKINGS: { id: Tracking; label: string }[] = [
  { id: 'weight_reps', label: 'משקל וחזרות' },
  { id: 'bodyweight_reps', label: 'משקל גוף' },
  { id: 'time', label: 'זמן' },
];

function CustomExerciseForm({ onDone }: { onDone: () => void }) {
  const saveCustomExercise = useStore((s) => s.saveCustomExercise);
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup>('chest');
  const [kind, setKind] = useState<'compound' | 'isolation'>('isolation');
  const [tracking, setTracking] = useState<Tracking>('weight_reps');
  const [equip, setEquip] = useState<string[]>([]);
  const [increment, setIncrement] = useState('2.5');
  const [how, setHow] = useState('');
  const [video, setVideo] = useState('');
  const [error, setError] = useState('');

  const save = () => {
    if (name.trim().length < 2) return setError('יש לתת שם לתרגיל.');
    const url = video.trim();
    if (url && !/^https:\/\/\S+$/.test(url)) return setError('קישור הסרטון צריך להתחיל ב-https://');
    const isCore = muscle === 'core';
    const compound = !isCore && kind === 'compound';
    const inc = Number(increment.replace(',', '.'));
    saveCustomExercise({
      id: `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(), muscle_group: muscle, pattern: DEFAULT_PATTERN[muscle], equipment_ids: equip,
      instructions_tips: how.split('\n').map((l) => l.trim()).filter(Boolean),
      safety_tip: '', media_urls: [], rest_time_seconds: isCore ? 30 : compound ? 150 : 75,
      is_core: isCore, is_compound: compound, is_bodyweight: tracking !== 'weight_reps', tracking,
      increment_kg: inc > 0 ? inc : 2.5, uses_barbell: equip.includes('barbell') && compound,
      video_url: url || null, is_custom: true,
    });
    onDone();
  };

  return (
    <div className="form">
      <label className="field"><span>שם התרגיל</span><input value={name} onChange={(e) => setName(e.target.value)} aria-label="שם התרגיל" /></label>
      <div className="field"><span>שריר עיקרי</span>
        <div className="chips">{MUSCLES.map((m) => <button key={m} className={`chip ${muscle === m ? 'on' : ''}`} onClick={() => setMuscle(m)}>{MUSCLE_LABEL[m]}</button>)}</div>
      </div>
      {muscle !== 'core' && (
        <div className="field"><span>סוג</span>
          <div className="chips">{KINDS.map((k) => <button key={k.id} className={`chip ${kind === k.id ? 'on' : ''}`} onClick={() => setKind(k.id)}>{k.label}</button>)}</div>
        </div>
      )}
      <div className="field"><span>איך רושמים אותו</span>
        <div className="chips">{TRACKINGS.map((t) => <button key={t.id} className={`chip ${tracking === t.id ? 'on' : ''}`} onClick={() => setTracking(t.id)}>{t.label}</button>)}</div>
      </div>
      <div className="field"><span>ציוד נדרש (לא חובה)</span>
        <div className="chips">
          {EQUIPMENT.map((e) => (
            <button key={e.id} className={`chip sm ${equip.includes(e.id) ? 'on' : ''}`}
              onClick={() => setEquip((cur) => (cur.includes(e.id) ? cur.filter((x) => x !== e.id) : [...cur, e.id]))}>{e.name}</button>
          ))}
        </div>
      </div>
      {tracking === 'weight_reps' && (
        <label className="field"><span>קפיצת משקל (ק"ג)</span><input inputMode="decimal" value={increment} onChange={(e) => setIncrement(e.target.value)} /></label>
      )}
      <label className="field"><span>הוראות ביצוע (שורה לכל שלב, לא חובה)</span>
        <textarea rows={3} value={how} onChange={(e) => setHow(e.target.value)} />
      </label>
      <label className="field"><span>קישור לסרטון טכניקה (לא חובה)</span>
        <input inputMode="url" dir="ltr" value={video} placeholder="https://" onChange={(e) => setVideo(e.target.value)} />
      </label>
      {error && <p className="warn" role="alert">{error}</p>}
      <button className="btn primary block" onClick={save}>שמור תרגיל</button>
    </div>
  );
}

export function CustomExercisesSheet({ onClose }: { onClose: () => void }) {
  const custom = useStore((s) => s.custom_exercises).filter((c) => !c.archived);
  const deleteCustomExercise = useStore((s) => s.deleteCustomExercise);
  const [adding, setAdding] = useState(false);
  return (
    <Sheet title={adding ? 'תרגיל חדש' : 'התרגילים שלי'} onClose={onClose}>
      {adding ? <CustomExerciseForm onDone={() => setAdding(false)} /> : (
        <>
          <p className="muted">תרגילים שהוספת מופיעים בהחלפת תרגיל, בהוספת תרגיל לאימון ובעריכת התוכנית.</p>
          {custom.length === 0 && <p className="muted">עדיין לא הוספת תרגילים.</p>}
          {custom.map((c) => (
            <div key={c.id} className="list-row">
              <span><strong>{c.name}</strong><small>{MUSCLE_LABEL[c.muscle_group]}</small></span>
              <button className="link danger-text" aria-label={`מחק ${c.name}`}
                onClick={() => { if (confirm(`למחוק את "${c.name}"? אימונים שמורים שכוללים אותו לא ייפגעו.`)) deleteCustomExercise(c.id); }}>✕</button>
            </div>
          ))}
          <button className="btn primary block" onClick={() => setAdding(true)}>+ תרגיל חדש</button>
        </>
      )}
    </Sheet>
  );
}

/** Permanent program editing. Saved workouts keep what was actually performed. */
export function ProgramEditorSheet({ onClose }: { onClose: () => void }) {
  const program = useStore((s) => s.profile!.program);
  const overrides = useStore((s) => s.template_overrides);
  const setTemplateSlots = useStore((s) => s.setTemplateSlots);
  const cat = useCatalog();
  const mine = TEMPLATES.filter((t) => t.program === program);
  const [tplId, setTplId] = useState<SplitType>(mine[0].id);
  const [picker, setPicker] = useState<number | 'add' | null>(null);
  const slots = getTemplate(tplId, overrides).slots;
  const edited = !!overrides[tplId];

  const update = (next: TemplateSlot[]) => setTemplateSlots(tplId, next);
  const patch = (i: number, p: Partial<TemplateSlot>) => update(slots.map((s, j) => (j === i ? { ...s, ...p } : s)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= slots.length) return;
    const next = [...slots];
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  };
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v) || lo));

  return (
    <>
      <Sheet title="עריכת התוכנית" onClose={onClose}>
        <div className="chips">
          {TEMPLATES.map((t) => <button key={t.id} className={`chip ${tplId === t.id ? 'on' : ''}`} onClick={() => setTplId(t.id)}>{t.name}</button>)}
        </div>
        <p className="muted small">שינוי קבוע: חל מהאימון הבא. אימונים שכבר נשמרו לא משתנים. לשינוי חד-פעמי, השתמש בכפתורים שבתוך האימון עצמו.</p>
        {slots.map((s, i) => {
          const ex = cat.get(s.exercise_id);
          const timed = ex.tracking === 'time';
          return (
            <div key={`${s.exercise_id}-${i}`} className="slot">
              <div className="slot-head">
                <strong>{ex.name}</strong>
                <span className="slot-tools">
                  <button className="link" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`הזז למעלה ${ex.name}`}>↑</button>
                  <button className="link" onClick={() => move(i, 1)} disabled={i === slots.length - 1} aria-label={`הזז למטה ${ex.name}`}>↓</button>
                  <button className="link" onClick={() => setPicker(i)} aria-label={`החלף ${ex.name}`}>⇄</button>
                  <button className="link danger-text" onClick={() => update(slots.filter((_, j) => j !== i))} disabled={slots.length <= 1} aria-label={`הסר ${ex.name}`}>✕</button>
                </span>
              </div>
              <div className="slot-nums">
                <label><span>סטים</span><input inputMode="numeric" value={s.sets} aria-label={`סטים ${ex.name}`} onChange={(e) => patch(i, { sets: clamp(Number(e.target.value), 1, 8) })} /></label>
                <label><span>{timed ? 'שניות מ-' : 'חזרות מ-'}</span><input inputMode="numeric" value={s.rep_min} aria-label={`מינימום ${ex.name}`} onChange={(e) => patch(i, { rep_min: clamp(Number(e.target.value), 1, 600) })} /></label>
                <label><span>עד</span><input inputMode="numeric" value={s.rep_max} aria-label={`מקסימום ${ex.name}`} onChange={(e) => patch(i, { rep_max: clamp(Number(e.target.value), 1, 600) })} /></label>
              </div>
              {s.rep_max < s.rep_min && <p className="warn small">הטווח הפוך: המקסימום קטן מהמינימום.</p>}
            </div>
          );
        })}
        <button className="btn ghost block" onClick={() => setPicker('add')}>+ הוסף תרגיל</button>
        {edited && (
          <button className="btn ghost block danger-text" onClick={() => { if (confirm(`לאפס את ${TEMPLATE_MAP[tplId].name} לתוכנית המקורית?`)) setTemplateSlots(tplId, null); }}>
            אפס לברירת המחדל
          </button>
        )}
      </Sheet>
      {picker !== null && (
        <ExercisePicker
          title={picker === 'add' ? 'הוסף תרגיל לתוכנית' : 'החלף תרגיל בתוכנית'}
          excludeIds={slots.map((s) => s.exercise_id)}
          muscle={picker === 'add' ? undefined : cat.get(slots[picker].exercise_id).muscle_group}
          onClose={() => setPicker(null)}
          onPick={(ex) => {
            if (picker === 'add') update([...slots, defaultSlot(ex)]);
            else patch(picker, { exercise_id: ex.id });
            setPicker(null);
          }}
        />
      )}
    </>
  );
}
