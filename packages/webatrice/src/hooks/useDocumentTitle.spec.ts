import { renderHook } from '@testing-library/react';

import { useDocumentTitle } from './useDocumentTitle';

describe('useDocumentTitle', () => {
  it('names the tab after the page, and falls back to the app name', () => {
    const { rerender } = renderHook(({ title }) => useDocumentTitle(title), {
      initialProps: { title: 'Room Main' as string | null },
    });
    expect(document.title).toBe('Room Main · Webatrice');

    rerender({ title: null });
    expect(document.title).toBe('Webatrice');
  });
});
