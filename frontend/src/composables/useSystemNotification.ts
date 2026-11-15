import { isTauri } from './useTransport'

export type SystemNotificationPermission = 'unsupported' | 'default' | 'granted' | 'denied'

export interface SystemNotificationPayload {
  title: string
  body: string
  paneId?: string
  /** Called when the notification body is clicked (main-thread notification path). */
  onActivate?: () => void
}

type BadgeNavigator = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>
  clearAppBadge?: () => Promise<void>
}

/**
 * Web/PWA system notifications. The desktop build (Tauri) returns `unsupported`
 * until the native notification plugin lands; WebView2 does not implement the
 * Web Notifications API.
 */
export function getSystemNotificationPermission(): SystemNotificationPermission {
  if (isTauri()) return 'unsupported'
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  switch (Notification.permission) {
    case 'granted':
      return 'granted'
    case 'denied':
      return 'denied'
    default:
      return 'default'
  }
}

/**
 * Must be called from a user gesture (browser policy). Returns the resulting
 * permission state.
 */
export async function requestSystemNotificationPermission(): Promise<SystemNotificationPermission> {
  const current = getSystemNotificationPermission()
  if (current !== 'default') return current
  try {
    const result = await Notification.requestPermission()
    if (result === 'granted') return 'granted'
    if (result === 'denied') return 'denied'
    return 'default'
  } catch {
    return getSystemNotificationPermission()
  }
}

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null

function serviceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(null)
  }
  if (!registrationPromise) {
    // `ready` never settles when no service worker is active; bound the wait so
    // a notification is still delivered through the constructor path.
    registrationPromise = Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]).catch(() => null) as Promise<ServiceWorkerRegistration | null>
  }
  return registrationPromise
}

/**
 * Shows a system notification. Returns false when the platform or permission
 * state cannot deliver one. The caller already applied DND/foreground gating.
 */
export async function sendSystemNotification(payload: SystemNotificationPayload): Promise<boolean> {
  if (getSystemNotificationPermission() !== 'granted') return false
  const options: NotificationOptions = {
    body: payload.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    // One notification per pane: a new completion replaces the previous one
    // instead of stacking.
    tag: payload.paneId ? `dinotty-pane-${payload.paneId}` : 'dinotty',
    data: { paneId: payload.paneId, type: 'dinotty-notification' },
    // Dinotty already plays its own configurable sound; silence the OS chime so
    // enabling this channel does not double-alert.
    silent: true,
  }

  const registration = await serviceWorkerRegistration()
  if (registration?.showNotification) {
    try {
      await registration.showNotification(payload.title, options)
      return true
    } catch {
      /* fall through to the constructor path */
    }
  }

  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      const notification = new Notification(payload.title, options)
      notification.onclick = () => {
        try {
          window.focus()
        } catch {}
        payload.onActivate?.()
        notification.close()
      }
      return true
    } catch {
      return false
    }
  }
  return false
}

/** Sets the PWA/taskbar badge where the Badging API is available. */
export function setAppBadge(count: number, dotOnly = false): void {
  if (typeof navigator === 'undefined') return
  const nav = navigator as BadgeNavigator
  try {
    if (count > 0) void nav.setAppBadge?.(dotOnly ? undefined : count)
    else void nav.clearAppBadge?.()
  } catch {
    /* unsupported or permission denied; the title still carries the count */
  }
}

/** Flashes the desktop taskbar/dock once while the app is unfocused. */
export async function flashTaskbar(): Promise<void> {
  if (!isTauri()) return
  try {
    const { getCurrentWindow, UserAttentionType } = await import('@tauri-apps/api/window')
    await getCurrentWindow().requestUserAttention(UserAttentionType.Informational)
  } catch {
    /* capability missing or window gone; not worth surfacing */
  }
}
