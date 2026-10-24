import { lazyRoute } from './utils/lazyRoute';

export const lazyRoutes = {
  Account: lazyRoute(() => import('./features/account/Account')),
  Administration: lazyRoute(() => import('./features/administration/Administration')),
  CardArtRules: lazyRoute(() => import('./features/card-art-rules/CardArtRules')),
  Decks: lazyRoute(() => import('./features/decks/Decks')),
  DeckEditor: lazyRoute(() => import('./features/decks/DeckEditor')),
  PublicDecks: lazyRoute(() => import('./features/decks/PublicDecks')),
  SharedDeck: lazyRoute(() => import('./features/decks/SharedDeck')),
  Developer: lazyRoute(() => import('./features/developer/Developer')),
  Game: lazyRoute(() => import('./features/game/Game')),
  GameReplay: lazyRoute(() => import('./features/game/replay/GameReplay')),
  Logs: lazyRoute(() => import('./features/logs/Logs')),
  Moderation: lazyRoute(() => import('./features/moderation/Moderation')),
  Player: lazyRoute(() => import('./features/player/Player')),
  People: lazyRoute(() => import('./features/people/People')),
  Replays: lazyRoute(() => import('./features/replays/Replays')),
  MyReports: lazyRoute(() => import('./features/reports/MyReports')),
  ReportQueue: lazyRoute(() => import('./features/reports/ReportQueue')),
  Room: lazyRoute(() => import('./features/rooms/Room')),
  Settings: lazyRoute(() => import('./features/settings/Settings')),
  Shortcuts: lazyRoute(() => import('./features/shortcuts/Shortcuts')),
};

let prefetched = false;

export function prefetchRoutes() {
  if (prefetched) {
    return;
  }
  prefetched = true;
  void Promise.allSettled(Object.values(lazyRoutes).map(route => route.preload()));
}
