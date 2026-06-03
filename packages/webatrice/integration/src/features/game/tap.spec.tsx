import { act, fireEvent, waitFor, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CardAttribute, Command_SetCardAttr_ext } from '@cockatrice/sockatrice/generated';
import { store, connectRaw } from '../../helpers/setup';
import { games } from '@cockatrice/datatrice';

import { Game } from '@app/features/game';
import { renderFeatureScreen } from '../helpers';
import { findAllGameCommands } from '../../helpers/command-capture';
import { buildEventGameJoined, buildEventGameStateChanged, registerGameBoardHooks, type TableCardSeed } from './helpers';

registerGameBoardHooks();

// jsdom has no layout engine, so getBoundingClientRect returns zeros. The
// rubber-band hit-test reads each card's rect, so stub them to fixed bounds the
// drag band can intersect (mirrors the unit useGameBoxSelection.spec technique).
function stubRect(el: HTMLElement, r: { left: number; top: number; right: number; bottom: number }) {
  el.getBoundingClientRect = () => ({
    left: r.left,
    top: r.top,
    right: r.right,
    bottom: r.bottom,
    width: r.right - r.left,
    height: r.bottom - r.top,
    x: r.left,
    y: r.top,
    toJSON: () => ({}),
  }) as DOMRect;
}

async function renderBoardWithTableCards(cards: TableCardSeed[]): Promise<HTMLElement> {
  connectRaw();
  renderFeatureScreen(<Game />);

  act(() => {
    store.dispatch(games.Actions.gameJoined({ data: buildEventGameJoined({ gameId: 42, localPlayerId: 1, hostId: 1 }) }));
    store.dispatch(games.Actions.gameStateChanged({
      gameId: 42,
      data: buildEventGameStateChanged([1, 2], 1, { tableCardsByPlayer: { 1: cards } }),
    }));
  });

  const board = await screen.findByTestId('player-board-1');
  await waitFor(() => {
    expect(board.querySelector(`[data-card-id="${cards[0].id}"]`)).not.toBeNull();
  });
  return board;
}

function cardEl(board: HTMLElement, id: number): HTMLElement {
  const el = board.querySelector(`[data-card-id="${id}"]`);
  if (!el) {
    throw new Error(`card ${id} not rendered on the board`);
  }
  return el as HTMLElement;
}

// Rubber-band over the two cards so both end up selected, then return them.
function boxSelect(board: HTMLElement, ids: [number, number]): void {
  const first = cardEl(board, ids[0]);
  const second = cardEl(board, ids[1]);
  stubRect(first, { left: 10, top: 10, right: 50, bottom: 90 });
  stubRect(second, { left: 60, top: 10, right: 100, bottom: 90 });

  const zone = first.closest('[data-zone-box-select]') as HTMLElement;
  fireEvent.mouseDown(zone, { button: 0, clientX: 0, clientY: 0 });
  fireEvent.mouseMove(window, { clientX: 200, clientY: 200 });
  fireEvent.mouseUp(window, { clientX: 200, clientY: 200 });
}

function tapCommands() {
  return findAllGameCommands(Command_SetCardAttr_ext).filter(
    (c) => c.value.attribute === CardAttribute.AttrTapped,
  );
}

describe('Game card tap', () => {
  it('taps a single untapped table card on double-click', async () => {
    const board = await renderBoardWithTableCards([{ id: 101, x: 0, y: 0, tapped: false }]);

    fireEvent.doubleClick(cardEl(board, 101));

    const cmds = tapCommands();
    expect(cmds).toHaveLength(1);
    expect(cmds[0].gameId).toBe(42);
    expect(cmds[0].value.cardId).toBe(101);
    expect(cmds[0].value.attrValue).toBe('1');
  });

  it('bulk-taps every selected card when one of a multi-selection is double-clicked', async () => {
    const board = await renderBoardWithTableCards([
      { id: 101, x: 0, y: 0, tapped: false },
      { id: 102, x: 1, y: 0, tapped: false },
    ]);

    boxSelect(board, [101, 102]);
    fireEvent.doubleClick(cardEl(board, 101));

    // Collective rule: any untapped ⇒ tap all. Both untapped ⇒ two tap commands.
    const cmds = tapCommands();
    expect(cmds).toHaveLength(2);
    expect(cmds.map((c) => c.value.cardId).sort()).toEqual([101, 102]);
    expect(cmds.every((c) => c.value.attrValue === '1')).toBe(true);
    // Both commands ride in a single CommandContainer (one cmdId) — Cockatrice parity.
    expect(new Set(cmds.map((c) => c.cmdId)).size).toBe(1);
  });

  it('bulk-untaps every selected card when all are already tapped', async () => {
    const board = await renderBoardWithTableCards([
      { id: 101, x: 0, y: 0, tapped: true },
      { id: 102, x: 1, y: 0, tapped: true },
    ]);

    boxSelect(board, [101, 102]);
    fireEvent.doubleClick(cardEl(board, 101));

    // Collective rule: none untapped ⇒ untap all. Two untap commands.
    const cmds = tapCommands();
    expect(cmds).toHaveLength(2);
    expect(cmds.map((c) => c.value.cardId).sort()).toEqual([101, 102]);
    expect(cmds.every((c) => c.value.attrValue === '0')).toBe(true);
    // Both commands ride in a single CommandContainer (one cmdId) — Cockatrice parity.
    expect(new Set(cmds.map((c) => c.cmdId)).size).toBe(1);
  });
});
