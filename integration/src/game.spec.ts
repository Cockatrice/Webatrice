// Game scenarios — game join, state initialization, card operations,
// player counters, game chat, game close, and outbound game commands.

import { create } from '@bufbuild/protobuf';
import { describe, expect, it } from 'vitest';

import * as Data from '../../src/generated';
import { GameCommands, RoomCommands } from '../../src';

import { connectAndHandshake, connectAndLogin, getMockResponse } from '../../src/testing/setup';
import {
  buildResponse,
  buildResponseMessage,
  buildSessionEventMessage,
  buildGameEventMessage,
  deliverMessage,
} from '../../src/testing/protobuf-builders';
import { findLastGameCommand, findLastRoomCommand, findLastSessionCommand } from '../../src/testing/command-capture';

function joinGame(gameId: number): void {
  deliverMessage(buildSessionEventMessage(
    Data.Event_GameJoined_ext,
    create(Data.Event_GameJoinedSchema, {
      gameInfo: create(Data.ServerInfo_GameSchema, {
        gameId,
        description: 'Test Game',
        maxPlayers: 2,
        playerCount: 1,
      }),
      playerId: 1,
      hostId: 1,
      spectator: false,
      judge: false,
      resuming: false,
    })
  ));
}

function setupGameState(gameId: number): void {
  const deckCard = create(Data.ServerInfo_CardSchema, { id: 100, name: 'Forest' });
  const handCard = create(Data.ServerInfo_CardSchema, { id: 101, name: 'Lightning Bolt' });

  const deckZone = create(Data.ServerInfo_ZoneSchema, {
    name: 'deck',
    type: Data.ServerInfo_Zone_ZoneType.HiddenZone,
    cardList: [deckCard],
  });
  const handZone = create(Data.ServerInfo_ZoneSchema, {
    name: 'hand',
    type: Data.ServerInfo_Zone_ZoneType.HiddenZone,
    cardList: [handCard],
  });
  const tableZone = create(Data.ServerInfo_ZoneSchema, {
    name: 'table',
    type: Data.ServerInfo_Zone_ZoneType.PublicZone,
    withCoords: true,
    cardList: [],
  });

  const player = create(Data.ServerInfo_PlayerSchema, {
    properties: create(Data.ServerInfo_PlayerPropertiesSchema, {
      playerId: 1,
      userInfo: create(Data.ServerInfo_UserSchema, { name: 'alice' }),
    }),
    zoneList: [deckZone, handZone, tableZone],
    counterList: [],
    arrowList: [],
  });

  deliverMessage(buildGameEventMessage({
    gameId,
    playerId: -1,
    ext: Data.Event_GameStateChanged_ext,
    value: create(Data.Event_GameStateChangedSchema, {
      playerList: [player],
      gameStarted: true,
      activePlayerId: 1,
      activePhase: 0,
    }),
  }));
}

describe('game', () => {
  it('dispatches gameJoined and gameStateChanged on Event_GameJoined + Event_GameStateChanged', () => {
    connectAndLogin();
    joinGame(42);

    expect(getMockResponse().session.gameJoined).toHaveBeenCalledWith(
      expect.objectContaining({
        playerId: 1,
        gameInfo: expect.objectContaining({ gameId: 42, description: 'Test Game' }),
      }),
    );

    setupGameState(42);

    expect(getMockResponse().game.gameStateChanged).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ gameStarted: true, activePlayerId: 1 }),
    );
  });

  it('dispatches cardsDrawn on Event_DrawCards', () => {
    connectAndLogin();
    joinGame(42);
    setupGameState(42);

    const drawnCard = create(Data.ServerInfo_CardSchema, { id: 200, name: 'Mountain' });
    deliverMessage(buildGameEventMessage({
      gameId: 42,
      playerId: 1,
      ext: Data.Event_DrawCards_ext,
      value: create(Data.Event_DrawCardsSchema, {
        number: 1,
        cards: [drawnCard],
      }),
    }));

    expect(getMockResponse().game.cardsDrawn).toHaveBeenCalledWith(
      42,
      1,
      expect.objectContaining({
        number: 1,
        cards: expect.arrayContaining([expect.objectContaining({ id: 200, name: 'Mountain' })]),
      }),
    );
  });

  it('dispatches gameSay on Event_GameSay', () => {
    connectAndLogin();
    joinGame(42);

    deliverMessage(buildGameEventMessage({
      gameId: 42,
      playerId: 1,
      ext: Data.Event_GameSay_ext,
      value: create(Data.Event_GameSaySchema, { message: 'good game' }),
    }));

    expect(getMockResponse().game.gameSay).toHaveBeenCalledWith(
      42,
      1,
      'good game',
      expect.any(Number),
    );
  });

  it('dispatches gameClosed on Event_GameClosed', () => {
    connectAndLogin();
    joinGame(42);

    deliverMessage(buildGameEventMessage({
      gameId: 42,
      playerId: -1,
      ext: Data.Event_GameClosed_ext,
      value: create(Data.Event_GameClosedSchema),
    }));

    expect(getMockResponse().game.gameClosed).toHaveBeenCalledWith(42);
  });

  it('sends outbound Command_GameSay with correct gameId and message', () => {
    connectAndLogin();
    joinGame(42);

    GameCommands.gameSay(42, { message: 'hello opponent' });

    const { value, cmdId } = findLastGameCommand(Data.Command_GameSay_ext);
    expect(value.message).toBe('hello opponent');
    expect(cmdId).toBeGreaterThan(0);
  });

  it('dispatches cardMoved on Event_MoveCard', () => {
    connectAndLogin();
    joinGame(42);
    setupGameState(42);

    deliverMessage(buildGameEventMessage({
      gameId: 42,
      playerId: 1,
      ext: Data.Event_MoveCard_ext,
      value: create(Data.Event_MoveCardSchema, {
        cardId: 101,
        cardName: 'Lightning Bolt',
        startPlayerId: 1,
        startZone: 'hand',
        targetPlayerId: 1,
        targetZone: 'table',
        x: 100,
        y: 200,
        faceDown: false,
        newCardId: 101,
      }),
    }));

    expect(getMockResponse().game.cardMoved).toHaveBeenCalledWith(
      42,
      1,
      expect.objectContaining({
        cardId: 101,
        cardName: 'Lightning Bolt',
        startZone: 'hand',
        targetZone: 'table',
        x: 100,
      }),
    );
  });

  it('dispatches counterCreated and counterSet across counter lifecycle', () => {
    connectAndLogin();
    joinGame(42);
    setupGameState(42);

    const counterInfo = create(Data.ServerInfo_CounterSchema, {
      id: 1,
      name: 'Life',
      count: 20,
      radius: 1,
    });

    deliverMessage(buildGameEventMessage({
      gameId: 42,
      playerId: 1,
      ext: Data.Event_CreateCounter_ext,
      value: create(Data.Event_CreateCounterSchema, { counterInfo }),
    }));

    expect(getMockResponse().game.counterCreated).toHaveBeenCalledWith(
      42,
      1,
      expect.objectContaining({
        counterInfo: expect.objectContaining({ id: 1, name: 'Life', count: 20 }),
      }),
    );

    deliverMessage(buildGameEventMessage({
      gameId: 42,
      playerId: 1,
      ext: Data.Event_SetCounter_ext,
      value: create(Data.Event_SetCounterSchema, { counterId: 1, value: 17 }),
    }));

    expect(getMockResponse().game.counterSet).toHaveBeenCalledWith(
      42,
      1,
      expect.objectContaining({ counterId: 1, value: 17 }),
    );
  });

  it('active turn: draw, play, tap, counter, target, end turn', () => {
    connectAndLogin();
    joinGame(42);
    setupGameState(42);

    GameCommands.drawCards(42, { number: 1 });
    expect(findLastGameCommand(Data.Command_DrawCards_ext).value.number).toBe(1);

    GameCommands.moveCard(42, {
      startPlayerId: 1,
      startZone: 'hand',
      cardsToMove: create(Data.ListOfCardsToMoveSchema, {
        card: [create(Data.CardToMoveSchema, { cardId: 101, faceDown: false })],
      }),
      targetPlayerId: 1,
      targetZone: 'table',
      x: 50,
      y: 100,
    });
    expect(findLastGameCommand(Data.Command_MoveCard_ext).value.targetZone).toBe('table');

    GameCommands.flipCard(42, { zone: 'table', cardId: 101, faceDown: true });
    expect(findLastGameCommand(Data.Command_FlipCard_ext).value.faceDown).toBe(true);

    deliverMessage(buildGameEventMessage({
      gameId: 42,
      playerId: 1,
      ext: Data.Event_FlipCard_ext,
      value: create(Data.Event_FlipCardSchema, {
        zoneName: 'table',
        cardId: 101,
        cardName: 'Lightning Bolt',
        faceDown: true,
      }),
    }));
    expect(getMockResponse().game.cardFlipped).toHaveBeenCalledWith(
      42, 1, expect.objectContaining({ cardId: 101, faceDown: true }),
    );

    GameCommands.setCardAttr(42, {
      zone: 'table',
      cardId: 101,
      attribute: Data.CardAttribute.AttrTapped,
      attrValue: '1',
    });
    expect(findLastGameCommand(Data.Command_SetCardAttr_ext).value.attribute).toBe(Data.CardAttribute.AttrTapped);

    deliverMessage(buildGameEventMessage({
      gameId: 42,
      playerId: 1,
      ext: Data.Event_SetCardAttr_ext,
      value: create(Data.Event_SetCardAttrSchema, {
        zoneName: 'table',
        cardId: 101,
        attribute: Data.CardAttribute.AttrTapped,
        attrValue: '1',
      }),
    }));
    expect(getMockResponse().game.cardAttrChanged).toHaveBeenCalledWith(
      42, 1, expect.objectContaining({ attrValue: '1' }),
    );

    GameCommands.setCardCounter(42, { zone: 'table', cardId: 101, counterId: 0, counterValue: 1 });
    expect(findLastGameCommand(Data.Command_SetCardCounter_ext).value.counterValue).toBe(1);

    deliverMessage(buildGameEventMessage({
      gameId: 42,
      playerId: 1,
      ext: Data.Event_SetCardCounter_ext,
      value: create(Data.Event_SetCardCounterSchema, {
        zoneName: 'table',
        cardId: 101,
        counterId: 0,
        counterValue: 1,
      }),
    }));
    expect(getMockResponse().game.cardCounterChanged).toHaveBeenCalledWith(
      42, 1, expect.objectContaining({ counterId: 0, counterValue: 1 }),
    );

    GameCommands.createArrow(42, {
      startPlayerId: 1, startZone: 'table', startCardId: 101,
      targetPlayerId: 2, targetZone: 'table', targetCardId: 200,
    });
    expect(findLastGameCommand(Data.Command_CreateArrow_ext).value.startCardId).toBe(101);

    deliverMessage(buildGameEventMessage({
      gameId: 42,
      playerId: 1,
      ext: Data.Event_CreateArrow_ext,
      value: create(Data.Event_CreateArrowSchema, {
        arrowInfo: create(Data.ServerInfo_ArrowSchema, {
          id: 7,
          startPlayerId: 1,
          startZone: 'table',
          startCardId: 101,
          targetPlayerId: 2,
          targetZone: 'table',
          targetCardId: 200,
        }),
      }),
    }));
    expect(getMockResponse().game.arrowCreated).toHaveBeenCalled();

    GameCommands.nextTurn(42);
    expect(() => findLastGameCommand(Data.Command_NextTurn_ext)).not.toThrow();

    deliverMessage(buildGameEventMessage({
      gameId: 42,
      playerId: -1,
      ext: Data.Event_SetActivePlayer_ext,
      value: create(Data.Event_SetActivePlayerSchema, { activePlayerId: 2 }),
    }));
    expect(getMockResponse().game.activePlayerSet).toHaveBeenCalledWith(42, 2);

    deliverMessage(buildGameEventMessage({
      gameId: 42,
      playerId: -1,
      ext: Data.Event_SetActivePhase_ext,
      value: create(Data.Event_SetActivePhaseSchema, { phase: 0 }),
    }));
    expect(getMockResponse().game.activePhaseSet).toHaveBeenCalledWith(42, 0);
  });

  it('counter and arrow lifecycle: create → inc → set → delete with arrow cleanup', () => {
    connectAndLogin();
    joinGame(42);
    setupGameState(42);

    GameCommands.createCounter(42, { counterName: 'Life', radius: 1, value: 20 });
    expect(findLastGameCommand(Data.Command_CreateCounter_ext).value.counterName).toBe('Life');

    GameCommands.incCounter(42, { counterId: 1, delta: -3 });
    expect(findLastGameCommand(Data.Command_IncCounter_ext).value.delta).toBe(-3);

    GameCommands.setCounter(42, { counterId: 1, value: 17 });
    expect(findLastGameCommand(Data.Command_SetCounter_ext).value.value).toBe(17);

    GameCommands.delCounter(42, { counterId: 1 });
    expect(findLastGameCommand(Data.Command_DelCounter_ext).value.counterId).toBe(1);

    deliverMessage(buildGameEventMessage({
      gameId: 42,
      playerId: 1,
      ext: Data.Event_DelCounter_ext,
      value: create(Data.Event_DelCounterSchema, { counterId: 1 }),
    }));
    expect(getMockResponse().game.counterDeleted).toHaveBeenCalledWith(
      42, 1, expect.objectContaining({ counterId: 1 }),
    );

    GameCommands.deleteArrow(42, { arrowId: 7 });
    expect(findLastGameCommand(Data.Command_DeleteArrow_ext).value.arrowId).toBe(7);

    deliverMessage(buildGameEventMessage({
      gameId: 42,
      playerId: 1,
      ext: Data.Event_DeleteArrow_ext,
      value: create(Data.Event_DeleteArrowSchema, { arrowId: 7 }),
    }));
    expect(getMockResponse().game.arrowDeleted).toHaveBeenCalledWith(
      42, 1, expect.objectContaining({ arrowId: 7 }),
    );

    GameCommands.incCardCounter(42, { zone: 'table', cardId: 101, counterId: 0, counterDelta: 1 });
    expect(findLastGameCommand(Data.Command_IncCardCounter_ext).value.counterDelta).toBe(1);
  });

  it('pre-game: ready → mulligan → sideboard plan → sideboard lock', () => {
    connectAndLogin();
    joinGame(42);

    GameCommands.readyStart(42, { ready: true });
    expect(findLastGameCommand(Data.Command_ReadyStart_ext).value.ready).toBe(true);

    GameCommands.mulligan(42, { number: 6 });
    expect(findLastGameCommand(Data.Command_Mulligan_ext).value.number).toBe(6);

    GameCommands.setSideboardPlan(42, {
      moveList: [
        create(Data.MoveCard_ToZoneSchema, {
          cardName: 'Forest',
          startZone: 'side',
          targetZone: 'main',
        }),
      ],
    });
    expect(findLastGameCommand(Data.Command_SetSideboardPlan_ext).value.moveList).toHaveLength(1);

    GameCommands.setSideboardLock(42, { locked: true });
    expect(findLastGameCommand(Data.Command_SetSideboardLock_ext).value.locked).toBe(true);
  });

  it('host transition: another player joins, host kicks them, host changes', () => {
    connectAndLogin();
    joinGame(42);

    deliverMessage(buildGameEventMessage({
      gameId: 42,
      playerId: 2,
      ext: Data.Event_Join_ext,
      value: create(Data.Event_JoinSchema, {
        playerProperties: create(Data.ServerInfo_PlayerPropertiesSchema, {
          playerId: 2,
          spectator: false,
          userInfo: create(Data.ServerInfo_UserSchema, { name: 'bob' }),
        }),
      }),
    }));
    expect(getMockResponse().game.playerJoined).toHaveBeenCalledWith(
      42, expect.objectContaining({ playerId: 2 }),
    );

    GameCommands.kickFromGame(42, { playerId: 2 });
    expect(findLastGameCommand(Data.Command_KickFromGame_ext).value.playerId).toBe(2);

    deliverMessage(buildGameEventMessage({
      gameId: 42,
      playerId: -1,
      ext: Data.Event_Kicked_ext,
      value: create(Data.Event_KickedSchema),
    }));
    expect(getMockResponse().game.kicked).toHaveBeenCalledWith(42);

    deliverMessage(buildGameEventMessage({
      gameId: 42,
      playerId: 3,
      ext: Data.Event_GameHostChanged_ext,
      value: create(Data.Event_GameHostChangedSchema),
    }));
    expect(getMockResponse().game.gameHostChanged).toHaveBeenCalledWith(42, 3);
  });

  it('special actions: shuffle, dice, reveal/dump, zone props, destroy, reverse, judge, tokens', () => {
    connectAndLogin();
    joinGame(42);
    setupGameState(42);

    GameCommands.shuffle(42, { zoneName: 'deck' });
    expect(findLastGameCommand(Data.Command_Shuffle_ext).value.zoneName).toBe('deck');

    deliverMessage(buildGameEventMessage({
      gameId: 42,
      playerId: 1,
      ext: Data.Event_Shuffle_ext,
      value: create(Data.Event_ShuffleSchema, { zoneName: 'deck' }),
    }));
    expect(getMockResponse().game.zoneShuffled).toHaveBeenCalledWith(
      42, 1, expect.objectContaining({ zoneName: 'deck' }),
    );

    GameCommands.rollDie(42, { sides: 20 });
    expect(findLastGameCommand(Data.Command_RollDie_ext).value.sides).toBe(20);

    deliverMessage(buildGameEventMessage({
      gameId: 42,
      playerId: 1,
      ext: Data.Event_RollDie_ext,
      value: create(Data.Event_RollDieSchema, { sides: 20, value: 17 }),
    }));
    expect(getMockResponse().game.dieRolled).toHaveBeenCalledWith(
      42, 1, expect.objectContaining({ sides: 20, value: 17 }),
    );

    GameCommands.revealCards(42, { zoneName: 'deck', topCards: 1 });
    expect(findLastGameCommand(Data.Command_RevealCards_ext).value.topCards).toBe(1);

    deliverMessage(buildGameEventMessage({
      gameId: 42,
      playerId: 1,
      ext: Data.Event_RevealCards_ext,
      value: create(Data.Event_RevealCardsSchema, { zoneName: 'deck', numberOfCards: 1 }),
    }));
    expect(getMockResponse().game.cardsRevealed).toHaveBeenCalled();

    GameCommands.dumpZone(42, { playerId: 1, zoneName: 'deck', numberCards: 5 });
    expect(findLastGameCommand(Data.Command_DumpZone_ext).value.numberCards).toBe(5);

    deliverMessage(buildGameEventMessage({
      gameId: 42,
      playerId: 1,
      ext: Data.Event_DumpZone_ext,
      value: create(Data.Event_DumpZoneSchema, { zoneOwnerId: 1, zoneName: 'deck', numberCards: 5 }),
    }));
    expect(getMockResponse().game.zoneDumped).toHaveBeenCalled();

    GameCommands.changeZoneProperties(42, { zoneName: 'deck', alwaysRevealTopCard: true });
    expect(findLastGameCommand(Data.Command_ChangeZoneProperties_ext).value.alwaysRevealTopCard).toBe(true);

    deliverMessage(buildGameEventMessage({
      gameId: 42,
      playerId: 1,
      ext: Data.Event_ChangeZoneProperties_ext,
      value: create(Data.Event_ChangeZonePropertiesSchema, { zoneName: 'deck', alwaysRevealTopCard: true }),
    }));
    expect(getMockResponse().game.zonePropertiesChanged).toHaveBeenCalled();

    deliverMessage(buildGameEventMessage({
      gameId: 42,
      playerId: 1,
      ext: Data.Event_DestroyCard_ext,
      value: create(Data.Event_DestroyCardSchema, { zoneName: 'table', cardId: 101 }),
    }));
    expect(getMockResponse().game.cardDestroyed).toHaveBeenCalledWith(
      42, 1, expect.objectContaining({ cardId: 101 }),
    );

    GameCommands.undoDraw(42);
    expect(() => findLastGameCommand(Data.Command_UndoDraw_ext)).not.toThrow();

    GameCommands.reverseTurn(42);
    expect(() => findLastGameCommand(Data.Command_ReverseTurn_ext)).not.toThrow();

    deliverMessage(buildGameEventMessage({
      gameId: 42,
      playerId: -1,
      ext: Data.Event_ReverseTurn_ext,
      value: create(Data.Event_ReverseTurnSchema, { reversed: true }),
    }));
    expect(getMockResponse().game.turnReversed).toHaveBeenCalledWith(42, true);

    GameCommands.setActivePhase(42, { phase: 2 });
    expect(findLastGameCommand(Data.Command_SetActivePhase_ext).value.phase).toBe(2);

    GameCommands.judge(42, 1, create(Data.GameCommandSchema));
    expect(findLastGameCommand(Data.Command_Judge_ext).value.targetId).toBe(1);

    GameCommands.unconcede(42);
    expect(() => findLastGameCommand(Data.Command_Unconcede_ext)).not.toThrow();

    GameCommands.attachCard(42, {
      startZone: 'table', cardId: 101,
      targetPlayerId: 1, targetZone: 'table', targetCardId: 200,
    });
    expect(findLastGameCommand(Data.Command_AttachCard_ext).value.cardId).toBe(101);

    deliverMessage(buildGameEventMessage({
      gameId: 42,
      playerId: 1,
      ext: Data.Event_AttachCard_ext,
      value: create(Data.Event_AttachCardSchema, {
        startZone: 'table', cardId: 101,
        targetPlayerId: 1, targetZone: 'table', targetCardId: 200,
      }),
    }));
    expect(getMockResponse().game.cardAttached).toHaveBeenCalled();

    GameCommands.createToken(42, { zone: 'table', cardName: 'Soldier', pt: '1/1' });
    expect(findLastGameCommand(Data.Command_CreateToken_ext).value.cardName).toBe('Soldier');

    deliverMessage(buildGameEventMessage({
      gameId: 42,
      playerId: 1,
      ext: Data.Event_CreateToken_ext,
      value: create(Data.Event_CreateTokenSchema, {
        zoneName: 'table', cardId: 300, cardName: 'Soldier', pt: '1/1',
      }),
    }));
    expect(getMockResponse().game.tokenCreated).toHaveBeenCalled();
  });

  it('full lifecycle: create → join → deck select → draw → chat → discard → concede → leave', () => {
    connectAndHandshake();

    deliverMessage(buildSessionEventMessage(
      Data.Event_ListRooms_ext,
      create(Data.Event_ListRoomsSchema, {
        roomList: [create(Data.ServerInfo_RoomSchema, { roomId: 1, autoJoin: true, gameList: [], userList: [], gametypeList: [] })],
      })
    ));
    const roomJoin = findLastSessionCommand(Data.Command_JoinRoom_ext);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: roomJoin.cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_JoinRoom_ext,
      value: create(Data.Response_JoinRoomSchema, {
        roomInfo: create(Data.ServerInfo_RoomSchema, { roomId: 1, gameList: [], userList: [], gametypeList: [] }),
      }),
    })));

    RoomCommands.createGame(1, { description: 'Ranked Match', maxPlayers: 2 });
    const createCmd = findLastRoomCommand(Data.Command_CreateGame_ext);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: createCmd.cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
    })));

    RoomCommands.joinGame(1, { gameId: 99 });
    const joinCmd = findLastRoomCommand(Data.Command_JoinGame_ext);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: joinCmd.cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
    })));

    expect(getMockResponse().room.joinedGame).toHaveBeenCalledWith(1, 99);

    deliverMessage(buildSessionEventMessage(
      Data.Event_GameJoined_ext,
      create(Data.Event_GameJoinedSchema, {
        gameInfo: create(Data.ServerInfo_GameSchema, { gameId: 99, description: 'Ranked Match', maxPlayers: 2 }),
        playerId: 1,
        hostId: 1,
        spectator: false,
        judge: false,
        resuming: false,
      })
    ));
    expect(getMockResponse().session.gameJoined).toHaveBeenCalledWith(
      expect.objectContaining({ gameInfo: expect.objectContaining({ gameId: 99 }) }),
    );

    GameCommands.deckSelect(99, { deck: '4 Lightning Bolt\n20 Mountain\n4 Goblin Guide' });
    const deckCmd = findLastGameCommand(Data.Command_DeckSelect_ext);
    expect(deckCmd.value.deck).toContain('Lightning Bolt');

    const deckCards = [
      create(Data.ServerInfo_CardSchema, { id: 1, name: 'Lightning Bolt' }),
      create(Data.ServerInfo_CardSchema, { id: 2, name: 'Mountain' }),
      create(Data.ServerInfo_CardSchema, { id: 3, name: 'Goblin Guide' }),
    ];
    deliverMessage(buildGameEventMessage({
      gameId: 99,
      playerId: -1,
      ext: Data.Event_GameStateChanged_ext,
      value: create(Data.Event_GameStateChangedSchema, {
        playerList: [create(Data.ServerInfo_PlayerSchema, {
          properties: create(Data.ServerInfo_PlayerPropertiesSchema, {
            playerId: 1,
            userInfo: create(Data.ServerInfo_UserSchema, { name: 'alice' }),
          }),
          zoneList: [
            create(Data.ServerInfo_ZoneSchema, {
              name: 'deck', type: Data.ServerInfo_Zone_ZoneType.HiddenZone,
              cardList: deckCards, cardCount: 3,
            }),
            create(Data.ServerInfo_ZoneSchema, {
              name: 'hand', type: Data.ServerInfo_Zone_ZoneType.HiddenZone,
              cardList: [], cardCount: 0,
            }),
            create(Data.ServerInfo_ZoneSchema, {
              name: 'table', type: Data.ServerInfo_Zone_ZoneType.PublicZone,
              withCoords: true, cardList: [], cardCount: 0,
            }),
            create(Data.ServerInfo_ZoneSchema, {
              name: 'grave', type: Data.ServerInfo_Zone_ZoneType.PublicZone,
              cardList: [], cardCount: 0,
            }),
          ],
          counterList: [],
          arrowList: [],
        })],
        gameStarted: true,
        activePlayerId: 1,
        activePhase: 0,
      }),
    }));
    expect(getMockResponse().game.gameStateChanged).toHaveBeenCalledWith(
      99,
      expect.objectContaining({ gameStarted: true }),
    );

    deliverMessage(buildGameEventMessage({
      gameId: 99,
      playerId: 1,
      ext: Data.Event_DrawCards_ext,
      value: create(Data.Event_DrawCardsSchema, {
        number: 2,
        cards: [
          create(Data.ServerInfo_CardSchema, { id: 1, name: 'Lightning Bolt' }),
          create(Data.ServerInfo_CardSchema, { id: 2, name: 'Mountain' }),
        ],
      }),
    }));
    expect(getMockResponse().game.cardsDrawn).toHaveBeenCalledWith(
      99,
      1,
      expect.objectContaining({ number: 2 }),
    );

    GameCommands.gameSay(99, { message: 'good luck!' });
    const sayCmd = findLastGameCommand(Data.Command_GameSay_ext);
    expect(sayCmd.value.message).toBe('good luck!');

    deliverMessage(buildGameEventMessage({
      gameId: 99,
      playerId: 1,
      ext: Data.Event_GameSay_ext,
      value: create(Data.Event_GameSaySchema, { message: 'good luck!' }),
    }));
    expect(getMockResponse().game.gameSay).toHaveBeenCalledWith(99, 1, 'good luck!', expect.any(Number));

    deliverMessage(buildGameEventMessage({
      gameId: 99,
      playerId: 1,
      ext: Data.Event_MoveCard_ext,
      value: create(Data.Event_MoveCardSchema, {
        cardId: 1,
        cardName: 'Lightning Bolt',
        startPlayerId: 1,
        startZone: 'hand',
        targetPlayerId: 1,
        targetZone: 'grave',
        faceDown: false,
        newCardId: 1,
      }),
    }));
    expect(getMockResponse().game.cardMoved).toHaveBeenCalledWith(
      99,
      1,
      expect.objectContaining({ targetZone: 'grave' }),
    );

    GameCommands.concede(99);
    expect(() => findLastGameCommand(Data.Command_Concede_ext)).not.toThrow();

    deliverMessage(buildGameEventMessage({
      gameId: 99,
      playerId: 1,
      ext: Data.Event_PlayerPropertiesChanged_ext,
      value: create(Data.Event_PlayerPropertiesChangedSchema, {
        playerProperties: create(Data.ServerInfo_PlayerPropertiesSchema, {
          playerId: 1,
          conceded: true,
          userInfo: create(Data.ServerInfo_UserSchema, { name: 'alice' }),
        }),
      }),
    }));
    expect(getMockResponse().game.playerPropertiesChanged).toHaveBeenCalled();

    GameCommands.leaveGame(99);
    expect(() => findLastGameCommand(Data.Command_LeaveGame_ext)).not.toThrow();

    deliverMessage(buildGameEventMessage({
      gameId: 99,
      playerId: 1,
      ext: Data.Event_Leave_ext,
      value: create(Data.Event_LeaveSchema, { reason: Data.Event_Leave_LeaveReason.USER_LEFT }),
    }));
    expect(getMockResponse().game.playerLeft).toHaveBeenCalledWith(99, 1, expect.any(Number));
  });
});
