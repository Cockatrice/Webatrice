import { createPortal } from 'react-dom';
import type { DrawFlight } from './useDrawFlights';
import { useTranslation } from 'react-i18next';

import Battlefield from '../../battlefield/Battlefield/Battlefield';
import { DragSelectionCount } from '../../SelectionCount/SelectionCount';
import BattlefieldCardMenu from '../../context-menus/SeatCardMenus/BattlefieldCardMenu';
import HandCardMenu from '../../context-menus/SeatCardMenus/HandCardMenu';
import PileCardMenu from '../../context-menus/SeatCardMenus/PileCardMenu';
import StackCardMenu from '../../context-menus/SeatCardMenus/StackCardMenu';
import PlayerInfoPanel from '../../right-sidebar/PlayerInfoPanel/PlayerInfoPanel';
import HandTray from '../../BoardTray/HandTray';
import { useBoardTrayHost } from '../../BoardTray/BoardTrayContext';
import { TRAY_CARD_HEIGHT_VAR, TRAY_CARD_WIDTH_VAR } from '../../BoardTray/BoardTray';
import HandZone from '../HandZone/HandZone';
import { CARD_BACK_URL, CARD_CORNER_RADIUS, CARD_HEIGHT, CARD_WIDTH } from '../SeatCard/cardSize';
import { SeatDragGhost } from '../SeatDragContext';
import StackColumn from '../StackColumn/StackColumn';
import type { PlayerCardViewModel } from './playerBoard.types';
import PendingTargetArrows from './PendingTargetArrows';
import { PlayerSeatProvider } from './PlayerSeatContext';
import SeatDragGhostCards from './SeatDragGhostCards';
import { usePlayerSeat, type PlayerSeatProps } from './usePlayerSeat';
import { MARQUEE_BORDER, MARQUEE_FILL } from '../seatColors/seatColors';

function PlayerBoard(props: PlayerSeatProps) {
  const controller = usePlayerSeat(props);
  const { t } = useTranslation();
  const trayHost = useBoardTrayHost();
  const {
    DRAW_ANIMATION_MS,
    boxRef,
    flights,
    handPlacement,
    isActive,
    marquee,
    name,
    onPointerDownBox,
    playerId,
    seatDrag,
    seatGrid,
    seatPending,
  } = controller;

  return (
    <PlayerSeatProvider value={controller}>
      <div
        ref={boxRef}
        role="region"
        aria-label={t('PlayerBoard.seat', { name })}
        onPointerDown={onPointerDownBox}
        className={[
          'h-full min-h-0 rounded-lg border overflow-hidden bg-bg-surface/60 backdrop-blur-sm board-motion transition-shadow select-none',
          isActive ? 'border-accent' : 'border-border-subtle',
        ].join(' ')}
        style={{
          display: 'grid',
          ...seatGrid.template,
          // Stronger accent glow than shadow-glow when it's this player's turn.
          boxShadow: isActive
            ? '0 0 28px 0 rgb(var(--accent-primary) / 0.5), 0 0 10px 0 rgb(var(--accent-primary) / 0.35)'
            : undefined,
        }}
      >
        <PlayerInfoPanel />

        <StackColumn />

        <Battlefield />

        {handPlacement === 'inline' && <HandZone />}

        {handPlacement === 'tray' && trayHost && createPortal(<HandTray />, trayHost)}

        {/* Draw animations — a card back tweens from the library rect
          (rotated to match the sideways pile) to the hand rect (upright)
          each time Redux hand count grows. Purely visual: the drawn
          card is already in Redux; this just adds the "flight" polish. */}
        {flights.length > 0 &&
        createPortal(
          <>
            {flights.map((f) => {
              return (
                <img
                  key={f.id}
                  src={CARD_BACK_URL}
                  alt=""
                  draggable={false}
                  className="shadow-glow"
                  style={drawFlightStyle(f, DRAW_ANIMATION_MS, handPlacement === 'tray')}
                />
              );
            })}
          </>,
          document.body,
        )}

        {/* Marquee selection rectangle. Fixed-position overlay so it can
          straddle scrollable containers without clipping. */}
        {marquee &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              left: Math.min(marquee.x1, marquee.x2),
              top: Math.min(marquee.y1, marquee.y2),
              width: Math.abs(marquee.x2 - marquee.x1),
              height: Math.abs(marquee.y2 - marquee.y1),
              border: MARQUEE_BORDER,
              background: MARQUEE_FILL,
              pointerEvents: 'none',
              zIndex: 275,
            }}
          >
            <DragSelectionCount band={marquee} count={marquee.count} />
          </div>,
          document.body,
        )}

        {seatPending && <PendingTargetArrows playerId={playerId} pending={seatPending} />}

        <BattlefieldCardMenu />

        <PileCardMenu />

        <HandCardMenu />

        <StackCardMenu />

        {/* Drag ghost — a floating copy of the dragged card(s) tracking the
          pointer. Group drags stack the cards with a small diagonal offset
          so the count is visible without hiding the top card. Only shows
          after the pointer crosses the movement threshold, so a click
          without motion never flashes the ghost.
          Library is a HiddenZone: the server's positional cardId (0 =
          top of ITS shuffle) is authoritative, and the client's local
          mock shuffle can't be matched to it. Showing the local top's
          face here would mislead the user into thinking THAT specific
          card is being moved — so library-source drags render a card
          back instead, matching the pile visualization. */}
        {seatDrag &&
        createPortal(
          <div style={handPlacement === 'tray' && seatDrag.zone === 'hand' ? TRAY_CARD_SIZE_VARS : undefined}>
            <SeatDragGhost>
              {(origin) =>
                <SeatDragGhostCards
                  cards={seatDrag.cards as readonly PlayerCardViewModel[]}
                  zone={seatDrag.zone}
                  lent={seatDrag.lenderPlayerId !== undefined}
                  origin={origin}
                />}
            </SeatDragGhost>
          </div>,
          document.body,
        )}
      </div>
    </PlayerSeatProvider>
  );
}

export default PlayerBoard;

const TRAY_CARD_SIZE_VARS = {
  '--card-width': `var(${TRAY_CARD_WIDTH_VAR}, ${CARD_WIDTH})`,
  '--card-height': `var(${TRAY_CARD_HEIGHT_VAR}, ${CARD_HEIGHT})`,
} as React.CSSProperties;

function drawFlightStyle(f: DrawFlight, DRAW_ANIMATION_MS: number, traySized: boolean): React.CSSProperties {
  const style: React.CSSProperties = {
    position: 'fixed',
    width: traySized ? `var(${TRAY_CARD_WIDTH_VAR}, ${CARD_WIDTH})` : CARD_WIDTH,
    height: traySized ? `var(${TRAY_CARD_HEIGHT_VAR}, ${CARD_HEIGHT})` : CARD_HEIGHT,
    borderRadius: CARD_CORNER_RADIUS,
    transition:
      `left ${DRAW_ANIMATION_MS}ms ease-out, top ${DRAW_ANIMATION_MS}ms ease-out, `
      + `transform ${DRAW_ANIMATION_MS}ms ease-out`,
    pointerEvents: 'none',
    zIndex: 200,
    willChange: 'left, top, transform',
  };
  if (!f.landed) {
    style.left = f.from.left + f.from.width / 2;
    style.top = f.from.top + f.from.height / 2;
    style.transform = 'translate(-50%, -50%) rotate(-90deg)';
  } else {
    style.left = f.to.left + f.to.width / 2;
    style.top = f.to.top + f.to.height / 2;
    style.transform = 'translate(-50%, -50%) rotate(0deg)';
  }
  return style;
}
