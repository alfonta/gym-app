import type { Exercise, Pattern, TemplateSlot } from '../types';
import { getAlternatives, type Availability } from './alternatives';
import type { Catalog } from './catalog';

// General load-management rules, not medical advice. The mapping is deliberately
// conservative: when in doubt an exercise counts as stressing the area.

export type InjuryArea = 'shoulder' | 'elbow' | 'wrist' | 'lower_back' | 'knee' | 'hip' | 'ankle';
/** reduce = keep training around it, lighter. avoid = do not load the area at all. */
export type InjuryLevel = 'reduce' | 'avoid';
export type Injuries = Partial<Record<InjuryArea, InjuryLevel>>;

export const INJURY_LABEL: Record<InjuryArea, string> = {
  shoulder: 'כתף', elbow: 'מרפק', wrist: 'שורש כף היד', lower_back: 'גב תחתון', knee: 'ברך', hip: 'ירך / מפשעה', ankle: 'קרסול',
};

interface Rule { patterns: Pattern[]; ids: string[] }
const HIGH: Record<InjuryArea, Rule> = {
  shoulder: { patterns: ['v_push'], ids: ['dips', 'incline_bench_press', 'pullups'] },
  elbow: { patterns: [], ids: ['skullcrusher', 'overhead_triceps_ext', 'db_overhead_ext', 'dips', 'pullups'] },
  wrist: { patterns: [], ids: ['pushups', 'barbell_curl', 'mountain_climbers'] },
  lower_back: { patterns: ['hinge'], ids: ['barbell_row', 'squat', 'ohp', 'russian_twist'] },
  knee: { patterns: ['squat', 'lunge', 'knee_ext'], ids: ['leg_press'] },
  hip: { patterns: ['lunge'], ids: ['squat', 'deadlift'] },
  ankle: { patterns: ['calf', 'lunge'], ids: [] },
};
const MODERATE: Record<InjuryArea, Rule> = {
  shoulder: { patterns: ['h_push', 'incline_push', 'lateral_raise', 'fly', 'v_pull'], ids: ['overhead_triceps_ext', 'db_overhead_ext', 'hanging_leg_raise'] },
  elbow: { patterns: ['elbow_ext', 'elbow_flex', 'h_push', 'v_push', 'v_pull'], ids: [] },
  wrist: { patterns: [], ids: ['bench_press', 'ohp', 'incline_bench_press', 'ez_curl', 'skullcrusher', 'dips', 'smith_bench_press'] },
  lower_back: { patterns: [], ids: ['hip_thrust', 'smith_squat', 'goblet_squat', 'leg_press', 'one_arm_db_row', 'crunches', 'cable_crunch', 'lying_leg_raise', 'hanging_leg_raise', 'db_lunges', 'split_squat'] },
  knee: { patterns: [], ids: ['mountain_climbers', 'hip_thrust', 'leg_press_calf'] },
  hip: { patterns: ['hinge', 'squat', 'core_legs'], ids: [] },
  ankle: { patterns: ['squat'], ids: ['mountain_climbers'] },
};

/** 0 = does not load the area, 1 = loads it moderately, 2 = loads it heavily. */
export function stress(ex: Exercise, area: InjuryArea): 0 | 1 | 2 {
  const mod = MODERATE[area].ids.includes(ex.id);
  if (HIGH[area].ids.includes(ex.id) || (HIGH[area].patterns.includes(ex.pattern) && !mod)) return 2;
  if (mod || MODERATE[area].patterns.includes(ex.pattern)) return 1;
  return 0;
}

export function activeInjuries(injuries: Injuries | undefined): [InjuryArea, InjuryLevel][] {
  return Object.entries(injuries ?? {}).filter(([, level]) => level === 'reduce' || level === 'avoid') as [InjuryArea, InjuryLevel][];
}

/** Heavily loads an area the user said to avoid completely. */
export function isBlocked(ex: Exercise, injuries: Injuries | undefined): boolean {
  return activeInjuries(injuries).some(([area, level]) => level === 'avoid' && stress(ex, area) === 2);
}

export type InjuryStatus = 'ok' | 'replaced' | 'reduced';
export interface InjuryRow { slot: TemplateSlot; status: InjuryStatus; from: string | null }
export interface InjuryResult { rows: InjuryRow[]; removed: string[] }

function lighter(slot: TemplateSlot, ex: Exercise): TemplateSlot {
  const weighted = ex.tracking === 'weight_reps' && !ex.is_core;
  return {
    ...slot,
    sets: Math.max(Math.min(slot.sets, 2), slot.sets - 1),
    // Fewer sets, and more reps per set so the load has to come down.
    rep_min: weighted ? slot.rep_min + 2 : slot.rep_min,
    rep_max: weighted ? slot.rep_max + 3 : slot.rep_max,
    caution: true,
  };
}

/**
 * Adapts a workout to the declared injuries.
 *  - avoid:  heavy-stress exercises are swapped for one that does not load the
 *            area, or dropped when nothing suitable exists; moderate ones are lightened.
 *  - reduce: heavy-stress exercises are swapped for a gentler one when possible,
 *            otherwise lightened; moderate ones are lightened.
 */
export function applyInjuries(slots: TemplateSlot[], injuries: Injuries | undefined, cat: Catalog, availability: Availability): InjuryResult {
  const list = activeInjuries(injuries);
  if (list.length === 0) return { rows: slots.map((slot) => ({ slot, status: 'ok', from: null })), removed: [] };

  const worst = (ex: Exercise) => Math.max(...list.map(([a]) => stress(ex, a)));
  // A replacement must not load an avoided area at all, and at most moderately a reduced one.
  const acceptable = (ex: Exercise) => list.every(([a, level]) => stress(ex, a) <= (level === 'avoid' ? 0 : 1));
  const mustLeave = (ex: Exercise) => list.some(([a, level]) => level === 'avoid' && stress(ex, a) === 2);
  const shouldLeave = (ex: Exercise) => list.some(([a]) => stress(ex, a) === 2);

  const used = new Set(slots.map((s) => s.exercise_id));
  const rows: InjuryRow[] = [];
  const removed: string[] = [];
  for (const slot of slots) {
    const ex = cat.find(slot.exercise_id);
    if (!ex || worst(ex) === 0) {
      rows.push({ slot, status: 'ok', from: null });
      continue;
    }
    if (shouldLeave(ex)) {
      const alt = getAlternatives(ex, cat.all, availability, [...used], 30)
        .find((a) => acceptable(a) && (a.tracking === 'time') === (ex.tracking === 'time'));
      if (alt) {
        used.add(alt.id);
        const swapped = { ...slot, exercise_id: alt.id };
        rows.push({ slot: worst(alt) > 0 ? lighter(swapped, alt) : { ...swapped, caution: true }, status: 'replaced', from: ex.id });
        continue;
      }
      if (mustLeave(ex)) {
        removed.push(ex.id);
        continue;
      }
    }
    rows.push({ slot: lighter(slot, ex), status: 'reduced', from: null });
  }
  return { rows, removed };
}
