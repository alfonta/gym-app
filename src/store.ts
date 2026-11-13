import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { del, get as idbGet, keys as idbKeys, set as idbSet } from 'idb-keyval';
import type {
  ActiveItem, ActiveWorkout, BodyMeasurement, BodyweightEntry, Effort, SetLog, SplitType, UserProfile, Workout,
} from './types';
import { EQUIPMENT } from './data/equipment';
import { EXERCISES, EXERCISE_MAP } from './data/exercises';
import { TEMPLATE_MAP } from './data/programs';
import { resolveExercise } from './engine/alternatives';
import { best1RM, epley1RM, ymd } from './engine/calc';
import type { PastSession } from './engine/progression';

const USER_ID = 'local';
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

const idbStorage: StateStorage = {
  getItem: async (name) => (await idbGet<string>(name)) ?? null,
  setItem: (name, value) => idbSet(name, value),
  removeItem: (name) => del(name),
};

export interface WorkoutSummary {
  workout: Workout;
  sets: number;
  volume: number;
  prs: { exercise_id: string; weight_kg: number; reps: number }[];
}

interface Data {
  profile: UserProfile | null;
  equipment: Record<string, boolean>;
  workouts: Workout[];
  sets: SetLog[];
  bodyweight: BodyweightEntry[];
  measurements: BodyMeasurement[];
  active: ActiveWorkout | null;
}

interface Actions {
  saveProfile: (p: Omit<UserProfile, 'id'>) => void;
  setEquipment: (id: string, available: boolean) => void;
  startWorkout: (split: SplitType) => void;
  cancelWorkout: () => void;
  finishWorkout: () => WorkoutSummary | null;
  setCurrentIndex: (i: number) => void;
  editSet: (item: number, set: number, patch: { weight?: string; reps?: string }) => void;
  completeSet: (item: number, set: number, weight: number, reps: number) => boolean;
  uncompleteSet: (item: number, set: number) => void;
  addSet: (item: number) => void;
  removeSet: (item: number) => void;
  swapExercise: (item: number, exerciseId: string) => void;
  setEffort: (item: number, effort: Effort) => void;
  adjustRest: (deltaSeconds: number) => void;
  skipRest: () => void;
  logBodyweight: (weight: number, date?: string) => void;
  deleteBodyweight: (id: string) => void;
  saveMeasurement: (m: Omit<BodyMeasurement, 'id'>) => void;
  deleteMeasurement: (id: string) => void;
  deleteWorkout: (id: string) => void;
  replaceAll: (data: Partial<Data>) => void;
}

export type Store = Data & Actions;

const defaultEquipment = () => Object.fromEntries(EQUIPMENT.map((e) => [e.id, true]));

const initial: Data = {
  profile: null,
  equipment: defaultEquipment(),
  workouts: [],
  sets: [],
  bodyweight: [],
  measurements: [],
  active: null,
};

const mapItem = (a: ActiveWorkout, index: number, fn: (it: ActiveItem) => ActiveItem): ActiveWorkout => ({
  ...a,
  items: a.items.map((it, i) => (i === index ? fn(it) : it)),
});

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...initial,

      saveProfile: (p) => set((s) => ({ profile: { ...p, id: s.profile?.id ?? USER_ID } })),

      setEquipment: (id, available) => set((s) => ({ equipment: { ...s.equipment, [id]: available } })),

      startWorkout: (split) => {
        const tpl = TEMPLATE_MAP[split];
        const { equipment } = get();
        const used: string[] = [];
        const items: ActiveItem[] = [];
        for (const slot of tpl.slots) {
          // Equipment fallback: planned exercise, else best available alternative, else skip.
          const ex = resolveExercise(EXERCISE_MAP[slot.exercise_id], EXERCISES, equipment, used);
          if (!ex) continue;
          used.push(ex.id);
          items.push({
            planned_exercise_id: slot.exercise_id,
            exercise_id: ex.id,
            role: slot.role,
            rep_min: slot.rep_min,
            rep_max: slot.rep_max,
            sets: Array.from({ length: slot.sets }, () => ({ weight: '', reps: '', done: false, completed_at: null, is_pr: false })),
            effort: null,
          });
        }
        set({ active: { id: uid(), split_type: split, started_at: Date.now(), items, current_index: 0, rest: null } });
      },

      cancelWorkout: () => set({ active: null }),

      finishWorkout: () => {
        const { active } = get();
        if (!active) return null;
        const now = new Date();
        const workout: Workout = {
          id: active.id,
          user_id: USER_ID,
          date: new Date(active.started_at).toISOString(),
          split_type: active.split_type,
          total_duration_minutes: Math.max(1, Math.round((now.getTime() - active.started_at) / 60000)),
          efforts: {},
          wearable_sync_id: null,
          avg_heart_rate: null,
        };
        const logs: SetLog[] = [];
        const prs: WorkoutSummary['prs'] = [];
        let volume = 0;
        for (const item of active.items) {
          if (item.effort) workout.efforts[item.exercise_id] = item.effort;
          const timed = EXERCISE_MAP[item.exercise_id]?.tracking === 'time';
          item.sets.forEach((s) => {
            if (!s.done) return;
            const weight_kg = Number(s.weight) || 0;
            const reps = Number(s.reps) || 0;
            logs.push({
              id: uid(), workout_id: workout.id, exercise_id: item.exercise_id,
              weight_kg, reps, order_index: logs.length, is_pr: s.is_pr,
              completed_at: s.completed_at ?? now.toISOString(),
            });
            if (!timed) volume += weight_kg * reps;
            if (s.is_pr) prs.push({ exercise_id: item.exercise_id, weight_kg, reps });
          });
        }
        if (logs.length === 0) {
          set({ active: null });
          return null;
        }
        set((s) => ({ active: null, workouts: [...s.workouts, workout], sets: [...s.sets, ...logs] }));
        return { workout, sets: logs.length, volume: Math.round(volume), prs };
      },

      setCurrentIndex: (i) => set((s) => (s.active ? { active: { ...s.active, current_index: Math.max(0, Math.min(s.active.items.length - 1, i)) } } : {})),

      editSet: (item, setIdx, patch) =>
        set((s) => (s.active ? { active: mapItem(s.active, item, (it) => ({ ...it, sets: it.sets.map((x, i) => (i === setIdx ? { ...x, ...patch } : x)) })) } : {})),

      completeSet: (item, setIdx, weight, reps) => {
        const { active, sets } = get();
        if (!active) return false;
        const it = active.items[item];
        const ex = EXERCISE_MAP[it.exercise_id];
        // PR = new best estimated 1RM, only once there is history to beat.
        let isPr = false;
        if (ex.tracking === 'weight_reps' && weight > 0) {
          const prior = best1RM(sets.filter((x) => x.exercise_id === ex.id));
          const today = best1RM(it.sets.filter((x, i) => x.done && i !== setIdx).map((x) => ({ weight_kg: Number(x.weight), reps: Number(x.reps) })));
          isPr = prior > 0 && epley1RM(weight, reps) > Math.max(prior, today) + 1e-6;
        }
        const next = mapItem(active, item, (cur) => ({
          ...cur,
          sets: cur.sets.map((x, i) =>
            i === setIdx ? { weight: String(weight), reps: String(reps), done: true, completed_at: new Date().toISOString(), is_pr: isPr } : x),
        }));
        const allDone = next.items.every((i) => i.sets.every((x) => x.done));
        set({
          active: {
            ...next,
            rest: allDone ? null : { ends_at: Date.now() + ex.rest_time_seconds * 1000, total_seconds: ex.rest_time_seconds },
          },
        });
        return isPr;
      },

      uncompleteSet: (item, setIdx) =>
        set((s) => (s.active
          ? { active: mapItem(s.active, item, (it) => ({ ...it, sets: it.sets.map((x, i) => (i === setIdx ? { ...x, done: false, completed_at: null, is_pr: false } : x)) })) }
          : {})),

      addSet: (item) =>
        set((s) => (s.active
          ? { active: mapItem(s.active, item, (it) => ({ ...it, sets: [...it.sets, { weight: '', reps: '', done: false, completed_at: null, is_pr: false }] })) }
          : {})),

      removeSet: (item) =>
        set((s) => (s.active
          ? { active: mapItem(s.active, item, (it) => (it.sets.length > 1 ? { ...it, sets: it.sets.slice(0, -1) } : it)) }
          : {})),

      swapExercise: (item, exerciseId) =>
        set((s) => (s.active
          ? {
            active: mapItem(s.active, item, (it) => ({
              ...it,
              exercise_id: exerciseId,
              effort: null,
              sets: it.sets.map(() => ({ weight: '', reps: '', done: false, completed_at: null, is_pr: false })),
            })),
          }
          : {})),

      setEffort: (item, effort) => set((s) => (s.active ? { active: mapItem(s.active, item, (it) => ({ ...it, effort })) } : {})),

      adjustRest: (delta) =>
        set((s) => {
          if (!s.active?.rest) return {};
          const r = s.active.rest;
          const ends_at = Math.max(Date.now(), r.ends_at) + delta * 1000;
          return { active: { ...s.active, rest: { ends_at, total_seconds: Math.max(1, r.total_seconds + delta) } } };
        }),

      skipRest: () => set((s) => (s.active ? { active: { ...s.active, rest: null } } : {})),

      logBodyweight: (weight, date = ymd(new Date())) =>
        set((s) => ({
          bodyweight: [...s.bodyweight.filter((b) => b.date !== date), { id: uid(), date, weight_kg: weight }]
            .sort((a, b) => a.date.localeCompare(b.date)),
          profile: s.profile && date >= (s.bodyweight.at(-1)?.date ?? '') ? { ...s.profile, current_weight: weight } : s.profile,
        })),

      deleteBodyweight: (id) => set((s) => ({ bodyweight: s.bodyweight.filter((b) => b.id !== id) })),

      saveMeasurement: (m) =>
        set((s) => ({ measurements: [...s.measurements, { ...m, id: uid() }].sort((a, b) => a.date.localeCompare(b.date)) })),

      deleteMeasurement: (id) => {
        const m = get().measurements.find((x) => x.id === id);
        if (m?.photo_front_url) void deletePhoto(m.photo_front_url);
        if (m?.photo_back_url) void deletePhoto(m.photo_back_url);
        set((s) => ({ measurements: s.measurements.filter((x) => x.id !== id) }));
      },

      deleteWorkout: (id) => set((s) => ({ workouts: s.workouts.filter((w) => w.id !== id), sets: s.sets.filter((x) => x.workout_id !== id) })),

      replaceAll: (data) => set({ ...initial, ...data, equipment: { ...defaultEquipment(), ...(data.equipment ?? {}) }, active: null }),
    }),
    {
      name: 'gym-app-v1',
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Data>;
        return { ...current, ...p, equipment: { ...defaultEquipment(), ...(p.equipment ?? {}) } };
      },
    },
  ),
);

// ───── Selectors ─────

/** Past sessions of one exercise, newest first, for ghost text and progression. */
export function historyFor(exerciseId: string, workouts: Workout[], sets: SetLog[]): PastSession[] {
  const byWorkout = new Map<string, SetLog[]>();
  for (const s of sets) {
    if (s.exercise_id !== exerciseId) continue;
    const arr = byWorkout.get(s.workout_id) ?? [];
    arr.push(s);
    byWorkout.set(s.workout_id, arr);
  }
  return workouts
    .filter((w) => byWorkout.has(w.id))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((w) => ({
      sets: byWorkout.get(w.id)!.sort((a, b) => a.order_index - b.order_index).map((s) => ({ weight_kg: s.weight_kg, reps: s.reps })),
      effort: w.efforts?.[exerciseId] ?? null,
    }));
}

// ───── Photos (kept out of the main state blob) ─────

const photoKey = (id: string) => `photo:${id}`;

export async function savePhoto(dataUrl: string): Promise<string> {
  const id = uid();
  await idbSet(photoKey(id), dataUrl);
  return id;
}
export const loadPhoto = (id: string) => idbGet<string>(photoKey(id));
export const deletePhoto = (id: string) => del(photoKey(id));

// ───── Backup ─────

export async function exportBackup(): Promise<string> {
  const s = useStore.getState();
  const photos: Record<string, string> = {};
  for (const k of await idbKeys()) {
    if (typeof k === 'string' && k.startsWith('photo:')) photos[k] = (await idbGet<string>(k)) ?? '';
  }
  const data: Data = {
    profile: s.profile, equipment: s.equipment, workouts: s.workouts, sets: s.sets,
    bodyweight: s.bodyweight, measurements: s.measurements, active: null,
  };
  return JSON.stringify({ app: 'gym-app', version: 1, exported_at: new Date().toISOString(), data, photos });
}

export async function importBackup(json: string): Promise<void> {
  const parsed = JSON.parse(json);
  if (parsed?.app !== 'gym-app' || !parsed.data) throw new Error('קובץ הגיבוי אינו תקין');
  for (const [k, v] of Object.entries(parsed.photos ?? {})) {
    if (k.startsWith('photo:') && typeof v === 'string') await idbSet(k, v);
  }
  useStore.getState().replaceAll(parsed.data);
}
