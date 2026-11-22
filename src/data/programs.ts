import type { ProgramType, SplitType, TemplateSlot, UserProfile, WorkoutTemplate } from '../types';

const anchor = (exercise_id: string): TemplateSlot => ({ exercise_id, role: 'anchor', sets: 4, rep_min: 6, rep_max: 10 });
const acc = (exercise_id: string, rep_min = 8, rep_max = 12): TemplateSlot => ({ exercise_id, role: 'accessory', sets: 3, rep_min, rep_max });
/** Core finisher: 2 rounds, 30s rests → 3 exercises ≈ 6 minutes. */
const core = (exercise_id: string, rep_min = 12, rep_max = 20): TemplateSlot => ({ exercise_id, role: 'core', sets: 2, rep_min, rep_max });
const coreTime = (exercise_id: string): TemplateSlot => ({ exercise_id, role: 'core', sets: 2, rep_min: 30, rep_max: 60 });

export const TEMPLATES: WorkoutTemplate[] = [
  {
    id: 'push', name: 'Push', subtitle: 'חזה, כתפיים ויד אחורית',
    slots: [
      anchor('bench_press'),
      acc('incline_db_press'),
      acc('db_shoulder_press'),
      acc('lateral_raise', 12, 15),
      acc('cable_fly', 10, 15),
      acc('triceps_pushdown', 10, 15),
      coreTime('plank'), core('crunches'), core('lying_leg_raise', 10, 15),
    ],
  },
  {
    id: 'pull', name: 'Pull', subtitle: 'גב, כתף אחורית ויד קדמית',
    slots: [
      anchor('barbell_row'),
      acc('lat_pulldown'),
      acc('seated_cable_row'),
      acc('face_pull', 12, 15),
      acc('barbell_curl'),
      acc('hammer_curl', 10, 15),
      core('hanging_leg_raise', 8, 15), core('russian_twist', 16, 24), core('dead_bug', 10, 16),
    ],
  },
  {
    id: 'legs', name: 'Legs', subtitle: 'רגליים וישבן',
    slots: [
      anchor('squat'),
      acc('rdl'),
      acc('leg_press', 10, 12),
      acc('leg_extension', 10, 15),
      acc('lying_leg_curl', 10, 15),
      acc('standing_calf_raise', 10, 15),
      core('cable_crunch', 10, 15), core('air_bike', 16, 24), coreTime('plank'),
    ],
  },
  {
    id: 'full_a', name: 'גוף מלא A', subtitle: 'דגש סקוואט',
    slots: [
      anchor('squat'),
      acc('db_bench_press'),
      acc('seated_cable_row'),
      acc('lateral_raise', 12, 15),
      acc('lying_leg_curl', 10, 15),
      acc('barbell_curl'),
      coreTime('plank'), core('crunches'), core('lying_leg_raise', 10, 15),
    ],
  },
  {
    id: 'full_b', name: 'גוף מלא B', subtitle: 'דגש לחיצת חזה',
    slots: [
      anchor('bench_press'),
      acc('rdl'),
      acc('lat_pulldown'),
      acc('db_shoulder_press'),
      acc('leg_extension', 10, 15),
      acc('triceps_pushdown', 10, 15),
      core('hanging_leg_raise', 8, 15), core('russian_twist', 16, 24), core('dead_bug', 10, 16),
    ],
  },
  {
    id: 'full_c', name: 'גוף מלא C', subtitle: 'דגש חתירה',
    slots: [
      anchor('barbell_row'),
      acc('leg_press', 10, 12),
      acc('incline_db_press'),
      acc('face_pull', 12, 15),
      acc('standing_calf_raise', 10, 15),
      acc('hammer_curl', 10, 15),
      core('cable_crunch', 10, 15), core('air_bike', 16, 24), coreTime('plank'),
    ],
  },
  {
    id: 'upper_a', name: 'פלג עליון A', subtitle: 'דגש לחיצת חזה',
    slots: [
      anchor('bench_press'),
      acc('lat_pulldown'),
      acc('db_shoulder_press'),
      acc('seated_cable_row'),
      acc('lateral_raise', 12, 15),
      acc('triceps_pushdown', 10, 15),
      coreTime('plank'), core('crunches'),
    ],
  },
  {
    id: 'upper_b', name: 'פלג עליון B', subtitle: 'דגש גב וכתפיים',
    slots: [
      anchor('barbell_row'),
      acc('incline_db_press'),
      acc('lat_pulldown'),
      acc('machine_shoulder_press'),
      acc('face_pull', 12, 15),
      acc('barbell_curl'),
      core('dead_bug', 10, 16), core('russian_twist', 16, 24),
    ],
  },
  {
    id: 'lower_a', name: 'פלג תחתון A', subtitle: 'דגש ירך קדמית',
    slots: [
      anchor('squat'),
      acc('rdl'),
      acc('leg_extension', 10, 15),
      acc('lying_leg_curl', 10, 15),
      acc('standing_calf_raise', 10, 15),
      core('cable_crunch', 10, 15), coreTime('plank'),
    ],
  },
  {
    id: 'lower_b', name: 'פלג תחתון B', subtitle: 'דגש ישבן וירך אחורית',
    slots: [
      anchor('hip_thrust'),
      acc('leg_press', 10, 12),
      acc('db_lunges', 8, 12),
      acc('db_rdl'),
      acc('lying_leg_curl', 10, 15),
      acc('leg_press_calf', 10, 15),
      core('lying_leg_raise', 10, 15), core('air_bike', 16, 24),
    ],
  },
];

/** Placeholder for the user's own built workout; the real slots are stored as an override. */
export const CUSTOM_TEMPLATE: WorkoutTemplate = { id: 'custom', name: 'האימון שלי', subtitle: 'אימון שבנית בעצמך', slots: [] };

export const TEMPLATE_MAP = Object.fromEntries([...TEMPLATES, CUSTOM_TEMPLATE].map((t) => [t.id, t])) as Record<SplitType, WorkoutTemplate>;

export const PROGRAM_LABEL: Record<ProgramType, string> = {
  ppl: 'Push / Pull / Legs',
  full_body: 'גוף מלא × 3',
  upper_lower: 'עליון / תחתון × 4',
  lower_focus: 'דגש פלג גוף תחתון',
  custom: 'מותאם אישית',
};

export const PROGRAM_HINT: Record<ProgramType, string> = {
  ppl: '3 אימונים: דחיפה, משיכה, רגליים. כל שריר פעם בשבוע.',
  full_body: '3 אימונים של כל הגוף. כל שריר שלוש פעמים בשבוע.',
  upper_lower: '4 אימונים: פעמיים עליון ופעמיים תחתון.',
  lower_focus: '3 אימונים: שניים לפלג גוף תחתון ואחד לעליון.',
  custom: 'בוחרים כמה ימים ואיזה אימון בכל יום.',
};

/** Weekly rotation of every preset. */
export const PRESETS: Record<Exclude<ProgramType, 'custom'>, SplitType[]> = {
  ppl: ['push', 'pull', 'legs'],
  full_body: ['full_a', 'full_b', 'full_c'],
  upper_lower: ['upper_a', 'lower_a', 'upper_b', 'lower_b'],
  lower_focus: ['lower_a', 'upper_a', 'lower_b'],
};

export const ANCHOR_EXERCISE_IDS = ['bench_press', 'squat', 'barbell_row', 'ohp', 'deadlift', 'rdl', 'hip_thrust'];

export function scheduleOf(profile: Pick<UserProfile, 'program' | 'schedule'>): SplitType[] {
  const valid = (profile.schedule ?? []).filter((id) => TEMPLATE_MAP[id]);
  if (valid.length > 0) return valid;
  return PRESETS[profile.program === 'custom' ? 'ppl' : profile.program] ?? PRESETS.ppl;
}

/** Position to resume from when no pointer is stored: right after the last workout done. */
export function initialRotation(schedule: SplitType[], lastSplit: SplitType | null): number {
  const i = lastSplit ? schedule.indexOf(lastSplit) : -1;
  return i < 0 ? 0 : (i + 1) % schedule.length;
}

/**
 * Rotation position when every week starts again from day 1: replay this
 * week's workouts (oldest first) from the start of the schedule.
 */
export function weekPointer(schedule: SplitType[], thisWeekSplits: SplitType[], start = 0): number {
  return thisWeekSplits.reduce((i, s) => advanceRotation(schedule, i, s), start);
}

export type WeekStartMode = 'ask' | 'new' | 'continue';
export function weekStartMode(p: Pick<UserProfile, 'week_start' | 'weekly_reset'>): WeekStartMode {
  return p.week_start ?? (p.weekly_reset === false ? 'continue' : 'ask');
}

/**
 * Moves the rotation pointer after a finished workout. Works when the same
 * workout appears more than once in the week, and ignores off-schedule bonus days.
 */
export function advanceRotation(schedule: SplitType[], index: number, finished: SplitType): number {
  const n = schedule.length;
  const cur = ((index % n) + n) % n;
  for (let k = 0; k < n; k++) {
    const j = (cur + k) % n;
    if (schedule[j] === finished) return (j + 1) % n;
  }
  return cur;
}
