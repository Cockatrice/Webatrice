import { useEffect, useMemo, useRef, useState } from 'react';
import {
  User,
  Crown,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Upload,
  Library,
  FastForward,
  LogOut,
  Eye,
} from 'lucide-react';

import { AuthGuard } from '@app/components';
import { Layout } from '@app/feature-wrappers/layout';
import { useWebClient } from '@cockatrice/datatrice/react';
import { rooms, server } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';
import { useLeaveGame, useReduxEffect } from '@app/hooks';
import type { ServerInfo_DeckStorage_Folder, ServerInfo_DeckStorage_TreeItem } from '@cockatrice/sockatrice/generated';

import { parseCod } from '../decks/cod';
import { MTG_FORMAT_LABELS, MTG_FORMATS, normalizeFormat } from '../decks/types';
import { useCurrentGame } from './hooks/useCurrentGame';
import GameLog from './components/right-sidebar/GameLog/GameLog';
import { GameIdProvider } from './components/ui/GameIdContext';

/**
 * Pre-game lobby. Renders after a player joins a game that hasn't
 * started yet. Superseded fancy webatrice's deck-select modal + wait
 * screen with a persistent full-page view where:
 *
 *   • Every player's seat is visible with their ready + deck state
 *   • The local user picks a deck (from My Decks OR via .cod upload)
 *     and readies up
 *   • The host can force-start by kicking unready players — Cockatrice
 *     has no explicit force-start command, so we lean on Command_
 *     KickFromGame to trim the seat list. Once no unready players
 *     remain, the server auto-starts the game.
 *
 * Protocol calls used (via sockatrice):
 *   • deckSelect(gameId, { deckId })      — pick from server-stored deck
 *   • deckSelect(gameId, { deck: xml })   — upload a .cod XML string
 *   • readyStart(gameId, { ready })       — toggle self ready
 *   • kickFromGame(gameId, { playerId })  — host-only, removes a player
 *   • leaveGame(gameId)                   — self leave
 */

interface FlatDeck {
  id: number;
  name: string;
}

function flattenDecks(folder: ServerInfo_DeckStorage_Folder | undefined): FlatDeck[] {
  const out: FlatDeck[] = [];
  const walk = (items: ServerInfo_DeckStorage_TreeItem[] | undefined) => {
    if (!items) return;
    for (const item of items) {
      if (item.file) {
        out.push({ id: item.id, name: item.name });
      } else if (item.folder) {
        walk(item.folder.items);
      }
    }
  };
  walk(folder?.items);
  return out;
}

/**
 * Category labels for the deck picker. `MTG_FORMATS` slugs get their
 * pretty label from `MTG_FORMAT_LABELS`; any non-empty format string
 * that isn't in the MTG list is "Other"; empty/missing is "Unknown".
 * Fixed sentinels keep the code that sorts + groups readable.
 */
const CATEGORY_OTHER = 'other';
const CATEGORY_UNKNOWN = 'unknown';
const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  MTG_FORMAT_LABELS.map((f) => [f.value, f.label]),
);
CATEGORY_LABELS[CATEGORY_OTHER] = 'Other';
CATEGORY_LABELS[CATEGORY_UNKNOWN] = 'Unknown format';

/** Bucket a deck's format string into a category slug for display. */
function categoryOf(format: string | undefined): string {
  const n = normalizeFormat(format ?? '');
  if (!n) return CATEGORY_UNKNOWN;
  if (MTG_FORMATS.includes(n)) return n;
  return CATEGORY_OTHER;
}

/** Info extracted from each downloaded .cod: format string + optional
 *  cached bracket level from `meta.bracketLevel`. Both are used by
 *  the deck picker (grouping + badge) and the picked-deck signal
 *  passed back so player rows can render the bracket too. */
interface DeckSummary {
  format: string;
  bracketLevel?: number;
  /** Deck name from the .cod's <deckname> — used to match a
   *  selected deck back to its badge after the server accepts the
   *  deckSelect. Servatrice broadcasts deckHash but not the name. */
  name: string;
}

// Session-scoped cache. Populated when the lobby (or anywhere else in
// the app) calls deckDownload — a Redux effect below parses each
// response's <format> and <comments>-meta blob and drops the digest
// here. Keyed by the server-side numeric deckId. Persists across
// lobby remounts so a repeated visit doesn't re-hit the server.
const deckSummaryCache = new Map<number, DeckSummary>();

export default function GameLobby({ gameId }: { gameId: number }) {
  const webClient = useWebClient();
  const leaveGame = useLeaveGame();
  const { game, localPlayer, isHost, isSpectator, isJudge } = useCurrentGame(gameId);
  const backendDecks = useAppSelector(server.Selectors.getBackendDecks);
  const isConnected = useAppSelector(server.Selectors.getIsConnected);

  // Fetch the deck list on mount if we don't have it yet. Same source
  // MyDecks uses — deck picks resolve to server-side `deck_id` so
  // Servatrice loads the deck without a re-upload round-trip.
  useEffect(() => {
    if (isConnected && !backendDecks) {
      webClient.request.session.deckList();
    }
  }, [isConnected, backendDecks, webClient]);

  const myDecks = useMemo(() => flattenDecks(backendDecks?.root), [backendDecks]);

  // Room format lookup — first game type in the room's gametypeMap.
  // Cockatrice games can have multiple game types; we prioritise the
  // first one for the "matches this room" hint. Empty string when
  // the room has no gametypes or we can't resolve the room state yet.
  const room = useAppSelector((state) =>
    game ? rooms.Selectors.getRoom(state, game.info.roomId) : undefined,
  );
  const roomFormatLabel = useMemo(() => {
    if (!room || !game?.info.gameTypes.length) return '';
    for (const id of game.info.gameTypes) {
      const label = room.gametypeMap[id];
      if (label) return label;
    }
    return '';
  }, [room, game?.info.gameTypes]);
  const roomFormatSlug = useMemo(() => normalizeFormat(roomFormatLabel), [roomFormatLabel]);

  // Trigger a deckDownload for every deck we haven't yet cached a
  // summary for. Runs whenever the deck list changes. Same technique
  // MyDecks uses to pull prices — we ride the same DECK_DOWNLOADED
  // events to learn each deck's <format> + cached bracketLevel.
  const [summaryByDeckId, setSummaryByDeckId] = useState<Map<number, DeckSummary>>(
    () => new Map(deckSummaryCache),
  );
  const inFlightRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!isConnected) return;
    for (const deck of myDecks) {
      if (summaryByDeckId.has(deck.id)) continue;
      if (inFlightRef.current.has(deck.id)) continue;
      inFlightRef.current.add(deck.id);
      webClient.request.session.deckDownload(deck.id);
    }
  }, [isConnected, myDecks, summaryByDeckId, webClient]);

  useReduxEffect<{ deckId: number; deck: string }>(
    ({ payload }) => {
      inFlightRef.current.delete(payload.deckId);
      let summary: DeckSummary;
      try {
        const parsed = parseCod(payload.deck);
        // Prefer the level stored in the richer <bracketAssessment>
        // element (which also carries the flagged card lists); fall
        // back to meta.bracketLevel for decks last saved before the
        // new element existed.
        summary = {
          format: parsed.format ?? '',
          bracketLevel: parsed.bracketAssessment?.level ?? parsed.meta.bracketLevel,
          name: parsed.name,
        };
      } catch {
        // Malformed .cod → cache empty so we don't re-download.
        summary = { format: '', bracketLevel: undefined, name: '' };
      }
      deckSummaryCache.set(payload.deckId, summary);
      setSummaryByDeckId((prev) => {
        const existing = prev.get(payload.deckId);
        if (
          existing &&
          existing.format === summary.format &&
          existing.bracketLevel === summary.bracketLevel &&
          existing.name === summary.name
        ) {
          return prev;
        }
        const next = new Map(prev);
        next.set(payload.deckId, summary);
        return next;
      });
    },
    server.Types.DECK_DOWNLOADED,
    [],
  );

  // Group decks by category, sort alphabetically inside each group,
  // then order the groups: room's format first (if it maps to a known
  // MTG format), other MTG formats in their canonical MTG_FORMAT_LABELS
  // order, then Other, then Unknown.
  const groupedDecks = useMemo(() => {
    const groups = new Map<string, FlatDeck[]>();
    for (const deck of myDecks) {
      const cat = categoryOf(summaryByDeckId.get(deck.id)?.format);
      const bucket = groups.get(cat) ?? [];
      bucket.push(deck);
      groups.set(cat, bucket);
    }
    for (const bucket of groups.values()) {
      bucket.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    }
    const order: string[] = [];
    if (roomFormatSlug && MTG_FORMATS.includes(roomFormatSlug)) {
      order.push(roomFormatSlug);
    }
    for (const f of MTG_FORMAT_LABELS) {
      if (f.value === roomFormatSlug) continue;
      order.push(f.value);
    }
    order.push(CATEGORY_OTHER);
    order.push(CATEGORY_UNKNOWN);
    return order
      .filter((cat) => groups.has(cat))
      .map((cat) => ({ category: cat, decks: groups.get(cat)! }));
  }, [myDecks, summaryByDeckId, roomFormatSlug]);

  const stillLoadingFormats = myDecks.some((d) => !summaryByDeckId.has(d.id));

  // For player-row bracket badges: map deckHash → bracketLevel via the
  // summary cache. We can't key by deckId because Servatrice only
  // broadcasts each player's deckHash on the wire (not the deck's
  // server-side id). We rely on a deckHash → summary lookup instead,
  // built by hashing each cached deck as we learn about it. Cheaper
  // approach: just remember the last local deck the user picked and
  // its bracket, and match remote players by name (best-effort — the
  // player name shown in the tooltip is authoritative).
  const bracketByDeckId = useMemo(() => {
    const out = new Map<number, number>();
    for (const [id, s] of summaryByDeckId) {
      if (s.bracketLevel != null) out.set(id, s.bracketLevel);
    }
    return out;
  }, [summaryByDeckId]);

  // .cod file upload state — fallback for players who don't have the
  // deck in their MyDecks. Validates the XML client-side before
  // firing the deckSelect command.
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const handleFilePicked = (file: File | null) => {
    setUploadError(null);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const xml = typeof reader.result === 'string' ? reader.result : '';
      if (!isValidCod(xml)) {
        setUploadError('Not a valid Cockatrice deck (.cod) file');
        return;
      }
      setMyPickedDeckId(null);
      webClient.request.game.deckSelect(gameId, { deck: xml });
      // No gameSay: Cockatrice already emits an event message
      // ("X has loaded a deck (…)") when the server processes deckSelect.
    };
    reader.onerror = () => setUploadError('Could not read the selected file');
    reader.readAsText(file);
  };

  const handleReadyToggle = () => {
    if (!localPlayer) return;
    const newReady = !localPlayer.properties.readyStart;
    webClient.request.game.readyStart(gameId, { ready: newReady });
    // No gameSay: Cockatrice emits its own event
    // ("X is ready to start the game.") on the readyStart property update.
  };

  // Remember which local deck the player just picked so the local
  // player row can show its bracket badge. Cockatrice broadcasts each
  // player's `deckHash` on the wire but NOT the deck's server-side
  // id, so we can't map remote players' deckHash back to a bracket
  // without an out-of-band channel. That means the badge on player
  // rows only reflects the LOCAL player today; remote players'
  // rows stay bracket-less unless we later broadcast via gameSay or
  // upstream Cockatrice grows bracket in ServerInfo_PlayerProperties.
  const [myPickedDeckId, setMyPickedDeckId] = useState<number | null>(null);
  const handleSelectDeck = (deckId: number) => {
    setMyPickedDeckId(deckId);
    webClient.request.game.deckSelect(gameId, { deckId });
    // No gameSay: Cockatrice emits its own event
    // ("X has loaded a deck (…)") on the deckHash property update.
  };
  const myBracket = myPickedDeckId != null ? bracketByDeckId.get(myPickedDeckId) : undefined;
  const myDeckName =
    myPickedDeckId != null ? summaryByDeckId.get(myPickedDeckId)?.name : undefined;

  // Force-start proxy: kick every non-ready seated (non-spectator,
  // non-judge, non-host) player. Once no unready players remain,
  // Servatrice auto-starts the game. Confirmation gate below.
  const seatedPlayers = useMemo(() => {
    if (!game) return [];
    return game.seatOrder
      .map((id) => game.players[id])
      .filter((p): p is NonNullable<typeof p> =>
        !!p && !p.properties.spectator && !p.properties.judge,
      );
  }, [game]);
  const unreadyPlayers = seatedPlayers.filter((p) => !p.properties.readyStart);
  const [forceStartPending, setForceStartPending] = useState(false);
  const handleForceStart = () => {
    if (!isHost) return;
    if (!forceStartPending) {
      setForceStartPending(true);
      return;
    }
    // Confirmed — kick every unready player. If the host is unready
    // themselves it's excluded; the host has to ready up first.
    for (const p of unreadyPlayers) {
      if (p.properties.playerId === game?.localPlayerId) continue;
      webClient.request.game.kickFromGame(gameId, { playerId: p.properties.playerId });
    }
    setForceStartPending(false);
  };

  // Reconnect / stale-state guard. The lobby is only meaningful for
  // pre-started games where we have a local player row on the wire.
  if (!game) {
    return (
      <Layout>
        <AuthGuard />
        <div className="h-full flex items-center justify-center bg-bg-base bg-purple-radial">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Loader2 size={16} className="animate-spin text-accent" /> Loading game…
          </div>
        </div>
      </Layout>
    );
  }

  const readyCount = seatedPlayers.filter((p) => p.properties.readyStart).length;
  const totalSeats = game.info.maxPlayers || seatedPlayers.length;
  const emptySeats = Math.max(0, totalSeats - seatedPlayers.length);
  const iAmReady = !!localPlayer?.properties.readyStart;
  const iAmSeated = !!localPlayer && !isSpectator && !isJudge;
  const iHaveDeck = !!localPlayer?.properties.deckHash;

  return (
    <Layout>
      <AuthGuard />
      <GameIdProvider value={gameId}>
      <div className="h-full flex bg-bg-base bg-purple-radial">
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-xl mx-auto py-10 px-6 flex flex-col gap-8">
            {/* Header */}
            <div className="text-center">
              <h1 className="font-modern text-2xl font-semibold text-text-primary">
                {game.info.description || `Game #${gameId}`}
              </h1>
              {roomFormatLabel && (
                <p className="text-sm text-text-muted mt-1">{roomFormatLabel}</p>
              )}
            </div>

            {/* Players */}
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-widest text-text-muted text-center">
                Players
              </div>
              {seatedPlayers.map((p) => {
                const isLocalPlayer = p.properties.playerId === game.localPlayerId;
                return (
                  <PlayerRow
                    key={p.properties.playerId}
                    playerName={p.properties.userInfo?.name || `Player ${p.properties.playerId}`}
                    isHost={p.properties.playerId === game.hostId}
                    ready={p.properties.readyStart}
                    hasDeck={!!p.properties.deckHash}
                    // Bracket + deck-name are only known for the local
                    // player today (see the comment on myPickedDeckId
                    // above for the Cockatrice protocol reason).
                    // Remote players fall back to "Deck submitted".
                    bracket={
                      isLocalPlayer && !!p.properties.deckHash ? myBracket : undefined
                    }
                    deckName={
                      isLocalPlayer && !!p.properties.deckHash ? myDeckName : undefined
                    }
                    showKick={isHost && !isLocalPlayer}
                    onKick={() =>
                      webClient.request.game.kickFromGame(gameId, {
                        playerId: p.properties.playerId,
                      })
                    }
                  />
                );
              })}
              {Array.from({ length: emptySeats }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="flex items-center gap-4 px-4 py-3 rounded-lg border border-dashed border-border-subtle bg-bg-surface/30"
                >
                  <div className="h-11 w-11 rounded-full border-2 border-dashed border-border-subtle" />
                  <span className="text-sm italic text-text-muted">Waiting for player…</span>
                </div>
              ))}
            </div>

            {/* Deck selection (only for seated players, only pre-ready) */}
            {iAmSeated && !iAmReady && (
              <div className="border-t border-border-strong pt-6 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-widest text-text-muted text-center">
                  Your deck
                </div>

                <div className="rounded-lg bg-bg-surface border border-border-subtle overflow-hidden">
                  <div className="px-4 py-2 border-b border-border-subtle flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-text-secondary">
                    <Library size={13} /> From My Decks
                    {stillLoadingFormats && myDecks.length > 0 && (
                      <Loader2 size={11} className="animate-spin text-text-muted ml-auto" />
                    )}
                  </div>
                  {!backendDecks ? (
                    <div className="px-4 py-6 flex items-center gap-2 text-sm text-text-muted justify-center">
                      <Loader2 size={14} className="animate-spin" /> Loading your decks…
                    </div>
                  ) : myDecks.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-text-muted italic text-center">
                      No decks yet — create one from the My Decks page, or upload a .cod below.
                    </div>
                  ) : (
                    <div className="max-h-72 overflow-y-auto">
                      {groupedDecks.map(({ category, decks }) => {
                        return (
                          <div key={category}>
                            <div className="sticky top-0 z-10 px-4 py-1.5 bg-bg-elevated border-b border-border-subtle text-[10px] font-semibold uppercase tracking-widest text-text-muted flex items-center gap-2">
                              <span>{CATEGORY_LABELS[category] ?? category}</span>
                              <span className="text-text-muted tabular-nums">{decks.length}</span>
                            </div>
                            <ul className="divide-y divide-border-subtle/50">
                              {decks.map((deck) => {
                                const bracket = bracketByDeckId.get(deck.id);
                                return (
                                  <li key={deck.id}>
                                    <button
                                      type="button"
                                      onClick={() => handleSelectDeck(deck.id)}
                                      className="w-full flex items-center gap-2 px-4 py-2 hover:bg-bg-elevated text-sm text-text-primary transition-colors text-left"
                                    >
                                      <span className="flex-1 min-w-0 truncate">{deck.name}</span>
                                      {bracket != null && <BracketBadge level={bracket} />}
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="rounded-lg bg-bg-surface border border-border-subtle p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-text-secondary mb-2">
                    <Upload size={13} /> Upload a .cod file
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".cod,application/xml,text/xml"
                    onChange={(e) => {
                      handleFilePicked(e.target.files?.[0] ?? null);
                      // Reset so re-uploading the same file re-triggers change.
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-border-strong bg-bg-elevated hover:bg-border-subtle text-text-primary text-sm font-medium transition-colors"
                  >
                    <Upload size={13} /> Choose .cod file
                  </button>
                  {uploadError && (
                    <div className="mt-2 flex items-start gap-2 text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-md px-2 py-1">
                      <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                      <span>{uploadError}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Ready toggle */}
            {iAmSeated && (
              <div className="flex items-center gap-2 justify-center flex-wrap">
                <button
                  type="button"
                  onClick={handleReadyToggle}
                  disabled={!iHaveDeck}
                  title={iHaveDeck ? undefined : 'Select a deck first'}
                  className={[
                    'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold shadow-glow transition-colors',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    iAmReady
                      ? 'bg-bg-elevated hover:bg-border-subtle text-text-primary border border-border-strong'
                      : 'bg-accent hover:bg-accent-hover text-white',
                  ].join(' ')}
                >
                  {iAmReady && <CheckCircle2 size={14} />}
                  {iAmReady ? 'Unready' : 'Ready up'}
                </button>
                <button
                  type="button"
                  onClick={() => leaveGame(gameId)}
                  className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-text-secondary hover:text-red-300 hover:bg-red-500/10 border border-border-subtle transition-colors"
                >
                  <LogOut size={14} /> Leave game
                </button>
              </div>
            )}

            {/* Spectator / judge notice — no deck, no ready. */}
            {!iAmSeated && (
              <div className="flex items-center justify-center gap-2 text-sm text-text-muted">
                <Eye size={14} />
                Watching as {isJudge ? 'judge' : 'spectator'}
                <button
                  type="button"
                  onClick={() => leaveGame(gameId)}
                  className="ml-4 flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium text-text-secondary hover:text-red-300 hover:bg-red-500/10 border border-border-subtle transition-colors"
                >
                  <LogOut size={12} /> Leave
                </button>
              </div>
            )}

            {/* Host controls — visible whenever at least one player is
                 ready, regardless of whether the host themselves is
                 ready and regardless of whether there are unready
                 players to kick. When there's nothing to kick the
                 button is a no-op label ("Force start"), but keeping
                 it visible matches the host's mental model of "I
                 should always be able to press this". */}
            {isHost && readyCount >= 1 && (
              <div className="border-t border-border-strong pt-6 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-widest text-text-muted text-center">
                  Host controls
                </div>
                <div className="flex items-center justify-center">
                  <button
                    type="button"
                    onClick={handleForceStart}
                    disabled={unreadyPlayers.length === 0}
                    className="flex items-center gap-2 px-4 py-2 rounded-md bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-200 border border-yellow-500/50 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={
                      unreadyPlayers.length === 0
                        ? 'Everyone seated is ready — Cockatrice will start the game automatically. Force start is only useful when there are unready players to kick.'
                        : 'Kicks all unready players so Cockatrice auto-starts with whoever is left.'
                    }
                  >
                    <FastForward size={14} />
                    {unreadyPlayers.length === 0
                      ? 'Force start'
                      : forceStartPending
                        ? `Confirm — kick ${unreadyPlayers.length} unready player${unreadyPlayers.length === 1 ? '' : 's'}?`
                        : `Force start (${unreadyPlayers.length} unready)`}
                  </button>
                  {forceStartPending && (
                    <button
                      type="button"
                      onClick={() => setForceStartPending(false)}
                      className="ml-2 text-xs text-text-muted hover:text-text-primary"
                    >
                      cancel
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Persistent chat log — reuses the in-game GameLog component
             so lobby chat, deck-select announcements, and ready-up
             announcements land in the same message list players will
             continue to see once the game starts. */}
        <aside className="hidden md:flex w-80 shrink-0 border-l border-border-strong flex-col bg-bg-base">
          <GameLog />
        </aside>
      </div>
      </GameIdProvider>
    </Layout>
  );
}

function PlayerRow({
  playerName,
  isHost,
  ready,
  hasDeck,
  bracket,
  deckName,
  showKick,
  onKick,
}: {
  playerName: string;
  isHost: boolean;
  ready: boolean;
  hasDeck: boolean;
  /** Commander bracket 1..5 for this player's selected deck when known.
   *  Currently only populated for the local player (Cockatrice's wire
   *  protocol doesn't expose enough for us to know a remote player's
   *  bracket without extra channels). */
  bracket?: number;
  /** Name of the selected deck. Same caveat as `bracket` — only known
   *  for the local player; remote players fall back to the generic
   *  "Deck submitted" text. */
  deckName?: string;
  showKick: boolean;
  onKick: () => void;
}) {
  return (
    <div
      className={[
        'flex items-center gap-4 px-4 py-3 rounded-lg border transition-colors',
        ready
          ? 'bg-emerald-500/5 border-emerald-500/40'
          : 'bg-bg-surface border-border-subtle',
      ].join(' ')}
    >
      <div className="h-11 w-11 rounded-full bg-gradient-to-br from-accent-secondary to-accent flex items-center justify-center">
        <User size={20} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base font-semibold text-text-primary truncate">{playerName}</span>
          {isHost && <Crown size={14} className="text-yellow-400 shrink-0" aria-label="Host" />}
          {ready && (
            <CheckCircle2
              size={18}
              className="text-emerald-400 shrink-0"
              aria-label="Ready"
            />
          )}
        </div>
        <div className="text-xs text-text-muted mt-0.5 truncate flex items-center gap-1.5">
          {ready ? (
            deckName ? (
              <>
                <span>Ready ·</span>
                <span className="text-text-secondary truncate">{deckName}</span>
                {bracket != null && <BracketBadge level={bracket} />}
              </>
            ) : (
              <span>Ready</span>
            )
          ) : hasDeck ? (
            deckName ? (
              <>
                <span className="text-text-secondary truncate">{deckName}</span>
                {bracket != null && <BracketBadge level={bracket} />}
                <span>· waiting to ready</span>
              </>
            ) : (
              <span>Deck submitted · waiting to ready</span>
            )
          ) : (
            <span className="italic">Choosing a deck…</span>
          )}
        </div>
      </div>
      {showKick && (
        <button
          type="button"
          onClick={onKick}
          className="text-xs px-2 py-1 rounded text-text-muted hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/40 transition-colors"
          title="Kick from game"
        >
          Kick
        </button>
      )}
    </div>
  );
}

function isValidCod(xml: string): boolean {
  if (xml.length === 0) return false;
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return false;
  return doc.documentElement?.tagName === 'cockatrice_deck';
}

// Bracket tone palette — mirrors DeckBreakdown's traffic-light coloring
// so a B3 chip in the lobby matches the B3 verdict in the editor.
const BRACKET_TONE: Record<number, string> = {
  1: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/40',
  2: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/40',
  3: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/40',
  4: 'text-red-300 bg-red-500/10 border-red-500/40',
  5: 'text-red-300 bg-red-500/10 border-red-500/40',
};

function BracketBadge({ level }: { level: number }) {
  const tone = BRACKET_TONE[level] ?? 'text-text-secondary bg-bg-elevated border-border-subtle';
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] font-bold tabular-nums shrink-0 ${tone}`}
      title={`Commander Bracket ${level} (from the deck's cached assessment)`}
    >
      B{level}
    </span>
  );
}
