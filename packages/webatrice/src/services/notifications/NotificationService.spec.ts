import {
  ATTENTION_MARKER,
  getNotificationPermission,
  requestAttention,
  requestNotificationPermission,
  showSystemNotification,
  watchNotificationPermission,
} from './NotificationService';

class FakeNotification {
  static permission: NotificationPermission = 'granted';
  static requestPermission = vi.fn(() => Promise.resolve<NotificationPermission>('granted'));
  static instances: FakeNotification[] = [];
  onclick: (() => void) | null = null;
  close = vi.fn();
  constructor(public title: string, public options: NotificationOptions) {
    FakeNotification.instances.push(this);
  }
}

const setHidden = (hidden: boolean) => vi.spyOn(document, 'hidden', 'get').mockReturnValue(hidden);

describe('NotificationService', () => {
  beforeEach(() => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    FakeNotification.instances = [];
    FakeNotification.permission = 'granted';
    vi.stubGlobal('Notification', FakeNotification);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('permission', () => {
    it('reports unsupported when the browser has no Notification API', () => {
      vi.stubGlobal('Notification', undefined);
      delete (window as unknown as Record<string, unknown>).Notification;
      expect(getNotificationPermission()).toBe('unsupported');
    });

    it('asks the browser only while the answer is still open', async () => {
      FakeNotification.permission = 'default';
      await expect(requestNotificationPermission()).resolves.toBe('granted');
      expect(FakeNotification.requestPermission).toHaveBeenCalledTimes(1);

      FakeNotification.permission = 'denied';
      await expect(requestNotificationPermission()).resolves.toBe('denied');
      expect(FakeNotification.requestPermission).toHaveBeenCalledTimes(1);
    });
  });

  describe('watchNotificationPermission', () => {
    it('reports changes from the Permissions API and on focus, until unsubscribed', async () => {
      const status = new EventTarget();
      vi.stubGlobal('navigator', { ...navigator, permissions: { query: vi.fn(() => Promise.resolve(status)) } });
      const onChange = vi.fn();

      const stop = watchNotificationPermission(onChange);
      await Promise.resolve();
      FakeNotification.permission = 'denied';
      status.dispatchEvent(new Event('change'));
      expect(onChange).toHaveBeenLastCalledWith('denied');

      FakeNotification.permission = 'default';
      window.dispatchEvent(new Event('focus'));
      expect(onChange).toHaveBeenLastCalledWith('default');

      stop();
      status.dispatchEvent(new Event('change'));
      window.dispatchEvent(new Event('focus'));
      expect(onChange).toHaveBeenCalledTimes(2);
    });

    it('still follows focus where the Permissions API cannot report notifications', async () => {
      vi.stubGlobal('navigator', { ...navigator, permissions: { query: vi.fn(() => Promise.reject(new TypeError())) } });
      const onChange = vi.fn();

      const stop = watchNotificationPermission(onChange);
      await Promise.resolve();
      window.dispatchEvent(new Event('focus'));

      expect(onChange).toHaveBeenCalledWith('granted');
      stop();
    });
  });

  describe('showSystemNotification', () => {
    it('shows a notification in a visible but unfocused window', () => {
      setHidden(false);
      vi.spyOn(document, 'hasFocus').mockReturnValue(false);
      expect(showSystemNotification({ title: 'hi' })).toBe(true);
    });
    it('shows nothing while the tab is visible, so the caller falls back to a toast', () => {
      setHidden(false);
      expect(showSystemNotification({ title: 'hi' })).toBe(false);
      expect(FakeNotification.instances).toHaveLength(0);
    });

    it('shows nothing without permission', () => {
      setHidden(true);
      FakeNotification.permission = 'denied';
      expect(showSystemNotification({ title: 'hi' })).toBe(false);
      expect(FakeNotification.instances).toHaveLength(0);
    });

    it('shows a truncated, tagged notification when hidden and permitted', () => {
      setHidden(true);
      expect(showSystemNotification({ title: 'From bob', body: 'x'.repeat(150), tag: 'pm:bob' })).toBe(true);

      const [n] = FakeNotification.instances;
      expect(n.title).toBe('From bob');
      expect(n.options.tag).toBe('pm:bob');
      expect(n.options.body).toBe(`${'x'.repeat(100)}…`);
    });

    it('focuses the tab and runs onClick when the notification is clicked', () => {
      setHidden(true);
      const focus = vi.spyOn(window, 'focus').mockImplementation(() => undefined);
      const onClick = vi.fn();
      showSystemNotification({ title: 'From bob', onClick });

      const [n] = FakeNotification.instances;
      n.onclick?.();

      expect(focus).toHaveBeenCalled();
      expect(n.close).toHaveBeenCalled();
      expect(onClick).toHaveBeenCalled();
    });

    it('reports failure when the constructor throws (e.g. Android Chrome)', () => {
      setHidden(true);
      vi.stubGlobal('Notification', class extends FakeNotification {
        constructor(title: string, options: NotificationOptions) {
          super(title, options);
          throw new TypeError('Illegal constructor');
        }
      });
      expect(showSystemNotification({ title: 'hi' })).toBe(false);
    });
  });

  describe('requestAttention', () => {
    beforeEach(() => {
      document.title = 'Webatrice';
    });

    it('keeps attention in a visible unfocused window until focus returns', () => {
      setHidden(false);
      const focus = vi.spyOn(document, 'hasFocus').mockReturnValue(false);
      requestAttention();
      document.dispatchEvent(new Event('visibilitychange'));
      expect(document.title).toBe(`${ATTENTION_MARKER}Webatrice`);
      focus.mockReturnValue(true);
      window.dispatchEvent(new Event('focus'));
      expect(document.title).toBe('Webatrice');
    });

    it('does nothing while the tab is visible', () => {
      setHidden(false);
      requestAttention();
      expect(document.title).toBe('Webatrice');
    });

    it('marks the title once while hidden and clears it when the tab is shown', () => {
      const hidden = setHidden(true);
      requestAttention();
      requestAttention();
      expect(document.title).toBe(`${ATTENTION_MARKER}Webatrice`);

      hidden.mockReturnValue(false);
      document.dispatchEvent(new Event('visibilitychange'));
      expect(document.title).toBe('Webatrice');
    });
  });
});
