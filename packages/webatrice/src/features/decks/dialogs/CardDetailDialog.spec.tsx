import { fireEvent, render, screen } from '@testing-library/react';

import type { CardDetailState } from '../hooks/useCardDetail';
import { useCardDetail } from '../hooks/useCardDetail';
import { emptyPriceLookup } from '../pricing';
import type { DeckCard } from '../types';
import { CardDetailDialog, type CardDetailDialogProps } from './CardDetailDialog';

vi.mock('../hooks/useCardDetail', () => ({ useCardDetail: vi.fn() }));
vi.mock('@app/components', async () => ({
  CardRelatedLinks: ({ parentName }: { parentName: string }) => <div>related to {parentName}</div>,
  relatedCardKey: (target: { name: string }) => target.name,
  ...(await import('../../../components/ManaSymbols/ManaSymbols')),
}));

const solRing: DeckCard = {
  name: 'Sol Ring', quantity: 1, category: 'main', lookupSource: 'scryfall', set: 'c21', collectorNumber: '263',
};
const atraxa: DeckCard = {
  name: 'Atraxa', quantity: 1, category: 'main', lookupSource: 'scryfall', isCommander: true,
};

function detailState(overrides: Partial<CardDetailState> = {}): CardDetailState {
  return {
    detail: {
      id: 'sol', name: 'Sol Ring', mana_cost: '{1}', cmc: 1, type_line: 'Artifact', oracle_text: '{T}: Add {C}{C}.',
      flavor_text: 'Lost to time.',
    },
    detailLoading: false,
    browsed: null,
    pending: null,
    browse: vi.fn(),
    back: vi.fn(),
    ...overrides,
  };
}

function renderDialog(props: Partial<CardDetailDialogProps> = {}) {
  const handlers = {
    onClose: vi.fn(),
    onInc: vi.fn(),
    onDec: vi.fn(),
    onSetCategory: vi.fn(),
    onSetCommander: vi.fn(),
    onChangePrinting: vi.fn(),
    onDelete: vi.fn(),
    onAdd: vi.fn(),
  };
  const utils = render(
    <CardDetailDialog
      snapshot={solRing}
      deckCards={[atraxa, solRing]}
      isCommanderDeck
      prices={emptyPriceLookup()}
      {...handlers}
      {...props}
    />,
  );
  return { ...utils, handlers };
}

describe('CardDetailDialog', () => {
  it('renders nothing without a snapshot', () => {
    vi.mocked(useCardDetail).mockReturnValue(detailState({ detail: null }));
    renderDialog({ snapshot: null });
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('shows the Scryfall details, related links and printing', () => {
    vi.mocked(useCardDetail).mockReturnValue(detailState());
    renderDialog();

    expect(screen.getByRole('heading', { name: 'Sol Ring' })).toBeInTheDocument();
    expect(screen.getByText('CardDetailDialog.cmc')).toBeInTheDocument();
    expect(screen.getByText('Artifact')).toBeInTheDocument();
    expect(screen.getByText('Lost to time.')).toBeInTheDocument();
    expect(screen.getByText('related to Sol Ring')).toBeInTheDocument();
    expect(screen.getByText('C21 · #263')).toBeInTheDocument();
  });

  it('adjusts quantity in place and closes after other actions', () => {
    vi.mocked(useCardDetail).mockReturnValue(detailState());
    const { handlers } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'CardDetailDialog.increase' }));
    fireEvent.click(screen.getByRole('button', { name: 'CardDetailDialog.decrease' }));
    expect(handlers.onInc).toHaveBeenCalledWith(1);
    expect(handlers.onDec).toHaveBeenCalledWith(1);
    expect(handlers.onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'DeckEditor.rowActions.markCommander' }));
    expect(handlers.onSetCommander).toHaveBeenCalledWith(1, true);
    fireEvent.click(screen.getByRole('button', { name: 'DeckEditor.rowActions.moveToSideboard' }));
    expect(handlers.onSetCategory).toHaveBeenCalledWith(1, 'sideboard');
    fireEvent.click(screen.getByRole('button', { name: 'DeckEditor.rowActions.changePrinting' }));
    expect(handlers.onChangePrinting).toHaveBeenCalledWith(1, solRing);
    fireEvent.click(screen.getByRole('button', { name: 'CardDetailDialog.removeFromDeck' }));
    expect(handlers.onDelete).toHaveBeenCalledWith(1);
    expect(handlers.onClose).toHaveBeenCalledTimes(4);
  });

  it('keeps a commander in the main deck', () => {
    vi.mocked(useCardDetail).mockReturnValue(detailState({ detail: null }));
    renderDialog({ snapshot: atraxa });
    expect(screen.getByRole('button', { name: 'DeckEditor.rowActions.unmarkCommander' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'DeckEditor.rowActions.moveToSideboard' })).toBeDisabled();
  });

  it('disables the actions once the row is removed', () => {
    vi.mocked(useCardDetail).mockReturnValue(detailState());
    renderDialog({ deckCards: [atraxa] });
    expect(screen.getByText('· CardDetailDialog.removed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CardDetailDialog.removeFromDeck' })).toBeDisabled();
  });

  it('offers Add to deck for a browsed card that is not in the deck, and goes back', () => {
    const state = detailState({
      detail: { id: 'grim', name: 'Grim Tutor', type_line: 'Sorcery' },
      browsed: { name: 'Grim Tutor', kind: 'combo_piece' },
    });
    vi.mocked(useCardDetail).mockReturnValue(state);
    const { handlers } = renderDialog();

    expect(screen.getByRole('heading', { name: 'Grim Tutor' })).toBeInTheDocument();
    expect(screen.queryByText(/related to/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'CardDetailDialog.removeFromDeck' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'CardDetailDialog.addToDeck' }));
    expect(handlers.onAdd).toHaveBeenCalledWith('Grim Tutor');
    fireEvent.click(screen.getByRole('button', { name: 'CardDetailDialog.backTo' }));
    expect(state.back).toHaveBeenCalled();
  });

  it('shows the shared price with a TCGplayer link', () => {
    vi.mocked(useCardDetail).mockReturnValue(detailState());
    const prices = emptyPriceLookup();
    prices.byName.set('sol ring', { usd: 2.25, tcgplayer: 'https://tcg/sol' });
    renderDialog({ prices });
    expect(screen.getByRole('link', { name: /CardDetailDialog.buy/ })).toHaveAttribute('href', 'https://tcg/sol');
    expect(screen.getByText('$2.25')).toBeInTheDocument();
  });
});
