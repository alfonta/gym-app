// Data model. Mirrors the PRD tables, with the fixes agreed in review:
// many-to-many equipment, program templates, bodyweight log, set types.

export type MuscleGroup =
  | 'chest' | 'shoulders' | 'triceps'
  | 'back' | 'biceps' | 'rear_delts'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves'
  | 'core';

/** Movement pattern – used to rank alternatives. */
export type Pattern =
  | 'h_push' | 'incline_push' | 'v_push' | 'fly' | 'lateral_raise' | 'elbow_ext'
  | 'h_pull' | 'v_pull' | 'rear_fly' | 'elbow_flex'
  | 'squat' | 'hinge' | 'knee_ext' | 'knee_flex' | 'lunge' | 'calf'
  | 'core_flex' | 'core_static' | 'core_rot' | 'core_legs';

export type Tracking = 'weight_reps' | 'bodyweight_reps' | 'time';

export interface Exercise {
  id: string;
  name: string;
  muscle_group: MuscleGroup;
  pattern: Pattern;
  /** All of these must be available (many-to-many, replaces required_equipment_id). */
  equipment_ids: string[];
  instructions_tips: string[];
  safety_tip: string;
  /** Two frames that are cross-faded in a loop. */
  media_urls: string[];
  rest_time_seconds: number;
  is_core: boolean;
  is_compound: boolean;
  is_bodyweight: boolean;
  tracking: Tracking;
  /** Smallest realistic load jump for this exercise. */
  increment_kg: number;
  /** Loaded on an Olympic bar – enables the plate calculator. */
  uses_barbell: boolean;
  /** English name, used only to build a technique-video search link. */
  name_en?: string;
  /** Explicit technique video supplied by the user (custom exercises). */
  video_url?: string | null;
  is_custom?: boolean;
  /** Deleted by the user but still referenced by saved workouts. */
  archived?: boolean;
}

export interface GymEquipment {
  id: string;
  name: string;
  is_available: boolean;
}

export type SplitType =
  | 'push' | 'pull' | 'legs' | 'full_a' | 'full_b' | 'full_c'
  | 'upper_a' | 'upper_b' | 'lower_a' | 'lower_b'
  /** The user's own built workout. Its slots live in template_overrides.custom. */
  | 'custom';
export type ProgramType = 'ppl' | 'full_body' | 'upper_lower' | 'lower_focus' | 'custom';
export type SlotRole = 'anchor' | 'accessory' | 'core';

export interface TemplateSlot {
  exercise_id: string;
  role: SlotRole;
  sets: number;
  /** For time-tracked exercises these are seconds. */
  rep_min: number;
  rep_max: number;
  /** Set by injury mode: train this one lighter and stop on pain. */
  caution?: boolean;
}

export interface WorkoutTemplate {
  id: SplitType;
  name: string;
  subtitle: string;
  slots: TemplateSlot[];
}

export type Effort = 'easy' | 'ok' | 'hard';

export interface Workout {
  id: string;
  user_id: string;
  date: string; // ISO
  split_type: SplitType;
  total_duration_minutes: number;
  /** Per-exercise effort rating that feeds progression. */
  efforts: Record<string, Effort>;
  // Future proofing – not used in the UI yet.
  wearable_sync_id: string | null;
  avg_heart_rate: number | null;
  /** Headline of the end-of-workout feedback; cleared if the workout is edited later. */
  verdict?: string | null;
}

export interface SetLog {
  id: string;
  workout_id: string;
  exercise_id: string;
  weight_kg: number;
  /** Reps, or seconds when the exercise is time-tracked. */
  reps: number;
  order_index: number;
  is_pr: boolean;
  completed_at: string;
}

export type Sex = 'male' | 'female';

export interface UserProfile {
  id: string;
  height_cm: number;
  age: number;
  sex: Sex;
  current_weight: number;
  /** Optional – the app works without a target weight. */
  goal_weight: number | null;
  daily_calories_goal: number;
  daily_protein_goal: number;
  program: ProgramType;
  /** Weekly rotation, one entry per training day. Missing = the preset of `program`. */
  schedule?: SplitType[];
  /** Alternate some accessory exercises between rounds of the same workout. Default on. */
  variety?: boolean;
  /** Legacy switch, read only to migrate to week_start. */
  weekly_reset?: boolean;
  /** What happens when a new week starts after an unfinished one. Default 'ask'. */
  week_start?: 'ask' | 'new' | 'continue';
  /** Injury mode: body area → how careful to be. */
  injuries?: Partial<Record<'shoulder' | 'elbow' | 'wrist' | 'lower_back' | 'knee' | 'hip' | 'ankle', 'reduce' | 'avoid'>>;
  bar_weight_kg: number;
  /** Plate sizes that exist in the gym, in kg. */
  plates_kg: number[];
}

export interface BodyweightEntry {
  id: string;
  date: string; // YYYY-MM-DD
  weight_kg: number;
}

export interface BodyMeasurement {
  id: string;
  date: string; // YYYY-MM-DD
  arms_cm: number | null;
  chest_cm: number | null;
  thighs_cm: number | null;
  /** Keys into the local photo store (IndexedDB), not remote URLs. */
  photo_front_url: string | null;
  photo_back_url: string | null;
}

export type CardioType = 'walk' | 'run' | 'bike' | 'stairs' | 'elliptical' | 'rowing' | 'other';

export interface CardioEntry {
  id: string;
  date: string; // ISO
  type: CardioType;
  minutes: number;
  distance_km: number | null;
  notes: string;
  calories?: number | null;
  /** True when the calories were estimated by the app rather than entered. */
  calories_estimated?: boolean;
  /** Set when the cardio was done as part of a strength workout. */
  workout_id?: string | null;
}

// ---- Active workout (in-progress, persisted so a reload does not lose it) ----

export interface ActiveSet {
  weight: string;
  reps: string;
  done: boolean;
  completed_at: string | null;
  is_pr: boolean;
}

export interface ActiveItem {
  /** Exercise planned by the template. */
  planned_exercise_id: string;
  /** Exercise actually performed (differs after a swap / equipment fallback). */
  exercise_id: string;
  role: SlotRole;
  rep_min: number;
  rep_max: number;
  sets: ActiveSet[];
  effort: Effort | null;
  caution?: boolean;
}

export interface RestState {
  ends_at: number; // epoch ms – timestamp based so it survives backgrounding
  total_seconds: number;
}

export interface ActiveWorkout {
  id: string;
  split_type: SplitType;
  started_at: number;
  items: ActiveItem[];
  current_index: number;
  rest: RestState | null;
  /** Cardio done as part of this workout; saved together with it. */
  cardio?: Omit<CardioEntry, 'id' | 'date' | 'workout_id'>[];
}
