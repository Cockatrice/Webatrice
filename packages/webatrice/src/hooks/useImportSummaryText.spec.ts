import { renderHook } from '@testing-library/react';

import { useImportSummaryText } from './useImportSummaryText';

describe('useImportSummaryText', () => {
  it('reports a clean import with duplicates as information', () => {
    const { result } = renderHook(() => useImportSummaryText());

    const text = result.current({
      imported: [{ name: 'a.cor' }],
      skipped: [{ name: 'b.cor', reason: 'duplicate' }],
      failed: [],
    }, 'replays');

    expect(text).toEqual({
      headline: 'ImportSummary.imported.replays ImportSummary.duplicates',
      problems: [],
      severity: 'info',
    });
  });

  it('groups problems by reason and turns them into a warning', () => {
    const { result } = renderHook(() => useImportSummaryText());

    const text = result.current({
      imported: [],
      skipped: [{ name: 'notes.txt', reason: 'unsupported' }],
      failed: [
        { name: 'x.xml', reason: 'save-failed' },
        { name: 'a.xml', reason: 'invalid' },
        { name: 'b.xml', reason: 'invalid' },
      ],
    }, 'cardFiles');

    expect(text).toEqual({
      headline: 'ImportSummary.imported.cardFiles',
      problems: [
        'ImportSummary.problem.unsupported.cardFiles',
        'ImportSummary.problem.invalid.cardFiles',
        'ImportSummary.problem.save-failed.cardFiles',
      ],
      severity: 'warning',
    });
  });
});
