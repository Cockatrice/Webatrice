import { act, fireEvent, screen, within } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { create } from '@bufbuild/protobuf';

import { server } from '@cockatrice/datatrice';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import {
  Response_WarnListSchema,
  ServerInfo_BanSchema,
  ServerInfo_User_UserLevelFlag as Flag,
  ServerInfo_WarningSchema,
} from '@cockatrice/sockatrice/generated';

import { connectedState, createMockWebClient, makeUser, renderWithProviders } from '../../__test-utils__';
import { ModerationProvider } from './ModerationProvider';
import type { ModerationAction } from './moderationMenu';
import { REDACT_ALL_MESSAGES } from './useModerationFlow';
import { useModerationMenu } from './useModerationMenu';
import { setAdminLocked } from '@app/hooks';

beforeEach(() => setAdminLocked(false));
afterEach(() => setAdminLocked(false));

const MODERATOR = Flag.IsUser | Flag.IsRegistered | Flag.IsModerator;
const ADMIN = MODERATOR | Flag.IsAdmin;

const Trigger = ({ action, userName = 'alice' }: { action: ModerationAction; userName?: string }) => {
  const { open } = useModerationMenu(userName, Flag.IsUser | Flag.IsRegistered);
  return <button type="button" onClick={() => open(action)}>{`trigger ${action}`}</button>;
};

function setup(action: ModerationAction, localUserLevel = MODERATOR) {
  const webClient = createMockWebClient();
  const self = makeUser({ name: 'mod', userLevel: localUserLevel });
  const preloadedState = {
    ...connectedState,
    server: { ...(connectedState.server as any), user: self },
  };
  const result = renderWithProviders(
    <ModerationProvider>
      <Trigger action={action} />
    </ModerationProvider>,
    { preloadedState, webClient },
  );
  fireEvent.click(screen.getByRole('button', { name: `trigger ${action}` }));
  const ids = {
    user: () => vi.mocked(webClient.request.session.getUserInfo).mock.lastCall?.[1],
    warnings: () => vi.mocked(webClient.request.moderator.getWarnList).mock.lastCall?.[3],
    bans: () => vi.mocked(webClient.request.moderator.getBanHistory).mock.lastCall?.[1],
    warns: () => vi.mocked(webClient.request.moderator.getWarnHistory).mock.lastCall?.[1],
    notes: () => vi.mocked(webClient.request.moderator.getAdminNotes).mock.lastCall?.[1],
    role: () => vi.mocked(webClient.request.admin.adjustMod).mock.lastCall?.[4],
  };
  return { ...result, webClient, ids };
}

const alice = makeUser({ name: 'alice', address: '10.0.0.7', clientid: 'cid-alice', userLevel: Flag.IsRegistered });

describe('ModerationProvider', () => {
  describe('warn user', () => {
    it('opens without cached reasons after a failed lookup, then uses fresh reasons on retry', () => {
      const { store, ids } = setup('warnUser');
      act(() => {
        store.dispatch(server.Actions.getUserInfo({ userInfo: alice, requestId: ids.user() }));
      });
      act(() => {
        store.dispatch(server.Actions.warnListOptions({
          requestId: ids.warnings(),
          warnList: [create(Response_WarnListSchema, { warning: ['Old reason'], userName: 'alice' })],
        }));
      });
      fireEvent.click(screen.getByRole('button', { name: 'Moderation.common.cancel' }));
      fireEvent.click(screen.getByRole('button', { name: 'trigger warnUser' }));
      act(() => {
        store.dispatch(server.Actions.getUserInfo({ userInfo: alice, requestId: ids.user() }));
      });
      act(() => {
        store.dispatch(server.Actions.moderatorCommandFailed({
          requestId: ids.warnings(), command: 'warnList', responseCode: 3, target: 'alice',
        }));
      });
      const dialog = screen.getByRole('dialog', { name: 'Moderation.warn.title' });
      expect(within(dialog).queryByRole('option', { name: 'Old reason' })).not.toBeInTheDocument();
      expect(within(dialog).getAllByRole('option')).toHaveLength(1);

      fireEvent.click(screen.getByRole('button', { name: 'Moderation.common.cancel' }));
      fireEvent.click(screen.getByRole('button', { name: 'trigger warnUser' }));
      act(() => {
        store.dispatch(server.Actions.getUserInfo({ userInfo: alice, requestId: ids.user() }));
      });
      act(() => {
        store.dispatch(server.Actions.warnListOptions({
          requestId: ids.warnings(),
          warnList: [create(Response_WarnListSchema, { warning: ['Fresh reason'], userName: 'alice' })],
        }));
      });
      expect(screen.getByRole('option', { name: 'Fresh reason' })).toBeInTheDocument();
    });

    it('fetches user info, then the official warnings, then opens the warning dialog', () => {
      const { store, webClient, ids } = setup('warnUser');
      expect(webClient.request.session.getUserInfo).toHaveBeenCalledWith('alice', expect.any(String));
      expect(screen.getByRole('dialog', { name: 'Moderation.common.loading' })).toBeInTheDocument();

      act(() => {
        store.dispatch(server.Actions.getUserInfo({ requestId: ids.user(), userInfo: alice }));
      });
      expect(webClient.request.moderator.getWarnList).toHaveBeenCalledWith('mod', 'alice', 'cid-alice', expect.any(String));

      act(() => {
        store.dispatch(server.Actions.warnListOptions({ requestId: ids.warnings(),
          warnList: [create(Response_WarnListSchema, {
            warning: ['Spamming', 'Flaming', 'Cheating'],
            warningIl: [1, 3],
            userName: 'alice',
            userClientid: 'cid-alice',
          })],
        }));
      });
      const dialog = screen.getByRole('dialog', { name: 'Moderation.warn.title' });
      const options = within(dialog).getAllByRole('option');
      expect(options.map((option) => option.textContent)).toEqual(['', 'Spamming', 'Moderation.warn.withLevel', 'Cheating']);
      expect(options.map((option) => option.getAttribute('value'))).toEqual(['', 'Spamming', 'Flaming', 'Cheating']);
    });

    it('sends Command_WarnUser with the chosen warning, client id and the redact-all amount', async () => {
      const { store, webClient, ids } = setup('warnUser');
      act(() => {
        store.dispatch(server.Actions.getUserInfo({ requestId: ids.user(), userInfo: alice }));
      });
      act(() => {
        store.dispatch(server.Actions.warnListOptions({ requestId: ids.warnings(),
          warnList: [create(Response_WarnListSchema, { warning: ['Spamming'], userName: 'alice' })],
        }));
      });

      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Spamming' } });
      fireEvent.click(screen.getByRole('checkbox'));
      fireEvent.click(screen.getByRole('button', { name: 'Moderation.common.ok' }));

      await vi.waitFor(() => {
        expect(webClient.request.moderator.warnUser).toHaveBeenCalledWith('alice', 'Spamming', 'cid-alice', REDACT_ALL_MESSAGES);
      });
      expect(screen.queryByRole('dialog', { name: 'Moderation.warn.title' })).not.toBeInTheDocument();
    });

    it('still asks for the warning list, with an empty client id, when the user info fails', () => {
      const { store, webClient, ids } = setup('warnUser');
      act(() => {
        store.dispatch(server.Actions.getUserInfoFailed({ requestId: ids.user(), userName: 'alice', responseCode: 34 }));
      });
      expect(webClient.request.moderator.getWarnList).toHaveBeenCalledWith('mod', 'alice', '', expect.any(String));

      act(() => {
        store.dispatch(server.Actions.warnListOptions({ requestId: ids.warnings(),
          warnList: [create(Response_WarnListSchema, { warning: ['Spamming'], userName: 'alice' })],
        }));
      });
      expect(screen.getByRole('dialog', { name: 'Moderation.warn.title' })).toBeInTheDocument();
    });

    it('refuses to send without a warning, with desktop\'s message', async () => {
      const { store, webClient, ids } = setup('warnUser');
      act(() => {
        store.dispatch(server.Actions.getUserInfo({ requestId: ids.user(), userInfo: alice }));
      });
      act(() => {
        store.dispatch(server.Actions.warnListOptions({ requestId: ids.warnings(),
          warnList: [create(Response_WarnListSchema, { warning: ['Spamming'], userName: 'alice' })],
        }));
      });
      fireEvent.click(screen.getByRole('button', { name: 'Moderation.common.ok' }));
      expect(await screen.findByText('Moderation.warn.errorBlankReason')).toBeInTheDocument();
      expect(webClient.request.moderator.warnUser).not.toHaveBeenCalled();
    });
  });

  describe('ban user', () => {
    it('opens with only the name filled in when the user info fails', () => {
      const { store, ids } = setup('banUser');
      act(() => {
        store.dispatch(server.Actions.getUserInfoFailed({ requestId: ids.user(), userName: 'alice', responseCode: 34 }));
      });
      const dialog = screen.getByRole('dialog', { name: 'Moderation.ban.title' });
      expect(within(dialog).getByRole('textbox', { name: 'Moderation.ban.byName' })).toHaveValue('alice');
      expect(within(dialog).getByRole('textbox', { name: 'Moderation.ban.byIp' })).toHaveValue('');
    });

    it('ignores a user info failure for another user', () => {
      const { store, ids } = setup('banUser');
      act(() => {
        store.dispatch(server.Actions.getUserInfoFailed({ requestId: ids.user(), userName: 'bob', responseCode: 34 }));
      });
      expect(screen.getByRole('dialog', { name: 'Moderation.common.loading' })).toBeInTheDocument();
    });

    it('pre-fills name, IP and client id from the user info and sends a 5-minute temporary ban by default', async () => {
      const { store, webClient, ids } = setup('banUser');
      expect(webClient.request.session.getUserInfo).toHaveBeenCalledWith('alice', expect.any(String));
      act(() => {
        store.dispatch(server.Actions.getUserInfo({ requestId: ids.user(), userInfo: alice }));
      });
      const dialog = screen.getByRole('dialog', { name: 'Moderation.ban.title' });
      expect(within(dialog).getByRole('textbox', { name: 'Moderation.ban.byIp' })).toHaveValue('10.0.0.7');

      fireEvent.click(within(dialog).getByRole('button', { name: 'Moderation.common.ok' }));
      await vi.waitFor(() => {
        expect(webClient.request.moderator.banFromServer).toHaveBeenCalledWith(
          5, 'alice', '10.0.0.7', '', '', 'cid-alice', undefined,
        );
      });
    });
  });

  describe('histories', () => {
    it('shows the ban history table when the server returns bans', () => {
      const { store, webClient, ids } = setup('banHistory');
      expect(webClient.request.moderator.getBanHistory).toHaveBeenCalledWith('alice', expect.any(String));
      act(() => {
        store.dispatch(server.Actions.banHistory({ requestId: ids.bans(),
          userName: 'alice',
          banHistory: [create(ServerInfo_BanSchema, { adminName: 'mod', banTime: '2026-01-01', banLength: '60', banReason: 'spam' })],
        }));
      });
      const dialog = screen.getByRole('dialog', { name: 'Moderation.banHistory.title' });
      expect(within(dialog).getByRole('cell', { name: 'spam' })).toBeInTheDocument();
    });

    it('says the user has never been banned for an empty history', () => {
      const { store, ids } = setup('banHistory');
      act(() => {
        store.dispatch(server.Actions.banHistory({ requestId: ids.bans(), userName: 'alice', banHistory: [] }));
      });
      expect(screen.getByText('Moderation.banHistory.empty')).toBeInTheDocument();
    });

    it('reports a failed ban history request', () => {
      const { store, ids } = setup('banHistory');
      act(() => {
        store.dispatch(server.Actions.moderatorCommandFailed({
          requestId: ids.bans(), command: 'banHistory', responseCode: 3, target: 'alice'
        }));
      });
      expect(screen.getByText('Moderation.banHistory.failed')).toBeInTheDocument();
    });

    it('explains a ban history request cut off by a disconnect', () => {
      const { store, ids } = setup('banHistory');
      act(() => {
        store.dispatch(server.Actions.moderatorCommandFailed({
          requestId: ids.bans(), command: 'banHistory', responseCode: -1, target: 'alice',
          failure: WebsocketTypes.CommandFailure.Disconnected,
        }));
      });
      expect(screen.getByText('Moderation.banHistory.title')).toBeInTheDocument();
      expect(screen.getByText('CommandFailure.disconnected')).toBeInTheDocument();
    });

    it('shows the warn history table with desktop\'s four columns', () => {
      const { store, webClient, ids } = setup('warnHistory');
      expect(webClient.request.moderator.getWarnHistory).toHaveBeenCalledWith('alice', expect.any(String));
      act(() => {
        store.dispatch(server.Actions.warnHistory({ requestId: ids.warns(),
          userName: 'alice',
          warnHistory: [create(ServerInfo_WarningSchema, { userName: 'alice', adminName: 'mod', reason: 'Flaming', timeOf: 't' })],
        }));
      });
      const dialog = screen.getByRole('dialog', { name: 'Moderation.warnHistory.title' });
      expect(within(dialog).getAllByRole('columnheader')).toHaveLength(4);
      expect(within(dialog).getByRole('cell', { name: 'Flaming' })).toBeInTheDocument();
    });

    it('says the user has never been warned for an empty history', () => {
      const { store, ids } = setup('warnHistory');
      act(() => {
        store.dispatch(server.Actions.warnHistory({ requestId: ids.warns(), userName: 'alice', warnHistory: [] }));
      });
      expect(screen.getByText('Moderation.warnHistory.empty')).toBeInTheDocument();
    });
  });

  describe('admin notes', () => {
    it('opens the editor with the stored notes and saves an edit', () => {
      const { store, webClient, ids } = setup('adminNotes');
      expect(webClient.request.moderator.getAdminNotes).toHaveBeenCalledWith('alice', expect.any(String));
      act(() => {
        store.dispatch(server.Actions.getAdminNotes({ requestId: ids.notes(), userName: 'alice', notes: 'watch' }));
      });
      const editor = screen.getByRole('textbox', { name: 'Moderation.adminNotes.title' });
      expect(editor).toHaveValue('watch');
      const update = screen.getByRole('button', { name: 'Moderation.adminNotes.update' });
      expect(update).toBeDisabled();

      fireEvent.change(editor, { target: { value: 'watch closely' } });
      expect(update).toBeEnabled();
      fireEvent.click(update);
      return vi.waitFor(() => {
        expect(webClient.request.moderator.updateAdminNotes).toHaveBeenCalledWith('alice', 'watch closely');
      });
    });

    it('reports a failed notes lookup', () => {
      const { store, ids } = setup('adminNotes');
      act(() => {
        store.dispatch(server.Actions.moderatorCommandFailed({
          requestId: ids.notes(), command: 'getAdminNotes', responseCode: 6, target: 'alice'
        }));
      });
      expect(screen.getByText('Moderation.adminNotes.failed')).toBeInTheDocument();
    });
  });

  describe('role changes', () => {
    it('sends only should_be_mod for a promotion and reports success', () => {
      const { store, webClient, ids } = setup('promoteMod', ADMIN);
      expect(webClient.request.admin.adjustMod).toHaveBeenCalledWith('alice', true, undefined, undefined, expect.any(String));
      act(() => {
        store.dispatch(server.Actions.adjustMod({ requestId: ids.role(), userName: 'alice', shouldBeMod: true }));
      });
      expect(screen.getByText('Moderation.adjustMod.promoted')).toBeInTheDocument();
    });

    it('sends only should_be_developer for a developer promotion', () => {
      const { webClient } = setup('promoteDeveloper', ADMIN);
      expect(webClient.request.admin.adjustMod).toHaveBeenCalledWith('alice', undefined, undefined, true, expect.any(String));
    });

    it('sends only should_be_judge for a demotion and reports failure', () => {
      const { store, webClient, ids } = setup('demoteJudge', ADMIN);
      expect(webClient.request.admin.adjustMod).toHaveBeenCalledWith('alice', undefined, false, undefined, expect.any(String));
      act(() => {
        store.dispatch(server.Actions.adminCommandFailed({
          requestId: ids.role(), command: 'adjustMod', responseCode: 3, target: 'alice'
        }));
      });
      expect(screen.getByText('Moderation.adjustMod.demoteFailed')).toBeInTheDocument();
    });
  });

  describe('menu gating', () => {
    const MenuActions = () => {
      const { groups } = useModerationMenu('alice', Flag.IsUser | Flag.IsRegistered);
      return <ul>{groups.flat().map((entry) => <li key={entry.action}>{entry.action}</li>)}</ul>;
    };

    const renderMenu = (version: string) => renderWithProviders(
      <ModerationProvider>
        <MenuActions />
      </ModerationProvider>,
      {
        preloadedState: {
          ...connectedState,
          server: {
            ...(connectedState.server as any),
            info: { ...(connectedState.server as any).info, version },
            user: makeUser({ name: 'mod', userLevel: ADMIN }),
          },
        },
        webClient: createMockWebClient(),
      },
    );

    it('hides the developer entry from an admin on a 3.0 server', () => {
      renderMenu('3.0.0 (2026-05-08)');
      expect(screen.getByText('promoteJudge')).toBeInTheDocument();
      expect(screen.queryByText('promoteDeveloper')).not.toBeInTheDocument();
    });

    it('offers the developer entry to an admin on a 3.1 server', () => {
      renderMenu('3.1.0-beta.12 (2026-09-01)');
      expect(screen.getByText('promoteDeveloper')).toBeInTheDocument();
    });
  });
});

describe('investigate user', () => {
  it('opens the Moderation page on the user, as desktop openTabModeration(userName)', () => {
    const LocationProbe = () => {
      const location = useLocation();
      return <span data-testid="location">{location.pathname + location.search}</span>;
    };
    const webClient = createMockWebClient();
    renderWithProviders(
      <ModerationProvider>
        <Trigger action="investigateUser" />
        <LocationProbe />
      </ModerationProvider>,
      {
        preloadedState: {
          ...connectedState,
          server: { ...(connectedState.server as any), user: makeUser({ name: 'mod', userLevel: MODERATOR }) },
        },
        webClient,
      },
    );

    fireEvent.click(screen.getByRole('button', { name: 'trigger investigateUser' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/moderation?user=alice');
  });
});
