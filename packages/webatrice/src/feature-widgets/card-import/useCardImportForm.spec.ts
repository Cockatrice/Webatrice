import { act, renderHook } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({ scan: vi.fn(), save: vi.fn(), resolveUnknownSets: vi.fn() }));

vi.mock('@app/services', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@app/services')>()),
  scanCardSourceFiles: hoisted.scan,
  saveCardSourceScan: hoisted.save,
  cardDatabaseService: { resolveUnknownSets: hoisted.resolveUnknownSets },
}));

import { useCardImportForm } from './useCardImportForm';
import { hasUnloadRisk } from '../../services/unloadGuard';

const records = (overrides = {}) => ({
  cards: [{ name: { value: 'A Card' } }],
  sets: [{ name: { value: 'SET' }, longname: { value: 'A Set' } }],
  tokens: [],
  formats: [],
  ...overrides,
});

const makeScan = (overrides = {}) => ({
  sources: [
    { name: 'cards.xml', path: 'cards.xml', kind: 'main', xml: '<a/>', records: records() },
    {
      name: 'Cube.xml', path: 'Cube.xml', kind: 'custom', xml: '<b/>',
      records: records({ sets: [{ name: { value: 'CUB' } }], tokens: [{ name: { value: 'Elf' } }] }),
    },
  ],
  skipped: [],
  failed: [],
  ...overrides,
});

const savedSummary = {
  imported: [{ name: 'cards.xml' }, { name: 'Cube.xml' }],
  skipped: [],
  failed: [],
  unknownSets: ['CUB'],
  counts: { cards: 2, sets: 2, tokens: 1, formats: 0 },
};

async function scanned() {
  hoisted.scan.mockResolvedValue(makeScan());
  const hook = renderHook(() => useCardImportForm());
  await act(async () => {
    await hook.result.current.handleLocalFiles([new File(['x'], 'cards.xml')]);
  });
  return hook;
}

describe('useCardImportForm', () => {
  it('starts on the first step with empty state and the three step keys', () => {
    const { result } = renderHook(() => useCardImportForm());

    expect(result.current.activeStep).toBe(0);
    expect(result.current.steps.map((s) => s.key)).toEqual(['importFiles', 'reviewAndSave', 'finished']);
    expect(result.current.review).toBeNull();
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('scans the files, accepting custom sets, and advances to the review step', async () => {
    const { result } = await scanned();

    expect(result.current.activeStep).toBe(1);
    expect(result.current.review).toEqual({
      cards: 2,
      sets: 2,
      tokens: 1,
      formats: 0,
      setNames: ['A Set', 'CUB'],
      files: [{ name: 'cards.xml', kind: 'main' }, { name: 'Cube.xml', kind: 'custom' }],
      problems: [],
    });
  });

  it('lists skipped and failed files on the review step', async () => {
    hoisted.scan.mockResolvedValue(makeScan({ skipped: [{ name: 'notes.txt', reason: 'unsupported' }] }));
    const { result } = renderHook(() => useCardImportForm());

    await act(async () => {
      await result.current.handleLocalFiles([new File(['x'], 'cards.xml')]);
    });

    expect(result.current.review?.problems).toEqual(['ImportSummary.problem.unsupported.cardFiles']);
  });

  it('stays on the first step with a translated error when no card files were found', async () => {
    hoisted.scan.mockResolvedValue(makeScan({ sources: [], failed: [{ name: 'bad.xml', reason: 'invalid' }] }));
    const { result } = renderHook(() => useCardImportForm());

    await act(async () => {
      await result.current.handleLocalFiles([new File(['x'], 'bad.xml')]);
    });

    expect(result.current.activeStep).toBe(0);
    expect(result.current.error).toBe('CardImportForm.message.noCardFiles ImportSummary.problem.invalid.cardFiles');
  });

  it('shows a translated error when the files cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    hoisted.scan.mockRejectedValue(new Error('read boom'));
    const { result } = renderHook(() => useCardImportForm());

    await act(async () => {
      await result.current.handleLocalFiles([new File(['x'], 'cards.xml')]);
    });

    expect(result.current.error).toBe('CardImportForm.message.readFailed');
  });

  it('handleBack steps backward and clears any error', async () => {
    const { result } = await scanned();

    act(() => {
      result.current.handleBack();
    });
    expect(result.current.activeStep).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('saves the scan and finishes with the import summary and the new sets', async () => {
    hoisted.save.mockResolvedValue(savedSummary);
    const { result } = await scanned();

    await act(async () => {
      await result.current.handleLocalSave();
    });

    expect(hoisted.save).toHaveBeenCalledWith(makeScan());
    expect(result.current.activeStep).toBe(2);
    expect(result.current.result).toEqual({
      text: { headline: 'ImportSummary.imported.cardFiles', problems: [], severity: 'info' },
      unknownSets: ['CUB'],
    });
  });

  it('guards reload only while writing an import to the local database', async () => {
    let finish!: (value: typeof savedSummary) => void;
    hoisted.save.mockReturnValue(new Promise((resolve) => {
      finish = resolve;
    }));
    const { result } = await scanned();

    let saving!: Promise<void>;
    act(() => {
      saving = result.current.handleLocalSave();
    });
    expect(hasUnloadRisk()).toBe(true);

    await act(async () => {
      finish(savedSummary);
      await saving;
    });
    expect(hasUnloadRisk()).toBe(false);
  });

  it('clears the new-sets question once it is answered', async () => {
    hoisted.save.mockResolvedValue(savedSummary);
    hoisted.resolveUnknownSets.mockResolvedValue(undefined);
    const { result } = await scanned();
    await act(async () => {
      await result.current.handleLocalSave();
    });

    await act(async () => {
      await result.current.answerUnknownSets('enable');
    });

    expect(hoisted.resolveUnknownSets).toHaveBeenCalledWith('enable');
    expect(result.current.result?.unknownSets).toEqual([]);
  });

  it('shows a translated error when saving fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    hoisted.save.mockRejectedValue(new Error('db boom'));
    const { result } = await scanned();

    await act(async () => {
      await result.current.handleLocalSave();
    });

    expect(result.current.error).toBe('CardImportForm.message.saveFailed');
    expect(result.current.activeStep).toBe(1);
  });

  it('handleLocalSave is a no-op before anything was scanned', async () => {
    const { result } = renderHook(() => useCardImportForm());

    await act(async () => {
      await result.current.handleLocalSave();
    });

    expect(hoisted.save).not.toHaveBeenCalled();
    expect(result.current.activeStep).toBe(0);
  });
});
