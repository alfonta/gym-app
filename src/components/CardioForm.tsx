import { useState } from 'react';
import type { CardioType } from '../types';

export const CARDIO_LABEL: Record<CardioType, string> = { walk: 'הליכה', run: 'ריצה', bike: 'אופניים', stairs: 'מדרגות', elliptical: 'אליפטיקל', rowing: 'חתירה', other: 'אחר' };

// Rough metabolic equivalents for moderate effort (Compendium-style values).
const MET: Record<CardioType, number> = { walk: 3.8, run: 9, bike: 7, stairs: 8.5, elliptical: 5, rowing: 7, other: 5 };

/** kcal ≈ MET × body weight (kg) × hours. A coarse estimate, not a measurement. */
export function estimateCalories(type: CardioType, minutes: number, weightKg: number): number {
  return Math.round((MET[type] * weightKg * minutes) / 60 / 5) * 5;
}

export interface CardioInput {
  type: CardioType;
  minutes: number;
  distance_km: number | null;
  calories: number | null;
  calories_estimated: boolean;
}

const toNum = (v: string) => Number(v.replace(',', '.'));

export function CardioForm({ weightKg, onSave }: { weightKg: number; onSave: (c: CardioInput) => void }) {
  const [type, setType] = useState<CardioType>('walk');
  const [minutes, setMinutes] = useState('');
  const [km, setKm] = useState('');
  const [kcal, setKcal] = useState('');
  const [error, setError] = useState('');
  const estimate = toNum(minutes) > 0 ? estimateCalories(type, toNum(minutes), weightKg) : null;

  const save = () => {
    if (!(toNum(minutes) > 0)) return setError('הזן משך בדקות.');
    const typed = toNum(kcal) > 0 ? Math.round(toNum(kcal)) : null;
    onSave({
      type, minutes: toNum(minutes), distance_km: toNum(km) > 0 ? toNum(km) : null,
      calories: typed ?? estimate, calories_estimated: typed === null,
    });
  };

  return (
    <div className="form">
      <div className="chips">
        {(Object.keys(CARDIO_LABEL) as CardioType[]).map((t) => <button key={t} className={`chip ${type === t ? 'on' : ''}`} onClick={() => setType(t)}>{CARDIO_LABEL[t]}</button>)}
      </div>
      <div className="grid2">
        <label className="field"><span>משך (דקות)</span><input inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-label="משך בדקות" /></label>
        <label className="field"><span>מרחק בק"מ (לא חובה)</span><input inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} aria-label="מרחק" /></label>
      </div>
      <label className="field">
        <span>קלוריות (מהמכשיר או מהשעון)</span>
        <input inputMode="numeric" value={kcal} placeholder={estimate ? `הערכה: ${estimate}` : ''} onChange={(e) => setKcal(e.target.value)} aria-label="קלוריות" />
      </label>
      <p className="muted small">אם משאירים ריק, נשמרת הערכה גסה לפי סוג הפעילות, המשך ומשקל הגוף. היא יכולה לסטות בעשרות אחוזים.</p>
      {error && <p className="warn" role="alert">{error}</p>}
      <button className="btn primary block" onClick={save}>שמור אירובי</button>
    </div>
  );
}

export function cardioLine(c: { type: CardioType; minutes: number; distance_km: number | null; calories?: number | null; calories_estimated?: boolean }): string {
  return `${CARDIO_LABEL[c.type]} · ${c.minutes} דק׳${c.distance_km ? ` · ${c.distance_km} ק"מ` : ''}${c.calories ? ` · ${c.calories_estimated ? 'כ-' : ''}${c.calories} קלוריות` : ''}`;
}
