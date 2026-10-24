import { useId } from 'react';
import { useForkRef } from '@mui/material/utils';
import { useTranslation } from 'react-i18next';
import { ZoneName } from '@cockatrice/sockatrice';
import { useAnimationPreference, useSnapGridVisible } from '@app/hooks';

import ContextMenu from '../../context-menus/ContextMenu/ContextMenu';
import { PlaymatArt, usePlayerPlaymat } from '../../PlayerPlaymat';
import { usePlayerSeatContext } from '../../ui/PlayerBoard/PlayerSeatContext';
import type { BattlefieldCardViewModel } from '../../ui/PlayerBoard/playerBoard.types';
import { useSeatCardFocus } from '../../ui/PlayerBoard/useSeatCardFocus';
import { cardLabel } from '../../ui/SeatCard/cardLabel';
import { GAME_FOCUS_RING } from '../../ui/focusRing';
import { CARD_CORNER_RADIUS, CARD_HEIGHT, CARD_WIDTH } from '../../ui/SeatCard/cardSize';
import Card from '../../ui/SeatCard/SeatCard';
import { SEAT_DROP_PRIORITY } from '../../../hooks/seatDropPlan';
import { useHorizontalWheelScroll } from '../../../hooks/useHorizontalWheelScroll';
import { SeatDropPreview, useSeatDropZone } from '../../ui/SeatDragContext';
import { usePublishBattlefieldGeometry } from '../../ui/BattlefieldGeometryContext';
import { useValueFlash } from '../../ui/ValueFlash/useValueFlash';
import ZoneBackground from '../../ui/ZoneBackground/ZoneBackground';
import ValueFlashOverlay from '../../ui/ValueFlash/ValueFlashOverlay';
import { useJustRewound } from '../../ui/ReplayRewindContext';
import {
  BATTLEFIELD_ROWS,
  computeCellWidths,
  rowTopY,
  slotOriginPx,
  snapPxToSlot,
  type BattlefieldLayoutOpts,
} from './battlefieldLayout';
import { useBattlefieldLayout } from './useBattlefieldLayout';
import { ATTACH_SOURCE_RING, DOESNT_UNTAP_RING, SELECTED_DOESNT_UNTAP_RING, SELECTED_RING } from '../../ui/seatColors/seatColors';

/**
 * Non-interactive overlay: dashed outline at every snap slot + the divider
 * marking the lands row. Grid is measured by the parent so slot outlines
 * line up exactly with cards rendered in the same layer.
 *
 * When `mirrored`, the vertical layout is flipped so top-row players (as
 * seen from the viewer sitting at the bottom) render "facing" the viewer:
 * their state row 0 sits at the visual bottom, their lands row (max row)
 * sits at the visual top near their hand.
 */
function BattlefieldSlotOverlay({
  cellWidths,
  colsByRow,
  layout,
  mirrored,
  highlightedSlot,
}: {
  cellWidths: ReturnType<typeof computeCellWidths>;
  /** Per-row column count (inclusive) to render outlines for. Rows with
   *  fewer occupied columns still fill up to the min-cols count so an
   *  empty battlefield shows a dashed grid of drop targets. */
  colsByRow: readonly number[];
  layout: BattlefieldLayoutOpts;
  mirrored: boolean;
  /** Slot the current drag would snap to on this battlefield (display
   *  coord — post-mirror). When set, that specific cell paints an
   *  accent-tinted background as a drop-preview cue. `null` = no drop
   *  landing here right now (either no active drag, or the drag is
   *  aimed at a different zone / player's board). */
  highlightedSlot?: { row: number; col: number } | null;
}) {
  // Global toggle from the header — off by default (matches the "no
  // noisy grid" default) but the user can flip it on to see snap slots
  // when eyeballing layout.
  const showBorders = useSnapGridVisible();
  const rows = layout.rows ?? BATTLEFIELD_ROWS;
  const slots: { row: number; col: number }[] = [];
  for (let row = 0; row < rows; row++) {
    const cols = colsByRow[row];
    for (let col = 0; col < cols; col++) {
      slots.push({ row, col });
    }
  }
  return (
    <div className="absolute inset-0 pointer-events-none">
      {slots.map((slot) => {
        // Matches Cockatrice desktop's default (invertVerticalCoordinate
        // stays false). Wire y=0 (CREATURES per `oracleimporter.cpp` +
        // `tableRowToGridY`) renders at container top for the owner
        // (facing the opponent), y=2 (LANDS) at container bottom near
        // the owner's hand. Opponent boards flip via `mirrored` so
        // their creatures still face our creatures at center and their
        // lands sit near their own hand at the top of the screen.
        const displayRow = mirrored ? rows - 1 - slot.row : slot.row;
        const { x, y } = slotOriginPx(
          { row: displayRow, col: slot.col, subSlot: 0 },
          cellWidths,
          layout,
        );
        // Highlight comparison happens in DISPLAY coord (both slot.row
        // pre-mirror and highlightedSlot.row post-mirror sit in display
        // space here, since we render at displayRow above).
        const isHighlighted =
          highlightedSlot != null &&
          highlightedSlot.row === displayRow &&
          highlightedSlot.col === slot.col;
        return (
          <div
            key={`${slot.row}-${slot.col}`}
            data-drop-preview={isHighlighted || undefined}
            // Dashed border toggled by the header "Snap grid" button
            // (useSnapGridVisible). Off by default; on = dashed outline
            // at every snap position so the user can eyeball layout.
            // Highlighted slot always shows — accent background so the
            // user sees where their dragged card will land.
            className={[
              'absolute',
              showBorders && !isHighlighted && 'border border-dashed border-border-strong/40',
              isHighlighted && 'bg-accent/25 ring-2 ring-accent/60 ring-inset',
            ].filter(Boolean).join(' ')}
            style={{
              width: `${layout.cardWidthPx}px`,
              height: `${layout.cardHeightPx}px`,
              left: `${x}px`,
              top: `${y}px`,
              borderRadius: CARD_CORNER_RADIUS,
            }}
          />
        );
      })}
    </div>
  );
}

export default function Battlefield() {
  const { t } = useTranslation();
  const {
    attachExtraSourceIds,
    attachPending,
    attachPicking,
    battlefieldDisplayList,
    battlefieldMenuItems,
    cardMetaByName,
    handOnTop,
    isDragging,
    isSelf,
    lifeControl,
    menuOwnerId,
    name,
    onCardDoubleClick,
    openSeatCardMenu,
    opponentBattlefieldMenuItems,
    playerId,
    resolveFaceImageUri,
    seatGrid,
    seatId,
    selection,
    startSeatCardDrag,
  } = usePlayerSeatContext();
  const keysHintId = useId();
  const playmat = usePlayerPlaymat(playerId, isSelf);
  const justRewound = useJustRewound();
  const tapAnimation = useAnimationPreference('tapAnimation') && !justRewound;
  const damageFlash = useValueFlash(lifeControl?.value, useAnimationPreference('battlefieldFlash'), { only: 'loss' });

  const {
    battlefieldLayout,
    BATTLEFIELD_ROW_PADDING_PX,
    scrollContainerRef,
    battlefieldRef,
    cellWidths,
    colsByRow,
    colsByWireRow,
    naturalContentW,
    naturalContentH,
    gridRows,
    gridCols,
    battlefieldPositions,
  } = useBattlefieldLayout({ cards: battlefieldDisplayList, playerId, mirrored: handOnTop });
  usePublishBattlefieldGeometry(seatId, {
    rows: gridRows,
    cols: gridCols,
    colsByWireRow,
  });

  const battlefieldDropRef = useSeatDropZone(`seat-${seatId}-battlefield`, {
    seatPlayerId: seatId,
    acceptsOtherSeats: true,
    priority: SEAT_DROP_PRIORITY.battlefield,
    resolve: ({ cardOrigin }) => {
      const content = battlefieldRef.current;
      if (!content) {
        return null;
      }
      const rect = content.getBoundingClientRect();
      const snap = snapPxToSlot(cardOrigin.x - rect.left, cardOrigin.y - rect.top, cellWidths, battlefieldLayout);
      return {
        zone: 'battlefield',
        playerId: seatId,
        slot: { row: handOnTop ? BATTLEFIELD_ROWS - 1 - snap.row : snap.row, col: snap.col },
        grid: { rows: gridRows, cols: gridCols },
      };
    },
  });
  const battlefieldScrollRef = useForkRef(scrollContainerRef, battlefieldDropRef);

  const shownPT = (c: BattlefieldCardViewModel) => c.pt || (c.faceDown ? undefined : cardMetaByName.get(c.name)?.pt);
  const isAttached = (c: BattlefieldCardViewModel) => c.attachTargetCardId != null && c.attachTargetCardId >= 0;
  const lines = (() => {
    const byRow: BattlefieldCardViewModel[][] = Array.from({ length: BATTLEFIELD_ROWS }, () => []);
    for (const c of battlefieldDisplayList) {
      const parent = isAttached(c) && c.attachTargetPlayerId === playerId
        ? battlefieldDisplayList.find((p) => p.id === String(c.attachTargetCardId) && !isAttached(p))
        : undefined;
      const wireRow = (parent ?? c).slot.row;
      byRow[handOnTop ? BATTLEFIELD_ROWS - 1 - wireRow : wireRow]?.push(c);
    }
    const x = (c: BattlefieldCardViewModel) => battlefieldPositions.get(c.id)?.x ?? 0;
    return byRow.map((row) => row.sort((a, b) => x(a) - x(b)).map((c) => c.id));
  })();
  const { cardProps } = useSeatCardFocus('battlefield', {
    cards: battlefieldDisplayList,
    orientation: 'horizontal',
    lines,
    ownerOf: (c) => c.ownerPlayerId ?? playerId,
    labelOf: (c) => cardLabel(t, {
      name: c.name,
      id: c.id,
      faceDown: c.faceDown,
      tapped: c.tapped,
      doesntUntap: c.doesntUntap,
      attached: isAttached(c),
      pt: shownPT(c),
      counters: c.counters,
      annotation: c.annotation,
    }),
    previewOf: (c) => (c.faceDown
      ? null
      : {
        name: c.name,
        scryfallId: c.scryfallId || cardMetaByName.get(c.name)?.scryfallId,
        imageUri: resolveFaceImageUri(c.name),
        pt: shownPT(c),
        annotation: c.annotation,
      }),
  });
  useHorizontalWheelScroll(scrollContainerRef);

  return (
    <ContextMenu
      items={isSelf ? battlefieldMenuItems : opponentBattlefieldMenuItems}
      label={t('PlayerBoard.playerMenu', { name })}
      wrapperClassName="min-h-0 relative isolate"
      wrapperStyle={seatGrid.battlefield}
    >
      {playmat ? <PlaymatArt art={playmat} testId="player-playmat" /> : <ZoneBackground zone="table" />}
      <ValueFlashOverlay flash={damageFlash} kind="damage" />
      {/* Lands divider — spans the full width of the play area,
        ignoring the padding around the scrollable battlefield content
        so it reads as a continuous horizontal line across the box.
        Sits in the gap ABOVE the lands row (visual bottom for self,
        visual top for mirrored opponent boards). */}
      {BATTLEFIELD_ROWS >= 2 &&
      (() => {
        // The lands row is the visual row nearest the OWNER's hand.
        // Webatrice's wire y semantics (see playCard.ts) put creatures
        // at wireY=0 and lands at wireY=2, so:
        //   • self (handOnTop=false): lands render at bottom (row 2)
        //   • opponent (handOnTop=true, mirrored): lands render at top
        //     (visual row 0, since mirroring flips wireY=2 → row 0)
        // Draw the divider in the row-gap ABOVE (self) or BELOW
        // (opponent) the lands row.
        const dividerAboveRow = handOnTop ? 1 : 2;
        const dividerY =
          rowTopY(dividerAboveRow, battlefieldLayout) -
          BATTLEFIELD_ROW_PADDING_PX / 2;
        return (
          <div
            className="absolute left-0 right-0 border-t border-border-strong/60 pointer-events-none"
            style={{ top: `${dividerY}px` }}
          />
        );
      })()}
      <div
        ref={battlefieldScrollRef}
        data-battlefield-owner={String(playerId)}
        role="listbox"
        aria-multiselectable
        aria-label={t('PlayerBoard.battlefield', { name, count: battlefieldDisplayList.length })}
        aria-describedby={keysHintId}
        data-battlefield-mirrored={handOnTop ? 'true' : 'false'}
        // Cockatrice-style layout: the outer scroll container has no
        // padding. Left/right/top margins are already baked into the
        // content div's card + slot positions via BATTLEFIELD_MARGIN_*
        // constants in the layout helpers, so adding container padding
        // would double up the inset and shrink the visible column
        // count for no visual gain.
        // Not a tab stop: Firefox would otherwise put the scroller in the
        // tab order, where Tab is the board's Next Phase and focus could
        // never leave. A click still focuses it, so "click the table,
        // press Tab" keeps desktop's binding.
        tabIndex={-1}
        className="absolute inset-0 overflow-auto box-border"
      >
        <div
          ref={battlefieldRef}
          data-battlefield-content
          // Cross-battlefield snap reads this to reconstruct per-column
          // widths when a card is dragged over another player's board.
          // JSON.stringify on a Map returns [], so materialize entries
          // first. Cheap even for a few hundred cards.
          data-cell-widths={JSON.stringify(Array.from(cellWidths.entries()))}
          className="relative"
          // Absolute-positioned children (cards + slot outlines) sit at
          // pixel coordinates computed from cellWidths + rowTopY. The
          // content div's own size is set to the sum of per-column
          // widths + margins (Cockatrice-style): if the natural size is
          // smaller than the container, empty space appears on the right
          // (no more spread-to-fit); if larger, the container scrolls.
          // `zIndex: 0` forces a stacking context so card z-indexes
          // (`y*100 + x`, easily in the tens of thousands) are confined
          // to this scope rather than leaking into the parent stacking
          // context and outranking the hand wrapper's z-30. Without
          // this, hovered hand cards slid up into the play area but
          // painted BEHIND battlefield cards.
          style={{
            width: `${naturalContentW}px`,
            height: `${naturalContentH}px`,
            zIndex: 0,
          }}
        >
          <SeatDropPreview dropId={`seat-${seatId}-battlefield`}>
            {(target) => (
              <BattlefieldSlotOverlay
                cellWidths={cellWidths}
                colsByRow={colsByRow}
                layout={battlefieldLayout}
                mirrored={handOnTop}
                highlightedSlot={
                  target?.zone === 'battlefield'
                    ? {
                      row: handOnTop ? BATTLEFIELD_ROWS - 1 - target.slot.row : target.slot.row,
                      col: target.slot.col,
                    }
                    : null
                }
              />
            )}
          </SeatDropPreview>
          {(() => {
            // Group cards by slot for insertion-order stacking. For
            // server-authoritative cards `subSlot` carries the true
            // stack index (from `wire_x % 3`); for the drop-to-ack
            // window we fall back to the group's insertion index so
            // multiple optimistic drops on the same slot don't overlap.
            const groups = new Map<string, string[]>();
            for (const c of battlefieldDisplayList) {
              const key = `${c.slot.row},${c.slot.col}`;
              const list = groups.get(key) ?? [];
              list.push(c.id);
              groups.set(key, list);
            }
            return battlefieldDisplayList.map((c) => {
              // Position resolved from the shared `battlefieldPositions`
              // map above: parents get shifted to accommodate children,
              // attached children fan diagonally under their parent, and
              // free cards fall back to slotOriginPx. See the
              // battlefieldPositions builder for the full algorithm.
              const origin = battlefieldPositions.get(c.id) ?? {
                x: 0,
                y: 0,
              };
              const dragging = isDragging(c.id, 'battlefield');
              const selected =
            selection?.zone === 'battlefield' && selection.ids.has(c.id);
              // Attach source ring — green while pending so the user
              // can see which cards they're about to attach. Primary
              // source drives the pending arrow anchor; extras (from a
              // multi-selection attach) get the ring too.
              const cardIdNum = Number(c.id);
              const isAttachSource =
            attachPending != null &&
            (cardIdNum === attachPending.sourceCardId ||
              attachExtraSourceIds.includes(cardIdNum));
              return (
                <div
                  key={c.id}
                  {...cardProps(c)}
                  data-card
                  data-zone="battlefield"
                  data-card-id={c.id}
                  data-slot-col={c.slot.col}
                  data-selected={selected || undefined}
                  // Arrow interaction: the useGameArrowInteractions hook
                  // hit-tests via `data-card-owner` + `data-card-zone`
                  // during right-click-drag, and the GameArrowOverlay
                  // resolves committed arrow endpoints against the same
                  // attributes. Zone value is the Cockatrice wire name
                  // (`ZoneName.TABLE`) so the DOM lookup matches the
                  // server's start/target_zone strings.
                  data-card-owner={c.ownerPlayerId ?? playerId}
                  data-card-zone={ZoneName.TABLE}
                  // Hover uses an arbitrary z far above the position-
                  // derived base so a mid-battlefield hover always pops
                  // to the top regardless of Y stacking.
                  className={`absolute hover:z-[10000] focus-visible:z-[10000] ${GAME_FOCUS_RING}`}
                  onPointerDown={(e) =>
                  // Pass the FULL BattlefieldCard object (not a
                  // stripped `{id, name, scryfallId}` projection):
                  // the drag ghost casts `drag.cards` back to
                  // BattlefieldCard to render annotation / PT /
                  // counters / faceDown / tapped rotation. Since
                  // BattlefieldCard extends HandCard structurally,
                  // this widens cleanly at the call site.
                    startSeatCardDrag(e, c, 'battlefield', battlefieldDisplayList)
                  }
                  onContextMenu={
                    c
                      ? (e) => {
                        e.preventDefault();
                        // Stop the event from bubbling up to the
                        // battlefield's ContextMenu wrapper — otherwise
                        // right-clicking a card opens both the card menu
                        // AND the player menu at the same position.
                        // Also opens for opponent cards; the menu render
                        // below branches on isSelf between the full owner
                        // menu and Cockatrice's minimal opponent menu
                        // (Draw arrow / Clone / Select / Reduce life by
                        // power / View related cards — card_menu.cpp:183).
                        e.stopPropagation();
                        openSeatCardMenu({
                          kind: 'battlefield',
                          playerId: menuOwnerId,
                          cardId: c.id,
                          x: e.clientX,
                          y: e.clientY,
                        });
                      }
                      : undefined
                  }
                  onDoubleClick={(e) => onCardDoubleClick('battlefield', c, e)}
                  style={{
                    width: CARD_WIDTH,
                    height: CARD_HEIGHT,
                    left: `${origin.x}px`,
                    top: `${origin.y}px`,
                    // Position-derived stacking: higher-Y cards render on
                    // top. This is what makes attached parents (y = base+15)
                    // sit visually ABOVE their children (y = base+5) — the
                    // parent's full art shows, children peek out from the
                    // fan. Ports Cockatrice's `ZValues::tableCardZValue`
                    // formula from z_values.h:72-75; without it, DOM order
                    // decides and children played after the parent stomp on
                    // top of it.
                    zIndex: Math.round(origin.y * 100) + Math.round(origin.x),
                    touchAction: isSelf ? 'none' : undefined,
                    cursor: attachPicking
                      ? 'crosshair'
                      : isSelf
                        ? 'grab'
                        : 'default',
                    opacity: dragging ? 0 : 1,
                    // Ring priority (outer overrides inner visually):
                    //   • attach source → green (Cockatrice's arrow color)
                    //   • marquee-selected → blue
                    //   • doesntUntap → amber
                    // (the seat tokens; see seatColors)
                    // When multiple apply they layer, but attach-source
                    // takes visual precedence since it's the ephemeral
                    // "you're mid-flow" cue.
                    boxShadow: isAttachSource
                      ? ATTACH_SOURCE_RING
                      : selected
                        ? c.doesntUntap
                          ? SELECTED_DOESNT_UNTAP_RING
                          : SELECTED_RING
                        : c.doesntUntap
                          ? DOESNT_UNTAP_RING
                          : undefined,
                    borderRadius: CARD_CORNER_RADIUS,
                    // Tapped cards rotate 90° clockwise in place.
                    // transform-origin: center keeps the pivot at the
                    // card's midpoint so it doesn't drift off its slot.
                    transform: c.tapped ? 'rotate(90deg)' : undefined,
                    transformOrigin: 'center',
                    transition: tapAnimation ? 'transform 150ms ease-out' : undefined,
                  }}
                >
                  <Card
                    name={c.name}
                    scryfallId={
                      c.scryfallId
                    || cardMetaByName.get(c.name)?.scryfallId
                    }
                    id={c.id}
                    faceDown={c.faceDown}
                    // Prefer the server's `pt` (initial value from
                    // `playCard` or an `AttrPT` change); fall back to
                    // the prefetched base P/T from the Scryfall
                    // lookup cache so untouched creatures still
                    // show their printed stats. Face-down cards keep
                    // whatever PT the server has recorded so a manifested
                    // creature's stats stay readable (Cockatrice does
                    // the same).
                    pt={shownPT(c)}
                    basePT={cardMetaByName.get(c.name)?.pt}
                    annotation={c.annotation}
                    counters={c.counters}
                    imageUri={resolveFaceImageUri(c.name)}
                  />
                </div>
              );
            });
          })()}
        </div>
        <span id={keysHintId} hidden>{t('PlayerBoard.cardKeys')}</span>
      </div>
    </ContextMenu>
  );
}
