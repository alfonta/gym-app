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
}

export interface GymEquipment {
  id: string;
  name: string;
  is_available: boolean;
}

export type SplitType = 'push' | 'pull' | 'legs' | 'full_a' | 'full_b' | 'full_c';
export type ProgramType = 'ppl' | 'full_body';
export type SlotRole = 'anchor' | 'accessory' | 'core';

export interface TemplateSlot {
  exercise_id: string;
  role: SlotRole;
  sets: number;
  /** For time-tracked exercises these are seconds. */
  rep_min: number;
  rep_max: number;
}

export interface WorkoutTemplate {
  id: SplitType;
  program: ProgramType;
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
}
