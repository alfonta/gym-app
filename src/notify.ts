// System notifications. They only appear while the app is still running:
// on Android and desktop also in the background, on iPhone only while the app
// is open (iOS suspends web apps in the background, and this app has no server
// to send a push).

export type NotifyStatus = 'granted' | 'denied' | 'default' | 'unsupported';

export function notifyStatus(): NotifyStatus {
  if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) return 'unsupported';
  return Notification.permission as NotifyStatus;
}

export async function requestNotify(): Promise<NotifyStatus> {
  if (notifyStatus() === 'unsupported') return 'unsupported';
  try {
    return (await Notification.requestPermission()) as NotifyStatus;
  } catch {
    return notifyStatus();
  }
}

const shown = new Set<string>();

/** Shows a notification once per tag+key, only when the app is not on screen. */
export async function notifyIfHidden(tag: string, key: string, title: string, body: string): Promise<boolean> {
  if (document.visibilityState !== 'hidden' || notifyStatus() !== 'granted') return false;
  const id = `${tag}:${key}`;
  if (shown.has(id)) return false;
  shown.add(id);
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    await reg.showNotification(title, { body, tag, lang: 'he', dir: 'rtl', icon: `${import.meta.env.BASE_URL}icon-192.png` } as NotificationOptions);
    return true;
  } catch {
    return false;
  }
}
