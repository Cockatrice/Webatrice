// Datatrice's `App` namespace is intentionally smaller than Webatrice's.
// It carries only the store-data-shape symbols the slices/reducers/selectors
// reference (sort + game enums + zone names). Webatrice-app symbols (routes,
// forms, settings, etc.) stay in Webatrice — they are not server data and
// have no place in a portable Redux server-data layer.
export type { CreateGameParams, JoinGameParams } from '@cockatrice/sockatrice/generated';

export * from './game';
export * from './sort';
