import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';

import { Route, Routes } from 'react-router-dom';

import { create, toBinary } from '@bufbuild/protobuf';



import {

  GameReplaySchema,

  ServerInfo_ReplayMatchSchema,

  ServerInfo_ReplaySchema,

  ServerInfo_User_UserLevelFlag,

} from '@cockatrice/sockatrice/generated';

import type { WebClient } from '@cockatrice/sockatrice';

import { REPLAY_LIBRARY_ROOT, ReplayFileDTO, closeReplay, getOpenedReplays, type ReplayOrigin } from '@app/services';

import { RouteEnum } from '@app/types';



import {

  connectedState,

  createMockWebClient,

  disconnectedState,

  makeStoreState,

  makeUser,

  renderWithProviders,

} from '../../__test-utils__';

import { buildReplay, sayContainer } from '../../services/replay/__mocks__/fixtures';

import Replays from './Replays';

import { clearReplayCache } from './useReplayPreview';



vi.mock('../../hooks/useSettings');

vi.mock('../../services/cards/cardCatalog', async () =>

  (await import('../game/__test-utils__/unknownCardCatalog')).unknownCardCatalog());



const REGISTERED = ServerInfo_User_UserLevelFlag.IsUser | ServerInfo_User_UserLevelFlag.IsRegistered;



function match(gameId: number, overrides: Partial<{ doNotHide: boolean; replayIds: number[]; players: string[] }> = {}) {

  return create(ServerInfo_ReplayMatchSchema, {

    gameId,

    gameName: `Game ${gameId}`,

    roomName: 'Main',

    playerNames: overrides.players ?? ['alice', 'bob'],

    timeStarted: 1_700_000_000,

    length: 300,

    doNotHide: overrides.doNotHide ?? false,

    replayList: (overrides.replayIds ?? [gameId * 10]).map((replayId) =>

      create(ServerInfo_ReplaySchema, { replayId, replayName: `Replay ${replayId}`, duration: 120 })),

  });

}



const HERE = 'wss://server.example:4748/';

const from = (gameId: number, replayId: number, endpoint = HERE): ReplayOrigin => ({ endpoint, gameId, replayId });



function entry(id: number, name: string, kind: 'folder' | 'replay' = 'replay', parentId = REPLAY_LIBRARY_ROOT, origin?: ReplayOrigin) {

  return Object.assign(new ReplayFileDTO(), {

    id, name, kind, parentId, size: 2048, modifiedAt: '2023-01-01T12:00:00.000Z', origin,

  });

}



function stateWith({ registered = true, connected = true, matches = [match(7)] } = {}) {

  const base = connected ? connectedState : disconnectedState;

  return makeStoreState({

    ...base,

    server: {

      ...(base.server as any),

      user: connected ? makeUser({ userLevel: registered ? REGISTERED : ServerInfo_User_UserLevelFlag.IsUser }) : null,

      replays: Object.fromEntries(matches.map((m) => [m.gameId, m])),

    },

  });

}



function renderReplays(preloadedState = stateWith(), webClient: WebClient = createMockWebClient()) {

  const view = renderWithProviders(

    <Routes>

      <Route path={RouteEnum.REPLAYS} element={<Replays />} />

      <Route path={RouteEnum.REPLAY} element={<div data-testid="replay-view" />} />

    </Routes>,

    { route: RouteEnum.REPLAYS, preloadedState, webClient },

  );

  return { ...view, webClient };

}



const replayBytes = () => toBinary(GameReplaySchema, buildReplay([sayContainer(0), sayContainer(4)]));



function lastCallArg<T>(mock: unknown, index: number): T {

  return vi.mocked(mock as (...args: unknown[]) => unknown).mock.lastCall![index] as T;

}



function list() {

  return within(screen.getByTestId('replay-list'));

}



beforeEach(() => {

  vi.spyOn(ReplayFileDTO, 'getAll').mockResolvedValue([]);

});



afterEach(() => {

  clearReplayCache();

  getOpenedReplays().forEach(({ key }) => closeReplay(key));

});



describe('Replays page', () => {

  it('lists server matches and library files together, newest first, with a source filter', async () => {

    vi.spyOn(ReplayFileDTO, 'getAll').mockResolvedValue([

      entry(1, '7_Game 7', 'folder'), entry(2, 'replay_70.cor', 'replay', 1, from(7, 70)), entry(3, 'draft.cor'),

      entry(4, 'replay_90.cor', 'replay', REPLAY_LIBRARY_ROOT, from(9, 90, 'wss://elsewhere.example:4748/')),

    ]);

    const { webClient } = renderReplays(stateWith({ matches: [match(7), match(9)] }));



    expect(webClient.request.session.replayList).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(list().getByTestId('replay-item-file:3')).toBeInTheDocument());

    expect(list().getByTestId('replay-item-match:7')).toHaveTextContent('Replays.list.savedIn');

    expect(list().getByTestId('replay-item-match:9')).not.toHaveTextContent('Replays.list.savedIn');

    expect(list().queryByTestId('replay-item-file:2')).not.toBeInTheDocument();

    expect(list().getByTestId('replay-item-file:4')).toBeInTheDocument();



    fireEvent.click(screen.getByRole('radio', { name: /Replays.source.local/ }));

    expect(list().getByTestId('replay-item-match:7')).toBeInTheDocument();

    expect(list().queryByTestId('replay-item-match:9')).not.toBeInTheDocument();

    expect(list().getByTestId('replay-item-file:3')).toBeInTheDocument();



    fireEvent.click(screen.getByRole('radio', { name: /Replays.source.server/ }));

    expect(list().queryByTestId('replay-item-file:3')).not.toBeInTheDocument();

    expect(list().getByTestId('replay-item-match:9')).toBeInTheDocument();

  });



  it('searches players and game names', () => {

    renderReplays(stateWith({ matches: [match(7, { players: ['alice', 'bob'] }), match(9, { players: ['carol', 'dave'] })] }));



    fireEvent.change(screen.getByRole('textbox', { name: 'Replays.list.search' }), { target: { value: 'carol' } });

    expect(list().queryByTestId('replay-item-match:7')).not.toBeInTheDocument();

    expect(list().getByTestId('replay-item-match:9')).toBeInTheDocument();

  });



  it('explains the server states while still showing the library', async () => {

    vi.spyOn(ReplayFileDTO, 'getAll').mockResolvedValue([entry(3, 'draft.cor')]);

    const { webClient } = renderReplays(stateWith({ registered: false }));



    expect(screen.getByText('Replays.server.unregistered')).toBeInTheDocument();

    expect(webClient.request.session.replayList).not.toHaveBeenCalled();

    await waitFor(() => expect(list().getByTestId('replay-item-file:3')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: 'Replays.action.submitCode' })).toBeDisabled();

  });



  it('selecting a match downloads nothing; the preview downloads the game once and caches it', async () => {

    const { webClient } = renderReplays(stateWith({ matches: [match(7, { replayIds: [70, 71] }), match(9)] }));



    fireEvent.click(list().getByTestId('replay-item-match:7'));

    expect(screen.getByRole('heading', { name: 'Game 7' })).toBeInTheDocument();

    expect(screen.getByTestId('replay-preview-placeholder')).toBeInTheDocument();

    expect(webClient.request.session.replayDownload).not.toHaveBeenCalled();



    fireEvent.click(screen.getByRole('tab', { name: /Replay 71/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Replays.preview.downloadAndPreview' }));

    expect(webClient.request.session.replayDownload).toHaveBeenCalledWith(71, expect.any(Function), expect.any(Function));

    await act(async () => {

      lastCallArg<(data: Uint8Array) => void>(webClient.request.session.replayDownload, 1)(replayBytes());

    });



    await waitFor(() => expect(screen.getByTestId('replay-preview')).toBeInTheDocument());

    expect(screen.getByTestId('replay-preview-time')).toHaveTextContent('0:00 / 0:04');

    expect(screen.getByText('Replays.preview.loadedServer')).toBeInTheDocument();

    expect(webClient.loadReplayGame).toHaveBeenCalledTimes(1);

    expect(getOpenedReplays()).toHaveLength(0);



    fireEvent.click(list().getByTestId('replay-item-match:9'));

    expect(screen.getByTestId('replay-preview-placeholder')).toBeInTheDocument();

    expect(webClient.unloadReplayGame).toHaveBeenCalledTimes(1);



    fireEvent.click(list().getByTestId('replay-item-match:7'));

    fireEvent.click(screen.getByRole('tab', { name: /Replay 71/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Replays.preview.downloadAndPreview' }));

    await waitFor(() => expect(screen.getByTestId('replay-preview')).toBeInTheDocument());

    expect(webClient.request.session.replayDownload).toHaveBeenCalledTimes(1);

  });



  it('reads a game saved in the library from Dexie instead of the server', async () => {

    vi.spyOn(ReplayFileDTO, 'getAll').mockResolvedValue([entry(2, 'replay_70.cor', 'replay', REPLAY_LIBRARY_ROOT, from(7, 70))]);

    vi.spyOn(ReplayFileDTO, 'readData').mockResolvedValue(replayBytes());

    const { webClient } = renderReplays();



    await waitFor(() => expect(list().getByTestId('replay-item-match:7')).toHaveTextContent('Replays.list.savedHere'));

    fireEvent.click(list().getByTestId('replay-item-match:7'));

    fireEvent.click(screen.getByRole('button', { name: 'Replays.preview.readAndPreview' }));



    await waitFor(() => expect(screen.getByTestId('replay-preview')).toBeInTheDocument());

    expect(ReplayFileDTO.readData).toHaveBeenCalledWith(2);

    expect(webClient.request.session.replayDownload).not.toHaveBeenCalled();

    expect(screen.getByRole('button', { name: 'Replays.detail.inLibrary' })).toBeDisabled();

  });



  it('offers to save only the missing games of a partly saved match, stamped with their origin', async () => {

    vi.spyOn(ReplayFileDTO, 'getAll').mockResolvedValue([entry(2, 'replay_70.cor', 'replay', REPLAY_LIBRARY_ROOT, from(7, 70))]);

    vi.spyOn(ReplayFileDTO, 'listFolder').mockResolvedValue([]);

    vi.spyOn(ReplayFileDTO, 'addFolder').mockResolvedValue(11);

    const add = vi.spyOn(ReplayFileDTO, 'addReplay').mockResolvedValue(12);

    const { webClient } = renderReplays(stateWith({ matches: [match(7, { replayIds: [70, 71] })] }));



    await waitFor(() => expect(list().getByTestId('replay-item-match:7')).toHaveTextContent('Replays.list.savedHere'));

    fireEvent.click(list().getByTestId('replay-item-match:7'));

    fireEvent.click(screen.getByRole('button', { name: 'Replays.detail.saveMissing' }));



    await waitFor(() => expect(webClient.request.session.replayDownload).toHaveBeenCalledTimes(1));

    expect(webClient.request.session.replayDownload).toHaveBeenCalledWith(71, expect.any(Function), expect.any(Function));

    await act(async () => {

      lastCallArg<(data: Uint8Array) => void>(webClient.request.session.replayDownload, 1)(replayBytes());

    });

    await waitFor(() => expect(add).toHaveBeenCalledWith(

      11, 'replay_71.cor', expect.any(Uint8Array), { endpoint: HERE, gameId: 7, replayId: 71 },

    ));

  });



  it('keeps the local copy\'s own actions on a linked game', async () => {

    vi.spyOn(ReplayFileDTO, 'getAll').mockResolvedValue([entry(2, 'replay_70.cor', 'replay', REPLAY_LIBRARY_ROOT, from(7, 70))]);

    const remove = vi.spyOn(ReplayFileDTO, 'delete').mockResolvedValue(undefined);

    renderReplays();



    await waitFor(() => expect(list().getByTestId('replay-item-match:7')).toHaveTextContent('Replays.list.savedHere'));

    fireEvent.click(screen.getByRole('radio', { name: /Replays.source.local/ }));

    fireEvent.click(list().getByTestId('replay-item-match:7'));

    expect(screen.getByRole('button', { name: 'Replays.detail.deleteFromServer' })).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Replays.detail.saveAsFile' })).toBeInTheDocument();



    fireEvent.click(screen.getByRole('button', { name: 'Replays.detail.deleteFile' }));

    const dialog = screen.getByRole('dialog');

    expect(dialog).toHaveTextContent('Replays.local.deleteTitle');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Replays.action.delete' }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith([2]));

  });



  it('reports a failed download in place and lets the user retry', async () => {

    const { webClient } = renderReplays();

    fireEvent.click(list().getByTestId('replay-item-match:7'));

    fireEvent.click(screen.getByRole('button', { name: 'Replays.preview.downloadAndPreview' }));

    await act(async () => {

      lastCallArg<(code: number) => void>(webClient.request.session.replayDownload, 2)(-1);

    });



    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Replays.preview.failed'));

    fireEvent.click(screen.getByRole('button', { name: 'Replays.preview.retry' }));

    expect(webClient.request.session.replayDownload).toHaveBeenCalledTimes(2);

  });



  it('opens the full replay at the preview position from "Watch from"', async () => {

    const { webClient } = renderReplays();

    fireEvent.click(list().getByTestId('replay-item-match:7'));

    fireEvent.click(screen.getByRole('button', { name: 'Replays.preview.downloadAndPreview' }));

    await act(async () => {

      lastCallArg<(data: Uint8Array) => void>(webClient.request.session.replayDownload, 1)(replayBytes());

    });

    await waitFor(() => expect(screen.getByTestId('replay-preview')).toBeInTheDocument());



    fireEvent.click(screen.getByRole('button', { name: 'ReplayPreview.controls.forward' }));

    fireEvent.click(screen.getByRole('button', { name: /ReplayPreview.watchFrom/ }));



    expect(screen.getByTestId('replay-view')).toBeInTheDocument();

    const opened = getOpenedReplays();

    expect(opened).toHaveLength(1);

    expect(opened[0].title).toBe('Replays.server.matchReplayTitle');

    expect(opened[0].engine.getState().currentTime).toBe(1000);

  });



  it('keeps the match actions: keep, share code, download, save to library and delete', async () => {

    const { webClient } = renderReplays(stateWith({ matches: [match(7, { replayIds: [70, 71] })] }));

    fireEvent.click(list().getByTestId('replay-item-match:7'));



    fireEvent.click(screen.getByRole('button', { name: 'Replays.detail.keep' }));

    expect(webClient.request.session.replayModifyMatch).toHaveBeenCalledWith(7, true, expect.any(Function));



    fireEvent.click(screen.getByRole('button', { name: 'Replays.detail.shareCode' }));

    expect(webClient.request.session.replayGetCode).toHaveBeenCalledWith(7, expect.any(Function), expect.any(Function));



    fireEvent.click(screen.getByRole('button', { name: 'Replays.detail.download' }));

    expect(webClient.request.session.replayDownload).toHaveBeenCalledTimes(2);



    fireEvent.click(screen.getByRole('button', { name: 'Replays.detail.deleteFromServer' }));

    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Replays.action.delete' }));

    expect(webClient.request.session.replayDeleteMatch).toHaveBeenCalledWith(7, expect.any(Function));

  });



  it('imports replay files and sums up the result as a notice, not an error', async () => {

    const add = vi.spyOn(ReplayFileDTO, 'addReplay').mockResolvedValue(20);

    renderReplays();



    fireEvent.change(screen.getByTestId('replay-import-files'), {

      target: { files: [new File([replayBytes() as BlobPart], 'a.cor'), new File(['x'], 'notes.txt')] },

    });



    const dialog = await screen.findByRole('dialog');

    expect(dialog).toHaveTextContent('Replays.notice.imported');

    expect(dialog).toHaveTextContent('ImportSummary.imported.replays');

    expect(dialog).toHaveTextContent('ImportSummary.problem.unsupported.replays');

    expect(dialog).not.toHaveTextContent('Replays.notice.error');

    expect(add).toHaveBeenCalledWith(REPLAY_LIBRARY_ROOT, 'a.cor', expect.any(Uint8Array));

  });



  it('offers save-as-file and delete for a library-only file', async () => {

    vi.spyOn(ReplayFileDTO, 'getAll').mockResolvedValue([entry(3, 'draft.cor')]);

    vi.spyOn(ReplayFileDTO, 'readData').mockResolvedValue(replayBytes());

    const remove = vi.spyOn(ReplayFileDTO, 'delete').mockResolvedValue(undefined);

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:replay');

    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    renderReplays(stateWith({ matches: [] }));



    await waitFor(() => expect(list().getByTestId('replay-item-file:3')).toBeInTheDocument());

    fireEvent.click(list().getByTestId('replay-item-file:3'));

    expect(screen.getByRole('heading', { name: 'draft' })).toBeInTheDocument();



    fireEvent.click(screen.getByRole('button', { name: 'Replays.detail.saveAsFile' }));

    await waitFor(() => expect(ReplayFileDTO.readData).toHaveBeenCalledWith(3));



    fireEvent.click(screen.getByRole('button', { name: 'Replays.detail.deleteFile' }));

    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Replays.action.delete' }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith([3]));

  });

});

