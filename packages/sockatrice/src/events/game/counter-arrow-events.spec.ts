vi.mock('../../WebClient');
import { create } from '@bufbuild/protobuf';
import {
  Event_ChangeZonePropertiesSchema,
  Event_CreateArrowSchema,
  Event_CreateCounterSchema,
  Event_DelCounterSchema,
  Event_DeleteArrowSchema,
  Event_DumpZoneSchema,
  Event_GameSaySchema,
  Event_ReverseTurnSchema,
  Event_RollDieSchema,
  Event_SetActivePhaseSchema,
  Event_SetActivePlayerSchema,
  Event_SetCardCounterSchema,
  Event_SetCounterSchema,
  Event_ShuffleSchema,
} from '../../generated';
import { WebClient } from '../../WebClient';
import { changeZoneProperties } from './changeZoneProperties';
import { createArrow } from './createArrow';
import { createCounter } from './createCounter';
import { delCounter } from './delCounter';
import { deleteArrow } from './deleteArrow';
import { dumpZone } from './dumpZone';
import { gameSay } from './gameSay';
import { reverseTurn } from './reverseTurn';
import { rollDie } from './rollDie';
import { setActivePhase } from './setActivePhase';
import { setActivePlayer } from './setActivePlayer';
import { setCardCounter } from './setCardCounter';
import { setCounter } from './setCounter';
import { shuffle } from './shuffle';

const meta = { gameId: 5, playerId: 2, context: null, secondsElapsed: 0, forcedByJudge: 0 };

describe('setCardCounter event', () => {
  it('delegates to WebClient.instance.response.game.cardCounterChanged with gameId, playerId and data', () => {
    const data = create(Event_SetCardCounterSchema, { cardId: 3 });
    setCardCounter(data, meta);
    expect(WebClient.instance.response.game.cardCounterChanged).toHaveBeenCalledWith(5, 2, data);
  });
});

describe('createArrow event', () => {
  it('delegates to WebClient.instance.response.game.arrowCreated with gameId, playerId and data', () => {
    const data = create(Event_CreateArrowSchema, {});
    createArrow(data, meta);
    expect(WebClient.instance.response.game.arrowCreated).toHaveBeenCalledWith(5, 2, data);
  });
});

describe('deleteArrow event', () => {
  it('delegates to WebClient.instance.response.game.arrowDeleted with gameId, playerId and data', () => {
    const data = create(Event_DeleteArrowSchema, { arrowId: 9 });
    deleteArrow(data, meta);
    expect(WebClient.instance.response.game.arrowDeleted).toHaveBeenCalledWith(5, 2, data);
  });

  it('forwards a malformed delete payload (no arrowId) intact', () => {
    const data = create(Event_DeleteArrowSchema, {});
    deleteArrow(data, meta);
    expect(WebClient.instance.response.game.arrowDeleted).toHaveBeenCalledWith(5, 2, data);
  });
});

describe('create/delete arrow race ordering', () => {
  it('preserves the order of rapid createArrow then deleteArrow dispatches', () => {
    const createData = create(Event_CreateArrowSchema, {});
    const deleteData = create(Event_DeleteArrowSchema, { arrowId: 42 });
    createArrow(createData, meta);
    deleteArrow(deleteData, meta);

    const createMock = WebClient.instance.response.game.arrowCreated as ReturnType<typeof vi.fn>;
    const deleteMock = WebClient.instance.response.game.arrowDeleted as ReturnType<typeof vi.fn>;
    const createOrder = createMock.mock.invocationCallOrder[0];
    const deleteOrder = deleteMock.mock.invocationCallOrder[0];
    expect(createOrder).toBeLessThan(deleteOrder);
    expect(createMock).toHaveBeenCalledWith(5, 2, createData);
    expect(deleteMock).toHaveBeenCalledWith(5, 2, deleteData);
  });
});

describe('createCounter event', () => {
  it('delegates to WebClient.instance.response.game.counterCreated with gameId, playerId and data', () => {
    const data = create(Event_CreateCounterSchema, {});
    createCounter(data, meta);
    expect(WebClient.instance.response.game.counterCreated).toHaveBeenCalledWith(5, 2, data);
  });
});

describe('setCounter event', () => {
  it('delegates to WebClient.instance.response.game.counterSet with gameId, playerId and data', () => {
    const data = create(Event_SetCounterSchema, { counterId: 1, value: 20 });
    setCounter(data, meta);
    expect(WebClient.instance.response.game.counterSet).toHaveBeenCalledWith(5, 2, data);
  });
});

describe('delCounter event', () => {
  it('delegates to WebClient.instance.response.game.counterDeleted with gameId, playerId and data', () => {
    const data = create(Event_DelCounterSchema, { counterId: 1 });
    delCounter(data, meta);
    expect(WebClient.instance.response.game.counterDeleted).toHaveBeenCalledWith(5, 2, data);
  });
});

describe('create/set/del counter race ordering', () => {
  it('preserves the order of rapid createCounter, setCounter, delCounter dispatches', () => {
    const createData = create(Event_CreateCounterSchema, {});
    const setData = create(Event_SetCounterSchema, { counterId: 1, value: 20 });
    const delData = create(Event_DelCounterSchema, { counterId: 1 });
    createCounter(createData, meta);
    setCounter(setData, meta);
    delCounter(delData, meta);

    const createMock = WebClient.instance.response.game.counterCreated as ReturnType<typeof vi.fn>;
    const setMock = WebClient.instance.response.game.counterSet as ReturnType<typeof vi.fn>;
    const delMock = WebClient.instance.response.game.counterDeleted as ReturnType<typeof vi.fn>;
    const createOrder = createMock.mock.invocationCallOrder[0];
    const setOrder = setMock.mock.invocationCallOrder[0];
    const delOrder = delMock.mock.invocationCallOrder[0];
    expect(createOrder).toBeLessThan(setOrder);
    expect(setOrder).toBeLessThan(delOrder);
  });
});

describe('shuffle event', () => {
  it('delegates to WebClient.instance.response.game.zoneShuffled with gameId, playerId and data', () => {
    const data = create(Event_ShuffleSchema, { zoneName: 'deck' });
    shuffle(data, meta);
    expect(WebClient.instance.response.game.zoneShuffled).toHaveBeenCalledWith(5, 2, data);
  });
});

describe('rollDie event', () => {
  it('delegates to WebClient.instance.response.game.dieRolled with gameId, playerId and data', () => {
    const data = create(Event_RollDieSchema, { die: 6, result: 4 });
    rollDie(data, meta);
    expect(WebClient.instance.response.game.dieRolled).toHaveBeenCalledWith(5, 2, data);
  });
});

describe('gameSay event', () => {
  it('delegates to WebClient.instance.response.game.gameSay with gameId, playerId, message, timeReceived', () => {
    const data = create(Event_GameSaySchema, { message: 'gg' });
    gameSay(data, meta);
    expect(WebClient.instance.response.game.gameSay).toHaveBeenCalledWith(5, 2, 'gg', expect.any(Number));
  });

  it('forwards an empty-message payload (malformed but tolerated)', () => {
    const data = create(Event_GameSaySchema, {});
    gameSay(data, meta);
    expect(WebClient.instance.response.game.gameSay).toHaveBeenCalledWith(5, 2, '', expect.any(Number));
  });
});

describe('setActivePlayer event', () => {
  it('delegates to WebClient.instance.response.game.activePlayerSet with gameId and activePlayerId', () => {
    const data = create(Event_SetActivePlayerSchema, { activePlayerId: 3 });
    setActivePlayer(data, meta);
    expect(WebClient.instance.response.game.activePlayerSet).toHaveBeenCalledWith(5, 3);
  });
});

describe('setActivePhase event', () => {
  it('delegates to WebClient.instance.response.game.activePhaseSet with gameId and phase', () => {
    const data = create(Event_SetActivePhaseSchema, { phase: 4 });
    setActivePhase(data, meta);
    expect(WebClient.instance.response.game.activePhaseSet).toHaveBeenCalledWith(5, 4);
  });
});

describe('reverseTurn event', () => {
  it('delegates to WebClient.instance.response.game.turnReversed with gameId and reversed', () => {
    const data = create(Event_ReverseTurnSchema, { reversed: true });
    reverseTurn(data, meta);
    expect(WebClient.instance.response.game.turnReversed).toHaveBeenCalledWith(5, true);
  });
});

describe('dumpZone event', () => {
  it('delegates to WebClient.instance.response.game.zoneDumped with gameId, playerId and data', () => {
    const data = create(Event_DumpZoneSchema, { zoneName: 'hand' });
    dumpZone(data, meta);
    expect(WebClient.instance.response.game.zoneDumped).toHaveBeenCalledWith(5, 2, data);
  });
});

describe('changeZoneProperties event', () => {
  it('delegates to WebClient.instance.response.game.zonePropertiesChanged with gameId, playerId and data', () => {
    const data = create(Event_ChangeZonePropertiesSchema, { zoneName: 'hand', alwaysRevealTopCard: true });
    changeZoneProperties(data, meta);
    expect(WebClient.instance.response.game.zonePropertiesChanged).toHaveBeenCalledWith(5, 2, data);
  });
});
