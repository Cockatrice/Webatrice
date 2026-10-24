import { forwardRef, type HTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { Hand, Heart, Skull, Sparkles } from 'lucide-react';
import { ScryfallImageSize } from '@cockatrice/datatrice';
import { CardImage } from '@app/components';
import { getScryfallUrlByIdOrExactName } from '@app/services';

import { useCardPreviewActions } from '../CardPreviewContext';
import { usePlayerSeatContext } from '../PlayerBoard/PlayerSeatContext';
import { useSeatPiles } from './useSeatPiles';
import { INFO_GAP_EM } from '../seatFit';

const PILE_ROW_STYLE = { gap: `${INFO_GAP_EM}em` };
import {
  CARD_BACK_URL,
  CARD_CORNER_RADIUS,
  CARD_HEIGHT,
  CARD_SIDEWAYS_HEIGHT,
  CARD_WIDTH,
} from '../SeatCard/cardSize';
import Card from '../SeatCard/SeatCard';
import { GAME_FOCUS_RING } from '../focusRing';
import { OVER_ART_SHADOW } from '../seatColors/seatColors';

/**
 * Full-size zone box matching the Library footprint but WITHOUT the card back
 * image — for zones like Graveyard and Exile where a face-down card isn't the
 * right metaphor. Icon sits as a subtle watermark; count centered on top.
 *
 * Accepts a ref + onPointerDown so it can serve as both a drag source (grab
 * the top card) and a drop target (hit-testing uses the forwarded ref).
 */
const LargeZoneBox = forwardRef<
  HTMLDivElement,
  {
    icon: typeof Heart;
    label: string;
    count: number;
    /** Top card of the pile — its art fills the box so the zone visually
     *  represents what's on top of the physical pile. Null when empty. */
    topCard?: { name: string; scryfallId: string } | null;
    onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
    /** Wire owner + zone name, applied as `data-arrow-anchor-*` attrs
     *  so the arrow overlay can anchor arrows to the whole pile when
     *  the specific source card element isn't in the DOM (typical for
     *  arrows drawn from a grave / exile card — the card lives inside
     *  a portal-rendered pile-view modal that findCardEl can't reach,
     *  or the modal is closed entirely). See useGameArrowOverlay's
     *  `findCardEl` fallback path. */
    arrowAnchorPlayerId?: number;
    arrowAnchorZone?: string;
    pileProps?: HTMLAttributes<HTMLDivElement>;
      }
      >(function LargeZoneBox(
        {
          icon: Icon,
          label,
          count,
          topCard,
          onPointerDown,
          arrowAnchorPlayerId,
          arrowAnchorZone,
          pileProps,
        },
        ref,
      ) {
        const { t } = useTranslation();
        const draggable = !!onPointerDown;
        const { setHoveredCard } = useCardPreviewActions();
        return (
          <div className="flex w-full justify-center">
            <div
              ref={ref}
              data-pile-count={count}
              data-drag-source
              data-arrow-anchor-owner={
                arrowAnchorPlayerId != null ? String(arrowAnchorPlayerId) : undefined
              }
              data-arrow-anchor-zone={arrowAnchorZone}
              {...pileProps}
              onPointerDown={onPointerDown}
              onMouseEnter={topCard ? () => setHoveredCard(topCard) : undefined}
              className={`relative rounded-md border border-border-subtle bg-bg-base/60 overflow-hidden select-none ${GAME_FOCUS_RING}`}
              style={{
                width: '100%',
                height: CARD_WIDTH,
                cursor: draggable ? 'grab' : undefined,
                touchAction: draggable ? 'none' : undefined,
              }}
              title={
                topCard
                  ? t('ZoneStack.pileWithTop', { zone: label, count, top: topCard.name })
                  : t('ZoneStack.pile', { zone: label, count })
              }
            >
              {topCard && (
                <CardImage
                  // Mirror Card.tsx's fallback: Servatrice's Event_MoveCard
                  // populates `new_card_provider_id` from the server-side card
                  // DB (server_abstract_player.cpp:470,500), which returns
                  // empty for cards not in Servatrice's cards.xml — hitting
                  // `/cards/<empty>` returns 404 → broken image. Fall back to
                  // `/cards/named?exact=<name>` so the graveyard/exile pile
                  // still shows real art when only the name is known.
                  src={getScryfallUrlByIdOrExactName(topCard, ScryfallImageSize.Large)}
                  name={topCard.name}
                  draggable={false}
                  className="pointer-events-none select-none absolute inset-0 h-full w-full object-cover"
                />
              )}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                {!topCard && <Icon size="1.5em" className="text-text-muted shrink-0" />}
                <span
                  className="text-over-art-text font-modern font-bold tabular-nums text-[2.25em] leading-none"
                  style={{ textShadow: OVER_ART_SHADOW }}
                >
                  {count}
                </span>
              </div>
            </div>
          </div>
        );
      });

/**
 * Face-down sideways card representing a zone stack (library, hand, …).
 * Card back image rotated -90°, with a big count centered on top.
 */
const CardBackZone = forwardRef<
  HTMLDivElement,
  {
    label: string;
    count: number;
    onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
    /** When set, the pile renders the given card FACE UP in place of
     *  the card back. Drives the "Always reveal top card" /
     *  "Always look at top card" visualization — Cockatrice's
     *  desktop pile paints the top card face when the corresponding
     *  toggle is on (pile_zone.cpp:47-60). GameBoardCell only
     *  supplies this when the appropriate zone-property flag is
     *  active for the viewer. */
    topCard?: { name: string; scryfallId: string } | null;
    pileProps?: HTMLAttributes<HTMLDivElement>;
      }
      >(function CardBackZone({ label, count, onPointerDown, topCard, pileProps }, ref) {
        const { t } = useTranslation();
        const draggable = !!onPointerDown;
        return (
          <div className="flex w-full justify-center">
            <div
              ref={ref}
              data-pile-count={count}
              data-drag-source
              {...pileProps}
              onPointerDown={onPointerDown}
              className={`relative rounded-md overflow-hidden border border-border-strong shadow-inner select-none ${GAME_FOCUS_RING}`}
              style={{
                width: '100%',
                height: CARD_SIDEWAYS_HEIGHT,
                cursor: draggable ? 'grab' : undefined,
                touchAction: draggable ? 'none' : undefined,
              }}
              title={topCard
                ? t('ZoneStack.pileWithTop', { zone: label, count, top: topCard.name })
                : t('ZoneStack.pile', { zone: label, count })}
            >
              {topCard ? (
              // Face-up top card via the shared Card renderer (which reads
              // scryfallId / name → art URL). Rotated -90° to match the
              // sideways-pile layout of the card back below. Deliberately
              // NOT pointer-events-none — Card's onMouseEnter needs to
              // fire so the right-rail preview picks up the hovered face.
              // Pile-drag pointerdown still bubbles up to the parent
              // container's handler.
                <div
                  className="select-none absolute top-1/2 left-1/2"
                  style={{
                    width: CARD_WIDTH,
                    height: CARD_HEIGHT,
                    transform: 'translate(-50%, -50%) rotate(-90deg)',
                  }}
                >
                  <Card name={topCard.name} scryfallId={topCard.scryfallId} />
                </div>
              ) : (
                <img
                  src={CARD_BACK_URL}
                  alt=""
                  draggable={false}
                  className="pointer-events-none select-none absolute top-1/2 left-1/2"
                  style={{
                    width: CARD_WIDTH,
                    height: CARD_HEIGHT,
                    // ~7.5% of the card width matches the real MTG corner curve and
                    // hides the white JPG background showing through the rounded card
                    // corners without eating into meaningful art.
                    borderRadius: CARD_CORNER_RADIUS,
                    transform: 'translate(-50%, -50%) rotate(-90deg)',
                  }}
                />
              )}
              {/* Dimming overlay sits behind the count number so the big
            white digits stay readable against the busy card-back art.
            Skipped when a top card is showing — Cockatrice desktop
            renders that face fully un-dimmed, matching the visual
            expectation of a face-up card. */}
              {!topCard && (
                <div className="absolute inset-0 bg-over-art-backdrop/20 pointer-events-none" aria-hidden />
              )}
              <div
                className={[
                  'absolute inset-0 flex items-center justify-center text-over-art-text',
                  'font-modern font-bold tabular-nums text-[3em] pointer-events-none',
                ].join(' ')}
                style={{ textShadow: OVER_ART_SHADOW }}
              >
                {count}
              </div>
            </div>
          </div>
        );
      }
      );

const HAND_FAN = [-12, 0, 12] as const;
const HAND_TILE_STYLE = { minHeight: CARD_WIDTH, maxHeight: `calc(${CARD_HEIGHT} * 1.6)` };

function HandTile() {
  const { t } = useTranslation();
  const { handCount } = usePlayerSeatContext();
  const label = t('ZoneStack.hand', { count: handCount });
  const backs = HAND_FAN.slice(0, Math.min(HAND_FAN.length, handCount));
  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      data-hand-tile
      className="relative flex w-full flex-1 items-center overflow-hidden rounded-md border border-accent/60 bg-accent-soft select-none"
      style={HAND_TILE_STYLE}
    >
      <span aria-hidden className="relative h-full flex-1">
        {backs.map((angle, i) => (
          <img
            key={angle}
            src={CARD_BACK_URL}
            alt=""
            draggable={false}
            className="pointer-events-none absolute top-1/2 shadow-md"
            style={{
              height: '78%',
              aspectRatio: '72 / 102',
              left: `${18 + i * 14}%`,
              borderRadius: CARD_CORNER_RADIUS,
              transform: `translate(-50%, -50%) rotate(${angle}deg)`,
            }}
          />
        ))}
      </span>
      <span aria-hidden className="flex flex-col items-center px-[0.6em]">
        <Hand size="1.1em" className="text-accent" />
        <span className="font-modern text-[2.6em] font-bold leading-none tabular-nums text-text-primary">{handCount}</span>
      </span>
    </div>
  );
}

export default function ZoneStack() {
  const { playerId, handPlacement } = usePlayerSeatContext();
  const { library, graveyard, exile } = useSeatPiles();

  return (
    <>
      <HandTile />
      {handPlacement !== 'tray' && <SeatPiles playerId={playerId} library={library} graveyard={graveyard} exile={exile} />}
    </>
  );
}

function SeatPiles({ playerId, library, graveyard, exile }: { playerId: number } & ReturnType<typeof useSeatPiles>) {
  return (
    <>
      <div>
        <CardBackZone
          ref={library.ref}
          label={library.zoneLabel}
          count={library.count}
          pileProps={library.pileProps}
          topCard={library.topCard}
          onPointerDown={library.onPointerDown}
        />
        {library.popup}
      </div>
      <div className="grid grid-cols-2" style={PILE_ROW_STYLE}>
        <div className="min-w-0">
          <LargeZoneBox
            ref={graveyard.ref}
            icon={Skull}
            label={graveyard.zoneLabel}
            count={graveyard.count}
            topCard={graveyard.topCard}
            arrowAnchorPlayerId={playerId}
            arrowAnchorZone={graveyard.arrowAnchorZone}
            pileProps={graveyard.pileProps}
            onPointerDown={graveyard.onPointerDown}
          />
          {graveyard.popup}
        </div>
        <div className="min-w-0">
          <LargeZoneBox
            ref={exile.ref}
            icon={Sparkles}
            label={exile.zoneLabel}
            count={exile.count}
            topCard={exile.topCard}
            arrowAnchorPlayerId={playerId}
            arrowAnchorZone={exile.arrowAnchorZone}
            pileProps={exile.pileProps}
            onPointerDown={exile.onPointerDown}
          />
          {exile.popup}
        </div>
      </div>
    </>
  );
}
