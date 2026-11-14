import { useState } from 'react';
import { PROGRAM_LABEL } from '../data/programs';
import { nutritionTargets } from '../engine/calc';
import { useStore } from '../store';
import type { ProgramType, Sex } from '../types';

const DEFAULT_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

/** Used for first-run onboarding and for editing later. */
export function ProfileForm({ submitLabel, onSaved }: { submitLabel: string; onSaved?: () => void }) {
  const profile = useStore((s) => s.profile);
  const saveProfile = useStore((s) => s.saveProfile);
  const logBodyweight = useStore((s) => s.logBodyweight);

  const [height, setHeight] = useState(profile ? String(profile.height_cm) : '');
  const [weight, setWeight] = useState(profile ? String(profile.current_weight) : '');
  const [goal, setGoal] = useState(profile?.goal_weight ? String(profile.goal_weight) : '');
  const [age, setAge] = useState(profile ? String(profile.age) : '');
  const [sex, setSex] = useState<Sex>(profile?.sex ?? 'male');
  const [program, setProgram] = useState<ProgramType>(profile?.program ?? 'ppl');
  const [calories, setCalories] = useState(profile ? String(profile.daily_calories_goal) : '');
  const [protein, setProtein] = useState(profile ? String(profile.daily_protein_goal) : '');
  const [bar, setBar] = useState(String(profile?.bar_weight_kg ?? 20));
  const [plates, setPlates] = useState<number[]>(profile?.plates_kg ?? DEFAULT_PLATES);
  const [error, setError] = useState('');

  const n = (v: string) => Number(v.replace(',', '.'));
  const valid = [height, weight, age].every((v) => v.trim() !== '' && n(v) > 0);
  const goalValue = goal.trim() !== '' && n(goal) > 0 ? n(goal) : null;
  const auto = valid ? nutritionTargets(n(weight), n(height), n(age), sex, goalValue) : null;

  const submit = () => {
    if (!valid) {
      setError('יש למלא גובה, משקל וגיל.');
      return;
    }
    const isNew = !profile;
    saveProfile({
      height_cm: n(height), current_weight: n(weight), goal_weight: goalValue, age: n(age), sex, program,
      daily_calories_goal: n(calories) > 0 ? n(calories) : auto!.calories,
      daily_protein_goal: n(protein) > 0 ? n(protein) : auto!.protein,
      bar_weight_kg: n(bar) > 0 ? n(bar) : 20,
      plates_kg: plates.length ? plates : DEFAULT_PLATES,
    });
    if (isNew) logBodyweight(n(weight));
    onSaved?.();
  };

  return (
    <div className="form">
      <div className="grid2">
        <label className="field"><span>גובה (ס"מ)</span><input inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} /></label>
        <label className="field"><span>גיל</span><input inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} /></label>
        <label className="field"><span>משקל נוכחי (ק"ג)</span><input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} /></label>
        <label className="field"><span>משקל יעד (לא חובה)</span><input inputMode="decimal" value={goal} placeholder="—" onChange={(e) => setGoal(e.target.value)} /></label>
      </div>

      <div className="field">
        <span>מין (לחישוב קלוריות)</span>
        <div className="chips">
          <button type="button" className={`chip ${sex === 'male' ? 'on' : ''}`} onClick={() => setSex('male')}>גבר</button>
          <button type="button" className={`chip ${sex === 'female' ? 'on' : ''}`} onClick={() => setSex('female')}>אישה</button>
        </div>
      </div>

      <div className="field">
        <span>תוכנית אימונים (3 אימונים בשבוע)</span>
        <div className="chips">
          {(Object.keys(PROGRAM_LABEL) as ProgramType[]).map((p) => (
            <button type="button" key={p} className={`chip ${program === p ? 'on' : ''}`} onClick={() => setProgram(p)}>{PROGRAM_LABEL[p]}</button>
          ))}
        </div>
      </div>

      <div className="grid2">
        <label className="field">
          <span>יעד קלוריות יומי</span>
          <input inputMode="numeric" value={calories} placeholder={auto ? String(auto.calories) : ''} onChange={(e) => setCalories(e.target.value)} />
        </label>
        <label className="field">
          <span>יעד חלבון יומי (גרם)</span>
          <input inputMode="numeric" value={protein} placeholder={auto ? String(auto.protein) : ''} onChange={(e) => setProtein(e.target.value)} />
        </label>
      </div>
      <p className="muted small">השאר ריק לחישוב אוטומטי לפי הנתונים שלך. זו הערכה כללית ולא ייעוץ תזונתי.</p>

      {profile && (
        <>
          <label className="field"><span>משקל המוט (ק"ג)</span><input inputMode="decimal" value={bar} onChange={(e) => setBar(e.target.value)} /></label>
          <div className="field">
            <span>פלטות שיש במכון (ק"ג)</span>
            <div className="chips">
              {DEFAULT_PLATES.map((p) => (
                <button type="button" key={p} className={`chip ${plates.includes(p) ? 'on' : ''}`}
                  onClick={() => setPlates((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]))}>{p}</button>
              ))}
            </div>
          </div>
        </>
      )}

      {error && <p className="warn">{error}</p>}
      <button className="btn primary block" onClick={submit}>{submitLabel}</button>
    </div>
  );
}
