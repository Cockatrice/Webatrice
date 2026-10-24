import { act, waitFor } from '@testing-library/react';

import { lookupCards, parseCod } from '@app/services';
import { connectedState, createMockWebClient, renderWithProviders } from '../../../__test-utils__';
import { useDeckImportFlow, type DeckImportFlow } from './useDeckImportFlow';
import { useDeckList } from './useDeckList';
import { hasUnloadRisk } from '../../../services/unloadGuard';

vi.mock('@app/services', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@app/services')>()),
  lookupCards: vi.fn(),
}));

let flow: DeckImportFlow;
function Probe() {
  const list = useDeckList({ onDeckCreated: () => {} });
  flow = useDeckImportFlow(true, list.importDeck);
  return null;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(lookupCards).mockResolvedValue(new Map([
    ['Lightning Bolt', { found: true, source: 'scryfall', name: 'Lightning Bolt', colors: ['R'], printings: [] }],
    ['Negate', { found: true, source: 'scryfall', name: 'Negate', colors: ['U'], printings: [] }],
  ]));
});

const DESKTOP_COD = '<cockatrice_deck version="1"><deckname>Desktop</deckname>'
  + '<zone name="main"><card name="Lightning Bolt" number="4"/></zone>'
  + '<zone name="side"><card name="Negate" number="2"/></zone>'
  + '<zone name="tokens"><card name="Goblin" number="1"/></zone></cockatrice_deck>';

it('guards pasted import work and releases it when the input is cleared', () => {
  renderWithProviders(<Probe />, { preloadedState: connectedState, webClient: createMockWebClient() });
  expect(hasUnloadRisk()).toBe(false);
  act(() => flow.setText('4 Lightning Bolt'));
  expect(hasUnloadRisk()).toBe(true);
  act(() => flow.setText(''));
  expect(hasUnloadRisk()).toBe(false);
});

it.each([
  ['paste', null],
  ['.cod file', new File([DESKTOP_COD], 'desktop.cod')],
  ['.txt file', new File(['4 Lightning Bolt\n\n2 Negate'], 'burn.txt')],
])('uploads the computed color identity on the first %s import', async (_source, file) => {
  const webClient = createMockWebClient();
  renderWithProviders(<Probe />, { preloadedState: connectedState, webClient });
  if (!file) {
    act(() => flow.setText('4 Lightning Bolt\nSB: 2 Negate'));
    await act(() => flow.resolve());
  } else {
    act(() => flow.pickFile(file));
  }
  await waitFor(() => expect(flow.phase).toBe('review'));
  expect(flow.totalCount).toBe(6);
  act(() => flow.confirm());

  expect(webClient.request.session.deckUpload).toHaveBeenCalledOnce();
  const args = vi.mocked(webClient.request.session.deckUpload).mock.calls[0];
  expect(args[4]).toBe('UR');
  const deck = parseCod(args[2]);
  expect(deck.cards.map((c) => [c.quantity, c.category])).toEqual([[4, 'main'], [2, 'sideboard']]);
  expect(lookupCards).toHaveBeenCalledOnce();
});

it('keeps desktop zones out of the lookup and the card count, and says they are kept', async () => {
  renderWithProviders(<Probe />, { preloadedState: connectedState, webClient: createMockWebClient() });
  act(() => flow.pickFile(new File([DESKTOP_COD], 'desktop.cod')));
  await waitFor(() => expect(flow.phase).toBe('review'));
  expect(flow.extraZones).toEqual([{ zone: 'tokens', count: 1 }]);
  expect(vi.mocked(lookupCards).mock.calls[0][0]).toHaveLength(2);
});

it('names an unnamed desktop deck after its file and infers the format', async () => {
  renderWithProviders(<Probe />, { preloadedState: connectedState, webClient: createMockWebClient() });
  const xml = '<cockatrice_deck version="1"><deckname></deckname>'
    + '<zone name="main"><card name="Lightning Bolt" number="4"/></zone></cockatrice_deck>';
  act(() => flow.pickFile(new File([xml], 'Mono Red.cod')));
  await waitFor(() => expect(flow.phase).toBe('review'));
  expect(flow.name).toBe('Mono Red');
  expect(flow.format).toBe('');
});

it('refuses files that are not decks', async () => {
  renderWithProviders(<Probe />, { preloadedState: connectedState, webClient: createMockWebClient() });
  act(() => flow.pickFile(new File(['x'], 'cards.xml')));
  expect(flow.error).toBe('DeckImport.error.notDeckFile');
  expect(flow.phase).toBe('input');
});

it('goes back to the review with an error when the upload cannot be sent', async () => {
  const onImport = vi.fn(() => false);
  function Offline() {
    flow = useDeckImportFlow(true, onImport);
    return null;
  }
  renderWithProviders(<Offline />);
  act(() => flow.setText('4 Lightning Bolt'));
  await act(() => flow.resolve());
  act(() => flow.confirm());
  expect(onImport).toHaveBeenCalledOnce();
  expect(flow.phase).toBe('review');
  expect(flow.error).toBe('DeckImport.error.notConnected');
});
