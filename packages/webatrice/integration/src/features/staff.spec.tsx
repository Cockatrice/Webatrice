import { create } from '@bufbuild/protobuf';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  Command_AddCardArtRule_ext,
  Command_RemoveCardArtRule_ext,
  Command_ListCardArtRules_ext,
  Response_ListCardArtRules_ext,
  Response_ListCardArtRulesSchema,
  Response_CardArtRuleEntrySchema,
  Command_GetModeratorLastLogins_ext,
  Command_GetUserAlts_ext,
  Command_Login_ext,
  Command_UpdateServerMessage_ext,
  Event_ServerIdentification_ext,
  Event_ServerIdentificationSchema,
  Response_Login_ext,
  Response_LoginSchema,
  Response_ModeratorLastLogins_ext,
  Response_ModeratorLastLoginsSchema,
  Response_ResponseCode,
  Response_UserAlts_ext,
  Response_UserAltsSchema,
  ServerInfo_ModeratorLoginSchema,
  ServerInfo_UserAltSchema,
  ServerInfo_UserSchema,
  ServerInfo_User_UserLevelFlag,
} from '@cockatrice/sockatrice/generated';
import { Route, Routes } from 'react-router-dom';
import { UserDisplay } from '@app/components';
import { ModerationProvider } from '@app/feature-widgets/moderation';
import { CardArtRules } from '@app/features/card-art-rules';
import { Administration } from '@app/features/administration';
import { Moderation } from '@app/features/moderation';

import { connectRaw, PROTOCOL_VERSION } from '../helpers/setup';
import { buildResponse, buildResponseMessage, buildSessionEventMessage, deliverMessage } from '../helpers/protobuf-builders';
import { findLastAdminCommand, findLastModeratorCommand, findLastSessionCommand } from '../helpers/command-capture';
import { renderFeatureScreen } from './helpers';
import { setAdminLocked } from '@app/hooks';

const { IsRegistered, IsModerator, IsAdmin } = ServerInfo_User_UserLevelFlag;

function loginAsStaff(userLevel = IsRegistered | IsModerator | IsAdmin) {
  connectRaw({ userName: 'boss' });
  deliverMessage(buildSessionEventMessage(
    Event_ServerIdentification_ext,
    create(Event_ServerIdentificationSchema, {
      serverName: 'TestServer',
      serverVersion: '3.1.0 (2026-01-01)',
      protocolVersion: PROTOCOL_VERSION,
    }),
  ));
  const login = findLastSessionCommand(Command_Login_ext);
  deliverMessage(buildResponseMessage(buildResponse({
    cmdId: login.cmdId,
    responseCode: Response_ResponseCode.RespOk,
    ext: Response_Login_ext,
    value: create(Response_LoginSchema, {
      userInfo: create(ServerInfo_UserSchema, { name: 'boss', userLevel }),
      buddyList: [],
      ignoreList: [],
    }),
  })));
}

beforeEach(() => {
  setAdminLocked(true);
  vi.useRealTimers();
});

describe('Administration (integration)', () => {
  it('sends Command_UpdateServerMessage and shows the server acknowledgement', () => {
    loginAsStaff();
    renderFeatureScreen(<Administration />, '/administration');

    expect(screen.getByRole('button', { name: /Administration\.admin\.updateServerMessage/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Administration.button.unlock' }));
    fireEvent.click(screen.getByRole('button', { name: /Administration\.admin\.updateServerMessage/ }));
    const { cmdId } = findLastAdminCommand(Command_UpdateServerMessage_ext);

    act(() => {
      deliverMessage(buildResponseMessage(buildResponse({ cmdId, responseCode: Response_ResponseCode.RespOk })));
    });

    expect(screen.getByText('Administration.result.serverMessageUpdated')).toBeInTheDocument();
  });
});

describe('Moderation (integration)', () => {
  it('investigates the routed user and lists the alts Servatrice returns', () => {
    loginAsStaff(IsRegistered | IsModerator);
    renderFeatureScreen(<Moderation />, '/moderation?user=alice');

    const { cmdId, value } = findLastModeratorCommand(Command_GetUserAlts_ext);
    expect(value.userName).toBe('alice');

    act(() => {
      deliverMessage(buildResponseMessage(buildResponse({
        cmdId,
        responseCode: Response_ResponseCode.RespOk,
        ext: Response_UserAlts_ext,
        value: create(Response_UserAltsSchema, {
          alts: [
            create(ServerInfo_UserAltSchema, { userName: 'alice', isActive: true }),
            create(ServerInfo_UserAltSchema, { userName: 'alice_smurf', banCount: 2 }),
          ],
        }),
      })));
    });

    const alts = screen.getByRole('region', { name: /ModerationPage\.alts\.title/ });
    const smurf = within(alts).getByRole('row', { name: /alice_smurf/ });
    expect(within(smurf).getByText('2')).toBeInTheDocument();
  });

  it('lists staff last logins on open', () => {
    loginAsStaff(IsRegistered | IsModerator);
    renderFeatureScreen(<Moderation />, '/moderation');

    const { cmdId } = findLastModeratorCommand(Command_GetModeratorLastLogins_ext);
    act(() => {
      deliverMessage(buildResponseMessage(buildResponse({
        cmdId,
        responseCode: Response_ResponseCode.RespOk,
        ext: Response_ModeratorLastLogins_ext,
        value: create(Response_ModeratorLastLoginsSchema, {
          logins: [create(ServerInfo_ModeratorLoginSchema, { userName: 'judge_judy', userLevel: IsModerator })],
        }),
      })));
    });

    expect(screen.getByText('judge_judy')).toBeInTheDocument();
  });
});

describe('Investigate user (integration)', () => {
  it('opens the Moderation page on the user from the context menu and runs the lookups', () => {
    loginAsStaff(IsRegistered | IsModerator);
    renderFeatureScreen(
      <ModerationProvider>
        <Routes>
          <Route path="/" element={<UserDisplay user={create(ServerInfo_UserSchema, { name: 'suspect', userLevel: IsRegistered })} />} />
          <Route path="/moderation" element={<Moderation />} />
        </Routes>
      </ModerationProvider>,
    );

    act(() => setAdminLocked(false));
    fireEvent.contextMenu(screen.getByText('suspect'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Moderation.menu.investigateUser' }));

    expect(findLastModeratorCommand(Command_GetUserAlts_ext).value.userName).toBe('suspect');
    expect(screen.getByRole('searchbox', { name: /ModerationPage\.search\.placeholder/ })).toHaveValue('suspect');
  });
});

describe.each(['list', 'add', 'remove'] as const)('Card art %s failure (integration)', (command) => {
  it.each(['rejected', 'timed out'] as const)('shows a command that %s through the response-to-UI path', async (outcome) => {
    loginAsStaff();
    if (command === 'list') {
      vi.useFakeTimers();
    }
    renderFeatureScreen(<CardArtRules />, '/card-art-rules');
    let cmdId = findLastModeratorCommand(Command_ListCardArtRules_ext).cmdId;
    if (command !== 'list') {
      act(() => deliverMessage(buildResponseMessage(buildResponse({
        cmdId,
        responseCode: Response_ResponseCode.RespOk,
        ext: Response_ListCardArtRules_ext,
        value: create(Response_ListCardArtRulesSchema, {
          entries: [create(Response_CardArtRuleEntrySchema, { cardName: 'Island', cardProviderId: 'uuid-1', mode: 'DENY' })],
        }),
      }))));
      if (command === 'add') {
        await act(async () => {
          fireEvent.change(screen.getByRole('textbox', { name: 'CardArtRules.label.card' }), { target: { value: 'Island' } });
        });
        await waitFor(() => expect(screen.getByRole('button', { name: 'CardArtRules.button.add' })).toBeEnabled());
        vi.useFakeTimers();
        await act(async () => fireEvent.click(screen.getByRole('button', { name: 'CardArtRules.button.add' })));
        cmdId = findLastModeratorCommand(Command_AddCardArtRule_ext).cmdId;
      } else {
        vi.useFakeTimers();
        fireEvent.click(screen.getByText('uuid-1'));
        fireEvent.click(screen.getByRole('button', { name: 'CardArtRules.button.remove' }));
        cmdId = findLastModeratorCommand(Command_RemoveCardArtRule_ext).cmdId;
      }
      act(() => deliverMessage(buildResponseMessage(buildResponse({
        cmdId: findLastModeratorCommand(Command_ListCardArtRules_ext).cmdId,
        responseCode: Response_ResponseCode.RespOk,
        ext: Response_ListCardArtRules_ext,
        value: create(Response_ListCardArtRulesSchema, {}),
      }))));
    }
    act(() => {
      if (outcome === 'rejected') {
        deliverMessage(buildResponseMessage(buildResponse({ cmdId, responseCode: Response_ResponseCode.RespFunctionNotAllowed })));
      } else {
        vi.advanceTimersByTime(18000);
      }
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      outcome === 'rejected' ? `CardArtRules.error.${command}` : 'CommandFailure.timeout',
    );
  });
});
