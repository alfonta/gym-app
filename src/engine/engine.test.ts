import { describe, expect, it } from 'vitest';
import { EXERCISES, EXERCISE_MAP } from '../data/exercises';
import { EQUIPMENT } from '../data/equipment';
import { PRESETS, TEMPLATES, advanceRotation, initialRotation, scheduleOf, weekPointer, weekStartMode } from '../data/programs';
import { recoverActive } from '../store';
import { formatMinutes, lastActivity, overdueState, usualMinutes } from './overdue';
import { applyVariety } from './variety';
import { buildWorkout, suggestMore } from './builder';
import { workoutFeedback, type FeedbackItem } from './feedback';
import { estimateCalories } from '../components/CardioForm';
import { applyInjuries, isBlocked, stress } from './injury';
import { getAlternatives, isExerciseAvailable, resolveExercise } from './alternatives';
import { suggestNext, warmupSets } from './progression';
import { exerciseProgress, recomputePRs, workoutText, workoutVolume } from './calc';
import { buildCatalog, defaultSlot, getTemplate, videoLink } from './catalog';
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

describe('weekly schedule and rotation', () => {
  it('presets only reference existing workouts', () => {
    const ids = new Set(TEMPLATES.map((t) => t.id));
    for (const seq of Object.values(PRESETS)) for (const id of seq) expect(ids.has(id), id).toBe(true);
  });
  it('lower-body focus has two lower days out of three', () => {
    expect(PRESETS.lower_focus.filter((id) => id.startsWith('lower'))).toHaveLength(2);
    expect(PRESETS.lower_focus).toHaveLength(3);
  });
  it('schedule falls back to the preset and ignores unknown ids', () => {
    expect(scheduleOf({ program: 'ppl' })).toEqual(['push', 'pull', 'legs']);
    expect(scheduleOf({ program: 'custom', schedule: ['lower_a', 'lower_b'] })).toEqual(['lower_a', 'lower_b']);
    expect(scheduleOf({ program: 'custom', schedule: ['nope' as never] })).toEqual(['push', 'pull', 'legs']);
  });
  it('resumes after the last workout done', () => {
    expect(initialRotation(['push', 'pull', 'legs'], null)).toBe(0);
    expect(initialRotation(['push', 'pull', 'legs'], 'push')).toBe(1);
    expect(initialRotation(['push', 'pull', 'legs'], 'legs')).toBe(0);
    expect(initialRotation(['push', 'pull', 'legs'], 'full_a')).toBe(0);
  });
  it('advances in order and wraps', () => {
    const s = PRESETS.upper_lower;
    let i = 0;
    const seen: string[] = [];
    for (let k = 0; k < 5; k++) { seen.push(s[i]); i = advanceRotation(s, i, s[i]); }
    expect(seen).toEqual(['upper_a', 'lower_a', 'upper_b', 'lower_b', 'upper_a']);
  });
  it('handles the same workout twice in a week', () => {
    const s = ['lower_a', 'upper_a', 'lower_a'] as const;
    let i = 0;
    i = advanceRotation([...s], i, 'lower_a'); expect(i).toBe(1);
    i = advanceRotation([...s], i, 'upper_a'); expect(i).toBe(2);
    i = advanceRotation([...s], i, 'lower_a'); expect(i).toBe(0);
  });
  it('doing a later workout early skips ahead; a bonus day does not move the pointer', () => {
    expect(advanceRotation(['push', 'pull', 'legs'], 0, 'pull')).toBe(2);
    expect(advanceRotation(['push', 'pull', 'legs'], 1, 'full_a')).toBe(1);
  });
});

describe('variety between rounds', () => {
  const cat = buildCatalog([]);
  it('even rounds are the base plan, and round 2 equals round 0', () => {
    for (const t of TEMPLATES) {
      expect(applyVariety(t.slots, 0, cat, allOn)).toEqual(t.slots);
      expect(applyVariety(t.slots, 2, cat, allOn)).toEqual(t.slots);
    }
  });
  it('odd rounds change at least two exercises but never the anchor', () => {
    for (const t of TEMPLATES) {
      const v = applyVariety(t.slots, 1, cat, allOn);
      expect(v).toHaveLength(t.slots.length);
      expect(v[0]).toEqual(t.slots[0]);
      const changed = v.filter((s, i) => s.exercise_id !== t.slots[i].exercise_id).length;
      expect(changed, t.id).toBeGreaterThanOrEqual(3);
      expect(new Set(v.map((s) => s.exercise_id)).size, t.id).toBe(v.length);
    }
  });
  it('replacements keep the muscle, the tracking type and the prescription', () => {
    for (const t of TEMPLATES) {
      applyVariety(t.slots, 1, cat, allOn).forEach((s, i) => {
        const a = EXERCISE_MAP[t.slots[i].exercise_id], b = EXERCISE_MAP[s.exercise_id];
        expect(b.muscle_group).toBe(a.muscle_group);
        expect(b.tracking === 'time').toBe(a.tracking === 'time');
        if (!a.is_core) expect(b.tracking).toBe(a.tracking);
        expect([s.sets, s.rep_min, s.rep_max, s.role]).toEqual([t.slots[i].sets, t.slots[i].rep_min, t.slots[i].rep_max, t.slots[i].role]);
      });
    }
  });
  it('only uses equipment the gym has', () => {
    const av = { ...allOn, cable: false, dumbbells: false };
    for (const t of TEMPLATES) {
      applyVariety(t.slots, 1, cat, av).forEach((s, i) => {
        if (s.exercise_id !== t.slots[i].exercise_id) expect(isExerciseAvailable(EXERCISE_MAP[s.exercise_id], av)).toBe(true);
      });
    }
  });
});

describe('derived data after editing history', () => {
  const W = (id: string, day: number) => ({ id, date: new Date(2026, 10, day).toISOString(), split_type: 'push', total_duration_minutes: 60, efforts: {}, user_id: 'u', wearable_sync_id: null, avg_heart_rate: null }) as never;
  const S = (id: string, workout_id: string, order_index: number, weight_kg: number, reps: number, exercise_id = 'bench_press', is_pr = false) =>
    ({ id, workout_id, exercise_id, weight_kg, reps, order_index, is_pr, completed_at: '' });
  const weighted = (id: string) => EXERCISE_MAP[id]?.tracking === 'weight_reps';
  const workouts = [W('w1', 1), W('w2', 3), W('w3', 5)];

  it('flags only genuine new bests, never the first workout', () => {
    const sets = [S('a', 'w1', 0, 60, 10), S('b', 'w2', 0, 62.5, 10), S('c', 'w2', 1, 62.5, 10), S('d', 'w3', 0, 60, 10)];
    const r = recomputePRs(workouts, sets, weighted);
    expect(r.map((x) => x.is_pr)).toEqual([false, true, false, false]);
  });
  it('correcting a typo removes the false PR and restores the real one', () => {
    // w2 was logged as 625 instead of 62.5 → it and nothing after it could be a PR
    const typo = [S('a', 'w1', 0, 60, 10), S('b', 'w2', 0, 625, 10, 'bench_press', true), S('d', 'w3', 0, 65, 10)];
    expect(recomputePRs(workouts, typo, weighted).map((x) => x.is_pr)).toEqual([false, true, false]);
    const fixed = typo.map((x) => (x.id === 'b' ? { ...x, weight_kg: 62.5 } : x));
    expect(recomputePRs(workouts, fixed, weighted).map((x) => x.is_pr)).toEqual([false, true, true]);
  });
  it('deleting the workout that held the record promotes the next one', () => {
    const sets = [S('a', 'w1', 0, 60, 10), S('d', 'w3', 0, 61, 10)];
    expect(recomputePRs([workouts[0], workouts[2]], sets, weighted).map((x) => x.is_pr)).toEqual([false, true]);
  });
  it('timed and bodyweight sets are never PRs; input order does not matter', () => {
    const sets = [S('p2', 'w2', 0, 0, 90, 'plank'), S('p1', 'w1', 0, 0, 40, 'plank'), S('b', 'w2', 1, 70, 8), S('a', 'w1', 1, 60, 8)];
    const r = recomputePRs(workouts, sets, weighted);
    expect(Object.fromEntries(r.map((x) => [x.id, x.is_pr]))).toEqual({ p2: false, p1: false, b: true, a: false });
  });
  it('volume ignores timed sets', () => {
    expect(workoutVolume([S('a', 'w1', 0, 60, 10), S('p', 'w1', 1, 0, 45, 'plank')], (id) => id === 'plank')).toBe(600);
  });
  it('per-exercise progress: one point per workout, oldest first', () => {
    const sets = [S('d', 'w3', 0, 65, 8), S('a', 'w1', 0, 60, 10), S('a2', 'w1', 1, 60, 8)];
    const p = exerciseProgress(EXERCISE_MAP.bench_press, workouts, sets);
    expect(p).toHaveLength(2);
    expect(p[0]).toMatchObject({ top_weight: 60, top_reps: 10, value: 80 });
    expect(p[1].top_weight).toBe(65);
  });
  it('share text lists exercises, sets and volume', () => {
    const t = workoutText('אימון Push', workouts[0], [S('a', 'w1', 0, 60, 10), S('p', 'w1', 1, 0, 45, 'plank')], buildCatalog([]).get);
    expect(t).toContain('לחיצת חזה עם מוט: 60×10');
    expect(t).toContain('פלאנק: 45 שנ׳');
    expect(t).toContain('נפח כולל: 600');
  });
});

describe('catalog', () => {
  const custom = { ...EXERCISE_MAP.db_curl, id: 'custom_1', name: 'כפיפה בכבל גבוה', is_custom: true, media_urls: [] };
  it('custom exercises join the catalog and the alternatives', () => {
    const cat = buildCatalog([custom]);
    expect(cat.get('custom_1').name).toBe('כפיפה בכבל גבוה');
    expect(getAlternatives(EXERCISE_MAP.barbell_curl, cat.all, allOn, [], 50).map((e) => e.id)).toContain('custom_1');
  });
  it('archived custom exercises resolve for history but are not offered', () => {
    const cat = buildCatalog([{ ...custom, archived: true }]);
    expect(cat.get('custom_1').name).toBe('כפיפה בכבל גבוה');
    expect(cat.all.map((e) => e.id)).not.toContain('custom_1');
  });
  it('unknown ids never crash', () => {
    expect(buildCatalog([]).get('nope').name).toBe('תרגיל שנמחק');
  });
  it('template overrides replace slots without touching the base', () => {
    const slots = [defaultSlot(EXERCISE_MAP.squat)];
    expect(getTemplate('push', { push: slots }).slots).toEqual(slots);
    expect(getTemplate('push', {}).slots.length).toBe(9);
    expect(getTemplate('pull', { push: slots }).slots.length).toBe(9);
  });
  it('default slot fits the exercise type', () => {
    expect(defaultSlot(EXERCISE_MAP.plank)).toMatchObject({ role: 'core', rep_min: 30, rep_max: 60 });
    expect(defaultSlot(EXERCISE_MAP.squat)).toMatchObject({ role: 'accessory', sets: 3 });
  });
  it('video link is a search unless the user supplied a URL', () => {
    expect(videoLink(EXERCISE_MAP.squat)).toMatchObject({ isSearch: true });
    expect(videoLink(EXERCISE_MAP.squat)!.url).toContain('Barbell%20Squat');
    expect(videoLink({ ...custom, video_url: 'https://example.com/v' })).toEqual({ url: 'https://example.com/v', isSearch: false });
  });
});

describe('custom workout builder', () => {
  const cat = buildCatalog([]);
  const ex = (id: string) => EXERCISE_MAP[id];
  it('nothing requested → empty', () => {
    expect(buildWorkout({ muscles: [], exerciseIds: [], size: 6, core: false }, cat, allOn)).toEqual([]);
    expect(buildWorkout({ muscles: [], exerciseIds: [], size: 6, core: true }, cat, allOn)).toEqual([]);
  });
  it('builds a balanced session for the chosen muscles', () => {
    const slots = buildWorkout({ muscles: ['chest', 'back'], exerciseIds: [], size: 6, core: true }, cat, allOn);
    const main = slots.filter((s) => s.role !== 'core');
    expect(main).toHaveLength(6);
    expect(main.filter((s) => ex(s.exercise_id).muscle_group === 'chest')).toHaveLength(3);
    expect(main.filter((s) => ex(s.exercise_id).muscle_group === 'back')).toHaveLength(3);
    expect(slots.filter((s) => s.role === 'core')).toHaveLength(2);
    expect(slots[0].role).toBe('anchor');
    expect(ex(slots[0].exercise_id).is_compound).toBe(true);
    expect(slots.filter((s) => s.role === 'anchor')).toHaveLength(1);
    expect(new Set(slots.map((s) => s.exercise_id)).size).toBe(slots.length);
  });
  it('compounds come before isolation, core last', () => {
    const slots = buildWorkout({ muscles: ['quads', 'hamstrings', 'calves'], exerciseIds: [], size: 6, core: true }, cat, allOn);
    const kinds = slots.map((s) => (ex(s.exercise_id).is_core ? 2 : ex(s.exercise_id).is_compound ? 0 : 1));
    expect(kinds).toEqual([...kinds].sort());
  });
  it('requested exercises are always included, even beyond the size', () => {
    const want = ['lateral_raise', 'hammer_curl', 'face_pull', 'db_curl', 'cable_fly'];
    const slots = buildWorkout({ muscles: ['chest'], exerciseIds: want, size: 4, core: false }, cat, allOn);
    for (const id of want) expect(slots.map((s) => s.exercise_id)).toContain(id);
    expect(slots.some((s) => s.role === 'core')).toBe(false);
  });
  it('exercises only → uses exactly them when size is small', () => {
    const slots = buildWorkout({ muscles: [], exerciseIds: ['squat', 'plank'], size: 1, core: false }, cat, allOn);
    expect(slots.map((s) => s.exercise_id)).toEqual(['squat', 'plank']);
    expect(slots[0].role).toBe('anchor');
    expect(slots[1]).toMatchObject({ role: 'core', rep_min: 30 });
  });
  it('respects equipment and the allowed filter', () => {
    const av = { ...allOn, barbell: false };
    const slots = buildWorkout({ muscles: ['chest', 'quads'], exerciseIds: [], size: 6, core: false }, cat, av, (e) => e.pattern !== 'lunge');
    for (const s of slots) {
      expect(isExerciseAvailable(ex(s.exercise_id), av)).toBe(true);
      expect(ex(s.exercise_id).pattern).not.toBe('lunge');
    }
  });
  it('never stacks more than two exercises of one movement pattern', () => {
    for (const muscles of [['glutes', 'hamstrings'], ['shoulders'], ['biceps'], ['chest', 'triceps']] as const) {
      const slots = buildWorkout({ muscles: [...muscles], exerciseIds: [], size: 8, core: false }, cat, allOn);
      const count: Record<string, number> = {};
      for (const sl of slots) count[ex(sl.exercise_id).pattern] = (count[ex(sl.exercise_id).pattern] ?? 0) + 1;
      expect(Math.max(...Object.values(count)), muscles.join()).toBeLessThanOrEqual(2);
      expect(slots.length).toBeGreaterThanOrEqual(2);
    }
  });
  it('core only → a core session', () => {
    const slots = buildWorkout({ muscles: ['core'], exerciseIds: [], size: 4, core: false }, cat, allOn);
    expect(slots).toHaveLength(4);
    expect(slots.every((s) => s.role === 'core')).toBe(true);
  });
});

describe('injury mode', () => {
  const cat = buildCatalog([]);
  const tpl = (id: string) => TEMPLATES.find((t) => t.id === id)!.slots;
  it('no injuries → untouched', () => {
    const r = applyInjuries(tpl('legs'), {}, cat, allOn);
    expect(r.rows.map((x) => x.slot)).toEqual(tpl('legs'));
    expect(r.removed).toEqual([]);
  });
  it('avoid: nothing left loads the area heavily, in any workout of any program', () => {
    for (const area of ['shoulder', 'elbow', 'wrist', 'lower_back', 'knee', 'hip', 'ankle'] as const) {
      for (const t of TEMPLATES) {
        const r = applyInjuries(t.slots, { [area]: 'avoid' }, cat, allOn);
        for (const row of r.rows) expect(stress(EXERCISE_MAP[row.slot.exercise_id], area), `${area}/${t.id}/${row.slot.exercise_id}`).toBeLessThan(2);
        for (const row of r.rows.filter((x) => x.status === 'replaced')) expect(stress(EXERCISE_MAP[row.slot.exercise_id], area)).toBe(0);
        expect(r.rows.length + r.removed.length).toBe(t.slots.length);
        expect(new Set(r.rows.map((x) => x.slot.exercise_id)).size).toBe(r.rows.length);
      }
    }
  });
  it('knee to avoid: squats, lunges and leg extensions are gone from leg day, hamstrings stay', () => {
    const r = applyInjuries(tpl('legs'), { knee: 'avoid' }, cat, allOn);
    const ids = r.rows.map((x) => x.slot.exercise_id);
    expect(ids).not.toContain('squat');
    expect(ids).not.toContain('leg_extension');
    expect(ids).toContain('rdl');
    expect(ids).toContain('lying_leg_curl');
    expect(r.removed).toContain('leg_extension');
  });
  it('reduce: stressed exercises get fewer sets, lighter rep range and a caution flag', () => {
    const r = applyInjuries(tpl('push'), { shoulder: 'reduce' }, cat, allOn);
    const bench = r.rows.find((x) => x.slot.exercise_id === 'bench_press')!;
    expect(bench.status).toBe('reduced');
    expect(bench.slot).toMatchObject({ sets: 3, rep_min: 8, rep_max: 13, caution: true });
    expect(r.removed).toEqual([]);
    expect(r.rows).toHaveLength(tpl('push').length);
    // Untouched exercises carry no flag.
    expect(r.rows.find((x) => x.slot.exercise_id === 'plank')!.slot.caution).toBeUndefined();
  });
  it('reduce: a heavy-stress exercise is swapped for a gentler one of the same muscle', () => {
    const r = applyInjuries(tpl('push'), { shoulder: 'reduce' }, cat, allOn);
    const row = r.rows.find((x) => x.from === 'db_shoulder_press');
    if (row) {
      expect(EXERCISE_MAP[row.slot.exercise_id].muscle_group).toBe('shoulders');
      expect(stress(EXERCISE_MAP[row.slot.exercise_id], 'shoulder')).toBeLessThan(2);
    } else {
      expect(r.rows.find((x) => x.slot.exercise_id === 'db_shoulder_press')!.status).toBe('reduced');
    }
  });
  it('unrelated workouts are not affected', () => {
    const r = applyInjuries(tpl('legs'), { elbow: 'avoid', wrist: 'avoid' }, cat, allOn);
    expect(r.rows.filter((x) => x.status !== 'ok').map((x) => x.slot.exercise_id).filter((id) => !EXERCISE_MAP[id].is_core)).toEqual([]);
  });
  it('isBlocked only for avoided areas', () => {
    expect(isBlocked(EXERCISE_MAP.squat, { knee: 'avoid' })).toBe(true);
    expect(isBlocked(EXERCISE_MAP.squat, { knee: 'reduce' })).toBe(false);
    expect(isBlocked(EXERCISE_MAP.squat, {})).toBe(false);
  });
});

describe('end-of-workout feedback', () => {
  const s = (w: number, ...reps: number[]) => reps.map((r) => ({ weight_kg: w, reps: r }));
  const item = (id: string, done: ReturnType<typeof s>, prev: ReturnType<typeof s> | null, over: Partial<FeedbackItem> = {}): FeedbackItem => ({
    ex: EXERCISE_MAP[id], rep_min: 8, rep_max: 12, planned_sets: 3, done, effort: 'ok', caution: false,
    history: prev ? [{ sets: prev, effort: 'ok' }] : [], ...over,
  });
  const fb = (items: FeedbackItem[], prs = 0, volume = 1000, prevVolume: number | null = 1000) => workoutFeedback(items, { prs, volume, prevVolume });

  it('first ever workout is a baseline, not a judgement', () => {
    const r = fb([item('bench_press', s(40, 10, 9, 8), null), item('lat_pulldown', s(35, 10, 10, 9), null)], 0, 1000, null);
    expect(r.verdict).toBe('baseline');
    expect(r.exercises.every((e) => e.trend === 'new')).toBe(true);
  });
  it('most exercises improved → strong', () => {
    const r = fb([
      item('bench_press', s(42.5, 10, 9, 8), s(40, 10, 9, 8)),
      item('lat_pulldown', s(35, 11, 11, 10), s(35, 10, 10, 9)),
      item('cable_fly', s(10, 12, 12, 12), s(10, 12, 12, 12)),
    ]);
    expect(r.verdict).toBe('strong');
    expect(r.exercises.map((e) => e.trend)).toEqual(['up', 'up', 'same']);
  });
  it('a PR makes it strong even if the rest is flat', () => {
    expect(fb([item('bench_press', s(40, 10, 9, 8), s(40, 10, 9, 8)), item('cable_fly', s(10, 12, 12, 12), s(10, 12, 12, 12))], 1).verdict).toBe('strong');
  });
  it('flat session → solid', () => {
    expect(fb([item('bench_press', s(40, 10, 9, 8), s(40, 10, 9, 8)), item('cable_fly', s(10, 12, 12, 11), s(10, 12, 12, 12))]).verdict).toBe('solid');
  });
  it('most exercises dropped → weak, with a recovery note', () => {
    const r = fb([
      item('bench_press', s(40, 7, 6, 5), s(40, 10, 9, 8)),
      item('lat_pulldown', s(30, 9, 8, 8), s(35, 10, 10, 9)),
      item('cable_fly', s(10, 12, 12, 12), s(10, 12, 12, 12)),
    ]);
    expect(r.verdict).toBe('weak');
    expect(r.notes.join(' ')).toContain('שינה');
  });
  it('less than 60% of the sets → partial, whatever the numbers', () => {
    const r = fb([item('bench_press', s(45, 12), s(40, 10, 9, 8)), item('lat_pulldown', [], s(35, 10, 10, 9))]);
    expect(r.verdict).toBe('partial');
    expect(r.completion).toBeCloseTo(1 / 6);
    // An exercise that was skipped entirely gets no advice.
    expect(r.exercises.map((e) => e.exercise_id)).toEqual(['bench_press']);
  });
  it('next step per exercise: increase, hold, decrease', () => {
    const r = fb([
      item('bench_press', s(40, 12, 12, 12), s(40, 11, 11, 10)),
      item('lat_pulldown', s(35, 10, 9, 9), s(35, 9, 9, 8)),
      item('cable_fly', s(10, 6, 5, 5), s(10, 7, 6, 5), { history: [{ sets: s(10, 7, 6, 5), effort: 'hard' }] }),
    ]);
    expect(r.exercises.map((e) => e.next)).toEqual(['increase', 'hold', 'decrease']);
    expect(r.exercises[0].message).toContain('42.5');
    expect(r.exercises[1].message).toContain('35');
  });
  it('top of range but rated too hard → hold, not increase', () => {
    expect(fb([item('bench_press', s(40, 12, 12, 12), s(40, 11, 11, 10), { effort: 'hard' })]).exercises[0].next).toBe('hold');
  });
  it('injury caution never recommends more load', () => {
    const r = fb([item('bench_press', s(40, 12, 12, 12), s(40, 11, 11, 10), { caution: true })]);
    expect(r.exercises[0].next).toBe('hold');
    expect(r.exercises[0].message).toContain('פציעה');
  });
  it('core work is left out of the per-exercise advice', () => {
    const r = fb([item('bench_press', s(40, 10, 9, 8), s(40, 10, 9, 8)), item('plank', s(0, 45, 40), s(0, 40, 35), { planned_sets: 2 })]);
    expect(r.exercises.map((e) => e.exercise_id)).toEqual(['bench_press']);
  });
  it('reports a clear change in total volume', () => {
    expect(fb([item('bench_press', s(40, 10, 9, 8), s(40, 10, 9, 8))], 0, 1200, 1000).volume_change_pct).toBe(20);
    expect(fb([item('bench_press', s(40, 10, 9, 8), s(40, 10, 9, 8))], 0, 1200, null).volume_change_pct).toBeNull();
  });
});

describe('cardio calories estimate', () => {
  it('scales with time and body weight, and running costs more than walking', () => {
    expect(estimateCalories('walk', 30, 70)).toBe(135);
    expect(estimateCalories('walk', 60, 70)).toBe(265);
    expect(estimateCalories('run', 30, 70)).toBeGreaterThan(estimateCalories('walk', 30, 70) * 2);
    expect(estimateCalories('bike', 30, 90)).toBeGreaterThan(estimateCalories('bike', 30, 60));
  });
});

describe('more exercises in today\'s style', () => {
  const cat = buildCatalog([]);
  const today = (id: string) => TEMPLATES.find((t) => t.id === id)!.slots.map((sl) => ({ ex: EXERCISE_MAP[sl.exercise_id], sets: sl.sets }));
  it('stays on today\'s muscles, skips what is already in the workout, no core when there is main work', () => {
    const cur = today('push');
    const out = suggestMore(cur, cat, allOn);
    const muscles = new Set(cur.filter((c) => !c.ex.is_core).map((c) => c.ex.muscle_group));
    expect(out.length).toBe(6);
    for (const e of out) {
      expect(muscles.has(e.muscle_group), e.id).toBe(true);
      expect(cur.some((c) => c.ex.id === e.id)).toBe(false);
      expect(e.is_core).toBe(false);
    }
    expect(new Set(out.map((e) => e.id)).size).toBe(out.length);
  });
  it('the muscle with the most sets comes first, and picks alternate between muscles', () => {
    const out = suggestMore(today('push'), cat, allOn);
    expect(out[0].muscle_group).toBe('chest');
    expect(out[1].muscle_group).not.toBe('chest');
  });
  it('prefers movement patterns not yet covered today', () => {
    const out = suggestMore(today('push'), cat, allOn);
    const chest = out.filter((e) => e.muscle_group === 'chest');
    // Push already has a flat press, an incline press and a fly.
    expect(chest[0].pattern).not.toBe('h_push');
  });
  it('respects equipment and the allowed filter', () => {
    const av = { ...allOn, cable: false, dumbbells: false };
    for (const e of suggestMore(today('pull'), cat, av, (x) => x.pattern !== 'v_pull')) {
      expect(isExerciseAvailable(e, av)).toBe(true);
      expect(e.pattern).not.toBe('v_pull');
    }
  });
  it('a core-only session gets more core', () => {
    const out = suggestMore([{ ex: EXERCISE_MAP.plank, sets: 2 }], cat, allOn, undefined, 3);
    expect(out).toHaveLength(3);
    expect(out.every((e) => e.is_core)).toBe(true);
  });
});

describe('weekly reset of the order', () => {
  const ppl = PRESETS.ppl;
  it('new week → day 1', () => {
    expect(weekPointer(ppl, [])).toBe(0);
  });
  it('follows this week\'s workouts in order', () => {
    expect(weekPointer(ppl, ['push'])).toBe(1);
    expect(weekPointer(ppl, ['push', 'pull'])).toBe(2);
    expect(weekPointer(ppl, ['push', 'pull', 'legs'])).toBe(0);
  });
  it('a skipped day is skipped; a bonus workout does not move it', () => {
    expect(weekPointer(ppl, ['pull'])).toBe(2);
    expect(weekPointer(ppl, ['full_a'])).toBe(0);
  });
  it('same workout twice in a week', () => {
    expect(weekPointer(PRESETS.lower_focus, ['lower_a', 'upper_a'])).toBe(2);
  });
});

describe('continue last week', () => {
  it('starts from where last week stopped and follows this week', () => {
    expect(weekPointer(PRESETS.ppl, [], 2)).toBe(2);
    expect(weekPointer(PRESETS.ppl, ['legs'], 2)).toBe(0);
    expect(weekPointer(PRESETS.ppl, ['legs', 'push'], 2)).toBe(1);
  });
  it('setting: default ask, old switch migrates', () => {
    expect(weekStartMode({})).toBe('ask');
    expect(weekStartMode({ weekly_reset: false })).toBe('continue');
    expect(weekStartMode({ weekly_reset: true })).toBe('ask');
    expect(weekStartMode({ week_start: 'new', weekly_reset: false })).toBe('new');
  });
});

describe('recovering the workout in progress after a reload', () => {
  const item = { planned_exercise_id: 'squat', exercise_id: 'squat', role: 'anchor', rep_min: 6, rep_max: 10, effort: null,
    sets: [{ weight: '60', reps: '8', done: true, completed_at: 'x', is_pr: false }] };
  const A = (id: string, done = 1) => ({ id, split_type: 'legs', started_at: 1, current_index: 0, rest: null,
    items: [{ ...item, sets: Array.from({ length: done }, () => item.sets[0]) }] }) as never;
  const none = new Set<string>();
  it('no data → nothing', () => expect(recoverActive(undefined, undefined, none)).toBeNull());
  it('database only', () => expect(recoverActive(A('w'), undefined, none)).toEqual(A('w')));
  it('the backup wins for the same workout (database write lost on reload)', () => {
    expect((recoverActive(A('w', 1), A('w', 3), none) as { items: { sets: unknown[] }[] }).items[0].sets).toHaveLength(3);
  });
  it('backup alone restores a workout the database never got', () => expect(recoverActive(null, A('w'), none)).toEqual(A('w')));
  it('a different newer workout in the backup wins', () => expect((recoverActive(A('old'), A('new'), none) as { id: string }).id).toBe('new'));
  it('backup "nothing in progress" does not discard an unsaved workout', () => expect(recoverActive(A('w'), null, none)).toEqual(A('w')));
  it('already saved as finished → not resurrected', () => expect(recoverActive(A('w'), A('w'), new Set(['w']))).toBeNull());
  it('repairs an out-of-range position and a broken rest timer', () => {
    const r = recoverActive({ ...(A('w') as object), current_index: 7, rest: { bogus: 1 } }, undefined, none) as { current_index: number; rest: unknown };
    expect(r.current_index).toBe(0);
    expect(r.rest).toBeNull();
  });
  it('an unreadable workout from another version is set aside, not crashed on', () => {
    expect(recoverActive({ id: 'w', items: 'nope' }, undefined, none)).toBeNull();
  });
});

describe('workout left open', () => {
  const T0 = new Date('2026-11-01T10:00:00').getTime();
  const min = (m: number) => T0 + m * 60000;
  const W = (mins: number[]) => mins.map((m, i) => ({ date: new Date(2026, 9, i + 1).toISOString(), total_duration_minutes: m }));
  const active = (doneAt: number[]) => ({
    id: 'a', split_type: 'push', started_at: T0, current_index: 0, rest: null,
    items: [{ planned_exercise_id: 'x', exercise_id: 'x', role: 'anchor', rep_min: 6, rep_max: 10, effort: null,
      sets: [...doneAt.map((m) => ({ weight: '40', reps: '10', done: true, completed_at: new Date(min(m)).toISOString(), is_pr: false })),
        { weight: '', reps: '', done: false, completed_at: null, is_pr: false }] }],
  }) as never;
  it('usual length: median of recent workouts, 75 until there are 3', () => {
    expect(usualMinutes(W([50, 60]))).toBe(75);
    expect(usualMinutes(W([50, 60, 200]))).toBe(60);
    expect(usualMinutes(W([50, 60, 70, 80]))).toBe(65);
  });
  it('last activity is the latest ticked set', () => {
    expect(lastActivity(active([5, 20, 12]))).toBe(min(20));
    expect(lastActivity(active([]))).toBe(T0);
  });
  it('a normal workout in progress is not flagged', () => {
    expect(overdueState(active([5, 10, 40]), 60, min(55)).forgotten).toBe(false);
  });
  it('45 minutes without a set → flagged, and the save time is just after the last set', () => {
    const o = overdueState(active([5, 30]), 60, min(76));
    expect(o.forgotten).toBe(true);
    expect(o.idle_min).toBe(46);
    expect(o.end_at).toBe(min(32));
  });
  it('far longer than usual with a quiet spell → flagged', () => {
    expect(overdueState(active([10, 60, 85]), 60, min(101)).forgotten).toBe(true);   // 101 ≥ 90, idle 16
    expect(overdueState(active([10, 60, 95]), 60, min(101)).forgotten).toBe(false);  // still ticking sets
  });
  it('"still training" silences it until the snooze ends', () => {
    const a = { ...(active([5]) as object), overdue_snooze_until: min(90) } as never;
    expect(overdueState(a, 60, min(80)).forgotten).toBe(false);
    expect(overdueState(a, 60, min(95)).forgotten).toBe(true);
  });
  it('minutes in Hebrew', () => {
    expect(formatMinutes(45)).toBe('45 דק׳');
    expect(formatMinutes(60)).toBe('שעה');
    expect(formatMinutes(135)).toBe('2 שעות ו-15 דק׳');
  });
});
