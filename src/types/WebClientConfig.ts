import type {
  RegistryEntry,
  SessionEvent,
  RoomEvent,
  GameEvent,
} from '../generated';

import type { GameEventMeta } from './WebSocketConfig';
import type { IWebClientResponse } from './WebClientResponse';

export interface ConnectTarget {
  host: string;
  port: string;
}

export interface WebClientConfig {
  response: IWebClientResponse;

  sessionEvents: RegistryEntry<unknown, SessionEvent>[];
  roomEvents: RegistryEntry<unknown, RoomEvent, RoomEvent>[];
  gameEvents: RegistryEntry<unknown, GameEvent, GameEventMeta>[];

  keepAliveFn(pingReceived: () => void): void;
}
