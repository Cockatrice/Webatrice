import { create, setExtension } from '@bufbuild/protobuf';
import {
  Event_GameSay_ext,
  Event_GameSaySchema,
  Event_PlayerPropertiesChanged_ext,
  Event_PlayerPropertiesChangedSchema,
  GameEventContainerSchema,
  GameEventSchema,
  GameReplaySchema,
  ServerInfo_GameSchema,
  ServerInfo_PlayerPropertiesSchema,
  type GameEventContainer,
  type GameReplay,
} from '@cockatrice/sockatrice/generated';

export function sayContainer(secondsElapsed: number, message = `at ${secondsElapsed}s`): GameEventContainer {
  const event = create(GameEventSchema, { playerId: 0 });
  setExtension(event, Event_GameSay_ext, create(Event_GameSaySchema, { message }));
  return create(GameEventContainerSchema, { secondsElapsed, eventList: [event] });
}

export function pingContainer(secondsElapsed: number): GameEventContainer {
  const event = create(GameEventSchema, { playerId: 0 });
  setExtension(
    event,
    Event_PlayerPropertiesChanged_ext,
    create(Event_PlayerPropertiesChangedSchema, {
      playerProperties: create(ServerInfo_PlayerPropertiesSchema, { pingSeconds: 1 }),
    }),
  );
  return create(GameEventContainerSchema, { secondsElapsed, eventList: [event] });
}

export function buildReplay(eventList: GameEventContainer[], gameId = 7): GameReplay {
  return create(GameReplaySchema, {
    replayId: 31n,
    gameInfo: create(ServerInfo_GameSchema, { gameId, description: 'Fixture game' }),
    eventList,
    durationSeconds: eventList.length ? eventList[eventList.length - 1].secondsElapsed : 0,
  });
}
