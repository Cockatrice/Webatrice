import { create } from '@bufbuild/protobuf';

import {
  Response_DeckListSchema,
  ServerInfo_DeckStorage_FileSchema,
  ServerInfo_DeckStorage_FolderSchema,
  ServerInfo_DeckStorage_TreeItemSchema,
} from '@cockatrice/sockatrice/generated';
import { connectedState, createMockWebClient, disconnectedState, renderWithProviders } from '../../../__test-utils__';

import { useBackendDeckNames } from './useBackendDeckNames';

let names: ReadonlyMap<number, string> | undefined;
function Probe() {
  names = useBackendDeckNames();
  return null;
}

const withDeckList = (backendDecks: unknown) => ({
  ...connectedState,
  server: { ...(connectedState.server as any), backendDecks },
});

describe('useBackendDeckNames', () => {
  it('asks for the deck list once connected when none is loaded', () => {
    const webClient = createMockWebClient();

    renderWithProviders(<Probe />, { preloadedState: connectedState, webClient });

    expect(webClient.request.session.deckList).toHaveBeenCalledTimes(1);
    expect(webClient.request.session.deckList).toHaveBeenCalledWith();
    expect(names?.size).toBe(0);
  });

  it('does not ask while offline', () => {
    const webClient = createMockWebClient();

    renderWithProviders(<Probe />, { preloadedState: disconnectedState, webClient });

    expect(webClient.request.session.deckList).not.toHaveBeenCalled();
  });

  it('names the loaded decks without asking again', () => {
    const webClient = createMockWebClient();
    const burn = create(ServerInfo_DeckStorage_TreeItemSchema, {
      id: 7, name: 'Burn', file: create(ServerInfo_DeckStorage_FileSchema, {}),
    });
    const deckList = create(Response_DeckListSchema, {
      root: create(ServerInfo_DeckStorage_FolderSchema, { items: [burn] }),
    });

    renderWithProviders(<Probe />, { preloadedState: withDeckList(deckList), webClient });

    expect(webClient.request.session.deckList).not.toHaveBeenCalled();
    expect(names).toEqual(new Map([[7, 'Burn']]));
  });
});
