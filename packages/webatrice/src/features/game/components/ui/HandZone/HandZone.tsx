import { useEffect, useId, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { useForkRef } from '@mui/material/utils';
import { Hand } from 'lucide-react';
import { Menu, isContextMenuKey, type MenuAnchor } from '@app/components';
import { usePreference } from '@app/hooks';

import ContextMenuEntries from '../../context-menus/ContextMenu/ContextMenuEntries';
import { usePlayerSeatContext } from '../PlayerBoard/PlayerSeatContext';
import { useHorizontalWheelScroll } from '../../../hooks/useHorizontalWheelScroll';
import { useSeatCardFocus } from '../PlayerBoard/useSeatCardFocus';
import { cardLabel } from '../SeatCard/cardLabel';
import { CARD_BACK_URL, CARD_CORNER_RADIUS, CARD_HEIGHT, CARD_WIDTH } from '../SeatCard/cardSize';
import type { PlayerCardViewModel } from '../PlayerBoard/playerBoard.types';
import HandCardTile from './HandCardTile';
import { layoutVerticalPile, type VerticalPileOptions } from '../VerticalPile/verticalPile';
import ZoneBackground from '../ZoneBackground/ZoneBackground';
import { GAME_FOCUS_RING } from '../focusRing';
import { OVER_ART_SHADOW_SMALL } from '../seatColors/seatColors';

export default function HandZone() {
  const {
    CARD_H_PX,
    CARD_W_PX,
    cardMetaByName,
    flipHandCardBacks,
    handCount,
    handDisplayList,
    handMenuItems,
    handOnTop,
    handPileOptions,
    handRef,
    handSize,
    handZoneRef,
    horizontalHand,
    isDragging,
    isSelf,
    menuOwnerId,
    name,
    onCardDoubleClick,
    openSeatCardMenu,
    playerId,
    seatGrid,
    selection,
    startSeatCardDrag,
  } = usePlayerSeatContext();
  const keysHintId = useId();
  useHorizontalWheelScroll(handRef);
  const { t } = useTranslation();
  const [handMenuAnchor, setHandMenuAnchor] = useState<MenuAnchor | null>(null);
  const handButtonRef = useRef<HTMLButtonElement>(null);
  const openHandMenuBelow = (button: HTMLElement) =>
    setHandMenuAnchor({ rect: button.getBoundingClientRect(), placement: 'below' });
  const handButtonLabel = t('HandZone.button', { count: handSize });
  const handLabel = t('PlayerBoard.hand', { name, count: handSize });
  const leftJustified = usePreference('leftJustifiedHand');
  // Whether the hand row is being hovered — controls the auto-expand
  // that reveals full-size cards over the play area without reflowing
  // the shell (same pattern the PhaseTrack uses on the left edge).
  const [handExpanded, setHandExpanded] = useState(false);
  // Tracks whether the hand's slide tween is mid-flight. Combined with
  // `handExpanded` to keep the outer wrapper's `overflow-visible` on
  // until the return-to-idle animation actually finishes — otherwise
  // the wrapper clips its own cards mid-slide when hover ends.
  const [handAnimating, setHandAnimating] = useState(false);

  const [handFocused, setHandFocused] = useState(false);
  const { cardProps } = useSeatCardFocus('hand', {
    cards: isSelf ? handDisplayList : [],
    orientation: horizontalHand ? 'horizontal' : 'vertical',
    labelOf: (c) => cardLabel(t, { name: c.name }),
    previewOf: (c) => ({ name: c.name, scryfallId: c.scryfallId || cardMetaByName.get(c.name)?.scryfallId }),
    onKeyboardFocus: setHandFocused,
  });

  const renderOwnCard = (c: PlayerCardViewModel) => (
    <HandCardTile
      key={c.id}
      card={c}
      ownerId={playerId}
      scryfallId={c.scryfallId || cardMetaByName.get(c.name)?.scryfallId}
      pt={cardMetaByName.get(c.name)?.pt}
      dragging={isDragging(c.id, 'hand')}
      selected={selection?.zone === 'hand' && selection.ids.has(c.id)}
      focusProps={cardProps(c)}
      onPointerDown={(e) => startSeatCardDrag(e, c, 'hand', handDisplayList)}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openSeatCardMenu({ kind: 'hand', playerId: menuOwnerId, cardId: c.id, x: e.clientX, y: e.clientY });
      }}
      onDoubleClick={(e) => onCardDoubleClick('hand', c, e)}
    />
  );

  const countBadge = isSelf ? (
    <>
      <button
        ref={handButtonRef}
        type="button"
        className={
          'absolute top-1 left-1 z-40 flex items-center justify-center '
          + 'h-14 w-14 rounded bg-bg-surface/80 hover:bg-bg-elevated '
          + 'border border-border-subtle text-text-primary '
          + 'shadow board-motion transition-colors cursor-default '
          + GAME_FOCUS_RING
        }
        title={handButtonLabel}
        aria-label={handButtonLabel}
        aria-haspopup="menu"
        aria-expanded={handMenuAnchor != null}
        onContextMenu={(e: MouseEvent<HTMLButtonElement>) => {
          e.preventDefault();
          if (e.clientX === 0 && e.clientY === 0) {
            openHandMenuBelow(e.currentTarget);
          } else {
            setHandMenuAnchor({ x: e.clientX, y: e.clientY });
          }
        }}
        onClick={(e) => {
          if (e.detail === 0) {
            openHandMenuBelow(e.currentTarget);
          } else {
            setHandMenuAnchor({ x: e.clientX, y: e.clientY });
          }
        }}
        onKeyDown={(e) => {
          if (isContextMenuKey(e)) {
            e.preventDefault();
            openHandMenuBelow(e.currentTarget);
          }
        }}
      >
        <Hand size={32} className="text-text-secondary" aria-hidden />
        <span
          className={
            'absolute inset-0 flex items-center justify-center '
            + 'text-[1.3rem] font-bold text-text-primary '
            + 'pointer-events-none tabular-nums'
          }
          style={{ textShadow: OVER_ART_SHADOW_SMALL }}
          aria-hidden
        >
          {handSize}
        </span>
      </button>
      {handMenuAnchor && (
        <Menu
          anchor={handMenuAnchor}
          label={t('HandZone.menu')}
          onClose={() => setHandMenuAnchor(null)}
          triggerRef={handButtonRef}
          className="w-[240px]"
        >
          <ContextMenuEntries items={handMenuItems} />
        </Menu>
      )}
    </>
  ) : (
    <button
      type="button"
      disabled
      className={
        'absolute top-1 left-1 z-40 flex items-center justify-center '
        + 'h-14 w-14 rounded bg-bg-surface/80 border border-border-subtle '
        + 'text-text-primary shadow cursor-default'
      }
      title={handButtonLabel}
      aria-label={handButtonLabel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Hand size={32} className="text-text-secondary" aria-hidden />
      <span
        className={
          'absolute inset-0 flex items-center justify-center '
          + 'text-[1.3rem] font-bold text-text-primary '
          + 'pointer-events-none tabular-nums'
        }
        style={{ textShadow: OVER_ART_SHADOW_SMALL }}
      >
        {handSize}
      </span>
    </button>
  );

  const keysHint = isSelf && <span id={keysHintId} hidden>{t('PlayerBoard.cardKeys')}</span>;

  const renderCardBack = (i: number) => (
    <img
      key={i}
      src={CARD_BACK_URL}
      alt=""
      draggable={false}
      className="shadow-md pointer-events-none select-none"
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        borderRadius: CARD_CORNER_RADIUS,
        transform: (handOnTop && flipHandCardBacks) ? 'rotate(180deg)' : undefined,
      }}
    />
  );

  const rowClassName = [
    'flex items-center gap-1 px-1 bg-bg-surface/40',
    leftJustified ? 'my-auto mr-auto' : 'm-auto',
  ].join(' ');
  const rowStyle: CSSProperties | undefined = leftJustified ? { marginLeft: `calc(${CARD_WIDTH} * 1.4)` } : undefined;

  if (!horizontalHand) {
    return (
      <VerticalHand
        placement={seatGrid.hand}
        badge={<>{countBadge}{keysHint}</>}
        count={isSelf ? handDisplayList.length : handCount}
        cardKey={(i) => (isSelf ? handDisplayList[i].id : String(i))}
        renderCard={(i) => (isSelf ? renderOwnCard(handDisplayList[i]) : renderCardBack(i))}
        cardWidth={CARD_W_PX}
        cardHeight={CARD_H_PX}
        pileOptions={handPileOptions}
        zoneRef={handZoneRef}
        testId={`hand-zone-${playerId}`}
        label={handLabel}
        describedBy={isSelf ? keysHintId : undefined}
      />
    );
  }

  return (
    <div
      className={[
        'min-h-0 flex',
        // For flipped opponent hands, use items-end so the rotated
        // card back's BOTTOM (which is the original TOP with the
        // Magic logo) sits in the visible strip. Everything else
        // (own hand + non-flipped 3-player opponent) stays
        // top-aligned, matching the local invariant that the
        // card's readable half occupies the strip.
        handOnTop && flipHandCardBacks ? 'items-end' : 'items-start',
        handOnTop ? 'border-b border-border-subtle' : 'border-t border-border-subtle',
        // Keep overflow-visible while the slide tween is mid-flight
        // too, otherwise the wrapper clips its own cards halfway
        // through the return-to-idle animation and it reads as a
        // z-index pop.
        (handExpanded || handFocused || handAnimating) ? 'overflow-visible' : 'overflow-hidden',
      ].join(' ')}
      style={{
        ...seatGrid.hand,
        // Always elevated above the play area so overflowing cards
        // paint on top when the hand expands. Kept static (not tied
        // to hover) so nothing flickers at the boundary.
        position: 'relative',
        zIndex: 30,
      }}
    >
      <ZoneBackground zone="hand" />
      {countBadge}
      {keysHint}
      {/* Inner row — full card height so cards render at their true
        size; the outer wrapper clips the half we don't want to see
        in idle mode. On hover, a translateY on this container
        slides the whole card content upward for the bottom hand
        (top hand stays put — its expansion is downward and
        handled by the outer's overflow flip alone). */}
      <motion.div
        ref={handZoneRef}
        data-testid={`hand-zone-${playerId}`}
        role={isSelf ? 'listbox' : 'group'}
        aria-multiselectable={isSelf || undefined}
        aria-orientation={isSelf ? 'horizontal' : undefined}
        aria-label={handLabel}
        aria-describedby={isSelf ? keysHintId : undefined}
        // `overflow-y-hidden` set explicitly alongside overflow-x-auto
        // to short-circuit the CSS spec's promotion of the other
        // axis to `auto` — that's what was spawning a phantom
        // vertical scrollbar even though cards fit exactly.
        className='w-full flex items-center overflow-x-auto overflow-y-hidden'
        tabIndex={-1}
        style={{ height: CARD_HEIGHT }}
        // Own hand slides UP on hover (top half of card floats
        // into the play area above, bottom half comes into the
        // strip). Flipped opponent hand mirrors that, sliding
        // DOWN on hover so the card back's original TOP (with
        // Magic logo) drops into the play area below and the
        // rotated top comes into the strip. Non-flipped
        // (3-player) opponent has no transform — its expansion
        // is a plain overflow reveal downward. Framer Motion
        // drives the tween via WAAPI so it interrupts cleanly on
        // fast hover-in/out (the CSS-transition version had to
        // finish before it could reverse) and auto-promotes to
        // the compositor.
        animate={{
          y: handExpanded || handFocused
            ? !handOnTop
              ? '-40%'
              : flipHandCardBacks
                ? '40%'
                : '0%'
            : '0%',
        }}
        // Spring feels snappier than a fixed-duration tween because
        // it front-loads the motion. Tuned for a quick, damped
        // response — no overshoot bounce, settles in ~180ms.
        transition={{ type: 'spring', stiffness: 500, damping: 40, mass: 0.6 }}
        // Flip the `handAnimating` flag around the tween so the outer
        // wrapper keeps `overflow-visible` for the whole slide-back
        // instead of clipping cards mid-flight.
        onAnimationStart={() => setHandAnimating(true)}
        onAnimationComplete={() => setHandAnimating(false)}
      >
        {isSelf
          ? handDisplayList.length > 0 && (
            <div
              onMouseEnter={() => setHandExpanded(true)}
              onMouseLeave={() => setHandExpanded(false)}
              className={rowClassName}
              style={rowStyle}
            >
              {handDisplayList.map((c) => renderOwnCard(c))}
            </div>
          )
          : handCount > 0 && (
            <div
              onMouseEnter={() => setHandExpanded(true)}
              onMouseLeave={() => setHandExpanded(false)}
              className={rowClassName}
              style={rowStyle}
            >
              {Array.from({ length: handCount }, (_, i) => renderCardBack(i))}
            </div>
          )}
      </motion.div>
    </div>
  );
}

interface VerticalHandProps {
  placement: CSSProperties;
  badge: ReactNode;
  count: number;
  cardKey: (index: number) => string;
  renderCard: (index: number) => ReactNode;
  cardWidth: number;
  cardHeight: number;
  pileOptions: VerticalPileOptions;
  zoneRef: React.Ref<HTMLDivElement>;
  testId: string;
  label: string;
  describedBy?: string;
}

function VerticalHand({
  placement,
  badge,
  count,
  cardKey,
  renderCard,
  cardWidth,
  cardHeight,
  pileOptions,
  zoneRef,
  testId,
  label,
  describedBy,
}: VerticalHandProps) {
  const sizeRef = useRef<HTMLDivElement>(null);
  const ref = useForkRef(zoneRef, sizeRef);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = sizeRef.current;
    if (!el) {
      return;
    }
    const ro = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { positions } = layoutVerticalPile(count, size.w, size.h, cardWidth, cardHeight, pileOptions);

  return (
    <div
      className="relative min-h-0 border-r border-border-subtle bg-bg-surface/40"
      style={{ ...placement, zIndex: 30 }}
    >
      <ZoneBackground zone="hand" />
      {badge}
      <div
        ref={ref}
        data-testid={testId}
        role={describedBy ? 'listbox' : 'group'}
        aria-multiselectable={describedBy ? true : undefined}
        aria-orientation={describedBy ? 'vertical' : undefined}
        aria-label={label}
        aria-describedby={describedBy}
        className="absolute inset-x-0 bottom-0 top-16"
      >
        {positions.map((pos, i) => {
          const key = cardKey(i);
          return (
            <div
              key={key}
              className="absolute hover:!z-[999]"
              style={{ left: pos.x, top: pos.y, zIndex: i }}
            >
              {renderCard(i)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
