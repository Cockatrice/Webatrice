import type { ReactNode } from 'react';
import { act, fireEvent, screen } from '@testing-library/react';
import { Routes, Route, useParams } from 'react-router-dom';
import type { i18n as I18n } from 'i18next';
import { useTranslation } from 'react-i18next';
import { create, toBinary } from '@bufbuild/protobuf';
import { games, rooms, server } from '@cockatrice/datatrice';
import {
  Event_GameJoinedSchema,
  GameReplaySchema,
  Response_ReportStatsSchema,
  Response_ReportUserInfoSchema,
  Response_ResponseCode,
  ServerInfo_GameSchema,
  ServerInfo_ReportSchema,
  ServerInfo_RoomSchema,
} from '@cockatrice/sockatrice/generated';
import type { WebsocketTypes } from '@cockatrice/sockatrice/types';
import type { Mock } from 'vitest';

import { createMockWebClient, renderWithProviders } from '../../__test-utils__';
import { getOpenedReplay } from '../../services';
import { buildReplay, sayContainer } from '../../services/replay/__mocks__/fixtures';
import { RouteEnum } from '../../types';
import { makeReport, reportsRootState, SERVER_30 } from './__mocks__/reportState';
import ReportQueue from './ReportQueue';

const OPEN = makeReport({ reportId: 1, reporterName: 'alice', reportedUserName: 'mallory', status: 'open', category: 'spam' });
const ASSIGNED = makeReport({
  reportId: 2, reporterName: 'bob', reportedUserName: 'eve', status: 'assigned', gameId: 30, roomId: 4, replayId: 9,
});

function renderQueue(options: { moderator?: boolean; version?: string; probe?: ReactNode } = {}) {
  const webClient = createMockWebClient();
  const utils = renderWithProviders(
    <>
      {options.probe}
      <Routes>
        <Route path={RouteEnum.REPORT_QUEUE} element={<ReportQueue />} />
        <Route path={RouteEnum.SERVER} element={<div>lobby</div>} />
        <Route path={RouteEnum.GAME} element={<div>game page</div>} />
        <Route path={RouteEnum.REPLAY} element={<ReplayViewProbe />} />
      </Routes>
    </>,
    {
      preloadedState: reportsRootState({ moderator: options.moderator ?? true, version: options.version }),
      webClient,
      route: RouteEnum.REPORT_QUEUE,
    },
  );
  const moderator = webClient.request.moderator as unknown as Record<string, Mock>;
  const session = webClient.request.session as unknown as Record<string, Mock>;
  const roomsRequest = webClient.request.rooms as unknown as Record<string, Mock>;
  const requestId = (command: string): string | undefined => moderator[command].mock.lastCall?.at(-1);
  const failed = (command: WebsocketTypes.ModeratorCommandName, target = '') =>
    server.Actions.moderatorCommandFailed({
      command, responseCode: Response_ResponseCode.RespInvalidData, target, requestId: requestId(command),
    });
  const load = (reports = [OPEN, ASSIGNED]) => act(() => {
    utils.store.dispatch(server.Actions.reportList({ requestId: requestId('reportList'), reports, totalCount: reports.length }));
  });
  return { ...utils, moderator, session, roomsRequest, load, requestId, failed };
}

function ReplayViewProbe() {
  const { replayKey } = useParams();
  return <div data-testid="replay-view">{getOpenedReplay(replayKey)?.title}</div>;
}

const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

describe('ReportQueue gating', () => {
  it('sends non-moderators back to the lobby without sending a moderator command', () => {
    const { moderator } = renderQueue({ moderator: false });
    expect(screen.getByText('lobby')).toBeTruthy();
    expect(moderator.reportList).not.toHaveBeenCalled();
    expect(moderator.reportStats).not.toHaveBeenCalled();
  });

  it('is hidden on a 3.0 server and queries nothing', () => {
    const { moderator } = renderQueue({ version: SERVER_30 });
    expect(screen.getByText('lobby')).toBeTruthy();
    expect(moderator.reportList).not.toHaveBeenCalled();
  });
});

describe('ReportQueue', () => {
  it('completes initial and repeated empty loads and enables refresh', () => {
    const { load, moderator } = renderQueue();
    for (let request = 1; request <= 2; request++) {
      expect(button('Reports.refresh').disabled).toBe(true);
      load([]);
      expect(screen.getByTestId('report-queue-status').textContent).toBe('Reports.queue.shownOfTotal');
      expect(button('Reports.refresh').disabled).toBe(false);
      fireEvent.click(button('Reports.refresh'));
      expect(moderator.reportList).toHaveBeenCalledTimes(request + 1);
    }
  });

  it('clears the previous action result on refresh and exposes a later list failure', () => {
    const { load, store, requestId, failed } = renderQueue();
    load();
    fireEvent.click(screen.getByTestId('report-row-1'));
    fireEvent.click(button('Reports.queue.assign'));
    act(() => store.dispatch(server.Actions.reportAssigned({ requestId: requestId('reportAssign'), reportId: 1 })));
    expect(screen.getByTestId('report-action-status').textContent).toBe('Reports.queue.assignedDone');
    load();
    fireEvent.click(button('Reports.refresh'));
    expect(screen.getByTestId('report-queue-status').textContent).toBe('Reports.loading');
    act(() => store.dispatch(failed('reportList')));
    expect(screen.getByTestId('report-queue-status').textContent).toBe('Reports.loadFailed');
  });

  it('exposes a failed post-action list load despite the action success message', () => {
    const { load, store, requestId, failed } = renderQueue();
    load();
    fireEvent.click(screen.getByTestId('report-row-1'));
    fireEvent.click(button('Reports.queue.assign'));
    act(() => store.dispatch(server.Actions.reportAssigned({ requestId: requestId('reportAssign'), reportId: 1 })));
    act(() => store.dispatch(failed('reportList')));
    expect(screen.getByTestId('report-queue-status').textContent).toBe('Reports.loadFailed');
  });

  it('loads the unresolved queue and the stats on open, and re-queries when the switch flips', () => {
    const { moderator } = renderQueue();
    expect(moderator.reportList).toHaveBeenCalledWith(true, undefined, undefined, expect.any(String));
    expect(moderator.reportStats).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /^Reports\.view\.resolved/ }));
    expect(moderator.reportList).toHaveBeenLastCalledWith(false, undefined, undefined, expect.any(String));
  });

  it('shows the list and stats failure lines from the moderator failure signal', () => {
    const { store, failed } = renderQueue();
    act(() => {
      store.dispatch(failed('reportStats'));
    });
    expect(screen.getByTestId('report-stats').textContent).toBe('Reports.stats.failed');
    expect(screen.getByTestId('report-queue-status').textContent).toBe('Reports.loading');
    act(() => {
      store.dispatch(failed('reportList'));
    });
    expect(screen.getByTestId('report-queue-status').textContent).toBe('Reports.loadFailed');
  });

  it('filters by search text and status locally', () => {
    const { load } = renderQueue();
    load();
    expect(screen.getAllByTestId(/^report-row-/)).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('Reports.queue.searchPlaceholder'), { target: { value: 'MALL' } });
    expect(screen.getAllByTestId(/^report-row-/).map((r) => r.dataset.testid)).toEqual(['report-row-1']);
    fireEvent.change(screen.getByLabelText('Reports.queue.searchPlaceholder'), { target: { value: '' } });
    const assignedTab = screen.getByRole('button', { name: /^Reports\.view\.assigned/ });
    fireEvent.click(assignedTab);
    expect(assignedTab.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getAllByTestId(/^report-row-/).map((r) => r.dataset.testid)).toEqual(['report-row-2']);
  });

  it('enables actions by status like desktop updateActionStates', () => {
    const { load } = renderQueue();
    load();
    expect(screen.queryByRole('button', { name: 'Reports.queue.assign' })).toBeNull();
    fireEvent.click(screen.getByTestId('report-row-1'));
    expect(button('Reports.queue.assign').disabled).toBe(false);
    expect(button('Reports.queue.resolveWithNote').disabled).toBe(false);
    expect(button('Reports.queue.viewReplay').disabled).toBe(true);
    expect(button('Reports.queue.joinGame').disabled).toBe(true);
    fireEvent.click(screen.getByTestId('report-row-2'));
    expect(button('Reports.queue.assign').disabled).toBe(true);
    expect(button('Reports.queue.dismiss').disabled).toBe(false);
    expect(button('Reports.queue.viewReplay').disabled).toBe(false);
    expect(button('Reports.queue.joinGame').disabled).toBe(false);
  });

  it('assigns to me, then refreshes; a failure says so without refreshing', () => {
    const { moderator, load, store, requestId, failed } = renderQueue();
    load();
    fireEvent.click(screen.getByTestId('report-row-1'));
    fireEvent.click(button('Reports.queue.assign'));
    expect(moderator.reportAssign).toHaveBeenCalledWith(1, expect.any(String));
    expect(screen.getByTestId('report-action-status').textContent).toBe('Reports.queue.assigning');
    expect(button('Reports.queue.resolveWithNote').disabled).toBe(true);

    act(() => {
      store.dispatch(failed('reportAssign', '2'));
    });
    expect(screen.getByTestId('report-action-status').textContent).toBe('Reports.queue.assigning');
    act(() => {
      store.dispatch(failed('reportAssign', '1'));
    });
    expect(screen.getByTestId('report-action-status').textContent).toBe('Reports.queue.assignFailed');
    expect(moderator.reportList).toHaveBeenCalledTimes(1);

    fireEvent.click(button('Reports.queue.assign'));
    act(() => {
      store.dispatch(server.Actions.reportAssigned({ requestId: requestId('reportAssign'), reportId: 1 }));
    });
    expect(screen.getByTestId('report-action-status').textContent).toBe('Reports.queue.assignedDone');
    expect(moderator.reportList).toHaveBeenCalledTimes(2);
  });

  it('resolves without a note, and dismisses with the note from the prompt', () => {
    const { moderator, load, store, requestId, failed } = renderQueue();
    load();
    fireEvent.click(screen.getByTestId('report-row-2'));
    fireEvent.click(button('Reports.queue.resolve'));
    expect(moderator.reportResolve).toHaveBeenCalledWith(2, undefined, false, expect.any(String));
    act(() => {
      store.dispatch(failed('reportResolve', '2'));
    });
    expect(screen.getByTestId('report-action-status').textContent).toBe('Reports.queue.actionFailed');

    fireEvent.click(button('Reports.queue.dismiss'));
    fireEvent.change(screen.getByLabelText('Reports.queue.dismissNoteLabel'), { target: { value: ' duplicate ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reports.queue.ok' }));
    expect(moderator.reportResolve).toHaveBeenLastCalledWith(2, 'duplicate', true, expect.any(String));
    act(() => {
      store.dispatch(server.Actions.reportResolved({ requestId: requestId('reportResolve'), reportId: 2, dismissed: true }));
    });
    expect(screen.getByTestId('report-action-status').textContent).toBe('Reports.queue.done');
    expect(moderator.reportList).toHaveBeenCalledTimes(2);
  });

  it('requests and shows the reported user context', () => {
    const { moderator, load, store } = renderQueue();
    load();
    fireEvent.click(screen.getByTestId('report-row-1'));
    expect(moderator.reportUserInfo).toHaveBeenCalledWith('mallory', expect.any(String));
    act(() => {
      store.dispatch(server.Actions.userInfoReport({
        info: create(Response_ReportUserInfoSchema, { userName: 'mallory', totalBans: 3, adminNotes: 'watch' }),
      }));
    });
    const panel = screen.getByTestId('report-user-context');
    expect(panel.textContent).toContain('watch');
    expect(panel.textContent).toContain('Reports.userContext.noRecent');
  });

  it('switches the queue investigation and ignores a stray result for the previous user', () => {
    const { load, store, moderator } = renderQueue();
    load();
    fireEvent.click(screen.getByTestId('report-row-1'));
    fireEvent.click(screen.getByTestId('report-row-2'));
    expect(moderator.reportUserInfo).toHaveBeenLastCalledWith('eve', expect.any(String));
    act(() => store.dispatch(server.Actions.userInfoReport({
      info: create(Response_ReportUserInfoSchema, { userName: 'eve', adminNotes: 'current investigation' }),
    })));
    expect(screen.getByTestId('report-user-context')).toHaveTextContent('current investigation');
    const active = store.getState().server.staff.investigation;
    act(() => store.dispatch(server.Actions.userInfoReport({
      info: create(Response_ReportUserInfoSchema, { userName: 'mallory', adminNotes: 'stray result' }),
    })));
    expect(store.getState().server.staff.investigation).toBe(active);
    expect(server.Selectors.getUserInvestigation(store.getState(), 'mallory')).toBeUndefined();
    expect(screen.getByTestId('report-user-context')).toHaveTextContent('current investigation');
    expect(screen.getByTestId('report-user-context')).not.toHaveTextContent('stray result');
  });

  it('does not reclaim an investigation another surface started when a queue result arrives', () => {
    const { load, store, moderator } = renderQueue();
    load();
    fireEvent.click(screen.getByTestId('report-row-1'));
    act(() => {
      store.dispatch(server.Actions.userInvestigationStarted({ userName: 'eve' }));
      store.dispatch(server.Actions.userInfoReport({
        info: create(Response_ReportUserInfoSchema, { userName: 'eve', adminNotes: 'other surface' }),
      }));
    });
    const active = store.getState().server.staff.investigation;
    act(() => store.dispatch(server.Actions.userInfoReport({
      info: create(Response_ReportUserInfoSchema, { userName: 'mallory', adminNotes: 'late queue result' }),
    })));
    expect(store.getState().server.staff.investigation).toBe(active);
    expect(server.Selectors.getUserInvestigation(store.getState(), 'eve')?.info?.adminNotes).toBe('other surface');
    expect(server.Selectors.getUserInvestigation(store.getState(), 'mallory')).toBeUndefined();
    expect(screen.getByTestId('report-user-context')).not.toHaveTextContent('late queue result');
    expect(moderator.reportUserInfo).toHaveBeenCalledTimes(1);
  });

  it('translates the status and category of earlier reports, showing unknown codes as sent', () => {
    let i18n!: I18n;
    function I18nProbe() {
      i18n = useTranslation().i18n;
      return null;
    }
    const { load, store } = renderQueue({ probe: <I18nProbe /> });
    i18n.addResourceBundle('en-US', 'translation', {
      Reports: { status: { open: 'Open' }, userContext: { recentLine: '{status}: {category}' } },
      ReportUserDialog: { categoryLabel: { spam: 'Spam' } },
    });
    try {
      load();
      fireEvent.click(screen.getByTestId('report-row-1'));
      act(() => {
        store.dispatch(server.Actions.userInfoReport({
          info: create(Response_ReportUserInfoSchema, {
            userName: 'mallory',
            recentReports: [
              create(ServerInfo_ReportSchema, { reportId: 5, status: 'open', category: 'spam' }),
              create(ServerInfo_ReportSchema, { reportId: 6, status: 'escalated', category: 'griefing' }),
            ],
          }),
        }));
      });
      const lines = screen.getByTestId('report-user-context').querySelectorAll('li');
      expect(lines[0].textContent).toBe('Open: Spam');
      expect(lines[1].textContent).toBe('escalated: griefing');
    } finally {
      i18n.removeResourceBundle('en-US', 'translation');
      i18n.addResourceBundle('en-US', 'translation', {});
    }
  });

  it('says the reported user context failed when the shared lookup fails', () => {
    const { load, store, requestId } = renderQueue();
    load();
    fireEvent.click(screen.getByTestId('report-row-1'));
    act(() => {
      store.dispatch(server.Actions.moderatorCommandFailed({
        requestId: requestId('reportUserInfo'),
        command: 'reportUserInfo', responseCode: Response_ResponseCode.RespInternalError, target: 'someone else',
      }));
    });
    expect(screen.getByTestId('report-user-context').textContent).not.toContain('Reports.userContext.loadFailed');
    act(() => {
      store.dispatch(server.Actions.moderatorCommandFailed({
        requestId: requestId('reportUserInfo'),
        command: 'reportUserInfo', responseCode: Response_ResponseCode.RespInternalError, target: 'mallory',
      }));
    });
    expect(screen.getByTestId('report-user-context').textContent).toContain('Reports.userContext.loadFailed');
  });

  it('opens the replay in the replay view once the matching download arrives', () => {
    const { moderator, load, store, requestId } = renderQueue();
    load();
    fireEvent.click(screen.getByTestId('report-row-2'));
    fireEvent.click(button('Reports.queue.viewReplay'));
    expect(moderator.replayDownloadByGameId).toHaveBeenCalledWith(30, expect.any(String));
    expect(screen.getByTestId('report-action-status').textContent).toBe('Reports.queue.loadingReplay');

    const replayData = toBinary(GameReplaySchema, buildReplay([sayContainer(0)], 30));
    act(() => {
      store.dispatch(server.Actions.reportReplayDownloaded({ requestId: requestId('replayDownloadByGameId'),
        gameId: 31, replayId: 8, replayData }));
    });
    expect(screen.queryByTestId('replay-view')).toBeNull();

    act(() => {
      store.dispatch(server.Actions.reportReplayDownloaded({ requestId: requestId('replayDownloadByGameId'),
        gameId: 30, replayId: 9, replayData }));
    });
    expect(screen.getByTestId('replay-view').textContent).toBe('Reports.queue.replayTitle');
  });

  it('waits for the new download when the same game\'s replay was fetched before', () => {
    const { load, store, requestId } = renderQueue();
    load();
    const replayData = toBinary(GameReplaySchema, buildReplay([sayContainer(0)], 30));
    act(() => {
      store.dispatch(server.Actions.reportReplayDownloaded({ requestId: requestId('replayDownloadByGameId'),
        gameId: 30, replayId: 9, replayData }));
    });
    fireEvent.click(screen.getByTestId('report-row-2'));
    fireEvent.click(button('Reports.queue.viewReplay'));
    expect(screen.queryByTestId('replay-view')).toBeNull();
    expect(screen.getByTestId('report-action-status').textContent).toBe('Reports.queue.loadingReplay');

    act(() => {
      store.dispatch(server.Actions.reportReplayDownloaded({ requestId: requestId('replayDownloadByGameId'),
        gameId: 30, replayId: 9, replayData }));
    });
    expect(screen.getByTestId('replay-view').textContent).toBe('Reports.queue.replayTitle');
  });

  it('says the replay could not be parsed and stays on the queue', () => {
    const { load, store, requestId } = renderQueue();
    load();
    fireEvent.click(screen.getByTestId('report-row-2'));
    fireEvent.click(button('Reports.queue.viewReplay'));
    act(() => {
      store.dispatch(server.Actions.reportReplayDownloaded({ requestId: requestId('replayDownloadByGameId'),
        gameId: 30, replayId: 9, replayData: new Uint8Array([1, 2, 3]) }));
    });
    expect(screen.queryByTestId('replay-view')).toBeNull();
    expect(screen.getByTestId('report-action-status').textContent).toBe('Reports.queue.replayParseFailed');
  });

  it('says there is no replay when the download fails', () => {
    const { load, store, failed } = renderQueue();
    load();
    fireEvent.click(screen.getByTestId('report-row-2'));
    fireEvent.click(button('Reports.queue.viewReplay'));
    act(() => {
      store.dispatch(failed('replayDownloadByGameId', '30'));
    });
    expect(screen.getByTestId('report-action-status').textContent).toBe('Reports.queue.noReplay');
  });

  it('joins the room first, then spectates the reported game', () => {
    const { session, roomsRequest, load, store } = renderQueue();
    load();
    fireEvent.click(screen.getByTestId('report-row-2'));
    fireEvent.click(button('Reports.queue.joinGame'));
    expect(session.joinRoom).toHaveBeenCalledWith(4);
    expect(roomsRequest.joinGame).not.toHaveBeenCalled();
    act(() => {
      store.dispatch(rooms.Actions.joinRoom({ roomInfo: create(ServerInfo_RoomSchema, { roomId: 4, name: 'Main' }) }));
    });
    expect(roomsRequest.joinGame).toHaveBeenCalledWith(4, {
      gameId: 30, password: '', spectator: true, overrideRestrictions: false, joinAsJudge: false,
    });
  });

  it('forgets the spectate when the room join fails', () => {
    const { roomsRequest, load, store } = renderQueue();
    load();
    fireEvent.click(screen.getByTestId('report-row-2'));
    fireEvent.click(button('Reports.queue.joinGame'));
    act(() => {
      store.dispatch(rooms.Actions.joinRoomFailed({
        roomId: 4, responseCode: Response_ResponseCode.RespNameNotFound, userInitiated: true,
      }));
    });
    act(() => {
      store.dispatch(rooms.Actions.joinRoom({ roomInfo: create(ServerInfo_RoomSchema, { roomId: 4, name: 'Main' }) }));
    });
    expect(roomsRequest.joinGame).not.toHaveBeenCalled();
  });

  it('opens only the game it asked to spectate', () => {
    const { load, store } = renderQueue();
    load();
    act(() => {
      store.dispatch(rooms.Actions.joinRoom({ roomInfo: create(ServerInfo_RoomSchema, { roomId: 4, name: 'Main' }) }));
    });
    const joined = (gameId: number) => games.Actions.gameJoined({
      data: create(Event_GameJoinedSchema, { gameInfo: create(ServerInfo_GameSchema, { gameId, roomId: 4 }) }),
    }) as never;
    act(() => {
      store.dispatch(joined(31));
    });
    expect(screen.queryByText('game page')).toBeNull();

    fireEvent.click(screen.getByTestId('report-row-2'));
    fireEvent.click(button('Reports.queue.joinGame'));
    act(() => {
      store.dispatch(joined(30));
    });
    expect(screen.getByText('game page')).toBeTruthy();
  });

  it('renders the statistics once they land', () => {
    const { store, requestId } = renderQueue();
    act(() => {
      store.dispatch(server.Actions.reportStats({ requestId: requestId('reportStats'),
        stats: create(Response_ReportStatsSchema, { totalReports: 5, reportsThisWeek: 3, reportsLastWeek: 2 }),
      }));
    });
    expect(screen.getByTestId('report-stats').textContent).toBe('Reports.stats.line');
    expect(screen.queryByTestId('report-stats-detail')).toBeNull();
    fireEvent.click(button('Reports.stats.title'));
    expect(screen.getByTestId('report-stats-detail').textContent).toContain('Reports.stats.total');
    expect(screen.getByTestId('report-stats-detail').textContent).toContain('Reports.stats.topCategories');
  });

  it('comments as staff with the reply placeholder', () => {
    const { session, load } = renderQueue();
    load();
    fireEvent.click(screen.getByTestId('report-row-2'));
    const input = screen.getByLabelText('Reports.thread.addComment') as HTMLInputElement;
    expect(input.placeholder).toBe('Reports.thread.replyPlaceholder');
    fireEvent.change(input, { target: { value: 'on it' } });
    fireEvent.click(screen.getByRole('button', { name: /Reports.thread.send/ }));
    expect(session.reportAddComment).toHaveBeenCalledWith(2, 'on it', expect.any(Function), expect.any(Function));
  });
});
