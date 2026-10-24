import { act, fireEvent, screen } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';
import { server } from '@cockatrice/datatrice';
import { Response_WarnListSchema, ServerInfo_BanSchema } from '@cockatrice/sockatrice/generated';
import { SessionScope } from '../../SessionScope';
import { connectedState, makeUser, renderWithProviders } from '../../__test-utils__';
import { ModerationDialogs } from './ModerationProvider';
import { useModerationFlow, type ModerationFlowState } from './useModerationFlow';

function setup() {
  let current!: ModerationFlowState;
  function Probe() {
    current = useModerationFlow();
    return <ModerationDialogs {...current} />;
  }
  const view = renderWithProviders(<SessionScope><Probe /></SessionScope>, { preloadedState: connectedState });
  return { ...view, flow: () => current };
}

it('ignores a cancelled history failure while a newer same-user ban flow loads', () => {
  const { flow, store, webClient } = setup();
  act(() => flow().open('banHistory', 'alice'));
  const historyId = vi.mocked(webClient.request.moderator.getBanHistory).mock.calls[0][1];
  act(() => {
    flow().close();
    flow().open('banUser', 'alice');
    store.dispatch(server.Actions.moderatorCommandFailed({
      command: 'banHistory', target: 'alice', responseCode: 3, requestId: historyId,
    }));
  });
  expect(flow().flow).toMatchObject({ kind: 'banUser', stage: 'loading' });
  expect(flow().notice).toBeNull();
  const requestId = vi.mocked(webClient.request.session.getUserInfo).mock.calls[0][1];
  act(() => store.dispatch(server.Actions.getUserInfo({ userInfo: makeUser({ name: 'alice' }), requestId })));
  expect(screen.getByRole('dialog', { name: 'Moderation.ban.title' })).toBeVisible();
  expect(requestId).toEqual(expect.any(String));
  expect(requestId).not.toBe(historyId);
});

it('retains the accepted history snapshot when old or duplicate replies update the shared cache', () => {
  const { flow, store, webClient } = setup();
  act(() => flow().open('banHistory', 'alice'));
  const oldId = vi.mocked(webClient.request.moderator.getBanHistory).mock.calls[0][1];
  act(() => flow().open('banHistory', 'alice'));
  const requestId = vi.mocked(webClient.request.moderator.getBanHistory).mock.calls[1][1];
  act(() => store.dispatch(server.Actions.banHistory({
    userName: 'alice', requestId: oldId, banHistory: [create(ServerInfo_BanSchema, { banReason: 'Early stale reason' })],
  })));
  expect(flow().flow).toMatchObject({ kind: 'banHistory', stage: 'loading' });
  act(() => store.dispatch(server.Actions.banHistory({
    userName: 'alice', requestId, banHistory: [create(ServerInfo_BanSchema, { banReason: 'Current reason' })],
  })));
  expect(screen.getByRole('cell', { name: 'Current reason' })).toBeVisible();
  act(() => {
    store.dispatch(server.Actions.banHistory({
      userName: 'alice', requestId: oldId, banHistory: [create(ServerInfo_BanSchema, { banReason: 'Old reason' })],
    }));
    store.dispatch(server.Actions.moderatorCommandFailed({ command: 'banHistory', target: 'alice', responseCode: 3, requestId }));
  });
  expect(screen.getByRole('cell', { name: 'Current reason' })).toBeVisible();
  expect(screen.queryByText('Old reason')).not.toBeInTheDocument();
  expect(flow().notice).toBeNull();
});

it('does not consume a notes request for an unrelated command, target or missing identity', () => {
  const { flow, store, webClient } = setup();
  act(() => flow().open('adminNotes', 'alice'));
  const requestId = vi.mocked(webClient.request.moderator.getAdminNotes).mock.calls[0][1];
  act(() => {
    store.dispatch(server.Actions.moderatorCommandFailed({ command: 'banHistory', target: 'alice', responseCode: 3, requestId }));
    store.dispatch(server.Actions.getAdminNotes({ userName: 'bob', notes: 'Other user', requestId }));
    store.dispatch(server.Actions.getAdminNotes({ userName: 'alice', notes: 'Unowned notes' }));
  });
  expect(flow().flow).toMatchObject({ kind: 'adminNotes', stage: 'loading' });
  expect(flow().notice).toBeNull();
  act(() => store.dispatch(server.Actions.getAdminNotes({ userName: 'alice', notes: 'Owned notes', requestId })));
  expect(screen.getByDisplayValue('Owned notes')).toBeVisible();
});

it('owns both warning stages even when each response arrives synchronously before a render', () => {
  const { flow, store, webClient } = setup();
  vi.mocked(webClient.request.session.getUserInfo).mockImplementation((name, requestId) => {
    store.dispatch(server.Actions.getUserInfo({ userInfo: makeUser({ name, clientid: 'cid' }), requestId }));
  });
  vi.mocked(webClient.request.moderator.getWarnList).mockImplementation((_mod, userName, _client, requestId) => {
    store.dispatch(server.Actions.warnListOptions({
      warnList: [create(Response_WarnListSchema, { userName, warning: ['Owned reason'] })], requestId,
    }));
  });
  act(() => flow().open('warnUser', 'alice'));
  expect(screen.getByRole('dialog', { name: 'Moderation.warn.title' })).toBeVisible();
  expect(screen.getByRole('option', { name: 'Owned reason' })).toBeInTheDocument();
  const userId = vi.mocked(webClient.request.session.getUserInfo).mock.calls[0][1];
  const listId = vi.mocked(webClient.request.moderator.getWarnList).mock.calls[0][3];
  expect(userId).toEqual(expect.any(String));
  expect(listId).toEqual(expect.any(String));
  expect(listId).not.toBe(userId);
  act(() => store.dispatch(server.Actions.getUserInfoFailed({ userName: 'alice', responseCode: 3, requestId: userId })));
  expect(webClient.request.moderator.getWarnList).toHaveBeenCalledTimes(1);
});

it('queues concurrent role meanings independently when replies arrive in reverse order in one batch', () => {
  const { flow, store, webClient } = setup();
  act(() => {
    flow().open('promoteMod', 'alice');
    flow().open('demoteJudge', 'alice');
  });
  const [promote, demote] = vi.mocked(webClient.request.admin.adjustMod).mock.calls;
  act(() => {
    store.dispatch(server.Actions.adminCommandFailed({ command: 'adjustMod', target: 'alice', responseCode: 3, requestId: demote[4] }));
    store.dispatch(server.Actions.adjustMod({ userName: 'alice', shouldBeMod: true, requestId: promote[4] }));
  });
  expect(screen.getByText('Moderation.adjustMod.demoteFailed')).toBeVisible();
  fireEvent.click(screen.getByRole('button'));
  expect(screen.getByText('Moderation.adjustMod.promoted')).toBeVisible();
  fireEvent.click(screen.getByRole('button'));
  act(() => store.dispatch(server.Actions.adjustMod({ userName: 'alice', requestId: promote[4] })));
  expect(flow().notice).toBeNull();
  expect(promote[4]).toEqual(expect.any(String));
  expect(promote[4]).not.toBe(demote[4]);
});

it('ignores unrelated and prior-session role outcomes without consuming a new role change', () => {
  const { flow, store, webClient } = setup();
  act(() => flow().open('promoteMod', 'alice'));
  const oldId = vi.mocked(webClient.request.admin.adjustMod).mock.calls[0][4];
  act(() => store.dispatch(server.Actions.clearStore()));
  act(() => flow().open('demoteMod', 'alice'));
  const requestId = vi.mocked(webClient.request.admin.adjustMod).mock.calls[1][4];
  act(() => {
    store.dispatch(server.Actions.adjustMod({ userName: 'alice', requestId: oldId }));
    store.dispatch(server.Actions.adjustMod({ userName: 'bob', requestId }));
    store.dispatch(server.Actions.adjustMod({ userName: 'alice' }));
  });
  expect(flow().notice).toBeNull();
  act(() => store.dispatch(server.Actions.adjustMod({ userName: 'alice', requestId })));
  expect(screen.getByText('Moderation.adjustMod.demoted')).toBeVisible();
});
