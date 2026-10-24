import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';
import { describe, expect, it, vi } from 'vitest';

import { games } from '@cockatrice/datatrice';
import {
  Command_MoveCard_ext,
  Event_MoveCard_ext,
  Event_MoveCardSchema,
  ServerInfo_CardSchema,
} from '@cockatrice/sockatrice/generated';
import { Game } from '@app/features/game';
import { store, connectRaw } from '../../helpers/setup';
import { findAllGameCommands } from '../../helpers/command-capture';
import { buildGameEventMessage, deliverMessage } from '../../helpers/protobuf-builders';
import { renderFeatureScreen } from '../helpers';
import { buildEventGameJoined, buildEventGameStateChanged, registerGameBoardHooks } from './helpers';

registerGameBoardHooks();

const handSelector = '[data-testid="hand-zone-1"] [data-card][data-zone="hand"]';

const handOrder = () => Array.from(document.querySelectorAll<HTMLElement>(handSelector), (card) => card.dataset.cardId);

function drag(from: HTMLElement, fromX: number, toX: number, toY = 550, init: Partial<PointerEventInit> = {}) {
  fireEvent.pointerDown(from, { button: 0, clientX: fromX, clientY: 550, ...init });
  fireEvent.pointerMove(window, { clientX: toX, clientY: toY });
  fireEvent.pointerUp(window, { clientX: toX, clientY: toY });
}

function click(card: HTMLElement, x: number, init: Partial<PointerEventInit> = {}) {
  fireEvent.pointerDown(card, { button: 0, clientX: x, clientY: 550, ...init });
  fireEvent.pointerUp(window, { clientX: x, clientY: 550, ...init });
}

function deliverEcho(cardId: number, x: number) {
  act(() => deliverMessage(buildGameEventMessage({
    gameId: 42, playerId: 1, ext: Event_MoveCard_ext,
    value: create(Event_MoveCardSchema, {
      startPlayerId: 1, startZone: 'hand', targetPlayerId: 1,
      cardId, newCardId: cardId, position: -1, x, y: 0,
    }),
  })));
}

async function renderHand() {
  connectRaw();
  renderFeatureScreen(<Game />);
  const data = buildEventGameStateChanged([1, 2], 1);
  const hand = data.playerList[0].zoneList.find((zone) => zone.name === 'hand')!;
  hand.cardList = [101, 102, 103].map((id) => create(ServerInfo_CardSchema, {
    id, name: `Card ${id}`,
  }));
  hand.cardCount = hand.cardList.length;
  act(() => {
    store.dispatch(games.Actions.gameJoined({
      data: buildEventGameJoined({ gameId: 42, localPlayerId: 1, hostId: 1 }),
    }));
    store.dispatch(games.Actions.gameStateChanged({ gameId: 42, data }));
  });
  await waitFor(() => expect(document.querySelectorAll(handSelector)).toHaveLength(3));
  const cards = Array.from(document.querySelectorAll<HTMLElement>(handSelector));
  cards.forEach((card, index) => {
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(new DOMRect(100 + index * 100, 500, 80, 120));
  });
  vi.spyOn(screen.getByTestId('hand-zone-1'), 'getBoundingClientRect')
    .mockReturnValue(new DOMRect(90, 500, 320, 120));
  return cards;
}

describe('Hand drag reorder', () => {
  it.each([
    { source: 0, dropX: 390, index: 2, expected: ['102', '103', '101'] },
    { source: 2, dropX: 100, index: 0, expected: ['103', '101', '102'] },
    { source: 0, dropX: 280, index: 1, expected: ['102', '101', '103'] },
  ])('moves card $source to ordinal $index', async ({ source, dropX, index, expected }) => {
    const cards = await renderHand();
    drag(cards[source], 140 + source * 100, dropX);

    const commands = findAllGameCommands(Command_MoveCard_ext);
    expect(commands).toHaveLength(1);
    expect(commands[0].gameId).toBe(42);
    expect(commands[0].value).toMatchObject({
      startPlayerId: 1, startZone: 'hand', targetPlayerId: 1, targetZone: 'hand',
      cardsToMove: { card: [{ cardId: 101 + source }] }, x: index, y: 0,
    });
    expect(handOrder()).toEqual(expected);

    deliverEcho(101 + source, index);
    expect(handOrder()).toEqual(expected);
    expect(games.Selectors.getZone(store.getState(), 42, 1, 'hand')?.cardCount).toBe(3);
  });

  it('applies the server echo, which is authoritative over the optimistic order', async () => {
    const cards = await renderHand();
    drag(cards[0], 140, 390);
    expect(handOrder()).toEqual(['102', '103', '101']);

    deliverEcho(101, 1);

    expect(handOrder()).toEqual(['102', '101', '103']);
    expect(games.isOptimisticPending(games.moveOpKey(1, 101))).toBe(false);
  });

  it('sends the card\'s own index when it is dropped on its own slot', async () => {
    const cards = await renderHand();
    drag(cards[1], 240, 250);

    const commands = findAllGameCommands(Command_MoveCard_ext);
    expect(commands).toHaveLength(1);
    expect(commands[0].value).toMatchObject({ cardsToMove: { card: [{ cardId: 102 }] }, x: 1 });
    expect(handOrder()).toEqual(['101', '102', '103']);
  });

  it('keeps a two-card group in order by sending one command per card', async () => {
    const cards = await renderHand();
    click(cards[0], 140);
    click(cards[1], 240, { ctrlKey: true });

    drag(cards[0], 140, 390);

    const commands = findAllGameCommands(Command_MoveCard_ext);
    expect(commands.map((command) => command.value)).toMatchObject([
      { cardsToMove: { card: [{ cardId: 101 }] }, x: 2 },
      { cardsToMove: { card: [{ cardId: 102 }] }, x: 2 },
    ]);
    expect(handOrder()).toEqual(['103', '101', '102']);

    deliverEcho(101, 2);
    deliverEcho(102, 2);
    expect(handOrder()).toEqual(['103', '101', '102']);
  });

  it('sends nothing when a hand card is dropped on the hand viewer', async () => {
    const cards = await renderHand();
    fireEvent.click(screen.getByTitle('Hand — 3 cards'));
    fireEvent.click(await screen.findByText('View hand'));
    const viewer = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('.fixed.inset-0 > .resize');
      expect(el).not.toBeNull();
      return el!;
    });
    vi.spyOn(viewer, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1000, 400));

    drag(cards[0], 140, 300, 200);

    expect(findAllGameCommands(Command_MoveCard_ext)).toHaveLength(0);
    expect(handOrder()).toEqual(['101', '102', '103']);
  });
});
