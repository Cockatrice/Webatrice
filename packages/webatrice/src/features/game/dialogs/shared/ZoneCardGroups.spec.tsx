import { fireEvent, render, screen } from '@testing-library/react';

import { CardPreviewProvider, createCardPreviewStore } from '../../components/ui/CardPreviewContext';
import { ZoneCardCell, type PilePlace } from './ZoneCardCell';
import { ZoneCardGroups } from './ZoneCardGroups';
import { placeholderMeta, type CardGroup, type EnrichedCard } from './zoneViewSort';

const card = (id: string, name: string) => ({ handCard: { id, name, scryfallId: '' }, meta: placeholderMeta(name) });
const GROUPS: CardGroup[] = [
  { key: 'Creature', label: 'Creature', cards: [card('1', 'Bears'), card('2', 'Elves')] },
  { key: 'Land', label: 'Land', cards: [card('3', 'Forest')] },
];

const cells = () => Array.from(document.querySelectorAll<HTMLElement>('[data-card-id]'));

describe('ZoneCardGroups', () => {
  it('labels each group with its count and hands each card its pile place', () => {
    const renderCell = vi.fn((c: EnrichedCard, _g: CardGroup, pile?: PilePlace) => <ZoneCardCell card={c.handCard} pile={pile} marked />);
    render(<ZoneCardGroups groups={GROUPS} pile renderCell={renderCell} />);
    expect(screen.getByText('Creature').textContent).toBe('Creature (2)');
    expect(renderCell.mock.calls.map(([c, g, pile]) => [c.handCard.id, g.key, pile])).toEqual([
      ['1', 'Creature', { index: 0, isLast: false }],
      ['2', 'Creature', { index: 1, isLast: true }],
      ['3', 'Land', { index: 0, isLast: true }],
    ]);
    expect(cells().map((el) => el.className)).toEqual(Array(3).fill('absolute left-0 hover:z-10 group'));
  });

  it('lays each group out as a grid outside pile view, and labels no ungrouped group', () => {
    const renderCell = vi.fn((c: EnrichedCard, _g: CardGroup, _pile?: PilePlace) => (
      <ZoneCardCell card={c.handCard} marked className="shrink-0" />
    ));
    render(<ZoneCardGroups groups={[{ key: 'all', label: '', cards: GROUPS[0].cards }]} pile={false} renderCell={renderCell} />);
    expect(renderCell.mock.calls.map(([, , pile]) => pile)).toEqual([undefined, undefined]);
    expect(cells().map((el) => el.className)).toEqual(['shrink-0', 'shrink-0']);
    expect(document.querySelector('.uppercase')).toBeNull();
  });
});

describe('ZoneCardCell', () => {
  const BEARS = { id: '1', name: 'Bears', scryfallId: 'abc' };

  it('marks itself as a view card only when asked', () => {
    const { rerender } = render(<ZoneCardCell card={BEARS} />);
    expect(cells()).toHaveLength(0);
    rerender(<ZoneCardCell card={BEARS} marked />);
    expect(cells()[0]).toHaveAttribute('data-card');
  });

  it('shows a strip of a pile card but the last', () => {
    const { rerender } = render(<ZoneCardCell card={BEARS} pile={{ index: 2, isLast: false }} marked />);
    expect(cells()[0].style.height).toContain('0.25');
    expect(cells()[0].style.top).toContain('* 2');
    rerender(<ZoneCardCell card={BEARS} pile={{ index: 2, isLast: true }} marked />);
    expect(cells()[0].style.height).not.toContain('0.25');
  });

  it('hands on a left press and a right-click, and rings, hides and grabs', () => {
    const onPointerDown = vi.fn();
    const onContextMenu = vi.fn();
    render(<ZoneCardCell card={BEARS} marked selected hidden onPointerDown={onPointerDown} onContextMenu={onContextMenu} />);
    const cell = cells()[0];
    fireEvent.pointerDown(cell, { button: 1 });
    fireEvent.pointerDown(cell, { button: 0 });
    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(fireEvent.contextMenu(cell)).toBe(false);
    expect(onContextMenu).toHaveBeenCalledTimes(1);
    expect(cell.style.boxShadow).not.toBe('');
    expect(cell.style.opacity).toBe('0');
    expect(cell.style.cursor).toBe('grab');
  });

  it('previews a pile card on hover and zooms it while the middle button is held', () => {
    const actions = createCardPreviewStore();
    vi.spyOn(actions, 'setHoveredCard');
    vi.spyOn(actions, 'openBigPreview');
    vi.spyOn(actions, 'closeBigPreview');
    render(
      <CardPreviewProvider store={actions}>
        <ZoneCardCell card={BEARS} pile={{ index: 0, isLast: true }} marked />
      </CardPreviewProvider>,
    );
    fireEvent.mouseEnter(cells()[0]);
    expect(actions.setHoveredCard).toHaveBeenCalledWith({ name: 'Bears', scryfallId: 'abc' });
    fireEvent.mouseDown(cells()[0], { button: 1 });
    expect(actions.openBigPreview).toHaveBeenCalledWith({ name: 'Bears', scryfallId: 'abc' });
    fireEvent.mouseUp(window, { button: 1 });
    expect(actions.closeBigPreview).toHaveBeenCalledTimes(1);
  });
});
