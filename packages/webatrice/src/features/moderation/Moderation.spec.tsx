import { create } from '@bufbuild/protobuf';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import type { Mock } from 'vitest';

import { attachResponseHandlers, server } from '@cockatrice/datatrice';
import {
  Response_ReportUserInfoSchema,
  Response_ResponseCode,
  ServerInfo_ModeratorLoginSchema,
  ServerInfo_UserAltSchema,
  ServerInfo_UserSessionSchema,
  ServerInfo_UserSchema,
  ServerInfo_User_UserLevelFlag,
} from '@cockatrice/sockatrice/generated';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { connectedState, createMockWebClient, makeUser, renderWithProviders } from '../../__test-utils__';
import Moderation from './Moderation';

const { IsRegistered, IsModerator, IsAdmin, IsJudge } = ServerInfo_User_UserLevelFlag;
const MODERATOR = IsRegistered | IsModerator;
const ADMIN = MODERATOR | IsAdmin;

function stateFor(userLevel: number, version = '3.1.0 (2026-01-01)') {
  return {
    ...connectedState,
    server: {
      ...(connectedState.server as any),
      info: { message: null, name: 'Servatrice', version },
      user: makeUser({ name: 'staff', userLevel }),
    },
  };
}

function setup(userLevel = MODERATOR, route = '/moderation', version?: string) {
  const webClient = createMockWebClient();
  const utils = renderWithProviders(
    <Routes>
      <Route path="/server" element={<div>server-page</div>} />
      <Route path="/moderation" element={<Moderation />} />
    </Routes>,
    { preloadedState: stateFor(userLevel, version), route, webClient },
  );
  return { ...utils, webClient };
}

const moderator = (webClient: ReturnType<typeof createMockWebClient>) => webClient.request.moderator as unknown as Record<string, Mock>;

const failed = (
  command: WebsocketTypes.ModeratorCommandName, target: string, responseCode: number, failure?: WebsocketTypes.CommandFailure,
) =>
  server.Actions.moderatorCommandFailed({ command, responseCode, target, failure });

const lookupRequestId = (webClient: ReturnType<typeof createMockWebClient>) =>
  (webClient.request.session.getUserInfo as unknown as Mock).mock.calls.at(-1)?.[1] as string;

async function investigate(name: string) {
  fireEvent.change(screen.getByRole('searchbox', { name: /search\.placeholder/ }), { target: { value: name } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /search\.investigate/ }));
  });
}

describe('Moderation gating', () => {
  const expectNothingSent = (webClient: ReturnType<typeof createMockWebClient>) => {
    const mod = moderator(webClient);
    expect(mod.getModeratorLastLogins).not.toHaveBeenCalled();
    expect(mod.reportUserInfo).not.toHaveBeenCalled();
    expect(mod.getUserSessions).not.toHaveBeenCalled();
    expect(mod.getUserAlts).not.toHaveBeenCalled();
  };

  it('sends a non-moderator away without sending any moderator command', () => {
    const { webClient } = setup(IsRegistered, '/moderation?user=bad');
    expect(screen.getByText('server-page')).toBeInTheDocument();
    expectNothingSent(webClient);
  });

  it('sends a moderator away without sending anything when the server version is unknown', () => {
    const { webClient } = setup(MODERATOR, '/moderation?user=bad', 'unknown');
    expect(screen.getByText('server-page')).toBeInTheDocument();
    expectNothingSent(webClient);
    expect(webClient.request.session.getUserInfo).not.toHaveBeenCalled();
  });

  it('stays open on a 3.0 server and looks the user up with the 3.0 user info command instead', () => {
    const { webClient, store } = setup(MODERATOR, '/moderation?user=bad', '3.0.0 ()');
    expect(screen.queryByText('server-page')).not.toBeInTheDocument();
    expectNothingSent(webClient);
    expect(webClient.request.session.getUserInfo).toHaveBeenCalledWith('bad', expect.any(String));
    const requestId = lookupRequestId(webClient);

    ['alts', 'sessions', 'staff'].forEach((section) => {
      const region = screen.getByRole('region', { name: new RegExp(`${section}\\.title`) });
      expect(within(region).getByText('ModerationPage.needsServer')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /staff\.refresh/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /action\.removeAvatar/ })).not.toBeInTheDocument();

    act(() => {
      store.dispatch(server.Actions.getUserInfo({
        userInfo: create(ServerInfo_UserSchema, { name: 'bad', userLevel: IsRegistered, country: 'de', clientid: 'c-42' }),
        requestId,
      }));
    });
    const details = screen.getByRole('region', { name: 'ModerationPage.info.title' });
    expect(within(details).getByText('DE')).toBeInTheDocument();
    expect(within(details).getByText('c-42')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Staff.sanctions.warn' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ModerationPage.recordAction.banHistory' })).toBeInTheDocument();
  });

  it('resolves a 3.0 lookup whose answer carries the canonical casing of the name', () => {
    const { webClient, store } = setup(MODERATOR, '/moderation?user=alice', '3.0.0 ()');
    act(() => {
      store.dispatch(server.Actions.getUserInfo({
        userInfo: create(ServerInfo_UserSchema, { name: 'Alice', userLevel: IsRegistered, clientid: 'c-7' }),
        requestId: lookupRequestId(webClient),
      }));
    });
    const details = screen.getByRole('region', { name: 'ModerationPage.info.title' });
    expect(within(details).getByText('c-7')).toBeInTheDocument();
    expect(within(details).queryByText('ModerationPage.value.loading')).not.toBeInTheDocument();
  });

  it('ignores user info answers to other requests', () => {
    const { store } = setup(MODERATOR, '/moderation?user=bad', '3.0.0 ()');
    act(() => {
      store.dispatch(server.Actions.getUserInfo({
        userInfo: create(ServerInfo_UserSchema, { name: 'bad', userLevel: IsRegistered, clientid: 'c-42' }),
      }));
    });
    const details = screen.getByRole('region', { name: 'ModerationPage.info.title' });
    expect(within(details).queryByText('c-42')).not.toBeInTheDocument();
    expect(within(details).getAllByText('ModerationPage.value.loading').length).toBeGreaterThan(0);
  });

  it('reports a failed 3.0 lookup in the details', () => {
    const { webClient, store } = setup(MODERATOR, '/moderation?user=ghost', '3.0.0 ()');
    act(() => {
      store.dispatch(server.Actions.getUserInfoFailed({
        userName: 'ghost', responseCode: Response_ResponseCode.RespNameNotFound, requestId: lookupRequestId(webClient),
      }));
    });
    const details = screen.getByRole('region', { name: 'ModerationPage.info.title' });
    expect(within(details).getAllByText('ModerationPage.info.loadError').length).toBeGreaterThan(0);
  });

  it('offers Reset Password only to admins (Servatrice serves it in the admin family)', () => {
    setup(MODERATOR);
    expect(screen.queryByRole('button', { name: /action\.resetPassword/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /action\.removeAvatar/ })).toBeDisabled();
  });
});

describe('Moderation investigation', () => {
  it('requests staff last logins on open and lists them', () => {
    const { webClient, store } = setup();
    expect(moderator(webClient).getModeratorLastLogins).toHaveBeenCalledTimes(1);

    act(() => {
      store.dispatch(server.Actions.moderatorLastLogins({
        logins: [create(ServerInfo_ModeratorLoginSchema, { userName: 'boss', userLevel: IsAdmin | IsModerator | IsJudge })],
      }));
    });

    const staff = screen.getByRole('region', { name: /staff\.title/ });
    expect(within(staff).getByText('boss')).toBeInTheDocument();
    expect(within(staff).getByText('ModerationPage.level.admin / ModerationPage.level.moderator / ModerationPage.level.judge'))
      .toBeInTheDocument();
  });

  it('runs the three lookups for a simplified name and shows their results', async () => {
    const { webClient, store } = setup();
    await investigate('  bad   guy ');

    const mod = moderator(webClient);
    expect(mod.reportUserInfo).toHaveBeenCalledWith('bad guy');
    expect(mod.getUserSessions).toHaveBeenCalledWith('bad guy');
    expect(mod.getUserAlts).toHaveBeenCalledWith('bad guy');
    expect(within(screen.getByRole('region', { name: /alts\.title/ })).getByText('ModerationPage.value.loading')).toBeInTheDocument();

    act(() => {
      store.dispatch(server.Actions.userAlts({
        userName: 'bad guy',
        alts: [create(ServerInfo_UserAltSchema, { userName: 'bad guy2', banCount: 3, isActive: true })],
      }));
      store.dispatch(server.Actions.userSessions({
        userName: 'bad guy',
        sessions: [create(ServerInfo_UserSessionSchema, { ipAddress: '10.1.2.3', endTime: 0n, connectionType: 'websocket' })],
      }));
      store.dispatch(server.Actions.userInfoReport({
        info: create(Response_ReportUserInfoSchema, { userName: 'bad guy', isActive: false, totalBans: 3, adminNotes: '' }),
      }));
    });

    const alts = screen.getByRole('region', { name: /alts\.title/ });
    expect(within(alts).getByText('bad guy2')).toBeInTheDocument();
    const sessions = screen.getByRole('region', { name: /sessions\.title/ });
    expect(within(sessions).getByText('10.1.2.3')).toBeInTheDocument();
    expect(within(sessions).getByText('ModerationPage.value.activeSession')).toBeInTheDocument();
    const info = screen.getByRole('region', { name: /info\.title/ });
    expect(within(info).getByText('ModerationPage.info.inactive')).toBeInTheDocument();
    expect(within(info).getByText('ModerationPage.info.noNotes')).toBeInTheDocument();
  });

  it('reports a failed info lookup and leaves the alts table empty on failure', async () => {
    const { webClient, store } = setup();
    await investigate('ghost');
    const mod = moderator(webClient);

    expect(mod.getUserAlts).toHaveBeenCalledWith('ghost');
    act(() => {
      store.dispatch(failed('reportUserInfo', 'ghost', Response_ResponseCode.RespNameNotFound));
      store.dispatch(failed('getUserAlts', 'ghost', Response_ResponseCode.RespInternalError));
    });

    expect(screen.getByText('ModerationPage.info.loadError')).toBeInTheDocument();
    const alts = screen.getByRole('region', { name: /alts\.title/ });
    expect(within(alts).queryByText('ModerationPage.value.loading')).not.toBeInTheDocument();
  });

  it('ignores a late answer for a user no longer investigated', async () => {
    const { store } = setup();
    await investigate('first');
    await investigate('second');

    act(() => {
      store.dispatch(server.Actions.userAlts({ userName: 'first', alts: [create(ServerInfo_UserAltSchema, { userName: 'stale' })] }));
    });

    expect(screen.queryByText('stale')).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: /alts\.title/ })).getByText('ModerationPage.value.loading')).toBeInTheDocument();
  });

  it('investigates the user named in the route (useOpenUserInvestigation)', () => {
    const { webClient } = setup(MODERATOR, '/moderation?user=alice');
    expect(moderator(webClient).getUserAlts).toHaveBeenCalledWith('alice');
    expect(screen.getByRole('searchbox', { name: /search\.placeholder/ })).toHaveValue('alice');
  });
});

describe('Moderation remediation', () => {
  it('resets a password after confirmation and shows the temporary password once', async () => {
    const { webClient, store } = setup(ADMIN, '/moderation?user=alice');

    fireEvent.click(screen.getByRole('button', { name: /action\.resetPassword/ }));
    expect(screen.getByText('ModerationPage.confirm.reset')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /button\.ok/ }));

    const reset = webClient.request.admin.resetUserPassword as unknown as Mock;
    expect(reset).toHaveBeenCalledWith('alice', expect.any(Function), expect.any(Function));
    act(() => reset.mock.calls[0][1]('alice', 's3cr3t-temp'));

    const password = screen.getByRole('textbox', { name: 'ModerationPage.password.label' });
    expect(password).toHaveValue('s3cr3t-temp');
    expect(password).toHaveAttribute('readonly');
    (password as HTMLInputElement).select();
    expect((password as HTMLInputElement).selectionStart).toBe(0);
    expect((password as HTMLInputElement).selectionEnd).toBe('s3cr3t-temp'.length);
    expect(JSON.stringify(store.getState())).not.toContain('s3cr3t-temp');

    const passwordDialog = screen.getByRole('dialog', { name: 'ModerationPage.password.title' });
    fireEvent.click(within(passwordDialog).getByRole('button', { name: /button\.ok/ }));
    expect(screen.queryByDisplayValue('s3cr3t-temp')).not.toBeInTheDocument();
  });

  it('sends nothing when the reset is cancelled', () => {
    const { webClient } = setup(ADMIN, '/moderation?user=alice');
    fireEvent.click(screen.getByRole('button', { name: /action\.resetPassword/ }));
    fireEvent.click(screen.getByRole('button', { name: /button\.cancel/ }));
    expect(webClient.request.admin.resetUserPassword).not.toHaveBeenCalled();
  });

  it('removes an avatar after confirmation and reports a refusal', () => {
    const { webClient, store } = setup(MODERATOR, '/moderation?user=alice');
    fireEvent.click(screen.getByRole('button', { name: /action\.removeAvatar/ }));
    fireEvent.click(screen.getByRole('button', { name: /button\.ok/ }));

    expect(moderator(webClient).removeUserAvatar).toHaveBeenCalledWith('alice');
    act(() => {
      store.dispatch(failed('removeUserAvatar', 'alice', Response_ResponseCode.RespNameNotFound));
    });
    expect(screen.getByText('ModerationPage.notice.avatarFailed')).toBeInTheDocument();
  });
});

describe('Moderation failures and acknowledgements', () => {
  it('reports a removed avatar once Servatrice acknowledges it', () => {
    const { store } = setup(MODERATOR, '/moderation?user=alice');
    fireEvent.click(screen.getByRole('button', { name: /action\.removeAvatar/ }));
    fireEvent.click(screen.getByRole('button', { name: /button\.ok/ }));
    act(() => {
      store.dispatch(server.Actions.userAvatarRemoved({ userName: 'Alice' }));
    });
    expect(screen.getByText('ModerationPage.notice.avatarRemoved')).toBeInTheDocument();
  });

  it('says why the user info could not load when the server never answered', async () => {
    const { store } = setup();
    await investigate('ghost');
    act(() => {
      store.dispatch(failed('reportUserInfo', 'ghost', Response_ResponseCode.RespNotConnected, WebsocketTypes.CommandFailure.Timeout));
    });
    expect(within(screen.getByRole('region', { name: /info\.title/ })).getByText('CommandFailure.timeout')).toBeInTheDocument();
  });

  it('clears the staff list when its lookup fails', () => {
    const { store } = setup();
    act(() => {
      store.dispatch(server.Actions.moderatorLastLogins({ logins: [create(ServerInfo_ModeratorLoginSchema, { userName: 'boss' })] }));
    });
    expect(screen.getByText('boss')).toBeInTheDocument();
    act(() => {
      store.dispatch(failed('getModeratorLastLogins', '', Response_ResponseCode.RespInternalError));
    });
    expect(screen.queryByText('boss')).not.toBeInTheDocument();
  });

  it('explains a password reset the server never answered', () => {
    const { webClient } = setup(ADMIN, '/moderation?user=alice');
    fireEvent.click(screen.getByRole('button', { name: /action\.resetPassword/ }));
    fireEvent.click(screen.getByRole('button', { name: /button\.ok/ }));
    const reset = webClient.request.admin.resetUserPassword as unknown as Mock;
    act(() => reset.mock.calls[0][2](Response_ResponseCode.RespNotConnected, WebsocketTypes.CommandFailure.Disconnected));
    expect(screen.getByText('CommandFailure.disconnected')).toBeInTheDocument();
  });
});

describe.each(['resetPassword', 'removeAvatar'])('cancel-default %s', (action) => {
  it('initially focuses Cancel', () => {
    setup(ADMIN, '/moderation?user=alice');
    fireEvent.click(screen.getByRole('button', { name: `ModerationPage.action.${action}` }));
    expect(screen.getByRole('button', { name: 'ModerationPage.button.cancel' })).toHaveFocus();
  });

  it('Enter on open cancels without sending a command', () => {
    const { webClient } = setup(ADMIN, '/moderation?user=alice');
    fireEvent.click(screen.getByRole('button', { name: `ModerationPage.action.${action}` }));
    const focused = document.activeElement!;
    if (fireEvent.keyDown(focused, { key: 'Enter', code: 'Enter' })) {
      fireEvent.click(focused);
    }
    fireEvent.keyUp(focused, { key: 'Enter', code: 'Enter' });
    expect(webClient.request.admin.resetUserPassword).not.toHaveBeenCalled();
    expect(moderator(webClient).removeUserAvatar).not.toHaveBeenCalled();
  });
});

it('names each staff table independently of its surrounding section', () => {
  setup();
  for (const part of ['alts', 'sessions', 'staff']) {
    expect(screen.getByRole('table', { name: `ModerationPage.${part}.title` })).toBeInTheDocument();
  }
});

it('prunes prior private results and ignores late responses when switching the investigation', async () => {
  const { store } = setup();
  const response = attachResponseHandlers(store).moderator;
  const alts = [create(ServerInfo_UserAltSchema, { email: 'private@example.test', clientid: 'private-client' })];
  const sessions = [create(ServerInfo_UserSessionSchema, { ipAddress: '192.0.2.7', clientid: 'private-session' })];
  const info = create(Response_ReportUserInfoSchema, { userName: 'alice', adminNotes: 'private-note' });
  await investigate('alice');
  act(() => {
    response.reportUserInfo!(info);
    response.userAlts!('alice', alts);
    response.userSessions!('alice', sessions);
  });
  expect(JSON.stringify(store.getState())).toContain('private@example.test');
  await investigate('bob');
  const expectPruned = () => {
    const stored = JSON.stringify(store.getState());
    for (const secret of ['private@example.test', 'private-client', '192.0.2.7', 'private-session', 'private-note']) {
      expect(stored).not.toContain(secret);
    }
  };
  expectPruned();
  act(() => {
    response.reportUserInfo!(info);
    response.userAlts!('alice', alts);
    response.userSessions!('alice', sessions);
  });
  expectPruned();
});
