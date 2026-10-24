import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';

import { Player } from '@app/features/player';
import {
  Command_Message_ext,
  Event_UserJoinedSchema,
  Event_UserJoined_ext,
  Event_UserLeftSchema,
  Event_UserLeft_ext,
  Response_ResponseCode,
  ServerInfo_UserSchema,
} from '@cockatrice/sockatrice/generated';

import { connectAndLogin } from '../helpers/setup';
import { buildResponse, buildResponseMessage, buildSessionEventMessage, deliverMessage } from '../helpers/protobuf-builders';
import { findLastSessionCommand } from '../helpers/command-capture';
import { renderFeatureScreen, simulateLoggedIn } from './helpers';

beforeEach(() => {
  vi.useRealTimers();
  simulateLoggedIn();
});

describe('Player (integration)', () => {
  it('shows the not-found state for an unknown player name', () => {
    renderFeatureScreen(
      <Routes>
        <Route path="/player/:name" element={<Player />} />
      </Routes>,
      '/player/ghost',
    );

    expect(screen.getByText('Player.action.notFound')).toBeInTheDocument();
  });

  it('restores an undelivered private message and tracks the partner going offline', async () => {
    connectAndLogin('alice');
    simulateLoggedIn();
    deliverMessage(buildSessionEventMessage(Event_UserJoined_ext, create(Event_UserJoinedSchema, {
      userInfo: create(ServerInfo_UserSchema, { name: 'bob' }),
    })));

    renderFeatureScreen(
      <Routes>
        <Route path="/player/:name" element={<Player />} />
      </Routes>,
      '/player/bob',
    );
    expect(screen.getByTestId('private-chat-presence')).toHaveTextContent('PrivateChat.presence.online');

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'you there?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Common.action.send' }));
    expect(input).toHaveValue('');

    const sent = findLastSessionCommand(Command_Message_ext);
    expect(sent.value).toMatchObject({ userName: 'bob', message: 'you there?' });
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: sent.cmdId,
      responseCode: Response_ResponseCode.RespNameNotFound,
    })));

    expect(await screen.findByText('PrivateChat.notice.recipientOffline')).toBeInTheDocument();
    expect(input).toHaveValue('you there?');

    deliverMessage(buildSessionEventMessage(Event_UserLeft_ext, create(Event_UserLeftSchema, { name: 'bob' })));
    expect(await screen.findByText('PrivateChat.notice.userLeft')).toBeInTheDocument();
    expect(screen.getByTestId('private-chat-presence')).toHaveTextContent('PrivateChat.presence.offline');
    expect(screen.getByRole('button', { name: 'Common.action.send' })).toBeDisabled();
  });
});
