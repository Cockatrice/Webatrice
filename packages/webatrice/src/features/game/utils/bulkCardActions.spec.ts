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
    }, undefined);
  });

  it('untaps all when every card is already tapped', () => {
    const { client, setCardAttr } = makeClient();
    const targets: SelectedCard[] = [
      { ownerPlayerId: 0, zone: 'table', card: card(1, true) },
      { ownerPlayerId: 0, zone: 'table', card: card(2, true) },
    ];
    dispatchBulkTap(client, 1, targets);
    expect(setCardAttr).toHaveBeenCalledTimes(2);
    expect(setCardAttr).toHaveBeenCalledWith(1, expect.objectContaining({ attrValue: '0' }), undefined);
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
    }), undefined);
    expect(moveCard).toHaveBeenCalledWith(1, expect.objectContaining({
      startPlayerId: 1,
      startZone: 'grave',
      cardsToMove: { card: [{ cardId: 5 }] },
    }), undefined);
  });

  it('routes each non-table group to its own owner, ignoring dest.targetPlayerId', () => {
    const moveCard = vi.fn();
    const client = { request: { game: { setCardAttr: vi.fn(), moveCard } } } as unknown as GameWebClient;
    const targets: SelectedCard[] = [
      { ownerPlayerId: 0, zone: 'table', card: card(1) },
      { ownerPlayerId: 1, zone: 'table', card: card(2) },
    ];
    // dest.targetPlayerId is the acting player (0); the foreign group (owner 1)
    // must still target player 1, since Servatrice rejects cross-player
    // non-table moves.
    dispatchBulkMove(client, 1, targets, { targetPlayerId: 0, targetZone: 'grave', x: 0, y: 0 });
    expect(moveCard).toHaveBeenCalledWith(1, expect.objectContaining({ startPlayerId: 0, targetPlayerId: 0 }), undefined);
    expect(moveCard).toHaveBeenCalledWith(1, expect.objectContaining({ startPlayerId: 1, targetPlayerId: 1 }), undefined);
  });

  it('keeps dest.targetPlayerId for TABLE moves (cross-player control-change)', () => {
    const moveCard = vi.fn();
    const client = { request: { game: { setCardAttr: vi.fn(), moveCard } } } as unknown as GameWebClient;
    const targets: SelectedCard[] = [{ ownerPlayerId: 1, zone: 'grave', card: card(5) }];
    dispatchBulkMove(client, 1, targets, { targetPlayerId: 0, targetZone: 'table', x: 0, y: 0 });
    expect(moveCard).toHaveBeenCalledWith(1, expect.objectContaining({
      startPlayerId: 1,
      targetPlayerId: 0,
      targetZone: 'table',
    }), undefined);
  });
});

describe('bulk actions — judge override', () => {
  it('dispatchBulkTap wraps a foreign card (target=owner) and sends an own card bare', () => {
    const setCardAttr = vi.fn();
    const client = { request: { game: { setCardAttr, moveCard: vi.fn() } } } as unknown as GameWebClient;
    const targets: SelectedCard[] = [
      { ownerPlayerId: 1, zone: 'table', card: card(1, false) }, // own → bare
      { ownerPlayerId: 2, zone: 'table', card: card(2, false) }, // foreign → wrapped
    ];
    // Judge resolver: foreign owner 2 wraps as 2; own owner 1 stays bare. Both untapped → tap all.
    const judgeTarget = (owner: number) => (owner === 1 ? undefined : owner);
    dispatchBulkTap(client, 1, targets, judgeTarget);
    expect(setCardAttr).toHaveBeenCalledWith(1, expect.objectContaining({ cardId: 1, attrValue: '1' }), undefined);
    expect(setCardAttr).toHaveBeenCalledWith(1, expect.objectContaining({ cardId: 2, attrValue: '1' }), 2);
  });

  it('dispatchBulkMove wraps each foreign group as its owner; own group stays bare', () => {
    const moveCard = vi.fn();
    const client = { request: { game: { setCardAttr: vi.fn(), moveCard } } } as unknown as GameWebClient;
    const targets: SelectedCard[] = [
      { ownerPlayerId: 1, zone: 'grave', card: card(1) }, // own → bare
      { ownerPlayerId: 2, zone: 'grave', card: card(5) }, // foreign → wrapped
    ];
    const judgeTarget = (owner: number) => (owner === 1 ? undefined : owner);
    dispatchBulkMove(client, 1, targets, { targetPlayerId: 1, targetZone: 'hand', x: 0, y: 0 }, judgeTarget);
    expect(moveCard).toHaveBeenCalledWith(1, expect.objectContaining({ startPlayerId: 1, targetPlayerId: 1 }), undefined);
    expect(moveCard).toHaveBeenCalledWith(1, expect.objectContaining({ startPlayerId: 2, targetPlayerId: 2 }), 2);
  });

  it('routes each non-table group to its own owner, ignoring dest.targetPlayerId', () => {
    const moveCard = vi.fn();
    const client = { request: { game: { setCardAttr: vi.fn(), moveCard } } } as unknown as GameWebClient;
    const targets: SelectedCard[] = [
      { ownerPlayerId: 0, zone: 'table', card: card(1) },
      { ownerPlayerId: 1, zone: 'table', card: card(2) },
    ];
    // dest.targetPlayerId is the acting player (0); the foreign group (owner 1)
    // must still target player 1, since Servatrice rejects cross-player
    // non-table moves.
    dispatchBulkMove(client, 1, targets, { targetPlayerId: 0, targetZone: 'grave', x: 0, y: 0 });
    expect(moveCard).toHaveBeenCalledWith(1, expect.objectContaining({ startPlayerId: 0, targetPlayerId: 0 }));
    expect(moveCard).toHaveBeenCalledWith(1, expect.objectContaining({ startPlayerId: 1, targetPlayerId: 1 }));
  });

  it('keeps dest.targetPlayerId for TABLE moves (cross-player control-change)', () => {
    const moveCard = vi.fn();
    const client = { request: { game: { setCardAttr: vi.fn(), moveCard } } } as unknown as GameWebClient;
    const targets: SelectedCard[] = [{ ownerPlayerId: 1, zone: 'grave', card: card(5) }];
    dispatchBulkMove(client, 1, targets, { targetPlayerId: 0, targetZone: 'table', x: 0, y: 0 });
    expect(moveCard).toHaveBeenCalledWith(1, expect.objectContaining({
      startPlayerId: 1,
      targetPlayerId: 0,
      targetZone: 'table',
    }));
  });
});
