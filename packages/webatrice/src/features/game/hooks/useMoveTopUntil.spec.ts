import { act, renderHook } from '@testing-library/react';
import { ZoneName } from '@cockatrice/sockatrice';

import { useMoveTopUntil, type UseMoveTopUntilOptions } from './useMoveTopUntil';

type Stack = UseMoveTopUntilOptions['stackCards'];

const REVEAL = [ZoneName.DECK, [0], { zone: ZoneName.STACK, index: 'end' }];
const describeCard = (name: string) => ({ name, typeLine: name === 'Bolt' ? 'Instant' : 'Land' });

function setup({ stack = [] as Stack, deckCount = 10, enabled = true } = {}) {
  const moveCards = vi.fn();
  const hook = renderHook(
    (props: { stackCards: Stack; deckCount: number }) =>
      useMoveTopUntil({ enabled, describeCard, moveCards, ...props }),
    { initialProps: { stackCards: stack, deckCount } },
  );
  let current = { stackCards: stack, deckCount };
  const lands = (id: string, name: string) => {
    current = { stackCards: [...current.stackCards, { id, name }], deckCount: current.deckCount - 1 };
    hook.rerender(current);
  };
  const rerender = (next: Partial<typeof current>) => {
    current = { ...current, ...next };
    hook.rerender(current);
  };
  const start = (filter: string, hits = 1, autoPlay = false) => {
    act(() => hook.result.current({ filter, hits, autoPlay }));
  };
  return { moveCards, lands, rerender, start };
}

describe('useMoveTopUntil', () => {
  it('a dialog callback starts against the current stack, not the stack at open', () => {
    const moveCards = vi.fn();
    const { result, rerender } = renderHook(
      (stackCards: Stack) => useMoveTopUntil({ enabled: true, describeCard, moveCards, stackCards, deckCount: 10 }),
      { initialProps: [] as Stack },
    );
    const submit = result.current;
    rerender([{ id: '90', name: 'Island' }]);
    act(() => submit({ filter: 'Bolt', hits: 1, autoPlay: false }));
    expect(moveCards.mock.calls).toEqual([REVEAL]);
  });

  it.each([[10, 0], [0, 10]])('a dialog callback reads the current deck count (%i to %i)', (before, after) => {
    const moveCards = vi.fn();
    const { result, rerender } = renderHook(
      (deckCount: number) => useMoveTopUntil({ enabled: true, describeCard, moveCards, stackCards: [], deckCount }),
      { initialProps: before },
    );
    const submit = result.current;
    rerender(after);
    act(() => submit({ filter: 'Bolt', hits: 1, autoPlay: false }));
    expect(moveCards.mock.calls).toEqual(after > 0 ? [REVEAL] : []);
  });

  it('reveals the top card once on start, and the next only when it lands', () => {
    const { moveCards, lands, start } = setup();

    start('Bolt', 2);
    expect(moveCards.mock.calls).toEqual([REVEAL]);

    lands('100', 'Island');
    expect(moveCards.mock.calls).toEqual([REVEAL, REVEAL]);
    lands('101', 'Bolt');
    expect(moveCards).toHaveBeenCalledTimes(3);
    lands('102', 'Bolt');
    expect(moveCards).toHaveBeenCalledTimes(3);
  });

  it('matches search expressions against the card description', () => {
    const { moveCards, lands, start } = setup();

    start('t:instant');
    lands('100', 'Island');
    lands('101', 'Bolt');

    expect(moveCards).toHaveBeenCalledTimes(2);
  });

  it('plays each hit from the stack with auto play', () => {
    const { moveCards, lands, start } = setup();

    start('Bolt', 2, true);
    lands('101', 'Bolt');

    expect(moveCards.mock.calls).toEqual([
      REVEAL,
      [ZoneName.STACK, [101], { zone: ZoneName.TABLE, index: 'end' }],
      REVEAL,
    ]);
  });

  it('stops when the library is empty after a reveal', () => {
    const { moveCards, lands, start } = setup({ deckCount: 1 });

    start('Bolt', 3);
    lands('100', 'Island');

    expect(moveCards).toHaveBeenCalledTimes(1);
  });

  it('sends nothing when the state updates without a new stack card', () => {
    const { moveCards, rerender, start } = setup();

    start('Bolt');
    rerender({ deckCount: 9 });
    rerender({ stackCards: [] });

    expect(moveCards).toHaveBeenCalledTimes(1);
  });

  it('judges only the top-most of several new stack cards, and remembers the rest', () => {
    const { moveCards, rerender, lands, start } = setup();

    start('Bolt', 2);
    rerender({ stackCards: [{ id: '100', name: 'Bolt' }, { id: '101', name: 'Island' }], deckCount: 9 });
    expect(moveCards).toHaveBeenCalledTimes(2);

    lands('102', 'Island');
    expect(moveCards).toHaveBeenCalledTimes(3);
  });

  it('ignores the stack it started with', () => {
    const { moveCards, lands, start } = setup({ stack: [{ id: '90', name: 'Bolt' }] });

    start('Bolt');
    lands('100', 'Island');

    expect(moveCards).toHaveBeenCalledTimes(2);
  });

  it('refuses to start on an empty filter, an empty library or another seat', () => {
    const empty = setup();
    empty.start('   ');
    expect(empty.moveCards).not.toHaveBeenCalled();

    const noLibrary = setup({ deckCount: 0 });
    noLibrary.start('Bolt');
    expect(noLibrary.moveCards).not.toHaveBeenCalled();

    const opponent = setup({ enabled: false });
    opponent.start('Bolt');
    expect(opponent.moveCards).not.toHaveBeenCalled();
  });

});
