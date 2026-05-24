import { act, renderHook } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({ ingest: vi.fn(), persist: vi.fn() }));

vi.mock('./LocalOracleImportService', () => ({
  localOracleImportService: { ingest: hoisted.ingest, persist: hoisted.persist },
}));

import { useCardImportForm } from './useCardImportForm';

const makeIngestResult = (overrides = {}) => ({
  cards: [{ name: { value: 'A Card' } }],
  sets: [{ name: { value: 'SET' }, longname: { value: 'A Set' } }],
  tokens: [],
  formats: [],
  acceptedFiles: ['cards.xml'],
  skippedFiles: [],
  info: {},
  ...overrides,
});

describe('useCardImportForm', () => {
  beforeEach(() => {
    hoisted.ingest.mockReset();
    hoisted.persist.mockReset();
  });

  it('starts on the first step with empty state and the three step keys', () => {
    const { result } = renderHook(() => useCardImportForm());

    expect(result.current.activeStep).toBe(0);
    expect(result.current.steps.map((s) => s.key)).toEqual([
      'importFiles',
      'reviewAndSave',
      'finished',
    ]);
    expect(result.current.importedCards).toEqual([]);
    expect(result.current.importedSets).toEqual([]);
    expect(result.current.ingest).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('handleLocalFiles ingests the files and advances to the review step', async () => {
    hoisted.ingest.mockResolvedValue(makeIngestResult());
    const { result } = renderHook(() => useCardImportForm());

    await act(async () => {
      await result.current.handleLocalFiles([new File(['x'], 'cards.xml')]);
    });

    expect(result.current.activeStep).toBe(1);
    expect(result.current.importedCards).toHaveLength(1);
    expect(result.current.importedSets).toHaveLength(1);
    expect(result.current.ingest).not.toBeNull();
  });

  it('handleLocalFiles sets an error when no files are recognized', async () => {
    hoisted.ingest.mockResolvedValue(makeIngestResult({ acceptedFiles: [] }));
    const { result } = renderHook(() => useCardImportForm());

    await act(async () => {
      await result.current.handleLocalFiles([new File(['x'], 'unknown.txt')]);
    });

    expect(result.current.activeStep).toBe(0);
    expect(result.current.error).toMatch(/No recognized files/);
  });

  it('handleLocalFiles surfaces an ingest failure as an error', async () => {
    hoisted.ingest.mockRejectedValue(new Error('parse boom'));
    const { result } = renderHook(() => useCardImportForm());

    await act(async () => {
      await result.current.handleLocalFiles([new File(['x'], 'cards.xml')]);
    });

    expect(result.current.error).toBe('parse boom');
  });

  it('handleBack steps backward and clears any error', async () => {
    hoisted.ingest.mockResolvedValue(makeIngestResult());
    const { result } = renderHook(() => useCardImportForm());

    await act(async () => {
      await result.current.handleLocalFiles([new File(['x'], 'cards.xml')]);
    });
    expect(result.current.activeStep).toBe(1);

    act(() => {
      result.current.handleBack();
    });
    expect(result.current.activeStep).toBe(0);
  });

  it('handleLocalSave persists the ingest result and advances to finished', async () => {
    hoisted.ingest.mockResolvedValue(makeIngestResult());
    hoisted.persist.mockResolvedValue(undefined);
    const { result } = renderHook(() => useCardImportForm());

    await act(async () => {
      await result.current.handleLocalFiles([new File(['x'], 'cards.xml')]);
    });
    await act(async () => {
      await result.current.handleLocalSave();
    });

    expect(hoisted.persist).toHaveBeenCalledTimes(1);
    expect(result.current.activeStep).toBe(2);
  });

  it('handleLocalSave surfaces a persist failure as an error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    hoisted.ingest.mockResolvedValue(makeIngestResult());
    hoisted.persist.mockRejectedValue(new Error('db boom'));
    const { result } = renderHook(() => useCardImportForm());

    await act(async () => {
      await result.current.handleLocalFiles([new File(['x'], 'cards.xml')]);
    });
    await act(async () => {
      await result.current.handleLocalSave();
    });

    expect(result.current.error).toBe('Failed to save imported data');
    expect(result.current.activeStep).toBe(1);
  });

  it('handleLocalSave is a no-op when there is no ingest result', async () => {
    const { result } = renderHook(() => useCardImportForm());

    await act(async () => {
      await result.current.handleLocalSave();
    });

    expect(hoisted.persist).not.toHaveBeenCalled();
    expect(result.current.activeStep).toBe(0);
  });
});
