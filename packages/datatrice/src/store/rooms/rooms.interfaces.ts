import type { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { App, Enriched } from '../../types';

export interface RoomsState {
  rooms: RoomsStateRooms;
  joinedRoomIds: JoinedRooms;
  joinedGameIds: JoinedGames;
  messages: RoomsStateMessages;
  sortGamesBy: RoomsStateSortGamesBy;
  sortUsersBy: RoomsStateSortUsersBy;
  selectedGameIds: SelectedGameIds;
  gameFilters: RoomsStateGameFilters;
  joinGamePending: boolean;
  joinGameError: JoinGameError | null;
  joinRoomError: JoinRoomError | null;
}

export interface RoomCommandFailedPayload {
  requestId?: string;
  roomId: number;
  responseCode: number;
  failure?: WebsocketTypes.CommandFailure;
}

export interface JoinRoomFailedPayload extends RoomCommandFailedPayload {
  userInitiated: boolean;
}

export interface JoinGameError {
  requestId?: string;
  failure?: WebsocketTypes.CommandFailure;
  code: number;
  message: string;
}

export type JoinRoomError = RoomCommandFailedPayload;

export interface RoomsStateRooms {
  [roomId: number]: Enriched.Room;
}

export interface JoinedRooms {
  [roomId: number]: boolean;
}

export interface JoinedGames {
  [roomId: number]: {
    [gameId: number]: boolean;
  };
}

export interface RoomsStateMessages {
  [roomId: number]: Enriched.Message[];
}

export interface RoomsStateSortGamesBy extends App.SortBy {
  field: App.GameSortField
}

export interface RoomsStateSortUsersBy extends App.SortBy {
  field: App.UserSortField
}

export interface SelectedGameIds {
  [roomId: number]: number | undefined;
}

export interface RoomsStateGameFilters {
  [roomId: number]: GameFilters;
}

export interface GameFilters {
  hideBuddiesOnlyGames: boolean;
  hideIgnoredUserGames: boolean;
  hideFullGames: boolean;
  hideGamesThatStarted: boolean;
  hidePasswordProtectedGames: boolean;
  hideNotBuddyCreatedGames: boolean;
  hideOpenDecklistGames: boolean;
  gameNameFilter: string;
  creatorNameFilters: string[];
  gameTypeFilter: number[];
  maxPlayersFilterMin: number;
  maxPlayersFilterMax: number;
  maxGameAgeSeconds: number;
  showOnlyIfSpectatorsCanWatch: boolean;
  showSpectatorPasswordProtected: boolean;
  showOnlyIfSpectatorsCanChat: boolean;
  showOnlyIfSpectatorsCanSeeHands: boolean;
}
