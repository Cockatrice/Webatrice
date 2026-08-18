import { act, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CardAttribute, Command_SetCardAttr_ext } from '@cockatrice/sockatrice/generated';
import { store, connectRaw } from '../../helpers/setup';
import { games } from '@cockatrice/datatrice';

import { Game } from '@app/features/game';
import { renderFeatureScreen } from '../helpers';
import { findAllGameCommands } from '../../helpers/command-capture';
import { buildEventGameJoined, buildEventGameStateChanged, registerGameBoardHooks, type TableCardSeed } from './helpers';

registerGameBoardHooks();

// PlayerBox rewrite: cards on the battlefield are still keyed via
// `data-card-id`, but the containing board is identified by a
// `[data-arrow-target-player-id="N"]` life-total anchor (the legacy
// `player-board-N` testid was dropped along with the removed PlayerBoard).
function findBoardCell(playerId: number): HTMLElement | null {
  const anchor = document.querySelector(`[data-arrow-target-player-id="${playerId}"]`);
  return anchor ? (anchor.closest('.game__board-cell') as HTMLElement | null) : null;
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

  const board = await waitFor(() => {
    const cell = findBoardCell(1);
    expect(cell).not.toBeNull();
    return cell!;
  });
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

  // Removed: bulk-tap / bulk-untap tests. The PlayerBox rewrite owns its own
  // per-box marquee selection (single-zone, Set<cardId>) that decides bulk
  // vs. single at double-click time. The legacy rubber-band selection used
  // Redux `selectedCardKeys` + a shared box-select overlay, which is what
  // those specs stubbed via `[data-zone-box-select]` and forged mouse events
  // against. There is no external hook into the new local selection state
  // (no Redux action, no imperative handle), so a spec can't drive it
  // without simulating the full pointer-down / marquee-move / pointer-up
  // sequence against real card `getBoundingClientRect` — beyond the scope
  // of an integration test. The bulk-tap wire behavior itself is exercised
  // by the unit specs on `useGameArrowInteractions` and
  // `useCardContextMenu`.
});
