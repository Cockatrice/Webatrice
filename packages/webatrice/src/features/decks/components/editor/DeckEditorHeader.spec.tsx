import { fireEvent, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';

import { RouteEnum } from '@app/types';

import { connectedState, renderWithProviders } from '../../../../__test-utils__';
import { emptyPriceLookup } from '../../pricing';
import type { HydratedDeck } from '../../types';
import { DeckEditorHeader, type DeckEditorHeaderProps } from './DeckEditorHeader';

const deck: HydratedDeck = {
  name: 'Burn',
  meta: { v: 1, updatedAt: 'x' },
  format: 'modern',
  cards: [{ name: 'Lightning Bolt', quantity: 4, category: 'main', lookupSource: 'scryfall' }],
};

function renderHeader(overrides: Partial<DeckEditorHeaderProps> = {}) {
  const props: DeckEditorHeaderProps = {
    deck,
    saveState: 'idle',
    onRetrySave: vi.fn(),
    totalMainboardCount: 4,
    totalSideboardCount: 0,
    tags: [],
    onNameChange: vi.fn(),
    onFormatChange: vi.fn(),
    onTagsChange: vi.fn(),
    onBannerChange: vi.fn(),
    onEditPlaymat: vi.fn(),
    onExport: vi.fn(),
    openDeck: {
      deckId: 1,
      isModified: false,
      isBlank: false,
      saveNow: vi.fn(async () => true),
      discardChanges: vi.fn(),
      pauseAutosave: vi.fn(),
      resumeAutosave: vi.fn(),
    },
    history: <span>history</span>,
    legality: <span>legality</span>,
    prices: emptyPriceLookup(),
    pricesLoading: false,
    isMtg: true,
    ...overrides,
  };
  renderWithProviders(
    <Routes>
      <Route path={RouteEnum.DECK} element={<DeckEditorHeader {...props} />} />
      <Route path={RouteEnum.DECKS} element={<div>my decks</div>} />
    </Routes>,
    { route: '/deck/1', preloadedState: connectedState },
  );
  return props;
}

describe('DeckEditorHeader', () => {
  it('edits the name and format, and opens the exporter', () => {
    const props = renderHeader();
    fireEvent.change(screen.getByRole('textbox', { name: 'DeckHeader.name' }), { target: { value: 'Burn 2' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'FormatPicker.label' }), { target: { value: 'legacy' } });
    fireEvent.click(screen.getByRole('button', { name: 'DeckHeader.export' }));
    expect(props.onNameChange).toHaveBeenCalledWith('Burn 2');
    expect(props.onFormatChange).toHaveBeenCalledWith('legacy');
    expect(props.onExport).toHaveBeenCalled();
    expect(screen.getByText('history')).toBeInTheDocument();
    expect(screen.getByText('legality')).toBeInTheDocument();
  });

  it('offers Share deck only when given a handler', () => {
    const onShare = vi.fn();
    renderHeader({ onShare });
    fireEvent.click(screen.getByRole('button', { name: 'DeckSharing.shareDeck' }));
    expect(onShare).toHaveBeenCalled();
  });

  it('has no share button on a server without share links', () => {
    renderHeader();
    expect(screen.queryByRole('button', { name: 'DeckSharing.shareDeck' })).toBeNull();
  });

  it('shows the totals and the save state, and links back to My decks', () => {
    renderHeader({ totalSideboardCount: 2, saveState: 'dirty' });
    expect(screen.getByText('DeckHeader.cardCount · DeckHeader.sideboardCount')).toBeInTheDocument();
    expect(screen.getByText('DeckHeader.dirty')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'DeckHeader.myDecks' }));
    expect(screen.getByText('my decks')).toBeInTheDocument();
  });

  it.each([
    ['saving', 'DeckHeader.saving'],
    ['saved', 'DeckHeader.saved'],
  ] as const)('shows %s', (saveState, label) => {
    renderHeader({ saveState });
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('reports a failed save and retries it', () => {
    const props = renderHeader({ saveState: 'failed' });
    expect(screen.getByRole('alert')).toHaveTextContent('DeckHeader.saveFailed');
    fireEvent.click(screen.getByRole('button', { name: 'DeckHeader.retrySave' }));
    expect(props.onRetrySave).toHaveBeenCalled();
  });

  it('shows the buy button only for MTG decks', () => {
    renderHeader();
    expect(screen.getByText('DeckEditor.buy.deck')).toBeInTheDocument();
  });

  it('hides MTG-only features for other decks', () => {
    renderHeader({ isMtg: false });
    expect(screen.queryByText('DeckEditor.buy.deck')).toBeNull();
  });

  it('puts Open deck, print, online services, banner and playmat in the More menu', () => {
    const props = renderHeader();
    fireEvent.click(screen.getByRole('button', { name: 'DeckHeader.more' }));
    const menu = screen.getByRole('menu', { name: 'DeckHeader.more' });
    expect(menu).toHaveTextContent('OpenDeckButton.label');
    expect(menu).toHaveTextContent('DeckTools.print');
    expect(menu).toHaveTextContent('DeckTools.sendTo');
    fireEvent.click(screen.getByRole('menuitem', { name: 'DeckHeader.playmat' }));
    expect(props.onEditPlaymat).toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'DeckHeader.more' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'DeckHeader.bannerCard' }));
    expect(screen.getByRole('dialog', { name: 'DeckHeader.bannerCard' })).toBeInTheDocument();
  });

  it('leaves Open deck out of a draft that has no server id', () => {
    renderHeader({
      openDeck: {
        deckId: null, isModified: false, isBlank: true, saveNow: vi.fn(async () => true),
        discardChanges: vi.fn(), pauseAutosave: vi.fn(), resumeAutosave: vi.fn(),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'DeckHeader.more' }));
    expect(screen.queryByRole('menuitem', { name: 'OpenDeckButton.label' })).toBeNull();
  });

  it('lists the tags and edits them in a dialog', () => {
    const props = renderHeader({ tags: ['Aggro', 'Burn'] });
    expect(screen.getByRole('list', { name: 'DeckTags.label' })).toHaveTextContent('AggroBurn');
    fireEvent.click(screen.getByRole('button', { name: 'DeckHeader.editTags' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'DeckTags.remove' })[0]);
    expect(props.onTagsChange).toHaveBeenCalledWith(['Burn']);
  });

  it('shows the bracket the editor validated', () => {
    renderHeader({ bracketLevel: 3 });
    expect(screen.getByTitle('DeckHeader.bracketHint')).toHaveTextContent('DeckBracket.bracket 3 · DeckBracket.level.3');
  });
});
