import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { combineReducers, type EnhancedStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DndContext } from '@dnd-kit/core';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import type { WebsocketTypes } from '@cockatrice/sockatrice/types';
import type { WebClient } from '@cockatrice/sockatrice';
import { createStore } from '@cockatrice/datatrice';
import { DatatriceProvider, WebClientProvider } from '@cockatrice/datatrice/react';

const testTheme = createTheme({
  transitions: {
    duration: {
      shortest: 0, shorter: 0, short: 0,
      standard: 0, complex: 0,
      enteringScreen: 0, leavingScreen: 0,
    },
    create: () => 'none',
  },
  components: {
    MuiButtonBase: { defaultProps: { disableRipple: true } },
    MuiDialog: { defaultProps: { transitionDuration: 0 } },
    MuiMenu: { defaultProps: { transitionDuration: 0 } },
    MuiPopover: { defaultProps: { transitionDuration: 0 } },
    MuiTooltip: { defaultProps: { enterDelay: 0, leaveDelay: 0 } },
  },
});

import { rootReducerMap, type RootState } from '../store';
import { ToastProvider } from '../components/Toast/ToastContext';
import { GameInteractionProvider, type GameInteractionHandlers } from '../features/game/components/ui/GameInteractionContext';
import { CardVisualStateProvider, type CanActFor } from '../features/game/components/ui/CardVisualStateContext';
import { GameDialogActionsProvider, type GameDialogActions } from '../features/game/components/ui/GameDialogActionsContext';
import { GameIdProvider } from '../features/game/components/ui/GameIdContext';
import { CardPreviewProvider } from '../features/game/components/ui/CardPreviewContext';
import { GameDialogsProvider } from '../features/game/components/ui/GameDialogsContext';
import { BoardCellProvider, type BoardCellInfo } from '../features/game/components/ui/BoardCellContext';
import { NOOP_GAME_DIALOGS_ACTIONS, type GameDialogs } from '../features/game/hooks/useGameDialogs';
import type { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { createMockWebClient } from './mockWebClient';

const NOOP_GAME_INTERACTION: GameInteractionHandlers = {
  onCardHover: () => undefined,
  onCardFocus: () => undefined,
  onCardBlur: () => undefined,
  onCardClick: () => undefined,
  onCardContextMenu: () => undefined,
  onCardDoubleClick: () => undefined,
  onZoneClick: () => undefined,
  onZoneContextMenu: () => undefined,
};

const NOOP_DIALOG_ACTIONS: GameDialogActions = {
  onRequestRollDie: () => undefined,
  onRequestConcede: () => undefined,
  onRequestUnconcede: () => undefined,
  onRequestGameInfo: () => undefined,
};

// Closed/no-op default for the whole dialogs slice: the closed-state fields plus
// the canonical no-op action surface (NOOP_GAME_DIALOGS_ACTIONS, kept in sync with
// the type at its source). Typed as GameDialogs so the compiler flags any state
// field that drifts — specs override only what they assert.
const NOOP_GAME_DIALOGS: GameDialogs = {
  cardMenu: null,
  zoneMenu: null,
  playerMenu: null,
  handMenu: null,
  zoneViews: [],
  prompt: null,
  rollDieOpen: false,
  lastDieSides: 0,
  lastDieCount: 0,
  createTokenOpen: false,
  sideboardOpen: false,
  gameInfoOpen: false,
  concedeConfirm: null,
  revealState: null,
  ...NOOP_GAME_DIALOGS_ACTIONS,
};

interface CardVisualStateOverride {
  arrowSourceKey?: string | null;
  arrowTargetKey?: string | null;
  selectedCardKeys?: ReadonlySet<string>;
  canActFor?: CanActFor;
}

const EMPTY_SELECTION: ReadonlySet<string> = new Set();
const DENY_ALL: CanActFor = () => false;

// Board components (PlayerBoard, StackColumn, Battlefield, PlayerInfoPanel,
// ZoneStack) read their seat from BoardCellContext; default to the local seat 1
// (matching the dominant localPlayerId: 1 fixture — so isLocal is true). Opponent
// specs override with boardCell: { playerId: 2, isLocal: false }.
const DEFAULT_BOARD_CELL: BoardCellInfo = { playerId: 1, mirrored: false, isLocal: true };

let defaultWebClient: WebClient | undefined;
function getDefaultWebClient(): WebClient {
  if (!defaultWebClient) {
    defaultWebClient = createMockWebClient();
  }
  return defaultWebClient;
}

const testI18n = i18n.createInstance();
testI18n.use(initReactI18next).init({
  lng: 'en-US',
  resources: { 'en-US': { translation: {} } },
  fallbackLng: 'en-US',
  interpolation: { escapeValue: false },
});

// Required by WebClientProvider's prop typing; the `client` override prop
// short-circuits internal construction so the values are never read.
const TEST_CLIENT_CONFIG: WebsocketTypes.ClientConfig = {
  clientid: 'webatrice-tests',
  clientver: '0',
  clientfeatures: [],
};
const TEST_CLIENT_OPTIONS: WebsocketTypes.ClientOptions = {
  autojoinrooms: false,
  keepalive: 0,
};

interface ExtendedRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: Partial<RootState>;
  route?: string;
  webClient?: WebClient;
  // Pre-built store override — used by the integration harness, whose
  // setup.ts owns a test store shared with a manually-constructed WebClient.
  // When omitted, the helper builds a fresh store per render.
  store?: EnhancedStore<RootState>;
  // Partial overrides for the game-interaction context (defaults to no-ops).
  gameInteraction?: Partial<GameInteractionHandlers>;
  // Partial overrides for the card-visual-state context (arrow/selection/canAct).
  // Defaults: no arrows, empty selection, canAct denied for every seat.
  cardVisualState?: CardVisualStateOverride;
  // Partial overrides for the game-dialog-actions context (defaults to no-ops).
  gameDialogActions?: Partial<GameDialogActions>;
  // The active game's id provided via GameIdContext. Omit for the default (1,
  // matching the dominant store fixture); pass explicitly — including
  // `undefined` — to override (e.g. the no-active-game case).
  gameId?: number;
  // The card shown in the preview pane, provided via CardPreviewContext.
  previewCard?: ServerInfo_Card | null;
  // Partial overrides for the dialogs slice (defaults to a closed/no-op slice).
  // Set the relevant menu state + handlers a dialog spec asserts against.
  gameDialogs?: Partial<GameDialogs>;
  // The seat a board component renders, provided via BoardCellContext. Defaults
  // to the local seat (playerId 1); pass to render an opponent/mirrored cell.
  boardCell?: Partial<BoardCellInfo>;
}

export function renderWithProviders(
  ui: ReactElement,
  options: ExtendedRenderOptions = {},
) {
  const {
    preloadedState,
    route = '/',
    webClient = getDefaultWebClient(),
    store: externalStore,
    gameInteraction,
    cardVisualState,
    gameDialogActions,
    gameDialogs,
    boardCell,
    previewCard = null,
    ...renderOptions
  } = options;
  const boardCellInfo: BoardCellInfo = boardCell
    ? { ...DEFAULT_BOARD_CELL, ...boardCell }
    : DEFAULT_BOARD_CELL;
  // Distinguish "omitted" (default game 1) from an explicit `gameId: undefined`
  // (no-active-game tests) — a destructure default can't tell them apart.
  const gameId = 'gameId' in options ? options.gameId : 1;
  const interactionHandlers: GameInteractionHandlers = gameInteraction
    ? { ...NOOP_GAME_INTERACTION, ...gameInteraction }
    : NOOP_GAME_INTERACTION;
  const dialogActions: GameDialogActions = gameDialogActions
    ? { ...NOOP_DIALOG_ACTIONS, ...gameDialogActions }
    : NOOP_DIALOG_ACTIONS;
  const dialogs: GameDialogs = gameDialogs
    ? { ...NOOP_GAME_DIALOGS, ...gameDialogs }
    : NOOP_GAME_DIALOGS;
  const visualState = {
    arrowSourceKey: cardVisualState?.arrowSourceKey ?? null,
    arrowTargetKey: cardVisualState?.arrowTargetKey ?? null,
    selectedCardKeys: cardVisualState?.selectedCardKeys ?? EMPTY_SELECTION,
    canActFor: cardVisualState?.canActFor ?? DENY_ALL,
  };
  const store = externalStore ?? createStore<RootState>({
    reducer: combineReducers(rootReducerMap),
    preloadedState,
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <DatatriceProvider store={store}>
        <WebClientProvider config={TEST_CLIENT_CONFIG} options={TEST_CLIENT_OPTIONS} client={webClient}>
          <I18nextProvider i18n={testI18n}>
            <ThemeProvider theme={testTheme}>
              <ToastProvider>
                <MemoryRouter initialEntries={[route]}>
                  <DndContext
                    accessibility={{
                      screenReaderInstructions: { draggable: '' },
                    }}
                  >
                    <GameIdProvider value={gameId}>
                      <GameInteractionProvider value={interactionHandlers}>
                        <CardVisualStateProvider
                          arrowSourceKey={visualState.arrowSourceKey}
                          arrowTargetKey={visualState.arrowTargetKey}
                          selectedCardKeys={visualState.selectedCardKeys}
                          canActFor={visualState.canActFor}
                        >
                          <GameDialogActionsProvider value={dialogActions}>
                            <CardPreviewProvider value={previewCard}>
                              <GameDialogsProvider value={dialogs}>
                                <BoardCellProvider value={boardCellInfo}>
                                  {children}
                                </BoardCellProvider>
                              </GameDialogsProvider>
                            </CardPreviewProvider>
                          </GameDialogActionsProvider>
                        </CardVisualStateProvider>
                      </GameInteractionProvider>
                    </GameIdProvider>
                  </DndContext>
                </MemoryRouter>
              </ToastProvider>
            </ThemeProvider>
          </I18nextProvider>
        </WebClientProvider>
      </DatatriceProvider>
    );
  }

  const result = render(ui, { wrapper: Wrapper, ...renderOptions });
  return {
    ...result,
    webClient,
    store,
  };
}
