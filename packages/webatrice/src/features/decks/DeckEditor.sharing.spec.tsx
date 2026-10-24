import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { create } from '@bufbuild/protobuf';
import { server } from '@cockatrice/datatrice';
import { Response_DeckShareCreateSchema } from '@cockatrice/sockatrice/generated';
import { connected31State, createMockWebClient, renderWithProviders } from '../../__test-utils__';
import DeckEditor from './DeckEditor';
import { clearDeckEditorCache, setCachedDeck } from './deckEditorCache';
import { deckSaveSignature } from './deckPersistence';
import type { HydratedDeck } from './types';

beforeEach(() => clearDeckEditorCache());
afterEach(() => clearDeckEditorCache());

function renderEditor(overrides: Partial<HydratedDeck> = {}) {
  const deck: HydratedDeck = { name: '', format: '', cards: [], meta: { v: 1, updatedAt: '' }, ...overrides };
  setCachedDeck(5, { deck, savedSignature: deckSaveSignature(deck) });
  return renderWithProviders(
    <Routes><Route path="/deck/:deckId" element={<DeckEditor />} /></Routes>,
    { route: '/deck/5', preloadedState: connected31State, webClient: createMockWebClient() },
  );
}

describe('DeckEditor sharing', () => {
  it('cancels the pending share so its late answer is not copied', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    try {
      const { webClient, store } = renderEditor({ name: 'Named deck' });
      fireEvent.click(await screen.findByRole('button', { name: /DeckSharing.shareDeck/ }));
      fireEvent.click(screen.getByRole('button', { name: /DeckSharing.create/ }));
      await waitFor(() => expect(webClient.request.session.deckShareCreate).toHaveBeenCalledTimes(1));
      const requestId = vi.mocked(webClient.request.session.deckShareCreate).mock.calls[0][1];
      fireEvent.click(screen.getByRole('button', { name: 'DeckSharing.cancel' }));
      await act(async () => {
        store.dispatch(server.Actions.deckShareCreated({
          requestId, share: create(Response_DeckShareCreateSchema, { token: 'late' }),
        }));
      });
      expect(writeText).not.toHaveBeenCalled();
    } finally {
      if (original) {
        Object.defineProperty(navigator, 'clipboard', original);
      } else {
        Reflect.deleteProperty(navigator, 'clipboard');
      }
    }
  });

  it('refuses an otherwise blank deck that only has a game format', async () => {
    renderEditor({ format: 'modern' });
    fireEvent.click(await screen.findByRole('button', { name: /DeckSharing.shareDeck/ }));
    expect(screen.getByText('DeckSharing.emptyDeck')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'DeckSharing.nameLabel' })).toBeNull();
  });

  it.each([
    '<playmatCard>Island</playmatCard>',
    '<playmatCard providerId="art-1"></playmatCard>',
  ])('allows a deck whose only metadata is a playmat card: %s', async (playmatXml) => {
    renderEditor({ playmatXml });
    fireEvent.click(await screen.findByRole('button', { name: /DeckSharing.shareDeck/ }));
    expect(screen.getByRole('textbox', { name: 'DeckSharing.nameLabel' })).toBeInTheDocument();
  });

  it('refuses an empty playmat element', async () => {
    renderEditor({ playmatXml: '<playmatCard zoom="1"></playmatCard>' });
    fireEvent.click(await screen.findByRole('button', { name: /DeckSharing.shareDeck/ }));
    expect(screen.getByText('DeckSharing.emptyDeck')).toBeInTheDocument();
  });
});
