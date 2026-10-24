import type { SeatZone } from '../../../hooks/seatDropPlan';
import { CARD_BACK_URL, CARD_CORNER_RADIUS, CARD_HEIGHT, CARD_WIDTH } from '../SeatCard/cardSize';
import Card from '../SeatCard/SeatCard';
import type { BattlefieldCardViewModel, PlayerCardViewModel } from './playerBoard.types';
import { usePlayerSeatContext } from './PlayerSeatContext';

export interface SeatDragGhostCardsProps {
  cards: readonly PlayerCardViewModel[];
  zone: SeatZone;
  lent: boolean;
  origin: { x: number; y: number };
}

export default function SeatDragGhostCards({ cards, zone, lent, origin }: SeatDragGhostCardsProps) {
  const { cardMetaByName, resolveFaceImageUri } = usePlayerSeatContext();
  return (
    <>
      {cards.map((c, i) => {
        // Runtime object is the FULL BattlefieldCard when the
        // source is the battlefield (BattlefieldCard extends
        // HandCard so the widening at drag start doesn't strip
        // the fields — they just get erased in the static type).
        // Cast to read the extended props so the ghost mirrors
        // what the resting card looks like: modified P/T, on-card
        // counters, annotation pill, face-down flip, tapped
        // rotation, picked printing. Non-battlefield sources
        // (hand / graveyard / exile / stack) leave the extended
        // fields undefined, and Card handles that gracefully.
        const bc = c as BattlefieldCardViewModel;
        const baseMeta = cardMetaByName.get(c.name);
        const isLibraryBack = zone === 'library' && !lent;
        return (
          <div
            key={c.id}
            data-drag-ghost
            style={{
              position: 'fixed',
              left: origin.x + i * 4,
              top: origin.y + i * 4,
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
              pointerEvents: 'none',
              // Above the search-library dialog (z-1000) so a
              // card dragged out of the dialog is visible under
              // the cursor from the moment the drag starts.
              zIndex: 1100 + i,
              // Tapped cards drag rotated 90° like they render
              // on the board (plus a small tilt for depth).
              transform: `rotate(${bc.tapped ? 92 : 2}deg)`,
              filter: 'drop-shadow(0 8px 12px rgba(0,0,0,0.4))',
            }}
          >
            {isLibraryBack ? (
              <img
                src={CARD_BACK_URL}
                alt=''
                draggable={false}
                className='w-full h-full select-none pointer-events-none'
                style={{ borderRadius: CARD_CORNER_RADIUS }}
              />
            ) : (
              <Card
                id={c.id}
                name={c.name}
                scryfallId={c.scryfallId || baseMeta?.scryfallId}
                pt={bc.pt || (bc.faceDown ? undefined : baseMeta?.pt)}
                basePT={baseMeta?.pt}
                annotation={bc.annotation}
                counters={bc.counters}
                faceDown={bc.faceDown}
                imageUri={resolveFaceImageUri(c.name)}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
