import type { ProgramType, SplitType, TemplateSlot, WorkoutTemplate } from '../types';

const anchor = (exercise_id: string): TemplateSlot => ({ exercise_id, role: 'anchor', sets: 4, rep_min: 6, rep_max: 10 });
const acc = (exercise_id: string, rep_min = 8, rep_max = 12): TemplateSlot => ({ exercise_id, role: 'accessory', sets: 3, rep_min, rep_max });
/** Core finisher: 2 rounds, 30s rests → 3 exercises ≈ 6 minutes. */
const core = (exercise_id: string, rep_min = 12, rep_max = 20): TemplateSlot => ({ exercise_id, role: 'core', sets: 2, rep_min, rep_max });
const coreTime = (exercise_id: string): TemplateSlot => ({ exercise_id, role: 'core', sets: 2, rep_min: 30, rep_max: 60 });

export const TEMPLATES: WorkoutTemplate[] = [
  {
    id: 'push', program: 'ppl', name: 'Push', subtitle: 'חזה, כתפיים ויד אחורית',
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
    id: 'pull', program: 'ppl', name: 'Pull', subtitle: 'גב, כתף אחורית ויד קדמית',
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
    id: 'legs', program: 'ppl', name: 'Legs', subtitle: 'רגליים וישבן',
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
    id: 'full_a', program: 'full_body', name: 'גוף מלא A', subtitle: 'דגש סקוואט',
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
    id: 'full_b', program: 'full_body', name: 'גוף מלא B', subtitle: 'דגש לחיצת חזה',
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
    id: 'full_c', program: 'full_body', name: 'גוף מלא C', subtitle: 'דגש חתירה',
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
];

export const TEMPLATE_MAP = Object.fromEntries(TEMPLATES.map((t) => [t.id, t])) as Record<SplitType, WorkoutTemplate>;

export const PROGRAM_LABEL: Record<ProgramType, string> = {
  ppl: 'Push / Pull / Legs',
  full_body: 'גוף מלא × 3',
};

export const ANCHOR_EXERCISE_IDS = ['bench_press', 'squat', 'barbell_row', 'ohp', 'deadlift', 'rdl'];

/** Next workout in the rotation of the chosen program, based on the last one done. */
export function nextTemplate(program: ProgramType, lastSplit: SplitType | null): WorkoutTemplate {
  const cycle = TEMPLATES.filter((t) => t.program === program);
  const idx = cycle.findIndex((t) => t.id === lastSplit);
  return cycle[(idx + 1) % cycle.length];
}
