import { useEffect, useState } from 'react';
import { loadPhoto, useStore } from './store';

/** Re-renders on an interval; timers derive from timestamps, not counters. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    const onVis = () => setNow(Date.now());
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [intervalMs]);
  return now;
}

/** Keeps the screen on during a workout (re-acquired when the app returns to the foreground). */
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        if (document.visibilityState !== 'visible') return;
        lock = await navigator.wakeLock.request('screen');
        if (cancelled) void lock.release();
      } catch {
        /* not allowed right now – retried on next visibility change */
      }
    };
    void acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', acquire);
      void lock?.release().catch(() => undefined);
    };
  }, [enabled]);
}

export function useHydrated(): boolean {
  const [ok, setOk] = useState(useStore.persist.hasHydrated());
  useEffect(() => {
    const unsub = useStore.persist.onFinishHydration(() => setOk(true));
    setOk(useStore.persist.hasHydrated());
    return unsub;
  }, []);
  return ok;
}

export function usePhoto(id: string | null | undefined): string | null {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setSrc(null);
    if (id) void loadPhoto(id).then((v) => alive && setSrc(v ?? null));
    return () => {
      alive = false;
    };
  }, [id]);
  return src;
}

// ───── Sound ─────

let ctx: AudioContext | null = null;

/** Must be called from a tap so iOS allows audio later when the rest timer ends. */
export function primeAudio(): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    /* no audio */
  }
}

export function beep(): void {
  if (!ctx) return;
  try {
    [0, 0.25, 0.5].forEach((offset) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx!.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.4, ctx!.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx!.currentTime + offset + 0.18);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(ctx!.currentTime + offset);
      osc.stop(ctx!.currentTime + offset + 0.2);
    });
  } catch {
    /* ignore */
  }
  navigator.vibrate?.(300);
}
