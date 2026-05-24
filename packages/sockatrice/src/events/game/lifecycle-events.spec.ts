vi.mock('../../WebClient');
import { create } from '@bufbuild/protobuf';
import {
  ServerInfo_PlayerPropertiesSchema,
} from '../../generated';
import { WebClient } from '../../WebClient';
import { gameClosed } from './gameClosed';
import { gameHostChanged } from './gameHostChanged';
import { joinGame } from './joinGame';
import { kicked } from './kicked';
import { leaveGame } from './leaveGame';

const meta = { gameId: 5, playerId: 2, context: null, secondsElapsed: 0, forcedByJudge: 0 };

describe('joinGame event', () => {
  it('delegates to WebClient.instance.response.game.playerJoined with gameId from meta', () => {
    const playerProperties = create(ServerInfo_PlayerPropertiesSchema, { playerId: 1 });
    const data = { playerProperties };
    joinGame(data, meta);
    expect(WebClient.instance.response.game.playerJoined).toHaveBeenCalledWith(5, playerProperties);
  });

  it('forwards undefined playerProperties when payload is missing the field', () => {
    const data = { playerProperties: undefined as unknown as ReturnType<typeof create<typeof ServerInfo_PlayerPropertiesSchema>> };
    joinGame(data, meta);
    expect(WebClient.instance.response.game.playerJoined).toHaveBeenCalledWith(5, undefined);
  });
});

describe('leaveGame event', () => {
  it('delegates to WebClient.instance.response.game.playerLeft with gameId/playerId from meta', () => {
    const data = { reason: 3 };
    leaveGame(data, meta);
    expect(WebClient.instance.response.game.playerLeft).toHaveBeenCalledWith(5, 2, 3);
  });

  it('defaults the reason to 1 when not provided', () => {
    const data = {} as { reason?: number };
    leaveGame(data, meta);
    expect(WebClient.instance.response.game.playerLeft).toHaveBeenCalledWith(5, 2, 1);
  });
});

describe('gameClosed event', () => {
  it('delegates to WebClient.instance.response.game.gameClosed with gameId', () => {
    gameClosed({}, meta);
    expect(WebClient.instance.response.game.gameClosed).toHaveBeenCalledWith(5);
  });
});

describe('gameHostChanged event', () => {
  it('delegates to WebClient.instance.response.game.gameHostChanged using meta.playerId as hostId', () => {
    gameHostChanged({}, meta);
    expect(WebClient.instance.response.game.gameHostChanged).toHaveBeenCalledWith(5, 2);
  });
});

describe('kicked event', () => {
  it('delegates to WebClient.instance.response.game.kicked with gameId', () => {
    kicked({}, meta);
    expect(WebClient.instance.response.game.kicked).toHaveBeenCalledWith(5);
  });

  it('still forwards when gameId in meta is zero (malformed but tolerated)', () => {
    const badMeta = { ...meta, gameId: 0 };
    kicked({}, badMeta);
    expect(WebClient.instance.response.game.kicked).toHaveBeenCalledWith(0);
  });
});
