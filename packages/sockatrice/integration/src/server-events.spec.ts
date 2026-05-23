// Server-level session events — server message banner, shutdown schedule,
// user notifications, and connection-closed reason code mapping.

import { create } from '@bufbuild/protobuf';
import { describe, expect, it } from 'vitest';

import * as Data from '../../src/generated';
import { WebsocketTypes } from '../../src/types';

import { connectAndHandshake, getMockResponse, getWebClient } from '../../src/testing/setup';
import {
  buildSessionEventMessage,
  deliverMessage,
} from '../../src/testing/protobuf-builders';

describe('server events', () => {
  it('dispatches serverMessage on Event_ServerMessage', () => {
    connectAndHandshake();

    deliverMessage(buildSessionEventMessage(
      Data.Event_ServerMessage_ext,
      create(Data.Event_ServerMessageSchema, { message: 'Welcome to TestServer!' })
    ));

    expect(getMockResponse().session.serverMessage).toHaveBeenCalledWith('Welcome to TestServer!');
  });

  it('dispatches serverShutdown on Event_ServerShutdown', () => {
    connectAndHandshake();

    deliverMessage(buildSessionEventMessage(
      Data.Event_ServerShutdown_ext,
      create(Data.Event_ServerShutdownSchema, {
        reason: 'Scheduled maintenance',
        minutes: 5,
      })
    ));

    expect(getMockResponse().session.serverShutdown).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'Scheduled maintenance', minutes: 5 }),
    );
  });

  it('dispatches notifyUser on Event_NotifyUser', () => {
    connectAndHandshake();

    deliverMessage(buildSessionEventMessage(
      Data.Event_NotifyUser_ext,
      create(Data.Event_NotifyUserSchema, {
        type: Data.Event_NotifyUser_NotificationType.PROMOTION,
        customTitle: 'You have been promoted',
        customContent: 'Now a judge',
      })
    ));

    expect(getMockResponse().session.notifyUser).toHaveBeenCalledWith(
      expect.objectContaining({ customTitle: 'You have been promoted' }),
    );
  });

  describe('connection closed', () => {
    function lastStatusMessage(): string {
      const calls = (getMockResponse().session.updateStatus as ReturnType<typeof vi.fn>).mock.calls;
      return String(calls[calls.length - 1][1]);
    }

    it('prefers reasonStr when provided', () => {
      connectAndHandshake();

      deliverMessage(buildSessionEventMessage(
        Data.Event_ConnectionClosed_ext,
        create(Data.Event_ConnectionClosedSchema, {
          reason: Data.Event_ConnectionClosed_CloseReason.OTHER,
          reasonStr: 'kicked by admin',
        })
      ));

      expect(getWebClient().status).toBe(WebsocketTypes.StatusEnum.DISCONNECTED);
      expect(getMockResponse().session.updateStatus).toHaveBeenCalledWith(
        WebsocketTypes.StatusEnum.DISCONNECTED,
        'kicked by admin',
      );
    });

    it('maps USER_LIMIT_REACHED to a capacity message', () => {
      connectAndHandshake();

      deliverMessage(buildSessionEventMessage(
        Data.Event_ConnectionClosed_ext,
        create(Data.Event_ConnectionClosedSchema, {
          reason: Data.Event_ConnectionClosed_CloseReason.USER_LIMIT_REACHED,
        })
      ));

      const calls = (getMockResponse().session.updateStatus as ReturnType<typeof vi.fn>).mock.calls;
      const last = calls[calls.length - 1];
      expect(last[0]).toBe(WebsocketTypes.StatusEnum.DISCONNECTED);
      expect(String(last[1])).toContain('maximum user capacity');
    });

    it('maps LOGGEDINELSEWERE to a multi-session message', () => {
      connectAndHandshake();

      deliverMessage(buildSessionEventMessage(
        Data.Event_ConnectionClosed_ext,
        create(Data.Event_ConnectionClosedSchema, {
          reason: Data.Event_ConnectionClosed_CloseReason.LOGGEDINELSEWERE,
        })
      ));

      const calls = (getMockResponse().session.updateStatus as ReturnType<typeof vi.fn>).mock.calls;
      const last = calls[calls.length - 1];
      expect(String(last[1])).toContain('another location');
    });

    it('maps TOO_MANY_CONNECTIONS to a concurrent-connections message', () => {
      connectAndHandshake();

      deliverMessage(buildSessionEventMessage(
        Data.Event_ConnectionClosed_ext,
        create(Data.Event_ConnectionClosedSchema, {
          reason: Data.Event_ConnectionClosed_CloseReason.TOO_MANY_CONNECTIONS,
        })
      ));

      expect(lastStatusMessage()).toContain('too many concurrent connections');
    });

    it('maps BANNED without an end time to a permanent-ban message', () => {
      connectAndHandshake();

      deliverMessage(buildSessionEventMessage(
        Data.Event_ConnectionClosed_ext,
        create(Data.Event_ConnectionClosedSchema, {
          reason: Data.Event_ConnectionClosed_CloseReason.BANNED,
        })
      ));

      expect(lastStatusMessage()).toBe('You are banned');
    });

    it('maps BANNED with an end time to a time-limited ban message', () => {
      connectAndHandshake();

      deliverMessage(buildSessionEventMessage(
        Data.Event_ConnectionClosed_ext,
        create(Data.Event_ConnectionClosedSchema, {
          reason: Data.Event_ConnectionClosed_CloseReason.BANNED,
          endTime: 1893456000, // a fixed positive epoch-seconds value
        })
      ));

      expect(lastStatusMessage()).toContain('You are banned until');
    });

    it('maps DEMOTED to a demotion message', () => {
      connectAndHandshake();

      deliverMessage(buildSessionEventMessage(
        Data.Event_ConnectionClosed_ext,
        create(Data.Event_ConnectionClosedSchema, {
          reason: Data.Event_ConnectionClosed_CloseReason.DEMOTED,
        })
      ));

      expect(lastStatusMessage()).toBe('You were demoted');
    });

    it('maps SERVER_SHUTDOWN to a shutdown message', () => {
      connectAndHandshake();

      deliverMessage(buildSessionEventMessage(
        Data.Event_ConnectionClosed_ext,
        create(Data.Event_ConnectionClosedSchema, {
          reason: Data.Event_ConnectionClosed_CloseReason.SERVER_SHUTDOWN,
        })
      ));

      expect(lastStatusMessage()).toBe('Scheduled server shutdown');
    });

    it('maps USERNAMEINVALID to an invalid-username message', () => {
      connectAndHandshake();

      deliverMessage(buildSessionEventMessage(
        Data.Event_ConnectionClosed_ext,
        create(Data.Event_ConnectionClosedSchema, {
          reason: Data.Event_ConnectionClosed_CloseReason.USERNAMEINVALID,
        })
      ));

      expect(lastStatusMessage()).toBe('Invalid username');
    });

    it('falls back to an unknown-reason message for OTHER with no reasonStr', () => {
      connectAndHandshake();

      deliverMessage(buildSessionEventMessage(
        Data.Event_ConnectionClosed_ext,
        create(Data.Event_ConnectionClosedSchema, {
          reason: Data.Event_ConnectionClosed_CloseReason.OTHER,
        })
      ));

      expect(lastStatusMessage()).toBe('Unknown reason');
    });
  });
});
