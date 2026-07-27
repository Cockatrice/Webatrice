import { Flag, Layers, LogOut } from 'lucide-react';

import { useLeaveGame } from '@app/hooks';

import PlayerList from '../right-sidebar/PlayerList/PlayerList';
import ChatLog from '../ChatLog/ChatLog';
import { useGameId } from '../ui/GameIdContext';
import { useGameDialogActions } from '../ui/GameDialogActionsContext';
import { useLocalIdentity } from '../../hooks/useLocalIdentity';
import { useGameAffordances } from '../../hooks/useGameAffordances';
import { useHoveredCard } from '../PlayerBox/hoveredCard';
import { CARD_CORNER_RADIUS } from '../PlayerBox/cardSize';

/**
 * Right-rail companion for the battlefield. Four stacked sections,
 * top-down:
 *   1. Card preview  — the last card the viewer hovered over
 *   2. Player list   — every seat, active/host/ping badges, plus a
 *                      Leave button in the section header
 *   3. Chat & log    — the shared ChatLog component (same one the
 *                      pre-game lobby renders)
 *
 * Card preview reads from the same `HoveredCardProvider` the PlayerBox
 * card components write to on mouse-enter, so hovering any card
 * anywhere in the play area updates the preview here. Ported inline
 * from fancy webatrice's BattlefieldSidebar — same 5 : 7 aspect image
 * and dashed placeholder.
 *
 * Spectator affordance stays: when the viewer joined as a spectator,
 * a small pill above the card preview flags the mode explicitly.
 */
export default function BattlefieldSidebar() {
  const gameId = useGameId();
  const leaveGame = useLeaveGame();
  const { isSpectator } = useLocalIdentity();
  const { hoveredCard } = useHoveredCard();
  const {
    onRequestConcede,
    onRequestUnconcede,
    onRequestViewSideboard,
  } = useGameDialogActions();
  const { canConcede, canUnconcede } = useGameAffordances(gameId ?? undefined);

  const handleLeave = () => {
    if (gameId != null) leaveGame(gameId);
  };

  // Fancy's exact URL pattern — prefer the exact printing by id,
  // fall back to the named endpoint. `png` is heavier than `large`
  // but the preview panel is big enough to warrant the higher fidelity.
  const hoveredImageUrl = hoveredCard
    ? hoveredCard.scryfallId
      ? `https://api.scryfall.com/cards/${hoveredCard.scryfallId}?format=image&version=png`
      : `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(hoveredCard.name)}&format=image&version=png`
    : null;

  return (
    <aside
      data-testid="right-panel"
      className="w-72 shrink-0 border-l border-border-subtle bg-bg-surface flex flex-col min-h-0 overflow-hidden"
    >
      {isSpectator && (
        <div
          data-testid="spectating-tag"
          className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-yellow-300 bg-yellow-500/10 border-b border-yellow-500/30 text-center"
        >
          Spectating
        </div>
      )}

      {/* Card preview — 5 : 7 aspect image when a card is hovered,
           otherwise a dashed placeholder frame. Reads the hover state
           from PlayerBox's HoveredCardProvider so any card on the
           board (hand / battlefield / library / graveyard / etc.)
           lights up the preview when its mouse-enter fires. */}
      <div className="shrink-0 p-3 border-b border-border-subtle">
        {hoveredImageUrl ? (
          <img
            src={hoveredImageUrl}
            alt={hoveredCard?.name ?? ''}
            draggable={false}
            className="w-full shadow-md"
            style={{
              aspectRatio: '5 / 7',
              borderRadius: CARD_CORNER_RADIUS,
              imageRendering: '-webkit-optimize-contrast',
            }}
          />
        ) : (
          <div
            className="aspect-[5/7] rounded-md border border-dashed border-border-subtle bg-bg-base/30 flex items-center justify-center text-xs text-text-muted italic p-3 text-center"
            style={{ borderRadius: CARD_CORNER_RADIUS }}
          >
            Hover a card to preview it here
          </div>
        )}
      </div>

      {/* Player list — og's PlayerList inside a section header row
           that carries the Leave button (fancy's pattern). */}
      <div className="shrink-0 border-b border-border-subtle">
        <div className="px-3 py-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            Players
          </span>
          <button
            type="button"
            onClick={handleLeave}
            disabled={gameId == null}
            title="Leave the game"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-text-primary bg-bg-elevated hover:bg-border-subtle border border-border-subtle disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            <LogOut size={12} /> Leave
          </button>
        </div>
        <PlayerList />
      </div>

      {/* Action-buttons row — sits between the player list and the
           chat & log so only the chat section (the flex-1 slot) gives
           up space when this row grows. Starts as just Concede /
           Rejoin; future buttons (Roll die, Game info, etc.) land
           here rather than being tucked into other panels. `shrink-0`
           keeps the row at its natural height regardless of
           available viewport. Hidden entirely for spectators and
           pre-game states where none of the buttons apply, so we
           don't reserve blank space for nothing. */}
      {(canConcede || canUnconcede) && (
        <div className="shrink-0 border-b border-border-subtle px-3 py-2 flex items-center gap-2">
          {canConcede && (
            <button
              type="button"
              onClick={onRequestConcede}
              title="Concede this game"
              // Same visual as the Leave button above — matching the
              // rest of this button row keeps the sidebar reading as
              // one consistent affordance strip. flex-1 makes it (and
              // any future sibling in this row) share the available
              // width evenly.
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-text-primary bg-bg-elevated hover:bg-border-subtle border border-border-subtle transition-colors"
            >
              <Flag size={12} /> Concede
            </button>
          )}
          {canUnconcede && (
            <button
              type="button"
              onClick={onRequestUnconcede}
              title="Rejoin the game"
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-text-primary bg-bg-elevated hover:bg-border-subtle border border-border-subtle transition-colors"
            >
              <Flag size={12} /> Rejoin
            </button>
          )}
          <button
            type="button"
            onClick={onRequestViewSideboard}
            title="Open sideboard"
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-text-primary bg-bg-elevated hover:bg-border-subtle border border-border-subtle transition-colors"
          >
            <Layers size={12} /> Sideboard
          </button>
        </div>
      )}

      {/* Chat & log — the shared ChatLog gets the remaining flex-1
           height. Its own component owns the header + timer + input,
           so the sidebar just gives it a slot. No padding here — the
           chat log flows edge-to-edge into the sidebar like fancy. */}
      <div className="flex-1 min-h-0 flex flex-col">
        <ChatLog />
      </div>
    </aside>
  );
}
