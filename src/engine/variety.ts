import type { TemplateSlot } from '../types';
import { getAlternatives, type Availability } from './alternatives';
import type { Catalog } from './catalog';

/**
 * Keeps training from being identical every week without breaking progression:
 * the anchor lift never changes, while every second accessory and the core
 * finisher alternate with their closest equivalent on odd rounds. Each exercise
 * therefore still repeats every second round, so load progression keeps working.
 * `round` = how many times this workout was already completed.
 */
export function applyVariety(slots: TemplateSlot[], round: number, cat: Catalog, availability: Availability): TemplateSlot[] {
  if (round % 2 === 0) return slots;
  const used = new Set(slots.map((s) => s.exercise_id));
  let accessory = 0;
  // When a slot that should alternate has no equivalent, the next accessory alternates instead.
  let owed = 0;
  return slots.map((slot) => {
    if (slot.role === 'anchor') return slot;
    const isCore = slot.role === 'core';
    const scheduled = isCore || accessory++ % 2 === 1;
    if (!scheduled && owed === 0) return slot;
    const ex = cat.find(slot.exercise_id);
    const candidates = ex ? getAlternatives(ex, cat.all, availability, [...used], 12).filter((a) => !a.is_custom) : [];
    // Accessories keep the same kind of loading so progression carries over;
    // core work only has to stay reps-based or time-based.
    const alt = isCore
      ? candidates.find((a) => (a.tracking === 'time') === (ex!.tracking === 'time'))
      : candidates.find((a) => a.tracking === ex!.tracking && a.is_compound === ex!.is_compound);
    if (!alt) {
      if (scheduled && !isCore) owed++;
      return slot;
    }
    if (!scheduled) owed--;
    used.add(alt.id);
    return { ...slot, exercise_id: alt.id };
  });
}
