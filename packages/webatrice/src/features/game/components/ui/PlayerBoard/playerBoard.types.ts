// The seat contract: what a player's board shows (PlayerBoardModel) and what it
// can ask for (PlayerBoardCommands). GameBoardCell builds the model from
// Datatrice state (usePlayerSeatViewModel) and the commands from the WebClient
// (usePlayer*Commands); views receive only these interfaces, never selectors or
// request builders. See docs/webatrice-solid-refactor-plan.md §5 (PB-01).
//
// Type-only: this module must not construct requests.

import type { ZoneNameValue } from '@cockatrice/sockatrice';
import type { MoveCardParams } from '@cockatrice/sockatrice/generated';
import type { ColorRGBA } from '@app/types';

import type { BattlefieldSlot } from '../../battlefield/Battlefield/battlefieldLayout';

export interface PlayerCardViewModel {
  id: string;
  name: string;
  scryfallId: string;
  annotation?: string;
}

export interface BattlefieldCardViewModel extends PlayerCardViewModel {
  ownerPlayerId?: number;
  slot: BattlefieldSlot;
  subSlot: number;
  tapped: boolean;
  faceDown?: boolean;
  pt?: string;
  doesntUntap?: boolean;
  color?: string;
  attachTargetPlayerId?: number;
  attachTargetCardId?: number;
  counters?: readonly { id: number; value: number }[];
}

export type ManaSymbol = 'W' | 'U' | 'B' | 'R' | 'G' | 'C' | 'O';

export type HandPlacement = 'tray' | 'inline' | 'hidden';

export interface PlayerSeatViewModel {
  playerId: number;
  hydrated: boolean;
  isLocal: boolean;
  mirrored: boolean;
  handPlacement: HandPlacement;
  isActive: boolean;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  flipHandCardBacks: boolean;
  drawSeq: number;
  lastDrawCount: number;
  revealTargets: readonly { playerId: number; name: string }[];
}

export interface VisibleZoneViewModel {
  cards: readonly PlayerCardViewModel[];
  cardCount: number | undefined;
}

export type HandZoneViewModel = VisibleZoneViewModel;

export interface HiddenZoneViewModel {
  cardCount: number | undefined;
  revealedCards: readonly PlayerCardViewModel[];
}

export interface LibraryZoneViewModel extends HiddenZoneViewModel {
  topCard: { name: string; scryfallId: string } | null;
  alwaysRevealTopCard: boolean;
  alwaysLookAtTopCard: boolean;
}

export interface BattlefieldViewModel {
  cards: readonly BattlefieldCardViewModel[];
}

export interface PlayerCounterViewModel {
  life: { id: number; value: number } | undefined;
  mana: Partial<Record<ManaSymbol, { id: number; count: number }>> | undefined;
}

export interface PlayerBoardPermissions {
  isOwner: boolean;
  canAct: boolean;
}

export interface SeatDeckCard {
  name: string;
  scryfallId: string;
  sideboard: boolean;
  commander: boolean;
}

export interface CustomZoneViewModel {
  name: string;
  type: number;
  withCoords: boolean;
  cardCount: number;
  cards: readonly PlayerCardViewModel[];
}

export interface PlayerBoardModel {
  seat: PlayerSeatViewModel;
  deck: readonly SeatDeckCard[];
  zones: {
    hand: HandZoneViewModel;
    library: LibraryZoneViewModel;
    graveyard: VisibleZoneViewModel;
    exile: VisibleZoneViewModel;
    stack: VisibleZoneViewModel;
    battlefield: BattlefieldViewModel;
    sideboard: HiddenZoneViewModel;
    customZones?: readonly CustomZoneViewModel[];
  };
  counters: PlayerCounterViewModel;
  permissions: PlayerBoardPermissions;
}

export type RevealRecipient = number | 'all';

export type SeatMoveCard = number | {
  id: number;
  faceDown?: true;
  pt?: string;
  tapped?: true;
};

export interface SeatMoveDestination {
  zone: ZoneNameValue;
  index?: number | 'end';
  row?: number;
  reversed?: boolean;
  shuffleMoved?: boolean;
}

export type RevealSelection = 'zone' | 'random' | { top: number } | { cardIds: readonly number[] };

export interface PlayerZoneCommands {
  move(params: MoveCardParams): void;
  moveCards(from: string, cards: readonly SeatMoveCard[], to: SeatMoveDestination): void;
  draw(count: number): void;
  undoDraw(): void;
  mulligan(handSize: number): void;
  shuffleLibrary(range?: { start: number; end: number }): void;
  reveal(zone: string, to: RevealRecipient, cards?: RevealSelection): void;
  lendLibrary(to: number): void;
  setAlwaysRevealTopCard(value: boolean): void;
  setAlwaysLookAtTopCard(value: boolean): void;
}

export interface CardCloneSource {
  name: string;
  providerId: string;
  color: string;
  pt: string;
  annotation: string;
  y: number;
}

export interface CreateTokenRequest {
  name: string;
  color: string;
  pt: string;
  annotation: string;
  destroyOnZoneChange: boolean;
  faceDown: boolean;
  providerId?: string;
  targetCardId?: number;
  targetMode?: 'transform_into' | 'attach_to';
}

export interface PlayerCardCommands {
  setTapped(cardIds: readonly number[], tapped: boolean): void;
  untapAll(): void;
  flip(cardId: number, faceDown: boolean): void;
  peek?: (cardIds: readonly number[]) => void;
  setDoesntUntap(cardId: number, doesntUntap: boolean): void;
  setAnnotation(cardId: number, annotation: string): void;
  setPT(items: readonly { cardId: number; pt: string }[]): void;
  clone(source: CardCloneSource): void;
  createToken(request: CreateTokenRequest): Promise<void>;
}

export interface PlayerCounterCommands {
  increment(counterId: number, delta: number): void;
  set(counterId: number, value: number): void;
  setCardCounters(entries: readonly { cardId: number; counterId: number; value: number }[]): void;
  flipCoin(): void;
}

export type ArrowTarget =
  | {
    kind: 'card';
    playerId: number;
    zone: ZoneNameValue;
    cardId: number;
    attached?: boolean;
  }
  | { kind: 'player'; playerId: number };

export interface PlayerTargetCommands {
  attach(sourceCardId: number, target: { playerId: number; cardId: number }): void;
  unattach(sourceCardId: number): void;
  createArrow(sourceCardId: number, sourceZone: string, target: ArrowTarget, color?: ColorRGBA): void;
  playAndCreateArrow(handCardId: number, target: ArrowTarget, color?: ColorRGBA): void;
  clearOwnArrows(): void;
}

export interface PlayerBoardCommands {
  zone: PlayerZoneCommands;
  card: PlayerCardCommands;
  counter: PlayerCounterCommands;
  target: PlayerTargetCommands;
}
