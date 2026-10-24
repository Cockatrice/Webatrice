
import { fireEvent, screen } from '@testing-library/react';

import { renderWithProviders } from '../../../../__test-utils__';
import ZoneRevealPanel from './ZoneRevealPanel';

const CARDS = [
  { id: '0', name: 'Island', scryfallId: '' },
  { id: '1', name: 'Forest', scryfallId: '' },
];

function renderPanel(props: Partial<React.ComponentProps<typeof ZoneRevealPanel>> = {}) {
  return renderWithProviders(<ZoneRevealPanel title="Top 2" cards={CARDS} onClose={() => undefined} {...props} />);
}

const dialog = () => screen.getByRole('heading', { name: 'Top 2' }).closest<HTMLElement>('.pointer-events-auto.resize')!;
const cells = () => Array.from(dialog().querySelectorAll<HTMLElement>('[data-card][data-card-id]'));

afterEach(() => {
  window.localStorage.clear();
});

describe('ZoneRevealPanel', () => {
  it('lists the cards in the order given, each over its label', () => {
    renderPanel({ subtitle: 'top of library is leftmost', labels: ['Top', '1'] });
    expect(cells().map((el) => el.dataset.cardId)).toEqual(['0', '1']);
    expect(cells()[0].nextElementSibling).toHaveTextContent('Top');
    expect(cells()[1].nextElementSibling).toHaveTextContent('1');
    expect(screen.getByText('top of library is leftmost')).toBeInTheDocument();
  });

  it('paints the keyboard selection and removes it when the selection changes', () => {
    const interaction = (selected: boolean) => (card: typeof CARDS[number]) => ({
      role: 'option', 'aria-selected': card.id === '0' && selected,
    });
    const { rerender } = renderPanel({ cardInteraction: interaction(true) });
    expect(cells()[0].style.boxShadow).not.toBe('');
    expect(cells()[1].style.boxShadow).toBe('');
    rerender(<ZoneRevealPanel title="Top 2" cards={CARDS} onClose={() => undefined} cardInteraction={interaction(false)} />);
    expect(cells()[0].style.boxShadow).toBe('');
  });

  it('says when there is nothing to show', () => {
    renderPanel({ cards: [] });
    expect(screen.getByText('No cards to show.')).toBeInTheDocument();
  });

  it('hands a left press to the caller and hides the cards being dragged', () => {
    const onCardPointerDown = vi.fn();
    renderPanel({ onCardPointerDown, draggingCardIds: new Set(['1']) });
    expect(cells()[0]).toHaveStyle({ cursor: 'grab' });
    expect(cells()[1].style.opacity).toBe('0');
    fireEvent.pointerDown(cells()[0], { button: 1 });
    expect(onCardPointerDown).not.toHaveBeenCalled();
    fireEvent.pointerDown(cells()[0], { button: 0 });
    expect(onCardPointerDown).toHaveBeenCalledWith(expect.anything(), CARDS[0]);
  });

  it('closes from the header and the footer', () => {
    const onClose = vi.fn();
    renderPanel({ onClose });
    screen.getAllByRole('button', { name: 'Common.action.close' }).forEach((button) => fireEvent.click(button));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  describe('floating geometry', () => {
    it('opens at 900×480, centred, unless a size or position is stored', () => {
      renderPanel();
      expect(dialog().style.width).toBe('900px');
      expect(dialog().style.height).toBe('480px');
      expect(dialog().style.left).toBe('512px');
      expect(dialog().style.top).toBe('384px');
    });

    it('restores a stored size, clamped between its minimum and the viewport', () => {
      window.localStorage.setItem('webatrice.zoneRevealSize', JSON.stringify({ w: 5000, h: 100 }));
      renderPanel();
      expect(dialog().style.width).toBe(`${window.innerWidth}px`);
      expect(dialog().style.height).toBe('240px');
    });

    it('restores a stored position, keeping 60px of its header on screen', () => {
      window.localStorage.setItem('webatrice.zoneRevealPosition', JSON.stringify({ x: 5000, y: -40 }));
      renderPanel();
      expect(dialog().style.left).toBe(`${window.innerWidth - 60}px`);
      expect(dialog().style.top).toBe('0px');
    });
  });
});
