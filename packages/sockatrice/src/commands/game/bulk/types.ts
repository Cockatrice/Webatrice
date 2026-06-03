import type { ServerInfo_Card } from '../../../generated';

// A card instance located in a zone owned by a player — the input every bulk
// command operates on. (webatrice aliases this as SelectedCard.)
export interface CardLocation {
  ownerPlayerId: number;
  zone: string;
  card: ServerInfo_Card;
}

// Resolves the Command_Judge target for a card owner (the owner when a judge acts
// on a foreign card, else undefined). Defaults to no wrapping. The caller supplies
// the rule because judge identity is session state, not a protocol fact.
export type JudgeTarget = (ownerPlayerId: number) => number | undefined;
export const NO_JUDGE: JudgeTarget = () => undefined;

export interface BulkMoveDestination {
  targetPlayerId: number;
  targetZone: string;
  x: number;
  y: number;
}
