import { act } from '@testing-library/react';
import { ZoneName } from '@cockatrice/sockatrice';
import { CardAttribute } from '@cockatrice/sockatrice/generated';
import { makeCard } from '@cockatrice/datatrice/testing';
import { renderSeatHook, buildSeatGameState, type SeatGameSpec } from '../../../__test-utils__/seatFixtures';
import { renderWithProviders, createMockWebClient } from '../../../../../__test-utils__';
import { GameReadOnlyProvider } from '../GameReadOnlyContext';
import { usePlayerCardCommands } from './usePlayerCardCommands';

const OGRE = makeCard({ id: 11, name: 'Ogre', x: 0, y: 0, pt: '3/3' });
const BEAR = makeCard({ id: 20, name: 'Bear', x: 0, y: 0, tapped: true });

const SPEC: SeatGameSpec = {
  localPlayerId: 1,
  seats: [
    { playerId: 1, table: [OGRE] },
    { playerId: 2, table: [BEAR] },
  ],
};

function renderCards(playerId = 1, isLocal = true) {
  const utils = renderSeatHook(() => usePlayerCardCommands(playerId, isLocal), SPEC);
  const card = (id: number) => utils.store.getState().games.games[1].players[playerId].zones[ZoneName.TABLE].byId[id];
  return { ...utils, card, commands: () => utils.result()! };
}

describe('usePlayerCardCommands', () => {
  it('offers no card commands on a replay board, including Clone', () => {
    let commands: ReturnType<typeof usePlayerCardCommands>;
    function Probe() {
      commands = usePlayerCardCommands(1, true);
      return null;
    }
    const webClient = createMockWebClient();
    const { store } = renderWithProviders(<GameReadOnlyProvider value><Probe /></GameReadOnlyProvider>, {
      preloadedState: buildSeatGameState(SPEC), webClient,
    });
    const before = store.getState();
    act(() => {
      commands?.clone({ name: 'Island', providerId: '', color: '', pt: '', annotation: '', y: 0 });
      commands?.setTapped([11], true);
    });
    expect(store.getState()).toBe(before);
    for (const send of Object.values(webClient.request.game)) {
      expect(send).not.toHaveBeenCalled();
    }
  });

  it('patches P/T before the server answers and restores it on rejection', () => {
    const { commands, card, game } = renderCards();
    act(() => commands().setPT([{ cardId: 11, pt: '5/5' }, { cardId: 11, pt: '5/5' }]));
    expect(card(11).pt).toBe('5/5');
    expect(game.setCardAttr).toHaveBeenCalledTimes(2);

    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    act(() => vi.mocked(game.setCardAttr).mock.calls[0][3]!.onError!(1, {} as never));
    expect(card(11).pt).toBe('3/3');
  });

  it('wraps a judge tap for the opponent seat while updating that owner optimistically', () => {
    const { commands, card, game } = renderCards(2, false);
    act(() => commands().setTapped([20], false));
    expect(card(20).tapped).toBe(false);
    expect(game.setCardAttr).toHaveBeenCalledWith(
      1,
      { zone: ZoneName.TABLE, cardId: 20, attribute: CardAttribute.AttrTapped, attrValue: '0' },
      2,
      { onError: expect.any(Function) },
    );
  });

  it('offers peek on the local seat only', () => {
    expect(renderCards(1, true).commands().peek).toBeInstanceOf(Function);
    expect(renderCards(2, false).commands().peek).toBeUndefined();
  });

  it('sends the remaining attributes without an optimistic step', () => {
    const { commands, card, game } = renderCards();
    commands().setDoesntUntap(11, false);
    commands().setAnnotation(11, '');
    commands().untapAll();
    expect(vi.mocked(game.setCardAttr).mock.calls.map(([, p]) => p)).toEqual([
      { zone: ZoneName.TABLE, cardId: 11, attribute: CardAttribute.AttrDoesntUntap, attrValue: '0' },
      { zone: ZoneName.TABLE, cardId: 11, attribute: CardAttribute.AttrAnnotation, attrValue: '' },
      { zone: ZoneName.TABLE, cardId: -1, attribute: CardAttribute.AttrTapped, attrValue: '0' },
    ]);
    expect(card(11).annotation).toBe(OGRE.annotation);
  });
});
