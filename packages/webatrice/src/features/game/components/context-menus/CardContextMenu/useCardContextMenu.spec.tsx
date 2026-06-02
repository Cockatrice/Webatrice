import { renderHook, act } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';
import { CardAttribute } from '@cockatrice/sockatrice/generated';
import { Enriched, games, type GamesState } from '@cockatrice/datatrice';
import { makeCard } from '@cockatrice/datatrice/testing';

import { makeReduxWebClientHookWrapper } from '../../../../../__test-utils__/makeHookWrapper';
import {
  CARD_MOVE_TARGETS,
  useCardContextMenu,
  type UseCardContextMenuArgs,
} from './useCardContextMenu';

function setup(overrides: Partial<UseCardContextMenuArgs> = {}) {
  const onClose = vi.fn();
  const onRequestSetPT = vi.fn();
  const onRequestSetAnnotation = vi.fn();
  const onRequestSetCounter = vi.fn();
  const onRequestDrawArrow = vi.fn();
  const onRequestAttach = vi.fn();
  const onRequestPlay = vi.fn();
  const onRequestMoveToLibraryAt = vi.fn();

  const { Wrapper, webClient } = makeReduxWebClientHookWrapper({
    reducer: combineReducers({ games: games.gamesReducer }),
    preloadedState: { games: { games: {} } as GamesState },
  });

  const args: UseCardContextMenuArgs = {
    gameId: 1,
    localPlayerId: 1,
    card: makeCard({ id: 5, tapped: false, faceDown: false }),
    ownerPlayerId: 1,
    sourceZone: Enriched.ZoneName.TABLE,
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

describe('useCardContextMenu', () => {
  it('reports ready+ownership flags for a local TABLE card', () => {
    const { result } = setup();

    expect(result.current.ready).toBe(true);
    expect(result.current.isOwnedByLocal).toBe(true);
    expect(result.current.canAttach).toBe(true);
    expect(result.current.isAttached).toBe(false);
    expect(result.current.canPlay).toBe(false);
    expect(result.current.moveTargets).toBe(CARD_MOVE_TARGETS);
  });

  it('canPlay is true for owned non-TABLE cards and false for TABLE / opponent cards', () => {
    expect(
      setup({ sourceZone: Enriched.ZoneName.HAND }).result.current.canPlay,
    ).toBe(true);
    expect(
      setup({ sourceZone: Enriched.ZoneName.HAND, ownerPlayerId: 2 }).result.current.canPlay,
    ).toBe(false);
    expect(
      setup({ sourceZone: Enriched.ZoneName.TABLE }).result.current.canPlay,
    ).toBe(false);
  });

  it('handleTapToggle dispatches setCardAttr with the negated tapped value and closes', () => {
    const { result, webClient, onClose } = setup({
      card: makeCard({ id: 9, tapped: false }),
    });

    act(() => {
      result.current.handleTapToggle();
    });

    expect(webClient.request.game.setCardAttr).toHaveBeenCalledWith(
      1,
      {
        zone: Enriched.ZoneName.TABLE,
        cardId: 9,
        attribute: CardAttribute.AttrTapped,
        attrValue: '1',
      },
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('bulk-taps the TABLE subset when the menu card is part of a ≥2 selection', () => {
    const menuCard = makeCard({ id: 9, tapped: false });
    const { result, webClient } = setup({
      card: menuCard,
      ownerPlayerId: 1,
      sourceZone: Enriched.ZoneName.TABLE,
      selectedCards: [
        { ownerPlayerId: 1, zone: Enriched.ZoneName.TABLE, card: menuCard },
        { ownerPlayerId: 1, zone: Enriched.ZoneName.TABLE, card: makeCard({ id: 10, tapped: false }) },
      ],
    });

    act(() => {
      result.current.handleTapToggle();
    });

    // Both untapped TABLE cards get a tap command (collective rule).
    expect(webClient.request.game.setCardAttr).toHaveBeenCalledTimes(2);
    expect(webClient.request.game.setCardAttr).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ cardId: 9, attrValue: '1' }),
    );
    expect(webClient.request.game.setCardAttr).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ cardId: 10, attrValue: '1' }),
    );
  });

  it('falls back to single-card tap when the menu card is not in the selection', () => {
    const { result, webClient } = setup({
      card: makeCard({ id: 9, tapped: false }),
      ownerPlayerId: 1,
      sourceZone: Enriched.ZoneName.TABLE,
      // A multi-selection that does NOT include the right-clicked card.
      selectedCards: [
        { ownerPlayerId: 1, zone: Enriched.ZoneName.TABLE, card: makeCard({ id: 1 }) },
        { ownerPlayerId: 1, zone: Enriched.ZoneName.TABLE, card: makeCard({ id: 2 }) },
      ],
    });

    act(() => {
      result.current.handleTapToggle();
    });

    expect(webClient.request.game.setCardAttr).toHaveBeenCalledTimes(1);
    expect(webClient.request.game.setCardAttr).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ cardId: 9 }),
    );
  });

  it('handleMove routes a non-table move to the card owner (not the local actor)', () => {
    // Card owned by player 2, acted on by local player 1. Servatrice only
    // accepts a non-table move into the card's own tree, so "Send to Hand"
    // must target the owner (2), not the local player.
    const { result, webClient } = setup({
      card: makeCard({ id: 13 }),
      ownerPlayerId: 2,
      localPlayerId: 1,
      sourceZone: Enriched.ZoneName.TABLE,
    });

    act(() => {
      result.current.handleMove(CARD_MOVE_TARGETS[0]); // Send to Hand
    });

    expect(webClient.request.game.moveCard).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        startPlayerId: 2,
        startZone: Enriched.ZoneName.TABLE,
        cardsToMove: { card: [{ cardId: 13 }] },
        targetPlayerId: 2,
        targetZone: Enriched.ZoneName.HAND,
        x: -1,
        y: 0,
      }),
    );
  });

  it('handleMove keeps the local player as target for a TABLE move (control-change)', () => {
    const { result, webClient } = setup({
      card: makeCard({ id: 14 }),
      ownerPlayerId: 2,
      localPlayerId: 1,
      sourceZone: Enriched.ZoneName.GRAVE,
    });

    act(() => {
      result.current.handleMove(CARD_MOVE_TARGETS[1]); // Send to Battlefield
    });

    expect(webClient.request.game.moveCard).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        startPlayerId: 2,
        targetPlayerId: 1,
        targetZone: Enriched.ZoneName.TABLE,
      }),
    );
  });

  it('handleUnattach omits target fields so the server treats the call as detach', () => {
    const { result, webClient } = setup({
      card: makeCard({ id: 21, attachCardId: 99 }),
    });

    act(() => {
      result.current.handleUnattach();
    });

    const call = vi.mocked(webClient.request.game.attachCard).mock.calls[0]?.[1] as Record<string, unknown>;
    expect(call).toEqual({ startZone: Enriched.ZoneName.TABLE, cardId: 21 });
    expect(call).not.toHaveProperty('targetPlayerId');
    expect(call).not.toHaveProperty('targetCardId');
  });

  it('forwards prompt-requests (setPT, setCounter, play) to their callbacks', () => {
    const { result, onRequestSetPT, onRequestSetCounter, onRequestPlay } = setup({
      sourceZone: Enriched.ZoneName.HAND,
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

  it('all action handlers no-op when ready is false (no card)', () => {
    const { result, webClient, onClose } = setup({ card: null });

    expect(result.current.ready).toBe(false);

    act(() => {
      result.current.handleTapToggle();
      result.current.handleFlip();
      result.current.handleCardCounterDelta(1, 1);
      result.current.handleMove(CARD_MOVE_TARGETS[0]);
      result.current.handleUnattach();
    });

    expect(webClient.request.game.setCardAttr).not.toHaveBeenCalled();
    expect(webClient.request.game.flipCard).not.toHaveBeenCalled();
    expect(webClient.request.game.incCardCounter).not.toHaveBeenCalled();
    expect(webClient.request.game.moveCard).not.toHaveBeenCalled();
    expect(webClient.request.game.attachCard).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
