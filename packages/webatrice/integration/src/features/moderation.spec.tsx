
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { create, isFieldSet } from '@bufbuild/protobuf';
import type { GenExtension } from '@bufbuild/protobuf/codegenv2';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  Command_AdjustModSchema,
  Command_AdjustMod_ext,
  Command_BanFromServer_ext,
  Command_ForceActivateUser_ext,
  Command_GetAdminNotes_ext,
  Command_GetBanHistory_ext,
  Command_GetUserInfo_ext,
  Command_GetWarnHistory_ext,
  Command_GetWarnList_ext,
  Command_GrantReplayAccess_ext,
  Command_Login_ext,
  Command_ReplayList_ext,
  Command_UpdateAdminNotes_ext,
  Command_ViewLogHistory_ext,
  Command_WarnUser_ext,
  Response,
  Response_BanHistorySchema,
  Response_BanHistory_ext,
  Response_GetAdminNotesSchema,
  Response_GetAdminNotes_ext,
  Response_GetUserInfoSchema,
  Response_GetUserInfo_ext,
  Response_LoginSchema,
  Response_Login_ext,
  Response_ResponseCode,
  Response_ViewLogHistorySchema,
  Response_ViewLogHistory_ext,
  Response_WarnHistorySchema,
  Response_WarnHistory_ext,
  Response_WarnListSchema,
  Response_WarnList_ext,
  ServerInfo_User,
  ServerInfo_UserSchema,
  ServerInfo_User_UserLevelFlag as Flag,
  ServerInfo_WarningSchema,
} from '@cockatrice/sockatrice/generated';
import { UserDisplay } from '@app/components';
import { ModerationProvider } from '@app/feature-widgets/moderation';
import { Administration } from '@app/features/administration';
import { Logs } from '@app/features/logs';
import { setAdminLocked } from '@app/hooks';

import { connectAndHandshake } from '../helpers/setup';
import { buildResponse, buildResponseMessage, deliverMessage } from '../helpers/protobuf-builders';
import { findLastAdminCommand, findLastModeratorCommand, findLastSessionCommand } from '../helpers/command-capture';
import { renderFeatureScreen } from './helpers';

const MODERATOR = Flag.IsUser | Flag.IsRegistered | Flag.IsModerator;
const ADMIN = MODERATOR | Flag.IsAdmin;

function loginAs(name: string, userLevel: number): void {
  connectAndHandshake({ userName: name });
  const login = findLastSessionCommand(Command_Login_ext);
  deliverMessage(buildResponseMessage(buildResponse({
    cmdId: login.cmdId,
    ext: Response_Login_ext,
    value: create(Response_LoginSchema, {
      userInfo: create(ServerInfo_UserSchema, { name, userLevel }),
      buddyList: [],
      ignoreList: [],
    }),
  })));
}

function respond<V>(cmdId: number, ext?: GenExtension<Response, V>, value?: V, responseCode = Response_ResponseCode.RespOk) {
  act(() => {
    deliverMessage(buildResponseMessage(buildResponse({ cmdId, responseCode, ext, value })));
  });
}

function makeTarget(name: string, extra: Partial<ServerInfo_User> = {}): ServerInfo_User {
  return create(ServerInfo_UserSchema, { name, userLevel: Flag.IsUser | Flag.IsRegistered, ...extra });
}

function renderUserRow(target: ServerInfo_User) {
  renderFeatureScreen(
    <ModerationProvider>
      <UserDisplay user={target} />
    </ModerationProvider>,
  );
}

function chooseFromMenu(name: string, entry: string) {
  fireEvent.contextMenu(screen.getByText(name));
  fireEvent.click(screen.getByRole('menuitem', { name: entry }));
}

beforeEach(() => {
  setAdminLocked(false);
  vi.useRealTimers();
});

describe('moderation round trips (integration)', () => {
  it('warn: GetUserInfo → GetWarnList → WarningDialog → WarnUser', async () => {
    loginAs('mod', MODERATOR);
    const target = makeTarget('warnee', { clientid: 'cid-warnee' });
    renderUserRow(target);

    chooseFromMenu('warnee', 'Moderation.menu.warnUser');
    const info = findLastSessionCommand(Command_GetUserInfo_ext);
    expect(info.value.userName).toBe('warnee');
    respond(info.cmdId, Response_GetUserInfo_ext, create(Response_GetUserInfoSchema, { userInfo: target }));

    const warnList = findLastModeratorCommand(Command_GetWarnList_ext);
    expect(warnList.value).toMatchObject({ userName: 'warnee', userClientid: 'cid-warnee' });
    respond(warnList.cmdId, Response_WarnList_ext, create(Response_WarnListSchema, {
      warning: ['Spamming', 'Flaming'],
      userName: 'warnee',
      userClientid: 'cid-warnee',
    }));

    const dialog = await screen.findByRole('dialog', { name: 'Moderation.warn.title' });
    fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'Flaming' } });
    fireEvent.click(within(dialog).getByRole('checkbox'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Moderation.common.ok' }));

    await waitFor(() => {
      expect(findLastModeratorCommand(Command_WarnUser_ext).value).toMatchObject({
        userName: 'warnee',
        reason: 'Flaming',
        clientid: 'cid-warnee',
        removeMessages: 0xffffffff,
      });
    });
  });

  it('ban: GetUserInfo → BanDialog pre-filled → BanFromServer', async () => {
    loginAs('mod', MODERATOR);
    const target = makeTarget('bannee', { address: '10.1.2.3', clientid: '' });
    renderUserRow(target);

    chooseFromMenu('bannee', 'Moderation.menu.banUser');
    const info = findLastSessionCommand(Command_GetUserInfo_ext);
    respond(info.cmdId, Response_GetUserInfo_ext, create(Response_GetUserInfoSchema, { userInfo: target }));

    const dialog = await screen.findByRole('dialog', { name: 'Moderation.ban.title' });
    expect(within(dialog).getByRole('checkbox', { name: 'Moderation.ban.byClientId' })).not.toBeChecked();
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Moderation.ban.permanent' }));
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Moderation.ban.visibleReason' }), {
      target: { value: 'Cheating' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Moderation.common.ok' }));

    await waitFor(() => {
      expect(findLastModeratorCommand(Command_BanFromServer_ext).value).toMatchObject({
        userName: 'bannee',
        address: '10.1.2.3',
        clientid: '',
        minutes: 0,
        visibleReason: 'Cheating',
      });
    });
  });

  it('ban by keyboard: Shift+F10 on the name → arrows to "Ban from server" → Enter → BanFromServer', async () => {
    const user = userEvent.setup();
    loginAs('mod', MODERATOR);
    const target = makeTarget('bannee', { address: '10.1.2.3', clientid: '' });
    renderUserRow(target);

    screen.getByRole('link', { name: /bannee/ }).focus();
    await user.keyboard('{Shift>}{F10}{/Shift}');
    const ban = screen.getByRole('menuitem', { name: 'Moderation.menu.banUser' });
    for (let step = 0; step < 20 && document.activeElement !== ban; step += 1) {
      await user.keyboard('{ArrowDown}');
    }
    expect(ban).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    const info = findLastSessionCommand(Command_GetUserInfo_ext);
    expect(info.value.userName).toBe('bannee');
    respond(info.cmdId, Response_GetUserInfo_ext, create(Response_GetUserInfoSchema, { userInfo: target }));

    const dialog = await screen.findByRole('dialog', { name: 'Moderation.ban.title' });
    await user.click(within(dialog).getByRole('radio', { name: 'Moderation.ban.permanent' }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Moderation.ban.visibleReason' }), 'Cheating');
    await user.click(within(dialog).getByRole('button', { name: 'Moderation.common.ok' }));

    await waitFor(() => {
      expect(findLastModeratorCommand(Command_BanFromServer_ext).value).toMatchObject({
        userName: 'bannee',
        address: '10.1.2.3',
        clientid: '',
        minutes: 0,
        visibleReason: 'Cheating',
      });
    });
  });

  it('warn history: GetWarnHistory → table', async () => {
    loginAs('mod', MODERATOR);
    renderUserRow(makeTarget('historied'));

    chooseFromMenu('historied', 'Moderation.menu.warnHistory');
    const history = findLastModeratorCommand(Command_GetWarnHistory_ext);
    expect(history.value.userName).toBe('historied');
    respond(history.cmdId, Response_WarnHistory_ext, create(Response_WarnHistorySchema, {
      warnList: [create(ServerInfo_WarningSchema, { userName: 'historied', adminName: 'mod', reason: 'Spamming', timeOf: 'now' })],
    }));

    const dialog = await screen.findByRole('dialog', { name: 'Moderation.warnHistory.title' });
    expect(within(dialog).getByRole('cell', { name: 'Spamming' })).toBeInTheDocument();
  });

  it('ban history: GetBanHistory → "never been banned"', async () => {
    loginAs('mod', MODERATOR);
    renderUserRow(makeTarget('clean'));

    chooseFromMenu('clean', 'Moderation.menu.banHistory');
    const history = findLastModeratorCommand(Command_GetBanHistory_ext);
    respond(history.cmdId, Response_BanHistory_ext, create(Response_BanHistorySchema, { banList: [] }));

    expect(await screen.findByText('Moderation.banHistory.empty')).toBeInTheDocument();
  });

  it('admin notes: GetAdminNotes → editor → UpdateAdminNotes', async () => {
    loginAs('mod', MODERATOR);
    renderUserRow(makeTarget('noted'));

    chooseFromMenu('noted', 'Moderation.menu.adminNotes');
    const notes = findLastModeratorCommand(Command_GetAdminNotes_ext);
    respond(notes.cmdId, Response_GetAdminNotes_ext, create(Response_GetAdminNotesSchema, { userName: 'noted', notes: 'old' }));

    const editor = await screen.findByRole('textbox', { name: 'Moderation.adminNotes.title' });
    fireEvent.change(editor, { target: { value: 'new' } });
    fireEvent.click(screen.getByRole('button', { name: 'Moderation.adminNotes.update' }));

    await waitFor(() => {
      expect(findLastModeratorCommand(Command_UpdateAdminNotes_ext).value).toMatchObject({ userName: 'noted', notes: 'new' });
    });
  });

  it('promote to judge: AdjustMod with only should_be_judge → success box', async () => {
    loginAs('admin', ADMIN);
    renderUserRow(makeTarget('promotee'));

    chooseFromMenu('promotee', 'Moderation.menu.promoteJudge');
    const adjust = findLastAdminCommand(Command_AdjustMod_ext);
    expect(adjust.value.userName).toBe('promotee');
    expect(adjust.value.shouldBeJudge).toBe(true);
    expect(isFieldSet(adjust.value, Command_AdjustModSchema.field.shouldBeMod)).toBe(false);
    expect(isFieldSet(adjust.value, Command_AdjustModSchema.field.shouldBeDeveloper)).toBe(false);
    respond(adjust.cmdId);

    expect(await screen.findByText('Moderation.adjustMod.promoted')).toBeInTheDocument();
  });

  it('regular users get no moderator entries', () => {
    loginAs('pleb', Flag.IsUser | Flag.IsRegistered);
    renderUserRow(makeTarget('other'));
    fireEvent.contextMenu(screen.getByText('other'));
    expect(screen.queryByRole('menuitem', { name: 'Moderation.menu.warnUser' })).not.toBeInTheDocument();
  });
});

describe('administration moderator functions (integration)', () => {
  it('grant replay access: RespContextError → "Replay ID invalid"; RespOk → granted and the replay list reloads', async () => {
    loginAs('mod', MODERATOR);
    renderFeatureScreen(<Administration />, '/administration');

    const replayId = screen.getByRole('textbox', { name: 'Administration.moderator.replayId' });
    fireEvent.change(replayId, { target: { value: '404' } });
    fireEvent.click(screen.getByRole('button', { name: 'Administration.moderator.grantReplayAccess' }));
    await waitFor(() => findLastModeratorCommand(Command_GrantReplayAccess_ext));
    const missing = findLastModeratorCommand(Command_GrantReplayAccess_ext);
    expect(missing.value).toMatchObject({ replayId: 404, moderatorName: 'mod' });
    respond(missing.cmdId, undefined, undefined, Response_ResponseCode.RespContextError);
    expect(await screen.findByText('Administration.result.replayIdInvalid')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Administration.button.ok' }));
    await waitFor(() => expect(screen.queryByText('Administration.result.replayIdInvalid')).not.toBeInTheDocument());

    fireEvent.change(replayId, { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Administration.moderator.grantReplayAccess' }));
    await waitFor(() => expect(findLastModeratorCommand(Command_GrantReplayAccess_ext).value.replayId).toBe(7));
    respond(findLastModeratorCommand(Command_GrantReplayAccess_ext).cmdId);
    expect(await screen.findByText('Administration.result.replayAccessGranted')).toBeInTheDocument();
    expect(() => findLastSessionCommand(Command_ReplayList_ext)).not.toThrow();
  });

  it('force activate: RespActivationAccepted → "User successfully activated"', async () => {
    loginAs('mod', MODERATOR);
    renderFeatureScreen(<Administration />, '/administration');

    fireEvent.change(screen.getByRole('textbox', { name: 'Administration.moderator.userToActivate' }), {
      target: { value: ' sleeper ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Administration.moderator.forceActivateUser' }));
    await waitFor(() => findLastModeratorCommand(Command_ForceActivateUser_ext));
    const activate = findLastModeratorCommand(Command_ForceActivateUser_ext);
    expect(activate.value).toMatchObject({ usernameToActivate: 'sleeper', moderatorName: 'mod' });
    respond(activate.cmdId, undefined, undefined, Response_ResponseCode.RespActivationAccepted);

    expect(await screen.findByText('Administration.result.userActivated')).toBeInTheDocument();
  });
});

describe('log search (integration)', () => {
  it('sends desktop\'s defaults and reports an empty result', async () => {
    loginAs('mod', MODERATOR);
    renderFeatureScreen(<Logs />);

    fireEvent.change(screen.getByLabelText('LogSearchForm.label.userName'), { target: { value: 'chatty' } });
    fireEvent.click(screen.getByRole('button', { name: 'LogSearchForm.button.search' }));

    await waitFor(() => findLastModeratorCommand(Command_ViewLogHistory_ext));
    const search = findLastModeratorCommand(Command_ViewLogHistory_ext);
    expect(search.value).toMatchObject({
      userName: 'chatty',
      dateRange: 20 * 24,
      maximumResults: 1000,
      logLocation: ['room', 'game', 'chat'],
    });
    respond(search.cmdId, Response_ViewLogHistory_ext, create(Response_ViewLogHistorySchema, { logMessage: [] }));

    expect(await screen.findByText('Logs.notice.empty')).toBeInTheDocument();
  });
});
