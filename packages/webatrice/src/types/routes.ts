export enum RouteEnum {
  PLAYER = '/player/:name',
  PEOPLE = '/people',
  SERVER = '/server',
  ROOM = '/room/:roomId',
  LOGIN = '/login',
  LOGS = '/logs',
  GAME = '/game/:gameId',
  DECKS = '/decks',
  DECK = '/deck/:deckId',
  SHARED_DECK = '/decks/shared',
  PUBLIC_DECKS = '/decks/public/:userName',
  DECK_DRAFT = '/deck/draft/:token',
  ACCOUNT = '/account',
  ADMINISTRATION = '/administration',
  MODERATION = '/moderation',
  CARD_ART_RULES = '/card-art-rules',
  DEVELOPER = '/developer',
  REPLAYS = '/replays',
  REPLAY = '/replay/:replayKey',
  SETTINGS = '/settings',
  SHORTCUTS = '/shortcuts',
  MY_REPORTS = '/my-reports',
  REPORT_QUEUE = '/report-queue',
  INITIALIZE = '/initialize',
  UNSUPPORTED = '/unsupported',
  // Rendered in a browser popup window spawned by the game sidebar
  // (window.open with a `webatrice-card-preview` target). Renders
  // only the card preview — no Layout/TopBar/AuthGuard — and mirrors
  // whatever the main window broadcasts on `webatrice-card-preview`.
  CARD_PREVIEW_POPUP = '/card-preview-popup',
}

export interface LoginRouteState {
  from?: string;
}

export interface ServerRouteState {
  startupRoom?: string;
}

export interface RoomRouteState {
  createGame?: boolean;
}

export interface DeckRouteState {
  replacesDeckId?: number;
}
