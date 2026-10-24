import { renderHook } from '@testing-library/react';

import { useDocumentLanguage } from './useDocumentLanguage';

const i18n = { language: 'en' };
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n }),
}));

describe('useDocumentLanguage', () => {
  afterEach(() => {
    document.documentElement.lang = 'en';
  });

  it('puts the UI language on <html lang> as a BCP-47 tag and follows changes', () => {
    i18n.language = 'pt_BR';
    const { rerender } = renderHook(() => useDocumentLanguage());
    expect(document.documentElement.lang).toBe('pt-BR');

    i18n.language = 'de';
    rerender();
    expect(document.documentElement.lang).toBe('de');
  });
});
