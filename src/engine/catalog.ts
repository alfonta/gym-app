import type { Exercise, MuscleGroup, Pattern, SplitType, TemplateSlot, WorkoutTemplate } from '../types';
import { EXERCISES, EXERCISE_MAP } from '../data/exercises';
import { TEMPLATE_MAP } from '../data/programs';

export interface Catalog {
  /** Built-in + custom exercises that can be chosen. */
  all: Exercise[];
  find: (id: string) => Exercise | undefined;
  /** Never fails: history may reference an exercise that no longer exists. */
  get: (id: string) => Exercise;
}

const missing = (id: string): Exercise => ({
  id, name: 'תרגיל שנמחק', muscle_group: 'core', pattern: 'core_flex', equipment_ids: [],
  instructions_tips: [], safety_tip: '', media_urls: [], rest_time_seconds: 60,
  is_core: false, is_compound: false, is_bodyweight: false, tracking: 'weight_reps',
  increment_kg: 2.5, uses_barbell: false, archived: true,
});

export function buildCatalog(custom: Exercise[]): Catalog {
  const customMap = Object.fromEntries(custom.map((c) => [c.id, c]));
  const find = (id: string): Exercise | undefined => EXERCISE_MAP[id] ?? customMap[id];
  return {
    all: [...EXERCISES, ...custom.filter((c) => !c.archived)],
    find,
    get: (id) => find(id) ?? missing(id),
  };
}

export type TemplateOverrides = Partial<Record<SplitType, TemplateSlot[]>>;

/** The program as the user edited it; saved workouts are never touched by this. */
export function getTemplate(id: SplitType, overrides: TemplateOverrides): WorkoutTemplate {
  const base = TEMPLATE_MAP[id];
  const slots = overrides[id];
  return slots ? { ...base, slots } : base;
}

export const DEFAULT_PATTERN: Record<MuscleGroup, Pattern> = {
  chest: 'h_push', shoulders: 'v_push', triceps: 'elbow_ext', back: 'h_pull', biceps: 'elbow_flex',
  rear_delts: 'rear_fly', quads: 'squat', hamstrings: 'hinge', glutes: 'hinge', calves: 'calf', core: 'core_flex',
};

/** Sensible starting prescription when an exercise is added to a workout or template. */
export function defaultSlot(ex: Exercise): TemplateSlot {
  if (ex.tracking === 'time') return { exercise_id: ex.id, role: ex.is_core ? 'core' : 'accessory', sets: 2, rep_min: 30, rep_max: 60 };
  if (ex.is_core) return { exercise_id: ex.id, role: 'core', sets: 2, rep_min: 12, rep_max: 20 };
  return { exercise_id: ex.id, role: 'accessory', sets: 3, rep_min: 8, rep_max: 12 };
}

/** YouTube search for the exercise – a search, not a specific video we vouch for. */
export function videoLink(ex: Exercise): { url: string; isSearch: boolean } | null {
  if (ex.video_url) return { url: ex.video_url, isSearch: false };
  const q = ex.name_en ?? ex.name;
  return { url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${q} proper form`)}`, isSearch: true };
}
