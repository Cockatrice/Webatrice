import { act, renderHook } from '@testing-library/react';

import { useApplyCardPresentation } from './useApplyCardPresentation';
import { getSettings, settingsStore } from './useSettings';

const rootVar = (name: string) => document.documentElement.style.getPropertyValue(name);

describe('useApplyCardPresentation', () => {
  afterEach(() => {
    settingsStore.reset();
    document.documentElement.removeAttribute('style');
  });

  it('applies desktop\'s card rendering defaults to the document', () => {
    renderHook(() => useApplyCardPresentation());
    expect(rootVar('--card-corner-radius')).toBe('7.5%');
    expect(rootVar('--card-hover-scale')).toBe('1.1');
    expect(rootVar('--card-info-font-size')).toBe('12px');
  });

  it('follows the options as they change', async () => {
    const settings = await getSettings();
    renderHook(() => useApplyCardPresentation());
    await act(async () => {
      settingsStore.setValue(Object.assign(settings, { roundCardCorners: false, scaleCards: false, maxFontSizeForCards: 20 }));
    });
    expect(rootVar('--card-corner-radius')).toBe('0px');
    expect(rootVar('--card-hover-scale')).toBe('1');
    expect(rootVar('--card-info-font-size')).toBe('20px');

    await act(async () => {
      settingsStore.setValue(Object.assign(settings, { maxFontSizeForCards: 4 }));
    });
    expect(rootVar('--card-info-font-size')).toBe('9px');
  });

  it('sets each card counter\'s colour, desktop\'s by default', async () => {
    const settings = await getSettings();
    renderHook(() => useApplyCardPresentation());
    expect(rootVar('--card-counter-0')).toBe('#FF6969');
    expect(rootVar('--card-counter-5')).toBe('#FF69FF');
    await act(async () => {
      settingsStore.setValue(Object.assign(settings, { cardCounterColorC: '123456' }));
    });
    expect(rootVar('--card-counter-2')).toBe('#123456');
  });
});
