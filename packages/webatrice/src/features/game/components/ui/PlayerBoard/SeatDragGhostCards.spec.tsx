import { render } from '@testing-library/react';

import { CARD_BACK_URL } from '../SeatCard/cardSize';
import type { PlayerSeat } from './usePlayerSeat';
import { PlayerSeatProvider } from './PlayerSeatContext';
import SeatDragGhostCards, { type SeatDragGhostCardsProps } from './SeatDragGhostCards';

vi.mock('../SeatCard/SeatCard', () => ({
  default: ({ name, pt }: { name: string; pt?: string }) => <span data-testid="face">{`${name} ${pt ?? ''}`.trim()}</span>,
}));

const seat = {
  cardMetaByName: new Map([['Bear', { typeLine: 'Creature', pt: '2/2' }]]),
  resolveFaceImageUri: () => undefined,
} as unknown as PlayerSeat;

function renderGhost(props: Partial<SeatDragGhostCardsProps>) {
  return render(
    <PlayerSeatProvider value={seat}>
      <SeatDragGhostCards
        cards={[{ id: '1', name: 'Bear', scryfallId: '' }, { id: '2', name: 'Opt', scryfallId: '' }]}
        zone="hand"
        lent={false}
        origin={{ x: 100, y: 50 }}
        {...props}
      />
    </PlayerSeatProvider>,
  );
}

describe('SeatDragGhostCards', () => {
  it('shows the dragged faces under the pointer, fanned a little, with the printed P/T as fallback', () => {
    const { container, getAllByTestId } = renderGhost({});
    expect(getAllByTestId('face').map((el) => el.textContent)).toEqual(['Bear 2/2', 'Opt']);
    const ghosts = container.querySelectorAll<HTMLElement>('[data-drag-ghost]');
    expect([ghosts[0].style.left, ghosts[0].style.top, ghosts[1].style.left]).toEqual(['100px', '50px', '104px']);
  });

  it('shows a card back for an own library card, whose position the server decides', () => {
    const { container, queryAllByTestId } = renderGhost({ zone: 'library' });
    expect(queryAllByTestId('face')).toHaveLength(0);
    expect(container.querySelectorAll(`img[src="${CARD_BACK_URL}"]`)).toHaveLength(2);
  });

  it('shows the face of a lent library card', () => {
    const { getAllByTestId } = renderGhost({ zone: 'library', lent: true });
    expect(getAllByTestId('face')).toHaveLength(2);
  });

  it('turns a tapped battlefield card the way it rests', () => {
    const { container } = renderGhost({
      zone: 'battlefield',
      cards: [{ id: '1', name: 'Bear', scryfallId: '', tapped: true } as SeatDragGhostCardsProps['cards'][number]],
    });
    expect(container.querySelector<HTMLElement>('[data-drag-ghost]')!.style.transform).toBe('rotate(92deg)');
  });
});
