import { act, waitFor } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';

import { server } from '@cockatrice/datatrice';
import { ServerInfo_DeckStorage_TreeItemSchema, ServerInfo_User_UserLevelFlag } from '@cockatrice/sockatrice/generated';
import { importReplayFiles, lookupCards, parseCod } from '@app/services';
import { hasUnloadRisk } from '../../../services/unloadGuard';

import { connectedState, createMockWebClient, makeUser, renderWithProviders } from '../../../__test-utils__';
import type { SourceFile } from './fileSources';
import { useDeckMigration, type DeckMigration } from './useDeckMigration';

vi.mock('@app/services', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@app/services')>()),
  lookupCards: vi.fn(),
  importReplayFiles: vi.fn(),
  importCustomSetFiles: vi.fn(),
}));

vi.mock('./pacedQueue', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./pacedQueue')>()),
  SERVER_PACING: { intervalMs: 0, floodBackoffMs: 0, maxFloodRetries: 2 },
}));

const registered = {
  ...connectedState,
  server: {
    ...(connectedState.server as object),
    user: makeUser({ userLevel: ServerInfo_User_UserLevelFlag.IsRegistered }),
  },
} as typeof connectedState;

let migration: DeckMigration;
function Probe() {
  migration = useDeckMigration();
  return null;
}

function source(path: string, text: string): SourceFile {
  return { file: new File([text], path.split('/').pop()!), path };
}

const SOURCES = [
  source('Cockatrice/decks/Burn/burn.txt', '4 Lightning Bolt\n\n2 Negate'),
  source('Cockatrice/replays/replay_1.cor', 'x'),
];

beforeEach(() => {
  vi.mocked(lookupCards).mockResolvedValue(new Map([
    ['Lightning Bolt', { found: true, source: 'scryfall', name: 'Lightning Bolt', colors: ['R'], printings: [] }],
  ]));
  vi.mocked(importReplayFiles).mockResolvedValue({ imported: [{ name: 'replay_1.cor' }], skipped: [], failed: [] });
});

async function previewed(state = registered) {
  const webClient = createMockWebClient();
  const { store } = renderWithProviders(<Probe />, { preloadedState: state, webClient });
  await act(() => migration.addSources(SOURCES));
  expect(migration.stage).toBe('preview');
  return { webClient, store };
}

it('scans dropped files into a preview with folders, unknown cards and replays', async () => {
  await previewed();
  expect(migration.previews).toEqual([expect.objectContaining({
    name: 'burn', folder: ['Burn'], cardCount: 6, unknownCount: 2, onServer: false,
  })]);
  expect(migration.sources?.replays).toHaveLength(1);
  expect(migration.plan.folders).toEqual([
    { parent: '', name: 'Imported from desktop' },
    { parent: 'Imported from desktop', name: 'Burn' },
  ]);
});

it('creates folders, uploads with pacing, retries a flood and summarises every leg', async () => {
  const { webClient, store } = await previewed();
  act(() => migration.setDestination(''));
  let started!: Promise<void>;
  act(() => {
    started = migration.start();
  });
  expect(hasUnloadRisk()).toBe(true);

  await waitFor(() => expect(webClient.request.session.deckNewDir).toHaveBeenCalledTimes(1));
  const dir = vi.mocked(webClient.request.session.deckNewDir).mock.calls[0];
  expect(dir.slice(0, 2)).toEqual(['', 'Burn']);
  act(() => {
    store.dispatch(server.Actions.deckNewDirFailed({ path: '', dirName: 'Burn', responseCode: 18, requestId: dir[2] }));
  });
  await waitFor(() => expect(webClient.request.session.deckNewDir).toHaveBeenCalledTimes(2));
  act(() => {
    store.dispatch(server.Actions.deckNewDir({
      path: '', dirName: 'Burn', requestId: vi.mocked(webClient.request.session.deckNewDir).mock.calls[1][2],
    }));
  });

  await waitFor(() => expect(webClient.request.session.deckUpload).toHaveBeenCalledTimes(1));
  const first = vi.mocked(webClient.request.session.deckUpload).mock.calls[0];
  expect(first[0]).toBe('Burn');
  expect(first[4]).toBe('R');
  expect(parseCod(first[2]).cards.map((c) => [c.name, c.category])).toEqual([['Lightning Bolt', 'main'], ['Negate', 'sideboard']]);
  act(() => {
    store.dispatch(server.Actions.deckUploadFailed({ path: 'Burn', responseCode: 18, requestId: first[5] }));
  });

  await waitFor(() => expect(webClient.request.session.deckUpload).toHaveBeenCalledTimes(2));
  const retry = vi.mocked(webClient.request.session.deckUpload).mock.calls[1];
  act(() => {
    store.dispatch(server.Actions.deckUpload({
      path: 'Burn', requestId: retry[5], treeItem: create(ServerInfo_DeckStorage_TreeItemSchema, { id: 41, name: 'burn' }),
    }));
  });
  await act(() => started);

  expect(migration.stage).toBe('done');
  expect(hasUnloadRisk()).toBe(false);
  expect(migration.result?.decks).toEqual({
    imported: [expect.objectContaining({ deckId: 41, name: 'burn', path: 'Burn', unknownCount: 2 })],
    skipped: [],
    failed: [],
    notStarted: 0,
  });
  expect(migration.result?.stoppedLegs).toEqual([]);
  expect(migration.result?.replays?.imported).toHaveLength(1);
  expect(vi.mocked(importReplayFiles).mock.calls[0][1]?.relativePathOf?.(SOURCES[1].file)).toBe('Cockatrice/replays/replay_1.cor');
});

it('reports the decks under a folder the server refused instead of uploading them', async () => {
  const { webClient, store } = await previewed();
  act(() => migration.setDestination(''));
  let started!: Promise<void>;
  act(() => {
    started = migration.start();
  });
  await waitFor(() => expect(webClient.request.session.deckNewDir).toHaveBeenCalledTimes(1));
  act(() => {
    store.dispatch(server.Actions.deckNewDirFailed({
      path: '', dirName: 'Burn', responseCode: 3, requestId: vi.mocked(webClient.request.session.deckNewDir).mock.calls[0][2],
    }));
  });
  await act(() => started);

  expect(webClient.request.session.deckUpload).not.toHaveBeenCalled();
  expect(migration.result?.decks?.failed).toEqual([{ name: 'burn', reason: 'folder', folder: 'Burn', code: 3 }]);
  expect(migration.stage).toBe('done');
});

it('stops between legs when cancelled during the replay import, and reports what was left', async () => {
  const { webClient } = await previewed();
  vi.mocked(importReplayFiles).mockImplementation(async (_files, options) => {
    migration.cancel();
    expect(options?.isCancelled?.()).toBe(true);
    return { imported: [], skipped: [], failed: [] };
  });
  await act(() => migration.start());

  expect(webClient.request.session.deckNewDir).not.toHaveBeenCalled();
  expect(migration.stage).toBe('done');
  expect(migration.result?.stoppedLegs).toEqual(['replays']);
  expect(migration.result?.decks).toMatchObject({ imported: [], notStarted: 1, stopped: 'cancelled' });
});

it('reaches the summary with the error when a local leg fails', async () => {
  await previewed(connectedState);
  vi.mocked(importReplayFiles).mockRejectedValue(new Error('disk full'));
  await act(() => migration.start());

  expect(migration.stage).toBe('done');
  expect(migration.result?.replays).toBeNull();
  expect(migration.result?.legErrors).toEqual([{ leg: 'replays', detail: 'disk full' }]);
});

it('imports replays only, and no decks, for an unregistered user', async () => {
  const { webClient } = await previewed(connectedState);
  expect(migration.canStoreDecks).toBe(false);
  await act(() => migration.start());
  expect(webClient.request.session.deckUpload).not.toHaveBeenCalled();
  expect(migration.result?.decks).toBeNull();
  expect(migration.result?.replays?.imported).toHaveLength(1);
});

it('says when nothing importable was found', async () => {
  renderWithProviders(<Probe />, { preloadedState: registered, webClient: createMockWebClient() });
  await act(() => migration.addSources([source('Cockatrice/settings/servers.ini', 'x')]));
  expect(migration.stage).toBe('source');
  expect(migration.error).toBe('DeckMigration.error.nothingFound');
});
