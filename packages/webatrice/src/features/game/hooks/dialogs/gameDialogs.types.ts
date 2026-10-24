import type { CreateTokenSubmit } from '../../dialogs/CreateTokenDialog/CreateTokenDialog';
import type { MoveTopUntilRequest } from '../useMoveTopUntil';

export interface ZoneViewTarget {
  playerId: number;
  zoneName: string;
  numberCards?: number;
  isReversed?: boolean;
}

export type SeatCardMenuState =
  | { kind: 'battlefield' | 'stack' | 'hand'; playerId: number; cardId: string; x: number; y: number }
  | {
    kind: 'pile' | 'zoneView';
    playerId: number;
    zone: string;
    cardId: string;
    cardName: string;
    x: number;
    y: number;
    viewCardIds: string[];
    columnCardIds: string[];
  };

export interface PromptState {
  title: string;
  label: string;
  initialValue?: string;
  helperText?: string;
  description?: string;
  placeholder?: string;
  submitLabel?: string;
  type?: 'text' | 'number';
  inputMode?: 'text' | 'numeric';
  selectOnFocus?: boolean;
  preview?: (value: string) => string | null;
  validate?: (value: string) => string | null;
  onSubmit: (value: string) => void;
}

export interface CreateTokenRequest {
  initial?: CreateTokenSubmit | null;
  onSubmit?: (token: CreateTokenSubmit) => void;
}

export interface MoveTopUntilState {
  onSubmit: (request: MoveTopUntilRequest) => void;
}

export type ConcedeConfirm = 'concede' | 'unconcede' | null;

// The dialogs slice splits into STATE (the open/closed flags + payloads that
// change as the user opens/closes dialogs) and ACTIONS (the stable open/close/
// request callbacks). Keeping them as separate types lets the hook return, the
// `GameDialogs` contract, and the test harness's no-op default all derive from
// one source instead of hand-syncing ~70 fields in three places. `GameDialogs`
// (their intersection) stays the single type every consumer reads.
export interface GameDialogsState {
  seatCardMenu: SeatCardMenuState | null;
  zoneViews: ZoneViewTarget[];
  prompt: PromptState | null;
  moveTopUntil: MoveTopUntilState | null;
  rollDieOpen: boolean;
  lastDieSides: number;
  lastDieCount: number;
  createTokenOpen: boolean;
  createTokenInitial: CreateTokenSubmit | null;
  gameInfoOpen: boolean;
  concedeConfirm: ConcedeConfirm;
  /** True while the leave-game confirmation dialog is open. Mirrors
   *  `concedeConfirm` — same guard-rail pattern for a destructive
   *  action, so accidental clicks on the sidebar Leave button don't
   *  drop the user out of a game they meant to stay in. */
  leaveConfirm: boolean;
}

export interface GameDialogsActions {
  openSeatCardMenu: (menu: SeatCardMenuState) => void;
  closeSeatCardMenu: () => void;

  // Zone-view dialog stack
  openZoneView: (view: ZoneViewTarget) => void;
  handleCloseZoneView: (playerId: number, zoneName: string, shuffleOnClose?: boolean) => void;

  // Prompt dialog
  openPrompt: (prompt: PromptState) => void;
  closePrompt: () => void;

  openMoveTopUntil: (dialog: MoveTopUntilState) => void;
  closeMoveTopUntil: () => void;

  // Roll die dialog
  openRollDie: () => void;
  closeRollDie: () => void;
  handleRollDieSubmit: (args: { sides: number; count: number }) => void;

  // Token / sideboard / game info / concede
  openCreateToken: (request?: CreateTokenRequest) => void;
  closeCreateToken: () => void;
  handleCreateTokenSubmit: (args: {
    name: string;
    color: string;
    pt: string;
    annotation: string;
    destroyOnZoneChange: boolean;
    faceDown: boolean;
    providerId?: string;
  }) => void;

  openViewSideboard: () => void;
  openViewLibrary: () => void;
  openViewGraveyard: () => void;

  openGameInfo: () => void;
  closeGameInfo: () => void;

  openConcede: () => void;
  openUnconcede: () => void;
  closeConcedeConfirm: () => void;
  confirmConcede: () => void;
  confirmUnconcede: () => void;

  openLeaveConfirm: () => void;
  closeLeaveConfirm: () => void;
  confirmLeave: () => void;

  handleRequestDrawN: () => void;
  handleRequestUndoDraw: () => void;
  handleRequestMoveTopCardToZone: (zone: string, options?: { x?: number }) => void;
  handleRequestPlayTop: (faceDown: boolean) => void;
  handleRequestMoveTopNToZone: (zone: string) => void;
  handleRequestChooseMulligan: () => void;
  handleRequestSortHandBy: (key: HandSortKey) => void;
}

export type GameDialogs = GameDialogsState & GameDialogsActions;

export type HandSortKey = 'name' | 'maintype' | 'manacost';

// No-op implementation of the whole action surface, co-located with the type so
// the compiler flags any handler that drifts. Test harnesses compose this with a
// closed-state object to build a complete `GameDialogs` without re-enumerating
// the ~55 callbacks. Tree-shaken out of production bundles.
const noopDialogAction = (): void => undefined;
export const NOOP_GAME_DIALOGS_ACTIONS: GameDialogsActions = {
  openSeatCardMenu: noopDialogAction,
  closeSeatCardMenu: noopDialogAction,
  openZoneView: noopDialogAction,
  handleCloseZoneView: noopDialogAction,
  openPrompt: noopDialogAction,
  closePrompt: noopDialogAction,
  openMoveTopUntil: noopDialogAction,
  closeMoveTopUntil: noopDialogAction,
  openRollDie: noopDialogAction,
  closeRollDie: noopDialogAction,
  handleRollDieSubmit: noopDialogAction,
  openCreateToken: noopDialogAction,
  closeCreateToken: noopDialogAction,
  handleCreateTokenSubmit: noopDialogAction,
  openViewSideboard: noopDialogAction,
  openViewLibrary: noopDialogAction,
  openViewGraveyard: noopDialogAction,
  openGameInfo: noopDialogAction,
  closeGameInfo: noopDialogAction,
  openConcede: noopDialogAction,
  openUnconcede: noopDialogAction,
  closeConcedeConfirm: noopDialogAction,
  confirmConcede: noopDialogAction,
  confirmUnconcede: noopDialogAction,
  openLeaveConfirm: noopDialogAction,
  closeLeaveConfirm: noopDialogAction,
  confirmLeave: noopDialogAction,
  handleRequestDrawN: noopDialogAction,
  handleRequestUndoDraw: noopDialogAction,
  handleRequestMoveTopCardToZone: noopDialogAction,
  handleRequestPlayTop: noopDialogAction,
  handleRequestMoveTopNToZone: noopDialogAction,
  handleRequestChooseMulligan: noopDialogAction,
  handleRequestSortHandBy: noopDialogAction,
};
