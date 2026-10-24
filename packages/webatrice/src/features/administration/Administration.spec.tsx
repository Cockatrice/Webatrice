import { act, fireEvent, screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';

import { setAdminLocked } from '@app/hooks';
import { server } from '@cockatrice/datatrice';
import { Response_ResponseCode, ServerInfo_User_UserLevelFlag } from '@cockatrice/sockatrice/generated';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { connectedState, createMockWebClient, makeUser, renderWithProviders } from '../../__test-utils__';
import Administration from './Administration';

const { IsRegistered, IsModerator, IsAdmin } = ServerInfo_User_UserLevelFlag;

function stateFor(userLevel: number) {
  return {
    ...connectedState,
    server: { ...(connectedState.server as any), user: makeUser({ name: 'staff', userLevel }) },
  };
}

function setup(userLevel = IsRegistered | IsModerator | IsAdmin) {
  const webClient = createMockWebClient();
  const utils = renderWithProviders(<Administration />, {
    preloadedState: stateFor(userLevel),
    route: '/administration',
    webClient,
  });
  return { ...utils, webClient };
}

const button = (name: RegExp) => screen.getByRole('button', { name });

beforeEach(() => {
  setAdminLocked(false);
});

describe('Administration permissions', () => {
  it('enables both groups for an admin', () => {
    setup();
    expect(button(/admin\.updateServerMessage/)).toBeEnabled();
    expect(button(/admin\.shutdownServer/)).toBeEnabled();
    expect(button(/admin\.reloadConfig/)).toBeEnabled();
    expect(screen.getByRole('textbox', { name: /moderator\.userToActivate/ })).toBeEnabled();
  });

  it('keeps the server administration group disabled for a moderator who is not an admin', () => {
    setup(IsRegistered | IsModerator);
    expect(button(/admin\.updateServerMessage/)).toBeDisabled();
    expect(button(/admin\.shutdownServer/)).toBeDisabled();
    expect(button(/admin\.reloadConfig/)).toBeDisabled();
    expect(screen.getByRole('textbox', { name: /moderator\.replayId/ })).toBeEnabled();
  });

  it('sends a plain user back to the server page', () => {
    renderWithProviders(
      <Routes>
        <Route path="/server" element={<div>server-page</div>} />
        <Route path="/administration" element={<Administration />} />
      </Routes>,
      { preloadedState: stateFor(IsRegistered), route: '/administration', webClient: createMockWebClient() },
    );
    expect(screen.getByText('server-page')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /admin\.updateServerMessage/ })).not.toBeInTheDocument();
  });
});

describe('Administration lock', () => {
  it('greys every function out while the console lock is on, until Unlock', () => {
    setup();
    expect(screen.queryByRole('button', { name: 'Administration.button.unlock' })).not.toBeInTheDocument();

    fireEvent.click(button(/^Staff\.lock\.lock$/));
    expect(button(/admin\.updateServerMessage/)).toBeDisabled();
    expect(screen.getByRole('textbox', { name: /moderator\.replayId/ })).toBeDisabled();
    expect(screen.getByText('Administration.lockedNotice')).toBeInTheDocument();

    fireEvent.click(button(/^Administration\.button\.unlock$/));
    expect(button(/admin\.updateServerMessage/)).toBeEnabled();
    expect(button(/^Staff\.lock\.lock$/)).toBeInTheDocument();
  });
});

describe('Administration server functions', () => {
  it('sends Command_UpdateServerMessage and Command_ReloadConfig', () => {
    const { webClient } = setup();
    fireEvent.click(button(/admin\.updateServerMessage/));
    fireEvent.click(button(/admin\.reloadConfig/));
    expect(webClient.request.admin.updateServerMessage).toHaveBeenCalledTimes(1);
    expect(webClient.request.admin.reloadConfig).toHaveBeenCalledTimes(1);
  });

  it('acknowledges a server message update with a toast', () => {
    const { store } = setup();
    act(() => {
      store.dispatch(server.Actions.updateServerMessage());
    });
    expect(screen.getByText('Administration.result.serverMessageUpdated')).toBeInTheDocument();
  });

  it('shuts down with the reason and minutes from the dialog (default 5)', async () => {
    const { webClient } = setup();
    fireEvent.click(button(/admin\.shutdownServer/));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/shutdown\.reason/), { target: { value: 'maintenance' } });

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: /shutdown\.confirm/ }));
    });

    expect(webClient.request.admin.shutdownServer).toHaveBeenCalledWith('maintenance', 5);
  });

  it('rejects shutdown minutes outside 0..999', async () => {
    const { webClient } = setup();
    fireEvent.click(button(/admin\.shutdownServer/));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/shutdown\.minutes/), { target: { value: '1000' } });

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: /shutdown\.confirm/ }));
    });

    expect(webClient.request.admin.shutdownServer).not.toHaveBeenCalled();
    expect(within(dialog).getByText('Administration.validation.minutes')).toBeInTheDocument();
  });
});

describe('Administration moderator functions', () => {
  const failed = (command: 'grantReplayAccess' | 'forceActivateUser', target: string, responseCode: number,
    failure?: WebsocketTypes.CommandFailure) => server.Actions.moderatorCommandFailed({ command, responseCode, target, failure });

  async function grant(value: string) {
    fireEvent.change(screen.getByRole('textbox', { name: /moderator\.replayId/ }), { target: { value } });
    await act(async () => {
      fireEvent.click(button(/moderator\.grantReplayAccess/));
    });
  }

  async function activate(value: string) {
    fireEvent.change(screen.getByRole('textbox', { name: /moderator\.userToActivate/ }), { target: { value } });
    await act(async () => {
      fireEvent.click(button(/moderator\.forceActivateUser/));
    });
  }

  it('keeps each button disabled until its field has text, and takes digits only for the replay id', () => {
    setup();
    expect(button(/moderator\.grantReplayAccess/)).toBeDisabled();
    expect(button(/moderator\.forceActivateUser/)).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: /moderator\.replayId/ }), { target: { value: '4a2' } });
    expect(screen.getByRole('textbox', { name: /moderator\.replayId/ })).toHaveValue('42');
  });

  it('grants replay access as the logged-in moderator, reports success and re-reads the replay list', async () => {
    const { webClient, store } = setup();
    await grant('42');

    expect(webClient.request.moderator.grantReplayAccess).toHaveBeenCalledWith(42, 'staff');
    act(() => {
      store.dispatch(server.Actions.grantReplayAccess({ replayId: 42, moderatorName: 'staff' }));
    });
    expect(screen.getByText('Administration.result.replayAccessGranted')).toBeInTheDocument();
    expect(webClient.request.session.replayList).toHaveBeenCalled();
  });

  it.each([
    [Response_ResponseCode.RespContextError, 'Administration.result.replayIdInvalid'],
    [Response_ResponseCode.RespInternalError, 'Administration.result.replayAccessInternalError'],
  ])('explains a refused grant (response code %i)', async (code, message) => {
    const { store } = setup();
    await grant('7');
    act(() => {
      store.dispatch(failed('grantReplayAccess', '7', code));
    });
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it('explains a grant the server never answered with the transport reason', async () => {
    const { store } = setup();
    await grant('7');
    act(() => {
      store.dispatch(failed('grantReplayAccess', '7', Response_ResponseCode.RespNotConnected, WebsocketTypes.CommandFailure.Timeout));
    });
    expect(screen.getByText('CommandFailure.timeout')).toBeInTheDocument();
  });

  it('force-activates a trimmed user name and reports the activation', async () => {
    const { webClient, store } = setup();
    await activate(' newbie ');
    expect(webClient.request.moderator.forceActivateUser).toHaveBeenCalledWith('newbie', 'staff');
    act(() => {
      store.dispatch(server.Actions.forceActivateUser({ usernameToActivate: 'newbie', moderatorName: 'staff' }));
    });
    expect(screen.getByText('Administration.result.userActivated')).toBeInTheDocument();
  });

  it.each([
    [Response_ResponseCode.RespNameNotFound, 'Administration.result.activateNameInvalid'],
    [Response_ResponseCode.RespActivationFailed, 'Administration.result.activateAlreadyActive'],
    [Response_ResponseCode.RespInternalError, 'Administration.result.activateInternalError'],
  ])('explains a refused activation (response code %i)', async (code, message) => {
    const { store } = setup();
    await activate('newbie');
    act(() => {
      store.dispatch(failed('forceActivateUser', 'newbie', code));
    });
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it('ignores outcomes of requests it did not send', () => {
    const { store } = setup();
    act(() => {
      store.dispatch(server.Actions.grantReplayAccess({ replayId: 5, moderatorName: 'someone' }));
      store.dispatch(failed('forceActivateUser', 'other', Response_ResponseCode.RespNameNotFound));
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Administration server function failures', () => {
  it('explains a failed server command with desktop-style text or the transport reason', () => {
    const { store } = setup();
    act(() => {
      store.dispatch(server.Actions.adminCommandFailed({
        command: 'reloadConfig', responseCode: Response_ResponseCode.RespFunctionNotAllowed, target: '', failure: undefined,
      }));
    });
    expect(screen.getByText('Administration.result.configReloadFailed')).toBeInTheDocument();
    fireEvent.click(button(/button\.ok/));

    act(() => {
      store.dispatch(server.Actions.adminCommandFailed({
        command: 'updateServerMessage', responseCode: Response_ResponseCode.RespNotConnected, target: '',
        failure: WebsocketTypes.CommandFailure.Disconnected,
      }));
    });
    expect(screen.getByText('CommandFailure.disconnected')).toBeInTheDocument();
  });

  it('leaves adjustMod failures to the user context menu', () => {
    const { store } = setup();
    act(() => {
      store.dispatch(server.Actions.adminCommandFailed({ command: 'adjustMod', responseCode: 3, target: 'bob', failure: undefined }));
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
