import { act, fireEvent, screen } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';
import type { TFunction } from 'i18next';
import { server } from '@cockatrice/datatrice';
import {
  Event_NotifyUser_NotificationType,
  Event_NotifyUserSchema,
  Event_ServerShutdownSchema,
} from '@cockatrice/sockatrice/generated';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  const t = (key: string, values?: Record<string, unknown>) => (values ? `${key} ${JSON.stringify(values)}` : key);
  return { ...actual, useTranslation: () => ({ t, i18n: { language: 'en-US' } }) };
});

import { renderWithProviders, connectedState } from '../../__test-utils__';
import ServerNotices, { describeNotification } from './ServerNotices';

const t = ((key: string, values?: Record<string, unknown>) =>
  (values ? `${key} ${JSON.stringify(values)}` : key)) as unknown as TFunction;

const notify = (type: number, fields: Partial<{ warningReason: string; customTitle: string; customContent: string }> = {}) =>
  create(Event_NotifyUserSchema, { type, ...fields });

describe('describeNotification', () => {
  it.each([
    [Event_NotifyUser_NotificationType.UNKNOWN, 'ServerNotices.unknown.title'],
    [Event_NotifyUser_NotificationType.IDLEWARNING, 'ServerNotices.idle.title'],
    [Event_NotifyUser_NotificationType.PROMOTED, 'ServerNotices.promoted.title'],
  ])('maps type %s to desktop\'s message box', (type, title) => {
    expect(describeNotification(t, notify(type))).toMatchObject({ title, severity: 'info' });
  });

  it('shows a warning with its simplified reason', () => {
    expect(describeNotification(t, notify(Event_NotifyUser_NotificationType.WARNING, { warningReason: '  spamming\n chat ' })))
      .toEqual({
        title: 'ServerNotices.warning.title',
        message: 'ServerNotices.warning.message {"reason":"spamming chat"}',
        severity: 'warning',
      });
  });

  it('shows nothing for a warning without a reason (as desktop)', () => {
    expect(describeNotification(t, notify(Event_NotifyUser_NotificationType.WARNING, { warningReason: '  ' }))).toBeNull();
  });

  it('titles a custom message with the server\'s title and quotes its content', () => {
    expect(describeNotification(t, notify(Event_NotifyUser_NotificationType.CUSTOM, {
      customTitle: 'Tournament',
      customContent: 'Round 2 starts now',
    }))).toEqual({
      title: 'Tournament',
      message: 'ServerNotices.custom.message',
      details: 'Round 2 starts now',
      severity: 'info',
    });
  });

  it('shows nothing for a custom message missing its title or content', () => {
    expect(describeNotification(t, notify(Event_NotifyUser_NotificationType.CUSTOM, { customTitle: 'Only title' }))).toBeNull();
    expect(describeNotification(t, notify(Event_NotifyUser_NotificationType.CUSTOM, { customContent: 'Only body' }))).toBeNull();
  });

  it('ignores a type this client does not know yet (desktop default:)', () => {
    expect(describeNotification(t, notify(99))).toBeNull();
  });
});

describe('ServerNotices', () => {
  function setup() {
    return renderWithProviders(<ServerNotices />, { preloadedState: connectedState });
  }

  it('renders nothing without a shutdown or notification', () => {
    setup();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  describe('server shutdown', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('announces the shutdown with its reason and a live countdown', () => {
      const { store } = setup();
      act(() => {
        store.dispatch(server.Actions.serverShutdown({
          data: create(Event_ServerShutdownSchema, { reason: 'Maintenance', minutes: 5 }),
        }));
      });

      expect(screen.getByText('ServerNotices.shutdown.title')).toBeInTheDocument();
      expect(screen.getByText(/"countdown":"5:00","reason":"Maintenance"/)).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(61_000);
      });
      expect(screen.getByText(/"countdown":"3:59"/)).toBeInTheDocument();
    });

    it('stays dismissed until the server re-announces, then shows the fresh time', () => {
      const { store } = setup();
      act(() => {
        store.dispatch(server.Actions.serverShutdown({ data: create(Event_ServerShutdownSchema, { reason: 'Update', minutes: 10 }) }));
      });
      fireEvent.click(screen.getByRole('button'));
      expect(screen.queryByText('ServerNotices.shutdown.title')).not.toBeInTheDocument();

      act(() => {
        store.dispatch(server.Actions.serverShutdown({ data: create(Event_ServerShutdownSchema, { reason: 'Update', minutes: 2 }) }));
      });
      expect(screen.getByText(/"countdown":"2:00"/)).toBeInTheDocument();
    });

    it('never counts below zero', () => {
      const { store } = setup();
      act(() => {
        store.dispatch(server.Actions.serverShutdown({ data: create(Event_ServerShutdownSchema, { reason: 'Now', minutes: 1 }) }));
      });
      act(() => {
        vi.advanceTimersByTime(5 * 60_000);
      });
      expect(screen.getByText(/"countdown":"0:00"/)).toBeInTheDocument();
    });
  });

  describe('notifications', () => {
    it('shows each notification in arrival order, one at a time', () => {
      const { store } = setup();
      act(() => {
        store.dispatch(server.Actions.notifyUser({ notification: notify(Event_NotifyUser_NotificationType.PROMOTED) }));
        store.dispatch(server.Actions.notifyUser({ notification: notify(Event_NotifyUser_NotificationType.IDLEWARNING) }));
      });

      expect(screen.getByText('ServerNotices.promoted.title')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByText('ServerNotices.idle.title')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('skips notifications desktop would not show, including unknown future types', () => {
      const { store } = setup();
      act(() => {
        store.dispatch(server.Actions.notifyUser({ notification: notify(99) }));
        store.dispatch(server.Actions.notifyUser({ notification: notify(Event_NotifyUser_NotificationType.WARNING) }));
        store.dispatch(server.Actions.notifyUser({
          notification: notify(Event_NotifyUser_NotificationType.WARNING, { warningReason: 'flooding' }),
        }));
      });
      expect(screen.getByText('ServerNotices.warning.title')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
