import { act, renderHook } from '@testing-library/react';

import { endSession } from '@app/services/session';

import { groupDeckCards } from '../deckGrouping';
import type { HydratedDeck } from '../types';
import { useDeckImageWarmer } from './useDeckImageWarmer';

const images: FakeImage[] = [];

class FakeImage {
  src = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    images.push(this);
  }
}

function deck(prefix = 'a'): HydratedDeck {
  return {
    name: prefix, format: 'standard', meta: { v: 1, updatedAt: '' },
    cards: Array.from({ length: 9 }, (_, i) => ({
      name: `${prefix}${i}`, imageUri: `https://img/${prefix}${i}`, quantity: 1,
      category: 'main', lookupSource: 'scryfall',
    })),
  };
}

beforeEach(() => {
  endSession();
  images.length = 0;
  vi.stubGlobal('Image', FakeImage);
});
afterEach(() => vi.unstubAllGlobals());

describe('useDeckImageWarmer', () => {
  it('waits for hydration, runs six loads and never rerenders on image events', () => {
    const d = deck();
    const groups = groupDeckCards(d.cards, false);
    const render = vi.fn();
    const { rerender } = renderHook(({ loading }) => {
      render();
      useDeckImageWarmer(1, d, groups, loading);
    }, { initialProps: { loading: true } });
    expect(images).toHaveLength(0);
    rerender({ loading: false });
    expect(images.map((image) => image.src)).toEqual(d.cards.slice(0, 6).map((card) => card.imageUri));
    render.mockClear();
    act(() => images[0].onload?.());
    expect(images).toHaveLength(7);
    act(() => images[1].onerror?.());
    expect(images).toHaveLength(8);
    expect(render).not.toHaveBeenCalled();
  });

  it('cancels queued work on deck change and unmount, ignoring late events', () => {
    const first = deck();
    const second = deck('b');
    const { rerender, unmount } = renderHook(({ id, d }) =>
      useDeckImageWarmer(id, d, groupDeckCards(d.cards, false), false),
    { initialProps: { id: 1, d: first } });
    const oldImages = [...images];
    const lateLoad = images[0].onload;
    rerender({ id: 2, d: second });
    expect(oldImages.every((image) => image.src === '')).toBe(true);
    expect(images.slice(6).map((image) => image.src)).toEqual(second.cards.slice(0, 6).map((card) => card.imageUri));
    expect(images.map((image) => image.src)).not.toContain('https://img/a6');
    const count = images.length;
    act(() => lateLoad?.());
    expect(images).toHaveLength(count);
    const lateError = images.at(-1)!.onerror;
    unmount();
    act(() => lateError?.());
    expect(images.every((image) => image.src === '')).toBe(true);
    expect(images).toHaveLength(count);
    expect(images.every((image) => image.onload === null && image.onerror === null)).toBe(true);
  });

  it('does not warm successful URLs on reopen, but retries errors and unfinished loads', () => {
    const d = deck();
    const groups = groupDeckCards(d.cards, false);
    const first = renderHook(() => useDeckImageWarmer(1, d, groups, false));
    act(() => images[0].onload?.());
    act(() => images[1].onerror?.());
    first.unmount();
    expect(images[0].src).toBe('https://img/a0');
    expect(images.slice(2).every((image) => image.src === '')).toBe(true);
    images.length = 0;
    renderHook(() => useDeckImageWarmer(1, d, groups, false));
    expect(images.map((image) => image.src)).toEqual(d.cards.slice(1, 7).map((card) => card.imageUri));
  });

  it('clears warmed URLs and cancels outstanding work when the session ends', () => {
    const d = deck();
    const groups = groupDeckCards(d.cards, false);
    const first = renderHook(() => useDeckImageWarmer(1, d, groups, false));
    act(() => images[0].onload?.());
    const lateLoad = images[1].onload;
    act(() => endSession());
    expect(images.every((image) => image.onload === null && image.onerror === null)).toBe(true);
    const count = images.length;
    act(() => lateLoad?.());
    expect(images).toHaveLength(count);
    first.unmount();
    images.length = 0;
    renderHook(() => useDeckImageWarmer(1, d, groups, false));
    expect(images[0].src).toBe('https://img/a0');
  });

  it('starts no loads when a fully warmed deck is reopened', () => {
    const d = deck();
    const groups = groupDeckCards(d.cards, false);
    const first = renderHook(() => useDeckImageWarmer(1, d, groups, false));
    for (let i = 0; i < d.cards.length; i += 1) {
      act(() => images[i].onload?.());
    }
    expect(images).toHaveLength(d.cards.length);
    first.unmount();
    images.length = 0;
    renderHook(() => useDeckImageWarmer(1, d, groups, false));
    expect(images).toHaveLength(0);
  });
});
