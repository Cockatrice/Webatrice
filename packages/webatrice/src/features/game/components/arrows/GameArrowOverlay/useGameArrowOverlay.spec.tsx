import { createRef, type ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { create } from '@bufbuild/protobuf';
import { colorSchema } from '@cockatrice/sockatrice/generated';
import {
  games,
  storeMiddlewareOptions,
  type GamesState,
} from '@cockatrice/datatrice';
import { WebClientContext } from '@cockatrice/datatrice/react';
import {
  makeArrow,
  makeGameEntry,
  makePlayerEntry,
  makePlayerProperties,
} from '@cockatrice/datatrice/testing';

import { createMockWebClient } from '../../../../../__test-utils__/mockWebClient';
import {
  CardRegistryContext,
  createCardRegistry,
  makeCardKey,
  makePlayerKey,
} from '../../../utils/CardRegistry/CardRegistryContext';
import { useGameArrowOverlay } from './useGameArrowOverlay';

function rect(left: number, top: number, size = 50): DOMRect {
  return {
    left,
    top,
    width: size,
    height: size,
    right: left + size,
    bottom: top + size,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function makeBoard(): HTMLDivElement {
  const board = document.createElement('div');
  board.getBoundingClientRect = () => rect(0, 0, 1000);
  return board;
}

function makeCardElement(boundingRect: DOMRect): HTMLElement {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => boundingRect;
  document.body.appendChild(el);
  return el;
}

interface SetupOpts {
  registry?: ReturnType<typeof createCardRegistry>;
  gamesState?: GamesState;
  gameId?: number | undefined;
}

function setup(opts: SetupOpts = {}) {
  const registry = opts.registry ?? createCardRegistry();
  const gamesState: GamesState = opts.gamesState ?? { games: {} };
  const gameId: number | undefined = 'gameId' in opts ? opts.gameId : 1;
  const store = configureStore({
    reducer: combineReducers({ games: games.gamesReducer }),
    preloadedState: { games: gamesState },
    middleware: (getDefault) => getDefault(storeMiddlewareOptions),
  });
  const webClient = createMockWebClient();
  const boardRef = createRef<HTMLDivElement>();
  (boardRef as { current: HTMLDivElement | null }).current = makeBoard();

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <WebClientContext value={webClient}>
          <CardRegistryContext.Provider value={registry}>
            {children}
          </CardRegistryContext.Provider>
        </WebClientContext>
      </Provider>
    );
  }

  const { result } = renderHook(
    () => useGameArrowOverlay({ gameId, containerRef: boardRef }),
    { wrapper: Wrapper },
  );
  return { result, webClient, registry, boardRef };
}

function stateWithArrow(): GamesState {
  const arrow = makeArrow({
    id: 1,
    startPlayerId: 1,
    startZone: 'table',
    startCardId: 10,
    targetPlayerId: 1,
    targetZone: 'table',
    targetCardId: 11,
    arrowColor: create(colorSchema, { r: 224, g: 75, b: 59, a: 255 }),
  });
  const player = makePlayerEntry({
    properties: makePlayerProperties({ playerId: 1 }),
    arrows: { 1: arrow },
  });
  const game = makeGameEntry({ players: { 1: player } });
  return { games: { 1: game } };
}

function stateWithPlayerArrow(): GamesState {
  // Player-target: targetZone='' / targetCardId=-1 trips the isPlayerTarget
  // check (mirrors the proto2-unset wire shape).
  const arrow = makeArrow({
    id: 2,
    startPlayerId: 1,
    startZone: 'table',
    startCardId: 10,
    targetPlayerId: 1,
    targetZone: '',
    targetCardId: -1,
    arrowColor: create(colorSchema, { r: 224, g: 75, b: 59, a: 255 }),
  });
  const player = makePlayerEntry({
    properties: makePlayerProperties({ playerId: 1 }),
    arrows: { 2: arrow },
  });
  const game = makeGameEntry({ players: { 1: player } });
  return { games: { 1: game } };
}

describe('useGameArrowOverlay', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('exposes the board width/height and an empty arrow list when no game is active', () => {
    const { result } = setup({ gameId: undefined });

    expect(result.current.arrows).toEqual([]);
    expect(result.current.width).toBe(1000);
    expect(result.current.height).toBe(1000);
  });

  it('produces no resolved arrows when source/target elements are not yet in the registry', () => {
    const { result } = setup({ gamesState: stateWithArrow() });

    expect(result.current.arrows).toEqual([]);
  });

  it('resolves an arrow once both endpoints are registered, recomputing midpoints in board-local coordinates', () => {
    const registry = createCardRegistry();
    const sourceEl = makeCardElement(rect(100, 100));
    const targetEl = makeCardElement(rect(300, 300));
    registry.register(makeCardKey(1, 'table', 10), sourceEl);
    registry.register(makeCardKey(1, 'table', 11), targetEl);

    const { result } = setup({ registry, gamesState: stateWithArrow() });

    expect(result.current.arrows).toHaveLength(1);
    const arrow = result.current.arrows[0];
    expect(arrow.arrowId).toBe(1);
    expect(arrow.x1).toBe(125);
    expect(arrow.y1).toBe(125);
    expect(arrow.x2).toBe(325);
    expect(arrow.y2).toBe(325);
    expect(arrow.color).toMatch(/^rgba\(224, 75, 59/);
  });

  it('anchors player-targeted arrows to the life circle rim, not the center', () => {
    const registry = createCardRegistry();
    const sourceEl = makeCardElement(rect(100, 100, 50));
    // Life-slot rect is the 32x32 wrapper around the life counter circle.
    const playerEl = makeCardElement(rect(300, 300, 32));
    registry.register(makeCardKey(1, 'table', 10), sourceEl);
    registry.register(makePlayerKey(1), playerEl);

    const { result } = setup({ registry, gamesState: stateWithPlayerArrow() });

    expect(result.current.arrows).toHaveLength(1);
    const arrow = result.current.arrows[0];
    // Source center (125,125) → target circle center (316,316), rim radius 16
    // inflated by ARROW_HEAD_TIP_OVERSHOOT_PX (=5) so the visual arrowhead
    // tip clears the life circle. d = hypot(191,191) ≈ 270.116; effective
    // radius 21; tip = 316 - 191 * 21 / d ≈ 301.149.
    expect(arrow.x1).toBe(125);
    expect(arrow.y1).toBe(125);
    expect(arrow.x2).toBeCloseTo(301.149, 2);
    expect(arrow.y2).toBeCloseTo(301.149, 2);
  });

  it('handleArrowClick dispatches deleteArrow with the gameId and arrowId', () => {
    const { result, webClient } = setup();

    act(() => {
      result.current.handleArrowClick(7);
    });

    expect(webClient.request.game.deleteArrow).toHaveBeenCalledWith(1, { arrowId: 7 });
  });

  it('handleArrowClick is a no-op when gameId is undefined', () => {
    const { result, webClient } = setup({ gameId: undefined });

    act(() => {
      result.current.handleArrowClick(7);
    });

    expect(webClient.request.game.deleteArrow).not.toHaveBeenCalled();
  });
});
