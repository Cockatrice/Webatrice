import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { combineReducers, type EnhancedStore } from '@reduxjs/toolkit';
import { MemoryRouter, type InitialEntry } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ICU from 'i18next-icu';
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
import { CardVisualStateProvider, type CanActFor } from '../features/game/components/ui/CardVisualStateContext';
import { GameDialogActionsProvider, type GameDialogActions } from '../features/game/components/ui/GameDialogActionsContext';
import { GameIdProvider, useGameId } from '../features/game/components/ui/GameIdContext';
import { PendingTargetProvider } from '../features/game/components/ui/PendingTargetContext';
import { usePendingTarget } from '../features/game/hooks/usePendingTarget';
import { CardPreviewProvider, createCardPreviewStore, type CardPreviewStore } from '../features/game/components/ui/CardPreviewContext';
import { GameDialogsProvider } from '../features/game/components/ui/GameDialogsContext';
import { LobbyDeckStateProvider } from '../features/game/components/lobby/LobbyDeckStateProvider';
import { NOOP_GAME_DIALOGS_ACTIONS, type GameDialogs } from '../features/game/hooks/useGameDialogs';
import { createMockWebClient } from './mockWebClient';
import zoneViewTitles from '../features/game/dialogs/ZoneViewDialog/useZoneViewDialog.i18n.json';
import incomingRevealTitles from '../features/game/dialogs/IncomingRevealDialog/IncomingRevealDialog.i18n.json';
import playerInfoLabels from '../features/game/components/right-sidebar/PlayerInfoPanel/PlayerInfoPanel.i18n.json';
import moveTopUntilText from '../features/game/dialogs/MoveTopUntilDialog/MoveTopUntilDialog.i18n.json';
import handZoneText from '../features/game/components/ui/HandZone/HandZone.i18n.json';
import playerBoardLabels from '../features/game/components/ui/PlayerBoard/PlayerBoard.i18n.json';
import gameDockText from '../features/game/components/GameDock/GameDock.i18n.json';
import cardPreviewPaneText from '../features/game/components/CardPreviewPane/CardPreviewPane.i18n.json';
import boardTrayText from '../features/game/components/BoardTray/BoardTray.i18n.json';
import turnBarText from '../features/game/components/TurnBar/TurnBar.i18n.json';
import seatCardLabels from '../features/game/components/ui/SeatCard/SeatCard.i18n.json';
import zoneStackLabels from '../features/game/components/ui/ZoneStack/ZoneStack.i18n.json';
import pendingTargetText from '../features/game/components/ui/PendingTargetAnnouncer/PendingTargetAnnouncer.i18n.json';
import moveCardsText from '../features/game/dialogs/MoveCardsDialog/MoveCardsDialog.i18n.json';
import shortcutsText from '../feature-widgets/shortcuts/SettingsTab/ShortcutsTab.i18n.json';
import gameLogText from '../feature-widgets/replay-player/formatLogDescriptor.i18n.json';
import gameMenus from '../features/game/components/context-menus/menus.i18n.json';
import gamePrompts from '../features/game/hooks/dialogs/GamePrompt.i18n.json';
import createTokenText from '../features/game/dialogs/CreateTokenDialog/CreateTokenDialog.i18n.json';
import deckSelectText from '../features/game/dialogs/DeckSelectDialog/DeckSelectDialog.i18n.json';
import rollDieText from '../features/game/dialogs/RollDieDialog/RollDieDialog.i18n.json';
import zoneViewText from '../features/game/dialogs/shared/ZoneView.i18n.json';
import zoneLabelText from '../features/game/dialogs/shared/zoneLabels.i18n.json';
import editTokensText from '../feature-widgets/card-import/EditTokens.i18n.json';
import deckSharingText from '../features/decks/DeckSharing.i18n.json';
import gamePhaseText from '../utils/phaseLabels.i18n.json';
import tallyText from '../features/game/components/TallyOverlay/TallyOverlay.i18n.json';

function GamePendingTarget({ children }: { children: React.ReactNode }) {
  return <PendingTargetProvider value={usePendingTarget(useGameId())}>{children}</PendingTargetProvider>;
}

const NOOP_DIALOG_ACTIONS: GameDialogActions = {
  onRequestRollDie: () => undefined,
  onRequestConcede: () => undefined,
  onRequestUnconcede: () => undefined,
  onRequestGameInfo: () => undefined,
  onRequestViewSideboard: () => undefined,
  onRequestLeave: () => undefined,
  onRotateView: () => undefined,
};

// Closed/no-op default for the whole dialogs slice: the closed-state fields plus
// the canonical no-op action surface (NOOP_GAME_DIALOGS_ACTIONS, kept in sync with
// the type at its source). Typed as GameDialogs so the compiler flags any state
// field that drifts — specs override only what they assert.
const NOOP_GAME_DIALOGS: GameDialogs = {
  seatCardMenu: null,
  zoneViews: [],
  prompt: null,
  moveTopUntil: null,
  rollDieOpen: false,
  lastDieSides: 0,
  lastDieCount: 0,
  createTokenOpen: false,
  createTokenInitial: null,
  gameInfoOpen: false,
  concedeConfirm: null,
  leaveConfirm: false,
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

let defaultWebClient: WebClient | undefined;
function getDefaultWebClient(): WebClient {
  if (!defaultWebClient) {
    defaultWebClient = createMockWebClient();
  }
  return defaultWebClient;
}

export const testI18n = i18n.createInstance();
testI18n.use(ICU).use(initReactI18next).init({
  lng: 'en-US',
  resources: {
    'en-US': {
      translation: {
        ...zoneViewTitles,
        ...incomingRevealTitles,
        ...playerInfoLabels,
        ...playerBoardLabels,
        ...seatCardLabels,
        ...zoneStackLabels,
        ...pendingTargetText,
        ...moveCardsText,
        ShortcutsTab: {
          action: Object.fromEntries(Object.entries(shortcutsText.ShortcutsTab.action).filter(([key]) => key.startsWith('game.'))),
        },
        ...gameLogText,
        ...gameMenus,
        TallyOverlay: { tally: tallyText.TallyOverlay.tally },
        ...gamePrompts,
        ...createTokenText,
        ...deckSelectText,
        ...rollDieText,
        ...zoneViewText,
        ...zoneLabelText,
        EditTokens: {
          label: {
            name: editTokensText.EditTokens.label.name,
            color: editTokensText.EditTokens.label.color,
            pt: editTokensText.EditTokens.label.pt,
            annotation: editTokensText.EditTokens.label.annotation,
          },
          color: editTokensText.EditTokens.color,
        },
        ReadOnlyDeck: { cardCount: deckSharingText.ReadOnlyDeck.cardCount },
        ...gamePhaseText,
        ...moveTopUntilText,
        ...handZoneText,
        ...gameDockText,
        ...cardPreviewPaneText,
        ...boardTrayText,
        ...turnBarText,
      },
    },
  },
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
  route?: InitialEntry;
  webClient?: WebClient;
  // Pre-built store override — used by the integration harness, whose
  // setup.ts owns a test store shared with a manually-constructed WebClient.
  // When omitted, the helper builds a fresh store per render.
  store?: EnhancedStore<RootState>;
  // Partial overrides for the card-visual-state context (arrow/selection/canAct).
  // Defaults: no arrows, empty selection, canAct denied for every seat.
  cardVisualState?: CardVisualStateOverride;
  // Partial overrides for the game-dialog-actions context (defaults to no-ops).
  gameDialogActions?: Partial<GameDialogActions>;
  // The active game's id provided via GameIdContext. Omit for the default (1,
  // matching the dominant store fixture); pass explicitly — including
  // `undefined` — to override (e.g. the no-active-game case).
  gameId?: number;
  previewStore?: CardPreviewStore;
  // Partial overrides for the dialogs slice (defaults to a closed/no-op slice).
  // Set the relevant menu state + handlers a dialog spec asserts against.
  gameDialogs?: Partial<GameDialogs>;
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
    cardVisualState,
    gameDialogActions,
    gameDialogs,
    previewStore = createCardPreviewStore(),
    ...renderOptions
  } = options;
  // Distinguish "omitted" (default game 1) from an explicit `gameId: undefined`
  // (no-active-game tests) — a destructure default can't tell them apart.
  const gameId = 'gameId' in options ? options.gameId : 1;
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
  const completedState = preloadedState?.games
    ? { ...preloadedState, games: { pings: {}, ...preloadedState.games } }
    : preloadedState;
  const store = externalStore ?? createStore<RootState>({
    reducer: combineReducers(rootReducerMap),
    preloadedState: completedState,
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
                      <GamePendingTarget>
                        <CardVisualStateProvider
                          arrowSourceKey={visualState.arrowSourceKey}
                          arrowTargetKey={visualState.arrowTargetKey}
                          selectedCardKeys={visualState.selectedCardKeys}
                          canActFor={visualState.canActFor}
                        >
                          <GameDialogActionsProvider value={dialogActions}>
                            <CardPreviewProvider store={previewStore}>
                              <GameDialogsProvider value={dialogs}>
                                <LobbyDeckStateProvider>
                                  {children}
                                </LobbyDeckStateProvider>
                              </GameDialogsProvider>
                            </CardPreviewProvider>
                          </GameDialogActionsProvider>
                        </CardVisualStateProvider>
                      </GamePendingTarget>
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
