import { create } from '@bufbuild/protobuf';

import { createStore } from '../store/createStore';
import { Data } from '../types';
import { Actions as ServerActions } from '../store/server/server.actions';
import { ModeratorResponseImpl } from './ModeratorResponseImpl';

function setup() {
  const store = createStore();
  const dispatch = vi.spyOn(store, 'dispatch');
  return { impl: new ModeratorResponseImpl(store), dispatch };
}

describe('ModeratorResponseImpl', () => {
  it('banFromServer dispatches the banFromServer action', () => {
    const { impl, dispatch } = setup();
    impl.banFromServer('alice');
    expect(dispatch).toHaveBeenCalledWith(ServerActions.banFromServer({ userName: 'alice' }));
  });

  it('banHistory dispatches the banHistory action with the ban list', () => {
    const { impl, dispatch } = setup();
    const bans = [create(Data.ServerInfo_BanSchema, { adminName: 'admin', reason: 'spam' })];
    impl.banHistory('alice', bans);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.banHistory({ userName: 'alice', banHistory: bans }));
  });

  it('viewLogs dispatches the viewLogs action with the log list', () => {
    const { impl, dispatch } = setup();
    const logs = [create(Data.ServerInfo_ChatMessageSchema, { senderName: 'bob', message: 'hi' })];
    impl.viewLogs(logs);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.viewLogs({ logs }));
  });

  it('warnHistory dispatches the warnHistory action with the warn list', () => {
    const { impl, dispatch } = setup();
    const warnings = [create(Data.ServerInfo_WarningSchema, { adminName: 'admin', reason: 'noise' })];
    impl.warnHistory('alice', warnings);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.warnHistory({ userName: 'alice', warnHistory: warnings }));
  });

  it('warnListOptions dispatches the warnListOptions action with the list', () => {
    const { impl, dispatch } = setup();
    const warnList = [create(Data.Response_WarnListSchema, { warning: 'spam' })];
    impl.warnListOptions(warnList);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.warnListOptions({ warnList }));
  });

  it('warnUser dispatches the warnUser action', () => {
    const { impl, dispatch } = setup();
    impl.warnUser('alice');
    expect(dispatch).toHaveBeenCalledWith(ServerActions.warnUser({ userName: 'alice' }));
  });

  it('grantReplayAccess dispatches the grantReplayAccess action', () => {
    const { impl, dispatch } = setup();
    impl.grantReplayAccess(42, 'mod');
    expect(dispatch).toHaveBeenCalledWith(ServerActions.grantReplayAccess({ replayId: 42, moderatorName: 'mod' }));
  });

  it('forceActivateUser dispatches the forceActivateUser action', () => {
    const { impl, dispatch } = setup();
    impl.forceActivateUser('alice', 'mod');
    expect(dispatch).toHaveBeenCalledWith(
      ServerActions.forceActivateUser({ usernameToActivate: 'alice', moderatorName: 'mod' }),
    );
  });

  it('getAdminNotes dispatches the getAdminNotes action', () => {
    const { impl, dispatch } = setup();
    impl.getAdminNotes('alice', 'notes here');
    expect(dispatch).toHaveBeenCalledWith(ServerActions.getAdminNotes({ userName: 'alice', notes: 'notes here' }));
  });

  it('updateAdminNotes dispatches the updateAdminNotes action', () => {
    const { impl, dispatch } = setup();
    impl.updateAdminNotes('alice', 'updated notes');
    expect(dispatch).toHaveBeenCalledWith(ServerActions.updateAdminNotes({ userName: 'alice', notes: 'updated notes' }));
  });
});
