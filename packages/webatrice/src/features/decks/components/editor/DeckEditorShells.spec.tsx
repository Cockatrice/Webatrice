import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';

import { RouteEnum } from '@app/types';

import { DeckEditorSkeleton, DeckNotFound, EmptyCardsHint } from './DeckEditorShells';

vi.mock('@app/feature-wrappers/layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@app/components', () => ({ AuthGuard: () => null }));

const testI18n = i18n.createInstance();
testI18n.use(initReactI18next).init({ lng: 'en-US', resources: { 'en-US': { translation: {} } } });

describe('DeckEditorShells', () => {
  it('shows hydration without image progress in the skeleton', () => {
    render(<DeckEditorSkeleton />);
    expect(screen.getByText('DeckEditor.shell.loadingDeck')).toBeInTheDocument();
    expect(screen.queryByText('DeckEditor.shell.preloading')).not.toBeInTheDocument();
  });

  it('links a missing deck back to My Decks', () => {
    render(
      <MemoryRouter initialEntries={['/deck/9']}>
        <Routes>
          <Route path={RouteEnum.DECK} element={<DeckNotFound reason={null} />} />
          <Route path={RouteEnum.DECKS} element={<div>my decks</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('DeckEditor.shell.notFoundTitle')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'DeckEditor.shell.backToDecks' }));
    expect(screen.getByText('my decks')).toBeInTheDocument();
  });

  it('explains why a deck failed to load instead of calling it missing', () => {
    render(
      <MemoryRouter>
        <DeckNotFound reason="CommandFailure.timeout" />
      </MemoryRouter>,
    );
    expect(screen.getByText('DeckEditor.loadFailedTitle')).toBeInTheDocument();
    expect(screen.getByText('CommandFailure.timeout')).toBeInTheDocument();
    expect(screen.queryByText('DeckEditor.shell.notFoundTitle')).not.toBeInTheDocument();
  });

  it('points an empty deck at the right entry control', () => {
    const { rerender } = render(<I18nextProvider i18n={testI18n}><EmptyCardsHint isMtg /></I18nextProvider>);
    expect(screen.getByText('DeckEditor.shell.emptyMtg')).toBeInTheDocument();
    rerender(<I18nextProvider i18n={testI18n}><EmptyCardsHint isMtg={false} /></I18nextProvider>);
    expect(screen.getByText('DeckEditor.shell.emptyPlain')).toBeInTheDocument();
  });
});
