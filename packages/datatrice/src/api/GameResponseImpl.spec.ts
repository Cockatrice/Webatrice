import { create } from '@bufbuild/protobuf';

import { createStore } from '../store/createStore';
import {
  Event_AttachCardSchema,
  Event_ChangeZonePropertiesSchema,
  Event_CreateArrowSchema,
  Event_CreateCounterSchema,
  Event_CreateTokenSchema,
  Event_DelCounterSchema,
  Event_DeleteArrowSchema,
  Event_DestroyCardSchema,
  Event_DrawCardsSchema,
  Event_DumpZoneSchema,
  Event_FlipCardSchema,
  Event_GameStateChangedSchema,
  Event_MoveCardSchema,
  Event_RevealCardsSchema,
  Event_RollDieSchema,
  Event_SetCardAttrSchema,
  Event_SetCardCounterSchema,
  Event_SetCounterSchema,
  Event_ShuffleSchema,
  ServerInfo_CardSchema,
  ServerInfo_PlayerPropertiesSchema,
} from '@cockatrice/sockatrice/generated';
import { Actions as GameActions } from '../store/games/game.actions';
import { GameResponseImpl } from './GameResponseImpl';

function setup() {
  const store = createStore();
  const dispatch = vi.spyOn(store, 'dispatch');
  return { impl: new GameResponseImpl(store), dispatch };
}

describe('GameResponseImpl', () => {
  it('clearStore dispatches the clearStore action', () => {
    const { impl, dispatch } = setup();
    impl.clearStore();
    expect(dispatch).toHaveBeenCalledWith(GameActions.clearStore());
  });

  it('gameStateChanged dispatches the gameStateChanged action with the event payload', () => {
    const { impl, dispatch } = setup();
    const data = create(Event_GameStateChangedSchema, { gameStarted: true });
    impl.gameStateChanged(7, data);
    expect(dispatch).toHaveBeenCalledWith(GameActions.gameStateChanged({ gameId: 7, data }));
  });

  it('playerJoined dispatches the playerJoined action', () => {
    const { impl, dispatch } = setup();
    const playerProperties = create(ServerInfo_PlayerPropertiesSchema, { playerId: 3 });
    impl.playerJoined(7, playerProperties);
    expect(dispatch).toHaveBeenCalledWith(GameActions.playerJoined({ gameId: 7, playerProperties }));
  });

  it('playerLeft dispatches the playerLeft action with a captured timestamp', () => {
    // Date.now() is captured inside playerLeft and embedded in the payload —
    // pin it so the equality check is deterministic.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    try {
      const { impl, dispatch } = setup();
      impl.playerLeft(7, 3, 2);
      expect(dispatch).toHaveBeenCalledWith(
        GameActions.playerLeft({ gameId: 7, playerId: 3, reason: 2, timeReceived: Date.now() }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('playerPropertiesChanged dispatches the playerPropertiesChanged action', () => {
    const { impl, dispatch } = setup();
    const properties = create(ServerInfo_PlayerPropertiesSchema, { playerId: 3 });
    impl.playerPropertiesChanged(7, 3, properties);
    expect(dispatch).toHaveBeenCalledWith(
      GameActions.playerPropertiesChanged({ gameId: 7, playerId: 3, properties }),
    );
  });

  it('gameClosed dispatches the gameClosed action', () => {
    const { impl, dispatch } = setup();
    impl.gameClosed(7);
    expect(dispatch).toHaveBeenCalledWith(GameActions.gameClosed({ gameId: 7 }));
  });

  it('gameHostChanged dispatches the gameHostChanged action', () => {
    const { impl, dispatch } = setup();
    impl.gameHostChanged(7, 5);
    expect(dispatch).toHaveBeenCalledWith(GameActions.gameHostChanged({ gameId: 7, hostId: 5 }));
  });

  it('kicked dispatches the kicked action', () => {
    const { impl, dispatch } = setup();
    impl.kicked(7);
    expect(dispatch).toHaveBeenCalledWith(GameActions.kicked({ gameId: 7 }));
  });

  it('gameSay dispatches the gameSay action', () => {
    const { impl, dispatch } = setup();
    impl.gameSay(7, 3, 'hello', 1234);
    expect(dispatch).toHaveBeenCalledWith(
      GameActions.gameSay({ gameId: 7, playerId: 3, message: 'hello', timeReceived: 1234 }),
    );
  });

  it('cardMoved dispatches the cardMoved action', () => {
    const { impl, dispatch } = setup();
    const data = create(Event_MoveCardSchema, { cardId: 1, startZone: 'hand', targetZone: 'table' });
    impl.cardMoved(7, 3, data);
    expect(dispatch).toHaveBeenCalledWith(GameActions.cardMoved({ gameId: 7, playerId: 3, data }));
  });

  it('cardFlipped dispatches the cardFlipped action', () => {
    const { impl, dispatch } = setup();
    const data = create(Event_FlipCardSchema, { zoneName: 'table', cardId: 1, faceDown: true });
    impl.cardFlipped(7, 3, data);
    expect(dispatch).toHaveBeenCalledWith(GameActions.cardFlipped({ gameId: 7, playerId: 3, data }));
  });

  it('cardDestroyed dispatches the cardDestroyed action', () => {
    const { impl, dispatch } = setup();
    const data = create(Event_DestroyCardSchema, { zoneName: 'table', cardId: 1 });
    impl.cardDestroyed(7, 3, data);
    expect(dispatch).toHaveBeenCalledWith(GameActions.cardDestroyed({ gameId: 7, playerId: 3, data }));
  });

  it('cardAttached dispatches the cardAttached action', () => {
    const { impl, dispatch } = setup();
    const data = create(Event_AttachCardSchema, { startZone: 'table', cardId: 1, targetZone: 'table' });
    impl.cardAttached(7, 3, data);
    expect(dispatch).toHaveBeenCalledWith(GameActions.cardAttached({ gameId: 7, playerId: 3, data }));
  });

  it('tokenCreated dispatches the tokenCreated action', () => {
    const { impl, dispatch } = setup();
    const data = create(Event_CreateTokenSchema, { zoneName: 'table', cardId: 9, cardName: 'Soldier' });
    impl.tokenCreated(7, 3, data);
    expect(dispatch).toHaveBeenCalledWith(GameActions.tokenCreated({ gameId: 7, playerId: 3, data }));
  });

  it('cardAttrChanged dispatches the cardAttrChanged action', () => {
    const { impl, dispatch } = setup();
    const data = create(Event_SetCardAttrSchema, { zoneName: 'table', cardId: 1, attribute: 1, attrValue: '1' });
    impl.cardAttrChanged(7, 3, data);
    expect(dispatch).toHaveBeenCalledWith(GameActions.cardAttrChanged({ gameId: 7, playerId: 3, data }));
  });

  it('cardCounterChanged dispatches the cardCounterChanged action', () => {
    const { impl, dispatch } = setup();
    const data = create(Event_SetCardCounterSchema, { zoneName: 'table', cardId: 1, counterId: 0, counterValue: 3 });
    impl.cardCounterChanged(7, 3, data);
    expect(dispatch).toHaveBeenCalledWith(GameActions.cardCounterChanged({ gameId: 7, playerId: 3, data }));
  });

  it('arrowCreated dispatches the arrowCreated action', () => {
    const { impl, dispatch } = setup();
    const data = create(Event_CreateArrowSchema, {});
    impl.arrowCreated(7, 3, data);
    expect(dispatch).toHaveBeenCalledWith(GameActions.arrowCreated({ gameId: 7, playerId: 3, data }));
  });

  it('arrowDeleted dispatches the arrowDeleted action', () => {
    const { impl, dispatch } = setup();
    const data = create(Event_DeleteArrowSchema, { arrowId: 5 });
    impl.arrowDeleted(7, 3, data);
    expect(dispatch).toHaveBeenCalledWith(GameActions.arrowDeleted({ gameId: 7, playerId: 3, data }));
  });

  it('counterCreated dispatches the counterCreated action', () => {
    const { impl, dispatch } = setup();
    const data = create(Event_CreateCounterSchema, {});
    impl.counterCreated(7, 3, data);
    expect(dispatch).toHaveBeenCalledWith(GameActions.counterCreated({ gameId: 7, playerId: 3, data }));
  });

  it('counterSet dispatches the counterSet action', () => {
    const { impl, dispatch } = setup();
    const data = create(Event_SetCounterSchema, { counterId: 1, value: 20 });
    impl.counterSet(7, 3, data);
    expect(dispatch).toHaveBeenCalledWith(GameActions.counterSet({ gameId: 7, playerId: 3, data }));
  });

  it('counterDeleted dispatches the counterDeleted action', () => {
    const { impl, dispatch } = setup();
    const data = create(Event_DelCounterSchema, { counterId: 1 });
    impl.counterDeleted(7, 3, data);
    expect(dispatch).toHaveBeenCalledWith(GameActions.counterDeleted({ gameId: 7, playerId: 3, data }));
  });

  it('cardsDrawn dispatches the cardsDrawn action', () => {
    const { impl, dispatch } = setup();
    const data = create(Event_DrawCardsSchema, { number: 3 });
    impl.cardsDrawn(7, 3, data);
    expect(dispatch).toHaveBeenCalledWith(GameActions.cardsDrawn({ gameId: 7, playerId: 3, data }));
  });

  it('cardsRevealed dispatches the cardsRevealed action', () => {
    const { impl, dispatch } = setup();
    const data = create(Event_RevealCardsSchema, {});
    impl.cardsRevealed(7, 3, data);
    expect(dispatch).toHaveBeenCalledWith(GameActions.cardsRevealed({ gameId: 7, playerId: 3, data }));
  });

  it('zoneViewRevealed dispatches the zoneViewRevealed action', () => {
    const { impl, dispatch } = setup();
    const cards = [create(ServerInfo_CardSchema, { id: 0, name: 'Forest' })];
    impl.zoneViewRevealed(7, 3, 'deck', cards);
    expect(dispatch).toHaveBeenCalledWith(
      GameActions.zoneViewRevealed({ gameId: 7, playerId: 3, zoneName: 'deck', cards }),
    );
  });

  it('zoneShuffled dispatches the zoneShuffled action', () => {
    const { impl, dispatch } = setup();
    const data = create(Event_ShuffleSchema, { zoneName: 'deck' });
    impl.zoneShuffled(7, 3, data);
    expect(dispatch).toHaveBeenCalledWith(GameActions.zoneShuffled({ gameId: 7, playerId: 3, data }));
  });

  it('dieRolled dispatches the dieRolled action', () => {
    const { impl, dispatch } = setup();
    const data = create(Event_RollDieSchema, { sides: 6, value: 4 });
    impl.dieRolled(7, 3, data);
    expect(dispatch).toHaveBeenCalledWith(GameActions.dieRolled({ gameId: 7, playerId: 3, data }));
  });

  it('activePlayerSet dispatches the activePlayerSet action', () => {
    const { impl, dispatch } = setup();
    impl.activePlayerSet(7, 3);
    expect(dispatch).toHaveBeenCalledWith(GameActions.activePlayerSet({ gameId: 7, activePlayerId: 3 }));
  });

  it('activePhaseSet dispatches the activePhaseSet action', () => {
    const { impl, dispatch } = setup();
    impl.activePhaseSet(7, 2);
    expect(dispatch).toHaveBeenCalledWith(GameActions.activePhaseSet({ gameId: 7, phase: 2 }));
  });

  it('turnReversed dispatches the turnReversed action', () => {
    const { impl, dispatch } = setup();
    impl.turnReversed(7, true);
    expect(dispatch).toHaveBeenCalledWith(GameActions.turnReversed({ gameId: 7, reversed: true }));
  });

  it('zoneDumped dispatches the zoneDumped action', () => {
    const { impl, dispatch } = setup();
    const data = create(Event_DumpZoneSchema, { zoneName: 'deck' });
    impl.zoneDumped(7, 3, data);
    expect(dispatch).toHaveBeenCalledWith(GameActions.zoneDumped({ gameId: 7, playerId: 3, data }));
  });

  it('zonePropertiesChanged dispatches the zonePropertiesChanged action', () => {
    const { impl, dispatch } = setup();
    const data = create(Event_ChangeZonePropertiesSchema, { zoneName: 'deck' });
    impl.zonePropertiesChanged(7, 3, data);
    expect(dispatch).toHaveBeenCalledWith(GameActions.zonePropertiesChanged({ gameId: 7, playerId: 3, data }));
  });
});
