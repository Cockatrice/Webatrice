import { act, renderHook, waitFor } from '@testing-library/react';



const hoisted = vi.hoisted(() => ({

  db: {

    listSources: vi.fn(),

    summary: vi.fn(),

    getLastUpdateCheck: vi.fn(),

    reload: vi.fn(),

    removeSource: vi.fn(),

    resolveUnknownSets: vi.fn(),

  },

  updates: { updateTokens: vi.fn(), updateSpoilers: vi.fn(), checkCardDatabase: vi.fn() },

  importCustomSetFiles: vi.fn(),

}));



vi.mock('@app/services', async (importOriginal) => ({

  ...(await importOriginal<typeof import('@app/services')>()),

  cardDatabaseService: hoisted.db,

  importCustomSetFiles: hoisted.importCustomSetFiles,

}));

vi.mock('./CardUpdateService', async (importOriginal) => ({

  ...(await importOriginal<typeof import('./CardUpdateService')>()),

  cardUpdateService: hoisted.updates,

}));



import { UpdateFetchError } from './CardUpdateService';

import { useCardDatabaseOverview } from './useCardDatabaseOverview';



const summary = { cards: 10, sets: 2, tokens: 3, formats: 1 };

const rebuild = (unknownSets: string[] = [], allNewSetsEnabled = false) => ({ summary, unknownSets, allNewSetsEnabled });



async function renderLoaded() {

  hoisted.db.listSources.mockResolvedValue([{ id: 'main', kind: 'main', fileName: 'cards.xml' }]);

  hoisted.db.summary.mockResolvedValue(summary);

  hoisted.db.getLastUpdateCheck.mockResolvedValue('2026-10-01T00:00:00.000Z');

  const hook = renderHook(() => useCardDatabaseOverview());

  await waitFor(() => expect(hook.result.current.loading).toBe(false));

  return hook;

}



describe('useCardDatabaseOverview', () => {

  it('loads sources, counts and the last update check', async () => {

    const { result } = await renderLoaded();

    expect(result.current.sources).toHaveLength(1);

    expect(result.current.summary).toEqual(summary);

    expect(result.current.lastUpdateCheck).toBe('2026-10-01T00:00:00.000Z');

  });



  it('reloads and raises the new-sets question', async () => {

    hoisted.db.reload.mockResolvedValue(rebuild(['NEO']));

    const { result } = await renderLoaded();



    await act(async () => {

      await result.current.reload();

    });

    expect(result.current.unknownSets).toEqual(['NEO']);

    expect(result.current.message).toEqual({ severity: 'success', key: 'reloaded', params: summary });

    expect(result.current.busy).toBeNull();

  });



  it('imports picked files as custom sets and reports the summary', async () => {

    hoisted.importCustomSetFiles.mockResolvedValue({

      imported: [{ name: 'cube.xml' }],

      skipped: [{ name: 'old.xml', reason: 'duplicate' }],

      failed: [],

      unknownSets: ['CUB'],

      counts: summary,

    });

    const { result } = await renderLoaded();

    const files = [new File(['x'], 'cube.xml')];



    await act(async () => {

      await result.current.addCustomFiles(files);

    });

    expect(hoisted.importCustomSetFiles).toHaveBeenCalledWith(files);

    expect(result.current.unknownSets).toEqual(['CUB']);

    expect(result.current.message).toEqual({

      severity: 'success',

      text: 'ImportSummary.imported.cardFiles ImportSummary.duplicates',

    });

  });



  it('warns about files it could not import', async () => {

    hoisted.importCustomSetFiles.mockResolvedValue({

      imported: [],

      skipped: [],

      failed: [{ name: 'broken.xml', reason: 'invalid' }],

      unknownSets: [],

      counts: null,

    });

    const { result } = await renderLoaded();



    await act(async () => {

      await result.current.addCustomFiles([new File(['x'], 'broken.xml')]);

    });

    expect(result.current.message).toEqual({

      severity: 'warning',

      text: 'ImportSummary.imported.cardFiles ImportSummary.problem.invalid.cardFiles',

    });

  });



  it('reports an offline update without touching the database', async () => {

    hoisted.updates.updateTokens.mockRejectedValue(new UpdateFetchError('https://x/tokens.xml'));

    const { result } = await renderLoaded();



    await act(async () => {

      await result.current.updateTokens();

    });

    expect(result.current.message).toEqual({ severity: 'error', key: 'offline', params: { url: 'https://x/tokens.xml' } });

  });



  it('maps spoiler and card-check outcomes to messages', async () => {

    hoisted.updates.updateSpoilers.mockResolvedValue({ status: 'season-ended', removed: true });

    hoisted.updates.checkCardDatabase.mockResolvedValue({ latestVersion: '5.3', installedVersion: '5.2', updateAvailable: true });

    const { result } = await renderLoaded();



    await act(async () => {

      await result.current.updateSpoilers();

    });

    expect(result.current.message).toEqual({ severity: 'info', key: 'spoilerSeasonEndedRemoved' });



    await act(async () => {

      await result.current.checkCardDatabase();

    });

    expect(result.current.message).toEqual({

      severity: 'info',

      key: 'cardUpdateAvailable',

      params: { latest: '5.3', installed: '5.2' },

    });

  });



  it('answers the new-sets question', async () => {

    hoisted.db.resolveUnknownSets.mockResolvedValue(undefined);

    const { result } = await renderLoaded();

    act(() => result.current.showUnknownSets(['NEO']));



    await act(async () => {

      await result.current.answerUnknownSets('enable-always');

    });

    expect(hoisted.db.resolveUnknownSets).toHaveBeenCalledWith('enable-always');

    expect(result.current.unknownSets).toEqual([]);

  });

});

