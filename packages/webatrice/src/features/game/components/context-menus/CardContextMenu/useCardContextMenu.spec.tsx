import { ZoneName, type CardLocation } from '@cockatrice/sockatrice';
import { renderHook, act } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';
import { games, type GamesState } from '@cockatrice/datatrice';
import { makeCard } from '@cockatrice/datatrice/testing';

import { makeReduxWebClientHookWrapper } from '../../../../../__test-utils__/makeHookWrapper';
import {
  CARD_MOVE_TARGETS,
  useCardContextMenu,
  type UseCardContextMenuArgs,
} from './useCardContextMenu';

function setup(
  overrides: Partial<UseCardContextMenuArgs> = {},
  { judge = false }: { judge?: boolean } = {},
) {
  const onClose = vi.fn();
  const onRequestSetPT = vi.fn();
  const onRequestSetAnnotation = vi.fn();
  const onRequestSetCounter = vi.fn();
  const onRequestDrawArrow = vi.fn();
  const onRequestAttach = vi.fn();
  const onRequestPlay = vi.fn();
  const onRequestMoveToLibraryAt = vi.fn();

  // useGameAccess reads the game for canAct + judge/local identity, so preload a
  // real (local player 1) entry; `judge` flips the override per test.
  const gamesState = { games: { 1: { judge, localPlayerId: 1 } } } as unknown as GamesState;
  const { Wrapper, webClient } = makeReduxWebClientHookWrapper({
    reducer: combineReducers({ games: games.gamesReducer }),
    preloadedState: { games: gamesState },
  });

  const args: UseCardContextMenuArgs = {
    gameId: 1,
    localPlayerId: 1,
    card: makeCard({ id: 5, tapped: false, faceDown: false }),
    ownerPlayerId: 1,
    sourceZone: ZoneName.TABLE,
    onClose,
    onRequestSetPT,
    onRequestSetAnnotation,
    onRequestSetCounter,
    onRequestDrawArrow,
    onRequestAttach,
    onRequestPlay,
    onRequestMoveToLibraryAt,
    ...overrides,
  };

  const { result } = renderHook(() => useCardContextMenu(args), { wrapper: Wrapper });
  return {
    result,
    webClient,
    onClose,
    onRequestSetPT,
    onRequestSetCounter,
    onRequestPlay,
    onRequestAttach,
  };
}

// The bulk command surface lives in sockatrice (exposed on request.game.bulk*);
// here we only assert the menu invoked the right command with the right targets
// + judge resolver. The entry-building / collective rules / judge grouping are
// covered by sockatrice's bulkCardActions.spec.
type GameApi = ReturnType<typeof setup>['webClient']['request']['game'];
type BulkFn = 'bulkTap' | 'bulkFlip' | 'bulkDoesntUntap' | 'bulkPeek' | 'bulkMove';

function lastBulkCall(webClient: ReturnType<typeof setup>['webClient'], fn: BulkFn) {
  const calls = vi.mocked(webClient.request.game[fn] as GameApi[BulkFn]).mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1] as unknown[];
}

function targetIds(targets: readonly CardLocation[]): number[] {
  return targets.map((t) => t.card.id).sort((a, b) => a - b);
}

describe('useCardContextMenu', () => {
  it('reports ready + writeable flags for a local TABLE card', () => {
    const { result } = setup();

    expect(result.current.ready).toBe(true);
    expect(result.current.canActOnCard).toBe(true);
    expect(result.current.canAttach).toBe(true);
    expect(result.current.isAttached).toBe(false);
    expect(result.current.canPlay).toBe(false);
    expect(result.current.moveTargets).toBe(CARD_MOVE_TARGETS);
  });

  it('canPlay is true for owned non-TABLE cards and false for TABLE / opponent cards', () => {
    expect(
      setup({ sourceZone: ZoneName.HAND }).result.current.canPlay,
    ).toBe(true);
    expect(
      setup({ sourceZone: ZoneName.HAND, ownerPlayerId: 2 }).result.current.canPlay,
    ).toBe(false);
    expect(
      setup({ sourceZone: ZoneName.TABLE }).result.current.canPlay,
    ).toBe(false);
  });

  it('handleTapToggle bulk-taps just the menu card and closes', () => {
    const { result, webClient, onClose } = setup({ card: makeCard({ id: 9, tapped: false }) });

    act(() => {
      result.current.handleTapToggle();
    });

    const [gameId, targets, judgeTarget] = lastBulkCall(webClient, 'bulkTap');
    expect(gameId).toBe(1);
    expect(targetIds(targets as CardLocation[])).toEqual([9]);
    expect((judgeTarget as (o: number) => number | undefined)(1)).toBeUndefined(); // own card → bare
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('bulk-taps the TABLE subset when the menu card is part of a ≥2 selection', () => {
    const menuCard = makeCard({ id: 9, tapped: false });
    const { result, webClient } = setup({
      card: menuCard,
      ownerPlayerId: 1,
      sourceZone: ZoneName.TABLE,
      selectedCards: [
        { ownerPlayerId: 1, zone: ZoneName.TABLE, card: menuCard },
        { ownerPlayerId: 1, zone: ZoneName.TABLE, card: makeCard({ id: 10, tapped: false }) },
      ],
    });

    act(() => {
      result.current.handleTapToggle();
    });

    const [, targets] = lastBulkCall(webClient, 'bulkTap');
    expect(targetIds(targets as CardLocation[])).toEqual([9, 10]);
  });

  it('acts on just the menu card when it is not part of the selection', () => {
    const { result, webClient } = setup({
      card: makeCard({ id: 9, tapped: false }),
      ownerPlayerId: 1,
      sourceZone: ZoneName.TABLE,
      // A multi-selection that does NOT include the right-clicked card.
      selectedCards: [
        { ownerPlayerId: 1, zone: ZoneName.TABLE, card: makeCard({ id: 1 }) },
        { ownerPlayerId: 1, zone: ZoneName.TABLE, card: makeCard({ id: 2 }) },
      ],
    });

    act(() => {
      result.current.handleTapToggle();
    });

    const [, targets] = lastBulkCall(webClient, 'bulkTap');
    expect(targetIds(targets as CardLocation[])).toEqual([9]);
  });

  it('handleFaceDownToggle / handleDoesntUntapToggle act on the TABLE subset via their bulk commands', () => {
    const { result, webClient } = setup({ card: makeCard({ id: 9 }) });

    act(() => {
      result.current.handleFaceDownToggle();
    });
    act(() => {
      result.current.handleDoesntUntapToggle();
    });

    expect(targetIds(lastBulkCall(webClient, 'bulkFlip')[1] as CardLocation[])).toEqual([9]);
    expect(targetIds(lastBulkCall(webClient, 'bulkDoesntUntap')[1] as CardLocation[])).toEqual([9]);
  });

  it('handlePeek reveals the menu card to the local player', () => {
    const { result, webClient } = setup({ card: makeCard({ id: 9, faceDown: true }) });

    act(() => {
      result.current.handlePeek();
    });

    const [gameId, targets, revealTo] = lastBulkCall(webClient, 'bulkPeek');
    expect(gameId).toBe(1);
    expect(targetIds(targets as CardLocation[])).toEqual([9]);
    expect(revealTo).toBe(1); // local player
  });

  it('handleMove passes the local player as the move target and the selection to bulkMove', () => {
    // The owner-routing of non-table moves now lives in sockatrice's bulkMove;
    // the menu just hands it the requested target (the local actor) + targets.
    const { result, webClient } = setup({
      card: makeCard({ id: 13 }),
      ownerPlayerId: 2,
      localPlayerId: 1,
      sourceZone: ZoneName.TABLE,
    });

    act(() => {
      result.current.handleMove(CARD_MOVE_TARGETS[0]); // Send to Hand
    });

    const [gameId, targets, dest, judgeTarget] = lastBulkCall(webClient, 'bulkMove');
    expect(gameId).toBe(1);
    expect(targetIds(targets as CardLocation[])).toEqual([13]);
    expect(dest).toEqual({ targetPlayerId: 1, targetZone: ZoneName.HAND, x: -1, y: 0 });
    expect((judgeTarget as (o: number) => number | undefined)(2)).toBeUndefined(); // non-judge actor
  });

  it('handleUnattach omits target fields so the server treats the call as detach', () => {
    const { result, webClient } = setup({
      card: makeCard({ id: 21, attachCardId: 99 }),
    });

    act(() => {
      result.current.handleUnattach();
    });

    const call = vi.mocked(webClient.request.game.attachCard).mock.calls[0]?.[1] as Record<string, unknown>;
    expect(call).toEqual({ startZone: ZoneName.TABLE, cardId: 21 });
    expect(call).not.toHaveProperty('targetPlayerId');
    expect(call).not.toHaveProperty('targetCardId');
  });

  it('forwards prompt-requests (setPT, setCounter, play) to their callbacks', () => {
    const { result, onRequestSetPT, onRequestSetCounter, onRequestPlay } = setup({
      sourceZone: ZoneName.HAND,
    });

    act(() => {
      result.current.handleSetPT();
    });
    act(() => {
      result.current.handleSetCardCounter(3);
    });
    act(() => {
      result.current.handlePlay();
    });

    expect(onRequestSetPT).toHaveBeenCalledTimes(1);
    expect(onRequestSetCounter).toHaveBeenCalledWith(3);
    expect(onRequestPlay).toHaveBeenCalledWith(false);
  });

  describe('judge override', () => {
    it('canActOnCard opens for a judge on a foreign card', () => {
      const { result } = setup({ ownerPlayerId: 2, localPlayerId: 1 }, { judge: true });
      expect(result.current.canActOnCard).toBe(true);
    });

    it('canActOnCard is false for a non-judge on a foreign card', () => {
      const { result } = setup({ ownerPlayerId: 2, localPlayerId: 1 });
      expect(result.current.canActOnCard).toBe(false);
    });

    it('canPlay opens for a judge on a foreign non-table card (parity with getLocalOrJudge)', () => {
      const { result } = setup(
        { ownerPlayerId: 2, localPlayerId: 1, sourceZone: ZoneName.HAND },
        { judge: true },
      );
      expect(result.current.canPlay).toBe(true);
    });

    it('passes a judge resolver that wraps a foreign card as its owner', () => {
      const { result, webClient } = setup(
        { card: makeCard({ id: 41, tapped: false }), ownerPlayerId: 2, localPlayerId: 1 },
        { judge: true },
      );
      act(() => {
        result.current.handleTapToggle();
      });
      const [, , judgeTarget] = lastBulkCall(webClient, 'bulkTap');
      expect((judgeTarget as (o: number) => number | undefined)(2)).toBe(2); // foreign → wrap as owner
    });

    it('passes a judge resolver that leaves their OWN card bare', () => {
      const { result, webClient } = setup(
        { card: makeCard({ id: 42 }), ownerPlayerId: 1, localPlayerId: 1, sourceZone: ZoneName.TABLE },
        { judge: true },
      );
      act(() => {
        result.current.handleMove(CARD_MOVE_TARGETS[2]); // Send to Graveyard
      });
      const [, , , judgeTarget] = lastBulkCall(webClient, 'bulkMove');
      expect((judgeTarget as (o: number) => number | undefined)(1)).toBeUndefined();
    });
  });

  it('all action handlers no-op when ready is false (no card)', () => {
    const { result, webClient, onClose } = setup({ card: null });

    expect(result.current.ready).toBe(false);

    act(() => {
      result.current.handleTapToggle();
      result.current.handleFaceDownToggle();
      result.current.handleCardCounterDelta(1, 1);
      result.current.handleMove(CARD_MOVE_TARGETS[0]);
      result.current.handleUnattach();
    });

    expect(webClient.request.game.bulkTap).not.toHaveBeenCalled();
    expect(webClient.request.game.bulkFlip).not.toHaveBeenCalled();
    expect(webClient.request.game.bulkMove).not.toHaveBeenCalled();
    expect(webClient.request.game.incCardCounter).not.toHaveBeenCalled();
    expect(webClient.request.game.attachCard).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
