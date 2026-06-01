import { describe, expect, it, vi } from 'vitest';

import { CardAttribute } from '@cockatrice/sockatrice/generated';
import type { useWebClient } from '@cockatrice/datatrice/react';

import { dispatchBulkMove, dispatchBulkTap } from './bulkCardActions';
import type { SelectedCard } from './selection';

type GameWebClient = ReturnType<typeof useWebClient>;

function card(id: number, tapped = false) {
  return { id, tapped } as SelectedCard['card'];
}

describe('dispatchBulkTap', () => {
  function makeClient() {
    const setCardAttr = vi.fn();
    const client = { request: { game: { setCardAttr, moveCard: vi.fn() } } } as unknown as GameWebClient;
    return { client, setCardAttr };
  }

  it('taps all when any is untapped, only commanding the ones that change', () => {
    const { client, setCardAttr } = makeClient();
    const targets: SelectedCard[] = [
      { ownerPlayerId: 0, zone: 'table', card: card(1, false) },
      { ownerPlayerId: 0, zone: 'table', card: card(2, true) },
    ];
    dispatchBulkTap(client, 1, targets);
    expect(setCardAttr).toHaveBeenCalledTimes(1);
    expect(setCardAttr).toHaveBeenCalledWith(1, {
      zone: 'table',
      cardId: 1,
      attribute: CardAttribute.AttrTapped,
      attrValue: '1',
    });
  });

  it('untaps all when every card is already tapped', () => {
    const { client, setCardAttr } = makeClient();
    const targets: SelectedCard[] = [
      { ownerPlayerId: 0, zone: 'table', card: card(1, true) },
      { ownerPlayerId: 0, zone: 'table', card: card(2, true) },
    ];
    dispatchBulkTap(client, 1, targets);
    expect(setCardAttr).toHaveBeenCalledTimes(2);
    expect(setCardAttr).toHaveBeenCalledWith(1, expect.objectContaining({ attrValue: '0' }));
  });
});

describe('dispatchBulkMove', () => {
  it('groups by (owner, zone) and emits one moveCard per group', () => {
    const moveCard = vi.fn();
    const client = { request: { game: { setCardAttr: vi.fn(), moveCard } } } as unknown as GameWebClient;
    const targets: SelectedCard[] = [
      { ownerPlayerId: 0, zone: 'table', card: card(1) },
      { ownerPlayerId: 0, zone: 'table', card: card(2) },
      { ownerPlayerId: 1, zone: 'grave', card: card(5) },
    ];
    dispatchBulkMove(client, 1, targets, { targetPlayerId: 0, targetZone: 'grave', x: 0, y: 0 });
    expect(moveCard).toHaveBeenCalledTimes(2);
    expect(moveCard).toHaveBeenCalledWith(1, expect.objectContaining({
      startPlayerId: 0,
      startZone: 'table',
      cardsToMove: { card: [{ cardId: 1 }, { cardId: 2 }] },
      targetZone: 'grave',
    }));
    expect(moveCard).toHaveBeenCalledWith(1, expect.objectContaining({
      startPlayerId: 1,
      startZone: 'grave',
      cardsToMove: { card: [{ cardId: 5 }] },
    }));
  });
});
