
export type NotificationPermissionState = NotificationPermission | 'unsupported';

export interface SystemNotificationOptions {
  title: string;
  body?: string;
  tag?: string;
  onClick?: () => void;
}

export const NOTIFICATION_BODY_LIMIT = 100;

export const ATTENTION_MARKER = '(*) ';

const isSupported = (): boolean => typeof window !== 'undefined' && 'Notification' in window;

export function getNotificationPermission(): NotificationPermissionState {
  return isSupported() ? Notification.permission : 'unsupported';
}

export function watchNotificationPermission(onChange: (permission: NotificationPermissionState) => void): () => void {
  if (!isSupported()) {
    return () => {};
  }
  let active = true;
  let status: PermissionStatus | undefined;
  const report = () => onChange(getNotificationPermission());

  window.addEventListener('focus', report);
  navigator.permissions?.query({ name: 'notifications' }).then(
    (result) => {
      if (active) {
        status = result;
        status.addEventListener('change', report);
      }
    },
    () => {},
  );
  return () => {
    active = false;
    window.removeEventListener('focus', report);
    status?.removeEventListener('change', report);
  };
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!isSupported()) {
    return 'unsupported';
  }
  if (Notification.permission !== 'default') {
    return Notification.permission;
  }
  return Notification.requestPermission();
}

export const isPageHidden = (): boolean => typeof document !== 'undefined' && document.hidden;

export const isPageInactive = (): boolean => typeof document !== 'undefined' && (document.hidden || !document.hasFocus());

const shown = new Set<Notification>();

export function closeSystemNotifications(): void {
  shown.forEach((notification) => notification.close());
  shown.clear();
}

export function showSystemNotification({ title, body, tag, onClick }: SystemNotificationOptions): boolean {
  if (!isPageInactive() || getNotificationPermission() !== 'granted') {
    return false;
  }
  try {
    const notification = new Notification(title, {
      body: body ? truncate(body, NOTIFICATION_BODY_LIMIT) : undefined,
      tag,
    });
    shown.add(notification);
    notification.onclose = () => shown.delete(notification);
    notification.onclick = () => {
      window.focus();
      notification.close();
      shown.delete(notification);
      onClick?.();
    };
    return true;
  } catch {
    return false;
  }
}

let attentionListening = false;

export function requestAttention(): void {
  if (!isPageInactive()) {
    return;
  }
  if (!document.title.startsWith(ATTENTION_MARKER)) {
    document.title = ATTENTION_MARKER + document.title;
  }
  if (!attentionListening) {
    attentionListening = true;
    document.addEventListener('visibilitychange', clearAttention);
    window.addEventListener('focus', clearAttention);
  }
}

function clearAttention(): void {
  if (isPageInactive()) {
    return;
  }
  if (document.title.startsWith(ATTENTION_MARKER)) {
    document.title = document.title.slice(ATTENTION_MARKER.length);
  }
  document.removeEventListener('visibilitychange', clearAttention);
  window.removeEventListener('focus', clearAttention);
  attentionListening = false;
}

function truncate(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}
