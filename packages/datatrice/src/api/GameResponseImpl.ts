import type { Store } from '@reduxjs/toolkit';
import {
  Event_AttachCard,
  Event_ChangeZoneProperties,
  Event_CreateArrow,
  Event_CreateCounter,
  Event_CreateToken,
  Event_DelCounter,
  Event_DeleteArrow,
  Event_DestroyCard,
  Event_DrawCards,
  Event_DumpZone,
  Event_FlipCard,
  Event_GameStateChanged,
  Event_MoveCard,
  Event_RevealCards,
  Event_RollDie,
  Event_SetCardAttr,
  Event_SetCardCounter,
  Event_SetCounter,
  Event_Shuffle,
  ServerInfo_PlayerProperties,
} from '@cockatrice/sockatrice/generated';
import type { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { Actions as GameActions } from '../store/games/game.actions';

export class GameResponseImpl implements WebsocketTypes.IGameResponse {
  constructor(private store: Store) {}

  clearStore(): void {
    this.store.dispatch(GameActions.clearStore());
  }

  gameStateChanged(gameId: number, data: Event_GameStateChanged): void {
    this.store.dispatch(GameActions.gameStateChanged({ gameId, data }));
  }

  playerJoined(gameId: number, playerProperties: ServerInfo_PlayerProperties): void {
    this.store.dispatch(GameActions.playerJoined({ gameId, playerProperties }));
  }

  playerLeft(gameId: number, playerId: number, reason: number): void {
    this.store.dispatch(GameActions.playerLeft({ gameId, playerId, reason, timeReceived: Date.now() }));
  }

  playerPropertiesChanged(gameId: number, playerId: number, properties: ServerInfo_PlayerProperties): void {
    this.store.dispatch(GameActions.playerPropertiesChanged({ gameId, playerId, properties }));
  }

  gameClosed(gameId: number): void {
    this.store.dispatch(GameActions.gameClosed({ gameId }));
  }

  gameHostChanged(gameId: number, hostId: number): void {
    this.store.dispatch(GameActions.gameHostChanged({ gameId, hostId }));
  }

  kicked(gameId: number): void {
    this.store.dispatch(GameActions.kicked({ gameId }));
  }

  gameSay(gameId: number, playerId: number, message: string, timeReceived: number): void {
    this.store.dispatch(GameActions.gameSay({ gameId, playerId, message, timeReceived }));
  }

  cardMoved(gameId: number, playerId: number, data: Event_MoveCard): void {
    this.store.dispatch(GameActions.cardMoved({ gameId, playerId, data }));
  }

  cardFlipped(gameId: number, playerId: number, data: Event_FlipCard): void {
    this.store.dispatch(GameActions.cardFlipped({ gameId, playerId, data }));
  }

  cardDestroyed(gameId: number, playerId: number, data: Event_DestroyCard): void {
    this.store.dispatch(GameActions.cardDestroyed({ gameId, playerId, data }));
  }

  cardAttached(gameId: number, playerId: number, data: Event_AttachCard): void {
    this.store.dispatch(GameActions.cardAttached({ gameId, playerId, data }));
  }

  tokenCreated(gameId: number, playerId: number, data: Event_CreateToken): void {
    this.store.dispatch(GameActions.tokenCreated({ gameId, playerId, data }));
  }

  cardAttrChanged(gameId: number, playerId: number, data: Event_SetCardAttr): void {
    this.store.dispatch(GameActions.cardAttrChanged({ gameId, playerId, data }));
  }

  cardCounterChanged(gameId: number, playerId: number, data: Event_SetCardCounter): void {
    this.store.dispatch(GameActions.cardCounterChanged({ gameId, playerId, data }));
  }

  arrowCreated(gameId: number, playerId: number, data: Event_CreateArrow): void {
    this.store.dispatch(GameActions.arrowCreated({ gameId, playerId, data }));
  }

  arrowDeleted(gameId: number, playerId: number, data: Event_DeleteArrow): void {
    this.store.dispatch(GameActions.arrowDeleted({ gameId, playerId, data }));
  }

  counterCreated(gameId: number, playerId: number, data: Event_CreateCounter): void {
    this.store.dispatch(GameActions.counterCreated({ gameId, playerId, data }));
  }

  counterSet(gameId: number, playerId: number, data: Event_SetCounter): void {
    this.store.dispatch(GameActions.counterSet({ gameId, playerId, data }));
  }

  counterDeleted(gameId: number, playerId: number, data: Event_DelCounter): void {
    this.store.dispatch(GameActions.counterDeleted({ gameId, playerId, data }));
  }

  cardsDrawn(gameId: number, playerId: number, data: Event_DrawCards): void {
    this.store.dispatch(GameActions.cardsDrawn({ gameId, playerId, data }));
  }

  cardsRevealed(gameId: number, playerId: number, data: Event_RevealCards): void {
    this.store.dispatch(GameActions.cardsRevealed({ gameId, playerId, data }));
  }

  zoneShuffled(gameId: number, playerId: number, data: Event_Shuffle): void {
    this.store.dispatch(GameActions.zoneShuffled({ gameId, playerId, data }));
  }

  dieRolled(gameId: number, playerId: number, data: Event_RollDie): void {
    this.store.dispatch(GameActions.dieRolled({ gameId, playerId, data }));
  }

  activePlayerSet(gameId: number, activePlayerId: number): void {
    this.store.dispatch(GameActions.activePlayerSet({ gameId, activePlayerId }));
  }

  activePhaseSet(gameId: number, phase: number): void {
    this.store.dispatch(GameActions.activePhaseSet({ gameId, phase }));
  }

  turnReversed(gameId: number, reversed: boolean): void {
    this.store.dispatch(GameActions.turnReversed({ gameId, reversed }));
  }

  zoneDumped(gameId: number, playerId: number, data: Event_DumpZone): void {
    this.store.dispatch(GameActions.zoneDumped({ gameId, playerId, data }));
  }

  zonePropertiesChanged(gameId: number, playerId: number, data: Event_ChangeZoneProperties): void {
    this.store.dispatch(GameActions.zonePropertiesChanged({ gameId, playerId, data }));
  }
}
