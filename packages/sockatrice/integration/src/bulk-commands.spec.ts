// Bulk card commands — multi-selection Tap / Doesn't Untap / Flip / Peek / Move
// batched through the real WebClient + ProtobufService into a single outbound
// CommandContainer (see commands/game/bulk). Exercises the builders end-to-end
// across the protocol layers, complementing the unit suite's branch coverage.

import { create } from '@bufbuild/protobuf';
import { describe, expect, it } from 'vitest';

import * as Data from '../../src/generated';
import { GameCommands } from '../../src';

import { connectAndLogin } from '../../src/testing/setup';
import { captureLastOutbound, findLastGameCommand } from '../../src/testing/command-capture';

const gameId = 42;

function card(id: number, props: Partial<Data.ServerInfo_Card> = {}) {
  return create(Data.ServerInfo_CardSchema, { id, ...props });
}

describe('bulk card commands', () => {
  it('bulkTap taps the untapped subset in one container (collective rule + skip-no-op)', () => {
    connectAndLogin();

    GameCommands.bulkTap(gameId, [
      { ownerPlayerId: 1, zone: 'table', card: card(1, { tapped: false }) },
      { ownerPlayerId: 1, zone: 'table', card: card(2, { tapped: true }) },
    ]);

    const { value } = findLastGameCommand(Data.Command_SetCardAttr_ext);
    expect(value.attribute).toBe(Data.CardAttribute.AttrTapped);
    expect(value.attrValue).toBe('1');
    // Only the untapped card changes; both ride one container.
    expect(captureLastOutbound().gameCommand).toHaveLength(1);
  });

  it('bulkDoesntUntap sends a SetCardAttr(AttrDoesntUntap)', () => {
    connectAndLogin();

    GameCommands.bulkDoesntUntap(gameId, [
      { ownerPlayerId: 1, zone: 'table', card: card(1, { doesntUntap: false }) },
    ]);

    const { value } = findLastGameCommand(Data.Command_SetCardAttr_ext);
    expect(value.attribute).toBe(Data.CardAttribute.AttrDoesntUntap);
    expect(value.attrValue).toBe('1');
  });

  it('bulkFlip flips face-up cards down via Command_FlipCard', () => {
    connectAndLogin();

    GameCommands.bulkFlip(gameId, [
      { ownerPlayerId: 1, zone: 'table', card: card(1, { faceDown: false }) },
      { ownerPlayerId: 1, zone: 'table', card: card(2, { faceDown: false }) },
    ]);

    const { value } = findLastGameCommand(Data.Command_FlipCard_ext);
    expect(value.faceDown).toBe(true);
    expect(captureLastOutbound().gameCommand).toHaveLength(2);
  });

  it('bulkPeek reveals each card to the given player', () => {
    connectAndLogin();

    GameCommands.bulkPeek(gameId, [
      { ownerPlayerId: 1, zone: 'table', card: card(1, { faceDown: true }) },
    ], 1);

    const { value } = findLastGameCommand(Data.Command_RevealCards_ext);
    expect(value.playerId).toBe(1);
    expect(value.cardId).toEqual([1]);
  });

  it('bulkMove routes a non-table move to the card owner and batches the group', () => {
    connectAndLogin();

    GameCommands.bulkMove(gameId, [
      { ownerPlayerId: 1, zone: 'table', card: card(1) },
      { ownerPlayerId: 1, zone: 'table', card: card(2) },
    ], { targetPlayerId: 1, targetZone: 'grave', x: 0, y: 0 });

    const { value } = findLastGameCommand(Data.Command_MoveCard_ext);
    expect(value.targetZone).toBe('grave');
    expect(value.targetPlayerId).toBe(1);
    expect(value.cardsToMove?.card.map((c) => c.cardId)).toEqual([1, 2]);
  });

  it('bulkSetPT sets the same P/T on every selected card', () => {
    connectAndLogin();

    GameCommands.bulkSetPT(gameId, [
      { ownerPlayerId: 1, zone: 'table', card: card(1) },
      { ownerPlayerId: 1, zone: 'table', card: card(2) },
    ], '3/3');

    const { value } = findLastGameCommand(Data.Command_SetCardAttr_ext);
    expect(value.attribute).toBe(Data.CardAttribute.AttrPT);
    expect(value.attrValue).toBe('3/3');
    expect(captureLastOutbound().gameCommand).toHaveLength(2);
  });

  it('bulkSetAnnotation sets the same annotation on every selected card', () => {
    connectAndLogin();

    GameCommands.bulkSetAnnotation(gameId, [
      { ownerPlayerId: 1, zone: 'table', card: card(1) },
    ], 'note');

    const { value } = findLastGameCommand(Data.Command_SetCardAttr_ext);
    expect(value.attribute).toBe(Data.CardAttribute.AttrAnnotation);
    expect(value.attrValue).toBe('note');
  });

  it('bulkIncCardCounter applies the same delta to every selected card', () => {
    connectAndLogin();

    GameCommands.bulkIncCardCounter(gameId, [
      { ownerPlayerId: 1, zone: 'table', card: card(1) },
      { ownerPlayerId: 1, zone: 'table', card: card(2) },
    ], 5, 1);

    const { value } = findLastGameCommand(Data.Command_IncCardCounter_ext);
    expect(value.counterId).toBe(5);
    expect(value.counterDelta).toBe(1);
    expect(captureLastOutbound().gameCommand).toHaveLength(2);
  });

  it('bulkSetCardCounter sets the same value on every selected card', () => {
    connectAndLogin();

    GameCommands.bulkSetCardCounter(gameId, [
      { ownerPlayerId: 1, zone: 'table', card: card(1) },
    ], 5, 3);

    const { value } = findLastGameCommand(Data.Command_SetCardCounter_ext);
    expect(value.counterId).toBe(5);
    expect(value.counterValue).toBe(3);
  });
});
