import { act, screen } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Event_UserJoinedSchema,
  Event_UserJoined_ext,
  Event_UserLeftSchema,
  Event_UserLeft_ext,
  Event_UserMessageSchema,
  Event_UserMessage_ext,
  ServerInfo_UserSchema,
} from '@cockatrice/sockatrice/generated';

import { Player, PrivateMessageNotifier } from '@app/features/player';
import { getSettings, settingsStore } from '@app/hooks';
import { chatFilterVerdicts } from '@app/utils';
import { connectAndLogin, store } from '../helpers/setup';
import { buildSessionEventMessage, deliverMessage } from '../helpers/protobuf-builders';
import { renderFeatureScreen, simulateLoggedIn } from './helpers';

beforeEach(() => {
  vi.useRealTimers();
  vi.spyOn(document, 'hasFocus').mockReturnValue(true);
  settingsStore.reset();
});

describe('private-message ingress', () => {
  it.each([
    { level: 1, ignoreAll: false, visible: false },
    { level: 7, ignoreAll: true, visible: true },
  ])('keeps the arrival verdict through a following departure: $visible', async ({ level, ignoreAll, visible }) => {
    connectAndLogin('alice');
    simulateLoggedIn();
    const settings = await getSettings();
    Object.assign(settings, {
      ignoreAllPrivateMessages: ignoreAll,
      ignoreUnregisteredUserMessages: true,
      ignoreNonBuddyUserMessages: false,
    });
    settingsStore.setValue(settings);
    deliverMessage(buildSessionEventMessage(Event_UserJoined_ext, create(Event_UserJoinedSchema, {
      userInfo: create(ServerInfo_UserSchema, { name: 'bob', userLevel: level }),
    })));
    renderFeatureScreen(
      <>
        <PrivateMessageNotifier />
        <Routes><Route path="/player/:name" element={<Player />} /></Routes>
      </>,
      '/player/bob',
    );

    act(() => {
      deliverMessage(buildSessionEventMessage(Event_UserMessage_ext, create(Event_UserMessageSchema, {
        senderName: 'bob', receiverName: 'alice', message: 'arrival verdict',
      })));
      expect(chatFilterVerdicts.get(store.getState().server.messages.bob[0])).toBe(visible);
      deliverMessage(buildSessionEventMessage(Event_UserLeft_ext, create(Event_UserLeftSchema, { name: 'bob' })));
    });
    expect(Boolean(screen.queryByText('arrival verdict'))).toBe(visible);
  });
});
