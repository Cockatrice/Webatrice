import { create } from '@bufbuild/protobuf';
import { describe, expect, it } from 'vitest';

import { Event_ConnectionClosedSchema, Event_ConnectionClosed_CloseReason, Event_ConnectionClosed_ext, Event_NotifyUserSchema, Event_NotifyUser_NotificationType, Event_NotifyUser_ext, Event_ServerMessageSchema, Event_ServerMessage_ext, Event_ServerShutdownSchema, Event_ServerShutdown_ext } from 'sockatrice/generated';
import { store } from '../helpers/setup';
import { WebsocketTypes } from 'sockatrice/types';

import { connectAndHandshake } from '../helpers/setup';
import {
  buildSessionEventMessage,
  deliverMessage,
} from '../helpers/protobuf-builders';

describe('server events', () => {
  it('writes the server banner into server.info.message on Event_ServerMessage', () => {
    connectAndHandshake();

    deliverMessage(buildSessionEventMessage(
      Event_ServerMessage_ext,
      create(Event_ServerMessageSchema, { message: 'Welcome to TestServer!' })
    ));

    expect(store.getState().server.info.message).toBe('Welcome to TestServer!');
  });

  it('stores the shutdown payload on Event_ServerShutdown', () => {
    connectAndHandshake();

    deliverMessage(buildSessionEventMessage(
      Event_ServerShutdown_ext,
      create(Event_ServerShutdownSchema, {
        reason: 'Scheduled maintenance',
        minutes: 5,
      })
    ));

    const shutdown = store.getState().server.serverShutdown;
    expect(shutdown).not.toBeNull();
    expect(shutdown?.reason).toBe('Scheduled maintenance');
    expect(shutdown?.minutes).toBe(5);
  });

  it('appends a notification on Event_NotifyUser', () => {
    connectAndHandshake();

    deliverMessage(buildSessionEventMessage(
      Event_NotifyUser_ext,
      create(Event_NotifyUserSchema, {
        type: Event_NotifyUser_NotificationType.PROMOTION,
        customTitle: 'You have been promoted',
        customContent: 'Now a judge',
      })
    ));

    const notifications = store.getState().server.notifications;
    expect(notifications).toHaveLength(1);
    expect(notifications[0].customTitle).toBe('You have been promoted');
  });

  describe('connection closed', () => {
    it('prefers reasonStr when provided', () => {
      connectAndHandshake();

      deliverMessage(buildSessionEventMessage(
        Event_ConnectionClosed_ext,
        create(Event_ConnectionClosedSchema, {
          reason: Event_ConnectionClosed_CloseReason.OTHER,
          reasonStr: 'kicked by admin',
        })
      ));

      const status = store.getState().server.status;
      expect(status.state).toBe(WebsocketTypes.StatusEnum.DISCONNECTED);
      expect(status.description).toBe('kicked by admin');
    });

    it('maps USER_LIMIT_REACHED to a capacity message', () => {
      connectAndHandshake();

      deliverMessage(buildSessionEventMessage(
        Event_ConnectionClosed_ext,
        create(Event_ConnectionClosedSchema, {
          reason: Event_ConnectionClosed_CloseReason.USER_LIMIT_REACHED,
        })
      ));

      expect(store.getState().server.status.description).toContain('maximum user capacity');
    });

    it('maps LOGGEDINELSEWERE to a multi-session message', () => {
      connectAndHandshake();

      deliverMessage(buildSessionEventMessage(
        Event_ConnectionClosed_ext,
        create(Event_ConnectionClosedSchema, {
          reason: Event_ConnectionClosed_CloseReason.LOGGEDINELSEWERE,
        })
      ));

      expect(store.getState().server.status.description).toContain('another location');
    });
  });
});
