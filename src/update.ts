import { create } from 'zustand';
import { registerSW } from 'virtual:pwa-register';
import { flushPersist, useStore } from './store';

// App updates never reload the page during a workout. A new version waits:
// it is applied right away only when nothing is in progress, otherwise when the
// app is next put in the background with no workout running, or from the banner.

export const useUpdate = create<{ ready: boolean }>(() => ({ ready: false }));

let updateSW: ((reload?: boolean) => Promise<void>) | null = null;
const launchedAt = Date.now();

export async function applyUpdate(): Promise<void> {
  if (!updateSW || useStore.getState().active) return;
  await flushPersist();
  await updateSW(true);
  // updateSW reloads once the new version takes over. A page opened before the
  // app was ever installed is not taken over, so reload it ourselves.
  setTimeout(() => location.reload(), 3000);
}

function maybeApply(): void {
  if (!useUpdate.getState().ready || useStore.getState().active) return;
  // Found while the app was just opening: nothing is on screen yet, update now.
  if (Date.now() - launchedAt < 8000 || document.visibilityState === 'hidden') void applyUpdate();
}

export function setupUpdates(): void {
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      useUpdate.setState({ ready: true });
      maybeApply();
    },
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      // Used by the tests; also checks hourly while the app stays open.
      (window as unknown as { __checkForUpdate?: () => Promise<unknown> }).__checkForUpdate = () => reg.update();
      setInterval(() => void reg.update(), 60 * 60 * 1000);
    },
  });
  document.addEventListener('visibilitychange', maybeApply);
}
