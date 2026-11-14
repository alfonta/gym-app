import { describe, expect, it } from 'vitest';
import { EXERCISES, EXERCISE_MAP } from '../data/exercises';
import { EQUIPMENT } from '../data/equipment';
import { TEMPLATES, nextTemplate } from '../data/programs';
import { getAlternatives, isExerciseAvailable, resolveExercise } from './alternatives';
import { suggestNext, warmupSets } from './progression';
import { calcPlates, epley1RM, estimateMinutes, formatClock, gainStatus, nutritionTargets, weeklyRate, weeklyVolume, weightTrend } from './calc';

const allOn = Object.fromEntries(EQUIPMENT.map((e) => [e.id, true]));

describe('data integrity', () => {
  it('every exercise references known equipment', () => {
    const ids = new Set(EQUIPMENT.map((e) => e.id));
    for (const ex of EXERCISES) for (const id of ex.equipment_ids) expect(ids.has(id), `${ex.id}:${id}`).toBe(true);
  });
  it('every template slot references a known exercise', () => {
    for (const t of TEMPLATES) for (const s of t.slots) expect(EXERCISE_MAP[s.exercise_id], s.exercise_id).toBeTruthy();
  });
  it('templates follow anchor + 4-5 accessories + core finisher', () => {
    for (const t of TEMPLATES) {
      expect(t.slots.filter((s) => s.role === 'anchor')).toHaveLength(1);
      const acc = t.slots.filter((s) => s.role === 'accessory').length;
      expect(acc).toBeGreaterThanOrEqual(4);
      expect(acc).toBeLessThanOrEqual(5);
      const core = t.slots.filter((s) => s.role === 'core');
      expect(core.length).toBeGreaterThanOrEqual(2);
      for (const c of core) expect(EXERCISE_MAP[c.exercise_id].is_core).toBe(true);
    }
  });
  it('unique exercise ids', () => {
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
  });
});

describe('alternatives / equipment fallback', () => {
  const bench = EXERCISE_MAP.bench_press;
  it('returns up to 3 same-muscle alternatives, best pattern match first', () => {
    const alts = getAlternatives(bench, EXERCISES, allOn);
    expect(alts).toHaveLength(3);
    for (const a of alts) expect(a.muscle_group).toBe('chest');
    expect(alts[0].pattern).toBe('h_push');
    expect(alts.map((a) => a.id)).not.toContain('bench_press');
  });
  it('filters out exercises whose equipment is unavailable', () => {
    const av = { ...allOn, dumbbells: false, smith: false };
    const alts = getAlternatives(bench, EXERCISES, av, [], 20);
    for (const a of alts) expect(isExerciseAvailable(a, av)).toBe(true);
    expect(alts.map((a) => a.id)).not.toContain('db_bench_press');
  });
  it('resolveExercise keeps the planned exercise when available', () => {
    expect(resolveExercise(bench, EXERCISES, allOn)?.id).toBe('bench_press');
  });
  it('resolveExercise falls back when a required piece is missing', () => {
    const r = resolveExercise(bench, EXERCISES, { ...allOn, barbell: false });
    expect(r).not.toBeNull();
    expect(r!.id).not.toBe('bench_press');
    expect(r!.equipment_ids).not.toContain('barbell');
  });
  it('returns null when nothing for that muscle is available', () => {
    const calf = EXERCISE_MAP.standing_calf_raise;
    const av = { ...allOn, calf_machine: false, leg_press: false, dumbbells: false };
    expect(resolveExercise(calf, EXERCISES, av)).toBeNull();
  });
  it('core swaps stay core', () => {
    for (const a of getAlternatives(EXERCISE_MAP.plank, EXERCISES, allOn)) expect(a.is_core).toBe(true);
  });
});

describe('progression', () => {
  const bench = EXERCISE_MAP.bench_press;
  const s = (w: number, ...reps: number[]) => reps.map((r) => ({ weight_kg: w, reps: r }));
  it('no history → no suggestion', () => {
    expect(suggestNext(bench, 6, 10, [])).toBeNull();
  });
  it('all sets at top of range → increase by the exercise increment', () => {
    const r = suggestNext(bench, 6, 10, [{ sets: s(60, 10, 10, 10), effort: 'ok' }])!;
    expect(r.action).toBe('increase');
    expect(r.weight_kg).toBe(62.5);
    expect(r.target_reps).toBe(6);
  });
  it('squat increases by 5', () => {
    const r = suggestNext(EXERCISE_MAP.squat, 6, 10, [{ sets: s(80, 10, 10, 10, 10), effort: null }])!;
    expect(r.weight_kg).toBe(85);
  });
  it('top of range but rated hard → hold', () => {
    expect(suggestNext(bench, 6, 10, [{ sets: s(60, 10, 10, 10), effort: 'hard' }])!.action).toBe('hold');
  });
  it('one rep short but rated easy → increase', () => {
    expect(suggestNext(bench, 6, 10, [{ sets: s(60, 10, 9, 9), effort: 'easy' }])!.action).toBe('increase');
  });
  it('mid range → hold and aim for one more rep', () => {
    const r = suggestNext(bench, 6, 10, [{ sets: s(60, 8, 8, 7), effort: 'ok' }])!;
    expect(r.action).toBe('hold');
    expect(r.weight_kg).toBe(60);
    expect(r.target_reps).toBe(8);
  });
  it('two failed sessions at the same weight → ~10% deload', () => {
    const r = suggestNext(bench, 6, 10, [
      { sets: s(60, 5, 4, 4), effort: 'hard' },
      { sets: s(60, 5, 5, 4), effort: 'hard' },
    ])!;
    expect(r.action).toBe('decrease');
    expect(r.weight_kg).toBe(55);
  });
  it('a workout cut short does not trigger an increase', () => {
    expect(suggestNext(bench, 6, 10, [{ sets: s(60, 10), effort: 'ok' }], 4)!.action).toBe('hold');
    expect(suggestNext(bench, 6, 10, [{ sets: s(60, 10, 10, 10), effort: 'ok' }], 4)!.action).toBe('increase');
  });
  it('a single failed session only holds', () => {
    expect(suggestNext(bench, 6, 10, [{ sets: s(60, 5, 4, 4), effort: 'hard' }])!.action).toBe('hold');
  });
  it('timed exercise progresses in seconds, never in weight', () => {
    const r = suggestNext(EXERCISE_MAP.plank, 30, 60, [{ sets: s(0, 40, 35), effort: null }])!;
    expect(r.weight_kg).toBe(0);
    expect(r.target_reps).toBe(40);
  });
  it('warmup ramps up to the working weight', () => {
    expect(warmupSets(100, 20).map((x) => x.weight_kg)).toEqual([50, 70, 85]);
    expect(warmupSets(25, 20)).toEqual([]);
  });
});

describe('calc', () => {
  const plates = [25, 20, 15, 10, 5, 2.5, 1.25];
  it('plates for 100kg', () => {
    expect(calcPlates(100, 20, plates)).toEqual({ perSide: [25, 15], remainder: 0, achievable: 100 });
  });
  it('plates for 62.5kg', () => {
    expect(calcPlates(62.5, 20, plates).perSide).toEqual([20, 1.25]);
  });
  it('reports remainder when not loadable', () => {
    const r = calcPlates(61, 20, plates);
    expect(r.remainder).toBeGreaterThan(0);
    expect(r.achievable).toBe(60);
  });
  it('bar only / below bar', () => {
    expect(calcPlates(20, 20, plates).perSide).toEqual([]);
    expect(calcPlates(10, 20, plates).perSide).toEqual([]);
  });
  it('respects the plates the gym actually has', () => {
    expect(calcPlates(70, 20, [20, 10, 5]).perSide).toEqual([20, 5]);
  });
  it('epley', () => {
    expect(epley1RM(100, 1)).toBe(100);
    expect(epley1RM(60, 10)).toBeCloseTo(80);
    expect(epley1RM(0, 10)).toBe(0);
  });
  it('nutrition for the starting profile is sane', () => {
    const n = nutritionTargets(70, 182, 30, 'male', 76);
    expect(n.calories).toBeGreaterThan(2600);
    expect(n.calories).toBeLessThan(3200);
    expect(n.protein).toBe(125);
  });
  it('weekly volume buckets by Sunday-based week and skips timed sets', () => {
    const now = new Date(2026, 10, 13); // Friday
    const w = [{ id: 'w1', date: new Date(2026, 10, 9).toISOString() }, { id: 'w2', date: new Date(2026, 10, 3).toISOString() }] as never;
    const sets = [
      { workout_id: 'w1', exercise_id: 'bench_press', weight_kg: 60, reps: 10 },
      { workout_id: 'w1', exercise_id: 'plank', weight_kg: 0, reps: 45 },
      { workout_id: 'w2', exercise_id: 'squat', weight_kg: 80, reps: 5 },
    ] as never;
    const v = weeklyVolume(w, sets, new Set(['plank']), 4, now);
    expect(v).toHaveLength(4);
    expect(v[3]).toEqual({ week: '2026-11-08', volume: 600 });
    expect(v[2]).toEqual({ week: '2026-11-01', volume: 400 });
  });
  it('weight trend is a 7-day trailing mean', () => {
    const t = weightTrend([
      { id: 'a', date: '2026-11-01', weight_kg: 70 },
      { id: 'b', date: '2026-11-02', weight_kg: 71 },
      { id: 'c', date: '2026-11-12', weight_kg: 72 },
    ]);
    expect(t.map((x) => x.trend)).toEqual([70, 70.5, 72]);
  });
  it('nutrition without a target weight assumes a lean gain', () => {
    expect(nutritionTargets(70, 182, 30, 'male', null)).toEqual(nutritionTargets(70, 182, 30, 'male', 76));
  });
  it('weekly rate needs at least a week of data', () => {
    const e = (date: string, weight_kg: number) => ({ id: date, date, weight_kg });
    expect(weeklyRate(weightTrend([e('2026-11-01', 70), e('2026-11-05', 70.2)]))).toBeNull();
    const r = weeklyRate(weightTrend([e('2026-11-01', 70), e('2026-11-08', 70.35), e('2026-11-15', 70.7)]))!;
    expect(r.kg_per_week).toBeCloseTo(0.35, 2);
    expect(r.pct_per_week).toBeCloseTo(0.5, 1);
  });
  it('gain status follows the 0.25–0.5% per week guideline', () => {
    expect(gainStatus(0)).toBe('slow');
    expect(gainStatus(0.3)).toBe('good');
    expect(gainStatus(0.9)).toBe('fast');
  });
  it('session estimate lands in the 60–90 minute target for the programs', () => {
    for (const t of TEMPLATES) {
      const m = estimateMinutes(t.slots.map((sl) => ({ sets: sl.sets, rest_seconds: EXERCISE_MAP[sl.exercise_id].rest_time_seconds, is_core: EXERCISE_MAP[sl.exercise_id].is_core })));
      expect(m, t.id).toBeGreaterThanOrEqual(50);
      expect(m, t.id).toBeLessThanOrEqual(90);
    }
  });
  it('clock', () => {
    expect(formatClock(75)).toBe('01:15');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatClock(-3)).toBe('00:00');
  });
});

describe('rotation', () => {
  it('cycles within the chosen program', () => {
    expect(nextTemplate('ppl', null).id).toBe('push');
    expect(nextTemplate('ppl', 'push').id).toBe('pull');
    expect(nextTemplate('ppl', 'legs').id).toBe('push');
    expect(nextTemplate('full_body', 'full_a').id).toBe('full_b');
    expect(nextTemplate('full_body', 'legs').id).toBe('full_a');
  });
});
