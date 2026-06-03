vi.mock('../../../WebClient');

import { WebClient } from '../../../WebClient';
import {
  CardAttribute,
  Command_FlipCard_ext,
  Command_MoveCard_ext,
  Command_RevealCards_ext,
  Command_SetCardAttr_ext,
} from '../../../generated';
import type { GameCommandEntry } from '../../../services/ProtobufService';

import { bulkTap } from './bulkTap';
import { bulkDoesntUntap } from './bulkDoesntUntap';
import { bulkFlip } from './bulkFlip';
import { bulkPeek } from './bulkPeek';
import { bulkMove } from './bulkMove';
import { moveTargetPlayerId } from './moveTargetPlayerId';
import type { CardLocation } from './types';

const gameId = 1;

function card(id: number, props: Partial<CardLocation['card']> = {}) {
  return { id, tapped: false, ...props } as CardLocation['card'];
}

// The single batch sent through WebClient.instance.protobuf.sendGameCommands.
function sentEntries(): GameCommandEntry[] {
  const send = vi.mocked(WebClient.instance.protobuf.sendGameCommands);
  expect(send).toHaveBeenCalledTimes(1);
  return send.mock.calls[0][1] as GameCommandEntry[];
}

function moveCardIds(entry: GameCommandEntry): number[] {
  return (entry.value as { cardsToMove: { card: { cardId: number }[] } }).cardsToMove.card.map((c) => c.cardId);
}

describe('bulkTap', () => {
  it('taps all when any is untapped, only commanding the ones that change', () => {
    bulkTap(gameId, [
      { ownerPlayerId: 0, zone: 'table', card: card(1, { tapped: false }) },
      { ownerPlayerId: 0, zone: 'table', card: card(2, { tapped: true }) },
    ]);
    const entries = sentEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].ext).toBe(Command_SetCardAttr_ext);
    expect(entries[0].value).toEqual(expect.objectContaining({
      zone: 'table',
      cardId: 1,
      attribute: CardAttribute.AttrTapped,
      attrValue: '1',
    }));
    expect(entries[0].judgeTargetId).toBeUndefined();
  });

  it('untaps all when every card is already tapped', () => {
    bulkTap(gameId, [
      { ownerPlayerId: 0, zone: 'table', card: card(1, { tapped: true }) },
      { ownerPlayerId: 0, zone: 'table', card: card(2, { tapped: true }) },
    ]);
    const entries = sentEntries();
    expect(entries).toHaveLength(2);
    expect(entries.every((e) => (e.value as { attrValue: string }).attrValue === '0')).toBe(true);
  });
});

describe('bulkDoesntUntap', () => {
  it('sets the attr on all when any is unset, only commanding the ones that change', () => {
    bulkDoesntUntap(gameId, [
      { ownerPlayerId: 0, zone: 'table', card: card(1, { doesntUntap: false }) },
      { ownerPlayerId: 0, zone: 'table', card: card(2, { doesntUntap: true }) },
    ]);
    const entries = sentEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].value).toEqual(expect.objectContaining({
      cardId: 1,
      attribute: CardAttribute.AttrDoesntUntap,
      attrValue: '1',
    }));
  });
});

describe('bulkFlip', () => {
  it('flips all face-down when any is face-up, using Command_FlipCard', () => {
    bulkFlip(gameId, [
      { ownerPlayerId: 0, zone: 'table', card: card(1, { faceDown: false }) },
      { ownerPlayerId: 0, zone: 'table', card: card(2, { faceDown: true }) },
    ]);
    const entries = sentEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].ext).toBe(Command_FlipCard_ext);
    expect(entries[0].value).toEqual(expect.objectContaining({ zone: 'table', cardId: 1, faceDown: true }));
  });
});

describe('bulkPeek', () => {
  it('reveals every card to the given player', () => {
    bulkPeek(gameId, [
      { ownerPlayerId: 0, zone: 'table', card: card(1, { faceDown: true }) },
      { ownerPlayerId: 0, zone: 'table', card: card(2, { faceDown: true }) },
    ], 0);
    const entries = sentEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0].ext).toBe(Command_RevealCards_ext);
    expect(entries[0].value).toEqual(expect.objectContaining({
      zoneName: 'table',
      cardId: [1],
      playerId: 0,
      topCards: -1,
    }));
  });
});

describe('bulkMove', () => {
  it('groups by (owner, zone) and emits one moveCard entry per group', () => {
    bulkMove(gameId, [
      { ownerPlayerId: 0, zone: 'table', card: card(1) },
      { ownerPlayerId: 0, zone: 'table', card: card(2) },
      { ownerPlayerId: 1, zone: 'grave', card: card(5) },
    ], { targetPlayerId: 0, targetZone: 'grave', x: 0, y: 0 });
    const entries = sentEntries();
    expect(entries).toHaveLength(2);
    expect(entries.every((e) => e.ext === Command_MoveCard_ext)).toBe(true);
    expect(entries[0].value).toEqual(expect.objectContaining({
      startPlayerId: 0,
      startZone: 'table',
      targetZone: 'grave',
    }));
    expect(moveCardIds(entries[0])).toEqual([1, 2]);
    expect(entries[1].value).toEqual(expect.objectContaining({ startPlayerId: 1, startZone: 'grave' }));
    expect(moveCardIds(entries[1])).toEqual([5]);
  });

  it('routes each non-table group to its own owner, ignoring dest.targetPlayerId', () => {
    bulkMove(gameId, [
      { ownerPlayerId: 0, zone: 'table', card: card(1) },
      { ownerPlayerId: 1, zone: 'table', card: card(2) },
    ], { targetPlayerId: 0, targetZone: 'grave', x: 0, y: 0 });
    const entries = sentEntries();
    expect(entries[0].value).toEqual(expect.objectContaining({ startPlayerId: 0, targetPlayerId: 0 }));
    expect(entries[1].value).toEqual(expect.objectContaining({ startPlayerId: 1, targetPlayerId: 1 }));
  });

  it('keeps dest.targetPlayerId for TABLE moves (cross-player control-change)', () => {
    bulkMove(gameId, [{ ownerPlayerId: 1, zone: 'grave', card: card(5) }],
      { targetPlayerId: 0, targetZone: 'table', x: 0, y: 0 });
    const entries = sentEntries();
    expect(entries[0].value).toEqual(expect.objectContaining({
      startPlayerId: 1,
      targetPlayerId: 0,
      targetZone: 'table',
    }));
  });
});

describe('bulk actions — judge override', () => {
  // Judge resolver: foreign owner 2 wraps as 2; own owner 1 stays bare.
  const judgeTarget = (owner: number) => (owner === 1 ? undefined : owner);

  it('bulkTap tags a foreign card with its owner and leaves an own card bare', () => {
    bulkTap(gameId, [
      { ownerPlayerId: 1, zone: 'table', card: card(1, { tapped: false }) },
      { ownerPlayerId: 2, zone: 'table', card: card(2, { tapped: false }) },
    ], judgeTarget);
    const entries = sentEntries();
    expect(entries[0]).toEqual(expect.objectContaining({ judgeTargetId: undefined }));
    expect((entries[0].value as { cardId: number }).cardId).toBe(1);
    expect(entries[1]).toEqual(expect.objectContaining({ judgeTargetId: 2 }));
    expect((entries[1].value as { cardId: number }).cardId).toBe(2);
  });

  it('bulkMove tags each foreign group with its owner; own group stays bare', () => {
    bulkMove(gameId, [
      { ownerPlayerId: 1, zone: 'grave', card: card(1) },
      { ownerPlayerId: 2, zone: 'grave', card: card(5) },
    ], { targetPlayerId: 1, targetZone: 'hand', x: 0, y: 0 }, judgeTarget);
    const entries = sentEntries();
    expect(entries[0]).toEqual(expect.objectContaining({ judgeTargetId: undefined }));
    expect(entries[0].value).toEqual(expect.objectContaining({ startPlayerId: 1, targetPlayerId: 1 }));
    expect(entries[1]).toEqual(expect.objectContaining({ judgeTargetId: 2 }));
    expect(entries[1].value).toEqual(expect.objectContaining({ startPlayerId: 2, targetPlayerId: 2 }));
  });
});

describe('empty selection', () => {
  it('every bulk command sends nothing for an empty selection', () => {
    bulkTap(gameId, []);
    bulkDoesntUntap(gameId, []);
    bulkFlip(gameId, []);
    bulkPeek(gameId, [], 0);
    bulkMove(gameId, [], { targetPlayerId: 0, targetZone: 'grave', x: 0, y: 0 });
    expect(WebClient.instance.protobuf.sendGameCommands).not.toHaveBeenCalled();
  });
});

describe('moveTargetPlayerId', () => {
  it('routes a non-table move to the card owner, ignoring the requested table target', () => {
    expect(moveTargetPlayerId(2, 'grave', 1)).toBe(2);
    expect(moveTargetPlayerId(2, 'hand', 1)).toBe(2);
  });

  it('keeps the requested target player for a TABLE move (control-change)', () => {
    expect(moveTargetPlayerId(2, 'table', 1)).toBe(1);
  });

  it('is a no-op for a self-owned card (owner already equals the local player)', () => {
    expect(moveTargetPlayerId(1, 'grave', 1)).toBe(1);
  });
});
