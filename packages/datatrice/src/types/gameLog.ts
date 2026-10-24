export interface LogPlayer {
  id?: number;
  name?: string;
}

export type LogTone = 'phase' | 'turn' | 'system' | 'action';
export type LogSegmentKind = 'plain' | 'player' | 'card' | 'number';
export interface LogSegment {
  text: string;
  kind: LogSegmentKind;
}

export interface LegacyLogText {
  text: string;
  segments: LogSegment[];
}

interface ActorParams { actor: LogPlayer }
interface CardParams extends ActorParams { cardName: string }

export interface LogParamsByKind {
  cardMoved: ActorParams & {
    sourceOwner: LogPlayer;
    targetOwner: LogPlayer;
    cardName: string;
    startZone: string;
    targetZone: string;
    position: number;
    targetPosition: number;
    sourceCount: number;
    targetCount: number;
    faceDown: boolean;
  };
  cardFlipped: CardParams & { faceDown: boolean };
  cardDestroyed: CardParams;
  cardAttached: CardParams & { targetOwner: LogPlayer; targetCardName: string; detached: boolean };
  tokenCreated: CardParams & { faceDown: boolean; pt: string };
  cardAttrChanged: CardParams & { attribute: number; value: string; previousPT: string };
  cardAttrChangedBulk: ActorParams & { tapped: boolean };
  cardCounterChanged: CardParams & { counterId: number; value: number; previousValue: number };
  counterSet: ActorParams & { counterId: number; counterName: string; value: number; previousValue: number };
  cardsDrawn: ActorParams & { count: number };
  cardUndoneDraw: CardParams;
  undoDrawFailed: ActorParams;
  zoneShuffled: ActorParams;
  cardPeeked: CardParams & { cardId: number };
  cardsRevealed: ActorParams & {
    zoneName: string;
    target: LogPlayer | null;
    mode: 'zone' | 'top' | 'cards';
    count: number;
    lend: boolean;
  };
  zoneDumped: ActorParams & { owner: LogPlayer; zoneName: string; count: number };
  zonePropertiesChanged: ActorParams & { zoneName: string; reveal: boolean; look: boolean };
  activePhaseSet: { phase: number };
  activePlayerSet: ActorParams;
  turnReversed: ActorParams & { reversed: boolean };
  dieRolled: ActorParams & { sides: number; rolls: number[] };
  playerJoined: ActorParams;
  playerLeft: ActorParams & { reason: number };
  gameStarted: Record<string, never>;
  gameClosed: Record<string, never>;
  replayStarted: { gameId: number };
  arrowCreated: ActorParams & {
    sourceOwner: LogPlayer;
    targetOwner: LogPlayer;
    sourceCardName: string;
    targetCardName: string;
    playerTarget: boolean;
  };
  playerConceded: ActorParams;
  playerUnconceded: ActorParams;
  playerReady: ActorParams;
  playerUnready: ActorParams;
  sideboardLocked: ActorParams;
  sideboardUnlocked: ActorParams;
  deckLoaded: ActorParams & { hash: string };
}

export type LogKind = keyof LogParamsByKind;
export type LogDescriptor = {
  [K in LogKind]: { kind: K; params: LogParamsByKind[K] }
}[LogKind];

export interface LogEntry extends LegacyLogText {
  kind?: LogKind;
  params?: LogDescriptor['params'];
}
