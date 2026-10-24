import { act, fireEvent, waitFor } from '@testing-library/react';
import { getExtension, hasExtension } from '@bufbuild/protobuf';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { games } from '@cockatrice/datatrice';
import { Command_Judge_ext, Command_MoveCard_ext } from '@cockatrice/sockatrice/generated';
import { Game } from '@app/features/game';
import { store, connectRaw } from '../../helpers/setup';
import { findAllGameCommands } from '../../helpers/command-capture';
import { renderFeatureScreen } from '../helpers';
import { buildEventGameJoined, buildEventGameStateChanged, registerGameBoardHooks } from './helpers';

registerGameBoardHooks();

const OPP_CARD = 201;

afterEach(() => {
  vi.restoreAllMocks();
});

async function renderAsJudge() {
  connectRaw();
  renderFeatureScreen(<Game />);
  act(() => {
    store.dispatch(games.Actions.gameJoined({
      data: buildEventGameJoined({ gameId: 42, localPlayerId: 1, hostId: 1, judge: true }),
    }));
    store.dispatch(games.Actions.gameStateChanged({
      gameId: 42,
      data: buildEventGameStateChanged([1, 2], 1, { tableCardsByPlayer: { 2: [{ id: OPP_CARD, x: 0, y: 0 }] } }),
    }));
  });
  const card = await waitFor(() => {
    const el = document.querySelector<HTMLElement>(`[data-battlefield-owner="2"] [data-card-id="${OPP_CARD}"]`);
    expect(el).not.toBeNull();
    return el!;
  });
  const oppGrave = document.querySelector<HTMLElement>(
    '[data-arrow-anchor-owner="2"][data-arrow-anchor-zone="grave"]',
  );
  expect(oppGrave).not.toBeNull();
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function rect(this: Element) {
    return this === oppGrave ? new DOMRect(900, 0, 80, 110) : new DOMRect(-10_000, -10_000, 0, 0);
  });
  return card;
}

describe('Judge override', () => {
  it('sends a drag of another player\'s card as that player through Command_Judge', async () => {
    const card = await renderAsJudge();

    act(() => {
      fireEvent.pointerDown(card, { button: 0, clientX: 10, clientY: 10 });
    });
    act(() => {
      fireEvent.pointerMove(window, { clientX: 920, clientY: 20 });
    });
    act(() => {
      fireEvent.pointerUp(window, { button: 0, clientX: 920, clientY: 20 });
    });

    const judged = findAllGameCommands(Command_Judge_ext);
    expect(judged).toHaveLength(1);
    expect(judged[0].gameId).toBe(42);
    expect(judged[0].value.targetId).toBe(2);
    const inner = judged[0].value.gameCommand;
    expect(inner).toHaveLength(1);
    expect(hasExtension(inner[0], Command_MoveCard_ext)).toBe(true);
    expect(getExtension(inner[0], Command_MoveCard_ext)).toMatchObject({
      startPlayerId: 2,
      startZone: 'table',
      cardsToMove: { card: [{ cardId: OPP_CARD }] },
      targetPlayerId: 2,
      targetZone: 'grave',
    });
    expect(findAllGameCommands(Command_MoveCard_ext)).toHaveLength(0);
  });
});
