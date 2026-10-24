import { act, screen, within } from '@testing-library/react';

import { renderWithProviders } from '../../__test-utils__';
import { testI18n } from '../../__test-utils__/renderWithProviders';
import ReplayList, { formatItemDate } from './ReplayList';
import type { ReplayLibrary } from './useReplayLibrary';
import { groupByDay, type FileItem } from './replayLibrary';

const now = new Date(2026, 9, 11, 15, 30).getTime();
const times = [now, new Date(2026, 9, 10, 8, 45).getTime(), new Date(2026, 8, 1, 9, 5).getTime()];
const expectedDate = (time: number, index: number, locale: string) => index < 2
  ? new Date(time).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
  : new Date(time).toLocaleString(locale, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

afterEach(async () => {
  await act(async () => {
    await testI18n.changeLanguage('en-US');
  });
});

it.each(['en-US', 'de-DE', 'ja-JP'])('preserves today, yesterday and older date strings in %s', (locale) => {
  times.forEach((time, index) => expect(formatItemDate(time, now, locale)).toBe(expectedDate(time, index, locale)));
  expect(formatItemDate(NaN, now, locale)).toBe('Invalid Date');
});

it('shares two formatters across rows and selection changes, rebuilding them when the locale changes', async () => {
  const items: FileItem[] = times.map((modifiedAt, index) => ({
    kind: 'file', id: String(index), entryId: index, name: `Replay ${index}`, folder: undefined, sizeBytes: 100, modifiedAt,
  }));
  const library = {
    server: { availability: 'disconnected', loading: false, matches: [] }, local: { loading: false },
    visible: items, groups: groupByDay(items, now), counts: { all: 3, local: 3, server: 0 },
    source: 'all', query: '', selected: null, countries: {}, now,
    setQuery: vi.fn(), setSource: vi.fn(), select: vi.fn(),
  } as unknown as ReplayLibrary;
  const formatters = vi.spyOn(Intl, 'DateTimeFormat');
  const { rerender } = renderWithProviders(<ReplayList library={library} />);
  expect(formatters).toHaveBeenCalledTimes(2);
  items.forEach((item, index) => {
    expect(within(screen.getByTestId(`replay-item-${item.id}`)).getByText(expectedDate(item.modifiedAt, index, 'en-US'))).toBeVisible();
  });
  formatters.mockClear();
  rerender(<ReplayList library={{ ...library, selected: items[0] }} />);
  expect(formatters).not.toHaveBeenCalled();
  expect(screen.getByTestId('replay-item-0')).toHaveAttribute('aria-current', 'true');

  await act(async () => {
    await testI18n.changeLanguage('de-DE');
  });
  expect(formatters).toHaveBeenCalledTimes(2);
  expect(formatters.mock.calls.every(([locale]) => locale === 'de-DE')).toBe(true);
  items.forEach((item, index) => {
    expect(within(screen.getByTestId(`replay-item-${item.id}`)).getByText(expectedDate(item.modifiedAt, index, 'de-DE'))).toBeVisible();
  });
});
