import { useMemo, useState } from 'react';
import { Sheet } from '../components/Sheet';
import { MUSCLE_LABEL } from '../data/exercises';
import { CUSTOM_TEMPLATE, PRESETS, PROGRAM_HINT, PROGRAM_LABEL, TEMPLATES, TEMPLATE_MAP, scheduleOf } from '../data/programs';
import { buildWorkout } from '../engine/builder';
import { estimateMinutes } from '../engine/calc';
import { INJURY_LABEL, activeInjuries, isBlocked, type InjuryArea, type InjuryLevel } from '../engine/injury';
import { isExerciseAvailable } from '../engine/alternatives';
import { DEFAULT_PATTERN, defaultSlot, getTemplate } from '../engine/catalog';
import { planSlots, planSplitDetailed, useCatalog, useEquipmentList, useStore } from '../store';
import type { Exercise, MuscleGroup, ProgramType, SplitType, TemplateSlot, Tracking } from '../types';

const MUSCLES = Object.keys(MUSCLE_LABEL) as MuscleGroup[];

/** Choose any available exercise, filtered by muscle and free text. */
export function ExercisePicker({ title, excludeIds = [], muscle, onPick, onClose }: {
  title: string; excludeIds?: string[]; muscle?: MuscleGroup; onPick: (ex: Exercise) => void; onClose: () => void;
}) {
  const cat = useCatalog();
  const equipment = useStore((s) => s.equipment);
  const injuries = useStore((s) => s.profile?.injuries);
  const [filter, setFilter] = useState<MuscleGroup | null>(muscle ?? null);
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const list = useMemo(
    () => cat.all
      .filter((e) => !excludeIds.includes(e.id) && isExerciseAvailable(e, equipment))
      .filter((e) => !filter || e.muscle_group === filter)
      .filter((e) => q.trim() === '' || e.name.includes(q.trim()))
      .sort((a, b) => Number(!!b.is_custom) - Number(!!a.is_custom)),
    [cat, equipment, excludeIds, filter, q],
  );
  if (creating) {
    return (
      <Sheet title="תרגיל חדש למאגר" onClose={() => setCreating(false)}>
        <CustomExerciseForm initialName={q.trim()} initialMuscle={filter ?? undefined} onDone={(ex) => { setCreating(false); if (ex) onPick(ex); }} />
      </Sheet>
    );
  }
  return (
    <Sheet title={title} onClose={onClose}>
      <label className="field"><input value={q} placeholder="חיפוש לפי שם" onChange={(e) => setQ(e.target.value)} aria-label="חיפוש תרגיל" /></label>
      <div className="chips scroll-x">
        <button className={`chip ${filter === null ? 'on' : ''}`} onClick={() => setFilter(null)}>הכול</button>
        {MUSCLES.map((m) => <button key={m} className={`chip ${filter === m ? 'on' : ''}`} onClick={() => setFilter(m)}>{MUSCLE_LABEL[m]}</button>)}
      </div>
      {list.length === 0 && <p className="muted">לא נמצאו תרגילים זמינים.</p>}
      <button className="btn ghost block" onClick={() => setCreating(true)}>+ לא מצאת? הוסף תרגיל חדש למאגר</button>
      {list.map((e) => (
        <button key={e.id} className="alt compact" onClick={() => onPick(e)}>
          <span>
            <strong>{e.name}</strong>
            <small>{MUSCLE_LABEL[e.muscle_group]}{e.is_custom ? ' · תרגיל שלי' : ''}{isBlocked(e, injuries) ? ' · ⚠️ מעמיס על אזור הפציעה' : ''}</small>
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

export function CustomExerciseForm({ onDone, initialName = '', initialMuscle, initialEquipment = [] }: {
  onDone: (saved?: Exercise) => void; initialName?: string; initialMuscle?: MuscleGroup; initialEquipment?: string[];
}) {
  const saveCustomExercise = useStore((s) => s.saveCustomExercise);
  const equipmentList = useEquipmentList();
  const [name, setName] = useState(initialName);
  const [muscle, setMuscle] = useState<MuscleGroup>(initialMuscle ?? 'chest');
  const [kind, setKind] = useState<'compound' | 'isolation'>('isolation');
  const [tracking, setTracking] = useState<Tracking>('weight_reps');
  const [equip, setEquip] = useState<string[]>(initialEquipment);
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
    const exercise: Exercise = {
      id: `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(), muscle_group: muscle, pattern: DEFAULT_PATTERN[muscle], equipment_ids: equip,
      instructions_tips: how.split('\n').map((l) => l.trim()).filter(Boolean),
      safety_tip: '', media_urls: [], rest_time_seconds: isCore ? 30 : compound ? 150 : 75,
      is_core: isCore, is_compound: compound, is_bodyweight: tracking !== 'weight_reps', tracking,
      increment_kg: inc > 0 ? inc : 2.5, uses_barbell: equip.includes('barbell') && compound,
      video_url: url || null, is_custom: true,
    };
    saveCustomExercise(exercise);
    onDone(exercise);
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
          {equipmentList.map((e) => (
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
  const profile = useStore((s) => s.profile)!;
  const overrides = useStore((s) => s.template_overrides);
  const setTemplateSlots = useStore((s) => s.setTemplateSlots);
  const cat = useCatalog();
  const inWeek = scheduleOf(profile);
  const [tplId, setTplId] = useState<SplitType>(inWeek[0]);
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
        <div className="chips scroll-x">
          {[...TEMPLATES, ...(overrides.custom ? [CUSTOM_TEMPLATE] : [])].sort((a, b) => Number(inWeek.includes(b.id)) - Number(inWeek.includes(a.id))).map((t) => (
            <button key={t.id} className={`chip ${tplId === t.id ? 'on' : ''}`} onClick={() => setTplId(t.id)}>{t.name}{inWeek.includes(t.id) ? ' ●' : ''}</button>
          ))}
        </div>
        <p className="muted small">● אימון שנמצא בשבוע שלך. לאימון שערכת ידנית לא מופעל גיוון אוטומטי.</p>
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

/** "My gym": which machines exist, adding and removing your own, and exercises per machine. */
export function MyGymSheet({ onClose }: { onClose: () => void }) {
  const list = useEquipmentList();
  const availability = useStore((s) => s.equipment);
  const setEquipment = useStore((s) => s.setEquipment);
  const addEquipment = useStore((s) => s.addEquipment);
  const deleteEquipment = useStore((s) => s.deleteEquipment);
  const cat = useCatalog();
  const [name, setName] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [addFor, setAddFor] = useState<string | null>(null);
  const availableCount = cat.all.filter((e) => isExerciseAvailable(e, availability)).length;

  const add = () => {
    const n = name.trim();
    if (n.length < 2 || list.some((e) => e.name === n)) return;
    addEquipment(n);
    setName('');
  };

  if (addFor) {
    return (
      <Sheet title={`תרגיל חדש: ${list.find((e) => e.id === addFor)?.name ?? ''}`} onClose={() => setAddFor(null)}>
        <CustomExerciseForm initialEquipment={[addFor]} onDone={() => setAddFor(null)} />
      </Sheet>
    );
  }
  return (
    <Sheet title="חדר הכושר שלי" onClose={onClose}>
      <p className="muted">סמן מה יש במכון. תרגיל נבחר רק אם כל הציוד שלו זמין. כרגע זמינים {availableCount} מתוך {cat.all.length} תרגילים.</p>
      {list.map((e) => {
        const custom = e.id.startsWith('eq_');
        const uses = cat.all.filter((x) => x.equipment_ids.includes(e.id));
        return (
          <div key={e.id} className="gym-row">
            <div className="toggle">
              <button className="gym-name" onClick={() => setOpenId(openId === e.id ? null : e.id)} aria-expanded={openId === e.id}>
                <span>{e.name}{custom ? ' · שלי' : ''}</span>
                <small>{uses.length} תרגילים {openId === e.id ? '▴' : '▾'}</small>
              </button>
              <input type="checkbox" aria-label={e.name} checked={availability[e.id] !== false} onChange={(ev) => setEquipment(e.id, ev.target.checked)} />
            </div>
            {openId === e.id && (
              <div className="gym-detail">
                {uses.length === 0 && <p className="muted small">עדיין אין תרגילים למכשיר הזה.</p>}
                {uses.map((x) => <div key={x.id} className="small">{x.name}{x.is_custom ? ' · תרגיל שלי' : ''}</div>)}
                <div className="grid2">
                  <button className="btn ghost sm" onClick={() => setAddFor(e.id)}>+ תרגיל למכשיר</button>
                  {custom && (
                    <button className="btn ghost sm danger-text" onClick={() => { if (confirm(`להסיר את "${e.name}" מהמכון?`)) deleteEquipment(e.id); }}>הסר מכשיר</button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
      <div className="quick-weight">
        <input value={name} placeholder="שם מכשיר חדש" onChange={(e) => setName(e.target.value)} aria-label="שם מכשיר חדש" />
        <button className="btn primary" onClick={add}>הוסף</button>
      </div>
      <p className="muted small">מכשירים מובנים אפשר לכבות. מכשירים שהוספת אפשר גם להסיר לגמרי.</p>
    </Sheet>
  );
}

/** Weekly structure: a preset, or any sequence of workouts, plus the variety switch. */
export function WeekPlanSheet({ onClose }: { onClose: () => void }) {
  const profile = useStore((s) => s.profile)!;
  const saveProfile = useStore((s) => s.saveProfile);
  const schedule = scheduleOf(profile);
  const hasCustom = useStore((s) => !!s.template_overrides.custom);
  const presets = Object.keys(PRESETS) as Exclude<ProgramType, 'custom'>[];

  const save = (program: ProgramType, next: SplitType[]) => {
    const { id: _id, ...rest } = profile;
    saveProfile({ ...rest, program, schedule: next });
  };
  const setDay = (i: number, id: SplitType) => save('custom', schedule.map((x, j) => (j === i ? id : x)));
  const counts = (kind: 'lower' | 'upper' | 'full') =>
    schedule.filter((id) => (kind === 'lower' ? id === 'legs' || id.startsWith('lower') : kind === 'full' ? id.startsWith('full') : !(id === 'legs' || id.startsWith('lower') || id.startsWith('full')))).length;

  return (
    <Sheet title="מבנה השבוע" onClose={onClose}>
      <div className="field"><span>תבנית מוכנה</span>
        <div className="chips">
          {presets.map((p) => (
            <button key={p} className={`chip ${profile.program === p ? 'on' : ''}`} onClick={() => save(p, PRESETS[p])}>{PROGRAM_LABEL[p]}</button>
          ))}
          {profile.program === 'custom' && <span className="chip on">{PROGRAM_LABEL.custom}</span>}
        </div>
        <p className="muted small">{PROGRAM_HINT[profile.program]}</p>
      </div>

      <div className="field"><span>האימונים בשבוע, לפי הסדר ({schedule.length} ימים)</span>
        {schedule.map((id, i) => (
          <div key={i} className="day-row">
            <span className="day-n">יום {i + 1}</span>
            <select className="select" value={id} aria-label={`אימון ליום ${i + 1}`} onChange={(e) => setDay(i, e.target.value as SplitType)}>
              {[...TEMPLATES, ...(hasCustom ? [CUSTOM_TEMPLATE] : [])].map((t) => <option key={t.id} value={t.id}>{t.name} · {t.subtitle}</option>)}
            </select>
            <button className="link danger-text" disabled={schedule.length <= 1} aria-label={`הסר יום ${i + 1}`} onClick={() => save('custom', schedule.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button className="btn ghost block" disabled={schedule.length >= 6} onClick={() => save('custom', [...schedule, schedule[schedule.length - 1]])}>+ הוסף יום אימון</button>
      </div>
      <p className="muted small">בשבוע הזה: {counts('lower')} אימוני פלג תחתון, {counts('upper')} פלג עליון, {counts('full')} גוף מלא. האימון הבא נבחר לפי הסדר הזה.</p>

      <label className="toggle">
        <span>גיוון תרגילים בין סבבים</span>
        <input type="checkbox" checked={profile.variety !== false} onChange={(e) => { const { id: _id, ...rest } = profile; saveProfile({ ...rest, variety: e.target.checked }); }} />
      </label>
      <p className="muted small">כשפעיל, תרגיל העוגן נשאר קבוע, וחלק מתרגילי המשנה והבטן מתחלפים בכל פעם שחוזרים על אותו אימון. כך כל תרגיל חוזר פעם בשני סבבים, והמעקב אחרי המשקלים ממשיך לעבוד.</p>
    </Sheet>
  );
}

const SIZES = [{ n: 4, label: 'קצר' }, { n: 6, label: 'רגיל' }, { n: 8, label: 'ארוך' }];

/** Build a workout from muscles and/or specific exercises; the rest is filled in automatically. */
export function CustomWorkoutSheet({ onClose, onStart }: { onClose: () => void; onStart: () => void }) {
  const cat = useCatalog();
  const state = useStore();
  const [muscles, setMuscles] = useState<MuscleGroup[]>([]);
  const [ids, setIds] = useState<string[]>([]);
  const [size, setSize] = useState(6);
  const [core, setCore] = useState(true);
  const [save, setSave] = useState(false);
  const [picking, setPicking] = useState(false);

  const slots = useMemo(
    () => buildWorkout({ muscles, exerciseIds: ids, size, core }, cat, state.equipment, (e) => !isBlocked(e, state.profile?.injuries)),
    [muscles, ids, size, core, cat, state.equipment, state.profile?.injuries],
  );
  const empty = muscles.length === 0 && ids.length === 0;
  const plan = useMemo(() => planSlots(slots, false, 0, state), [slots, state]);
  const minutes = estimateMinutes(plan.rows.map(({ slot, ex }) => ({ sets: slot.sets, rest_seconds: ex.rest_time_seconds, is_core: ex.is_core })));
  const toggle = (m: MuscleGroup) => setMuscles((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));

  const start = () => {
    if (save) state.setTemplateSlots('custom', slots);
    state.startCustomWorkout(slots);
    onStart();
  };

  return (
    <>
      <Sheet title="אימון מותאם אישית" onClose={onClose}>
        <div className="field"><span>על אילו שרירים לעבוד?</span>
          <div className="chips">{MUSCLES.map((m) => <button key={m} className={`chip ${muscles.includes(m) ? 'on' : ''}`} onClick={() => toggle(m)}>{MUSCLE_LABEL[m]}</button>)}</div>
        </div>
        <div className="field"><span>תרגילים שחייבים להיות באימון (לא חובה)</span>
          {ids.map((id) => (
            <div key={id} className="list-row">
              <strong>{cat.get(id).name}</strong>
              <button className="link danger-text" aria-label={`הסר ${cat.get(id).name}`} onClick={() => setIds((cur) => cur.filter((x) => x !== id))}>✕</button>
            </div>
          ))}
          <button className="btn ghost block" onClick={() => setPicking(true)}>+ בחר תרגיל</button>
        </div>
        <div className="field"><span>אורך האימון</span>
          <div className="chips">{SIZES.map((x) => <button key={x.n} className={`chip ${size === x.n ? 'on' : ''}`} onClick={() => setSize(x.n)}>{x.label} · {x.n} תרגילים</button>)}</div>
        </div>
        <label className="toggle"><span>להוסיף פינישר בטן</span><input type="checkbox" checked={core} onChange={(e) => setCore(e.target.checked)} /></label>

        {empty ? <p className="muted">בחר שרירים או תרגילים, והאימון ייבנה כאן אוטומטית.</p> : (
          <div className="built">
            <div className="tag">האימון שנבנה · כ-{minutes} דקות</div>
            <ul className="plan">
              {plan.rows.map(({ slot, ex, injury }) => (
                <li key={ex.id} className={slot.role}>
                  <span>{ex.name}{injury !== 'ok' && <em> ({injury === 'replaced' ? 'הותאם לפציעה' : 'מופחת'})</em>}</span>
                  <small>{slot.sets}×{slot.rep_min}–{slot.rep_max}{ex.tracking === 'time' ? ' שנ׳' : ''}</small>
                </li>
              ))}
            </ul>
            {plan.rows.length > 0 && plan.rows.filter((r) => !r.ex.is_core).length < size && muscles.length > 0 && (
              <p className="muted small">נבחרו פחות תרגילים מהמבוקש, כדי לא לחזור שלוש פעמים על אותה תנועה. אפשר להוסיף שרירים או תרגילים ספציפיים.</p>
            )}
            {plan.rows.length === 0 && <p className="warn">לא נמצאו תרגילים זמינים לבחירה הזו עם הציוד והמגבלות הנוכחיים.</p>}
          </div>
        )}
        <label className="toggle"><span>שמור כ"האימון שלי" לשימוש חוזר ולשיבוץ בשבוע</span><input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} /></label>
        <button className="btn primary block big" disabled={plan.rows.length === 0} onClick={start}>התחל את האימון</button>
      </Sheet>
      {picking && (
        <ExercisePicker title="בחר תרגיל לאימון" excludeIds={ids} onClose={() => setPicking(false)} onPick={(ex) => { setIds((cur) => [...cur, ex.id]); setPicking(false); }} />
      )}
    </>
  );
}

const LEVELS: { id: InjuryLevel | null; label: string }[] = [
  { id: null, label: 'תקין' },
  { id: 'reduce', label: 'להפחית' },
  { id: 'avoid', label: 'להימנע' },
];

/** Injury mode: every workout of the week is adapted, not just today's. */
export function InjurySheet({ onClose }: { onClose: () => void }) {
  const state = useStore();
  const profile = state.profile!;
  const injuries = profile.injuries ?? {};
  const set = (area: InjuryArea, level: InjuryLevel | null) => {
    const next = { ...injuries };
    if (level) next[area] = level;
    else delete next[area];
    const { id: _id, ...rest } = profile;
    state.saveProfile({ ...rest, injuries: next });
  };
  const on = activeInjuries(injuries).length > 0;
  const week = [...new Set(scheduleOf(profile))];

  return (
    <Sheet title="מצב פציעה" onClose={onClose}>
      <p className="warn">זו התאמת עומסים כללית ולא אבחון או טיפול. בפציעה, בכאב חד או בכאב שלא חולף, פנה לרופא או לפיזיותרפיסט לפני שממשיכים להתאמן.</p>
      {(Object.keys(INJURY_LABEL) as InjuryArea[]).map((area) => (
        <div key={area} className="injury-row">
          <span>{INJURY_LABEL[area]}</span>
          <div className="chips">
            {LEVELS.map((l) => (
              <button key={String(l.id)} className={`chip sm ${(injuries[area] ?? null) === l.id ? 'on' : ''}`} aria-label={`${INJURY_LABEL[area]}: ${l.label}`} onClick={() => set(area, l.id)}>{l.label}</button>
            ))}
          </div>
        </div>
      ))}
      <p className="muted small"><strong>להפחית:</strong> ממשיכים לאמן את האזור, בפחות סטים ובמשקל קל יותר, ותרגילים שמעמיסים עליו מאוד מוחלפים בעדינים יותר. <strong>להימנע:</strong> תרגילים שמעמיסים על האזור מוחלפים בתרגיל שלא נוגע בו, או יורדים מהאימון.</p>
      {on && (
        <div className="field"><span>ההשפעה על האימונים בשבוע שלך</span>
          {week.map((id) => {
            const d = planSplitDetailed(id, state);
            const replaced = d.rows.filter((r) => r.injury === 'replaced');
            const reduced = d.rows.filter((r) => r.injury === 'reduced');
            return (
              <div key={id} className="impact">
                <strong>{TEMPLATE_MAP[id].name}</strong>
                {replaced.length + reduced.length + d.removed.length === 0 && <div className="muted small">ללא שינוי.</div>}
                {replaced.map((r) => <div key={r.ex.id} className="small">⇄ {r.ex.name}</div>)}
                {reduced.length > 0 && <div className="small">↓ מופחת: {reduced.map((r) => r.ex.name).join(', ')}</div>}
                {d.removed.length > 0 && <div className="small danger-text">✕ ירד מהאימון: {d.removed.map((e) => e.name).join(', ')}</div>}
              </div>
            );
          })}
        </div>
      )}
      <p className="muted small">כשהאזור מחלים, החזר אותו ל"תקין" והאימונים יחזרו לתוכנית המלאה. בתרגילים מסומנים לא תוצע העלאת משקל.</p>
    </Sheet>
  );
}
