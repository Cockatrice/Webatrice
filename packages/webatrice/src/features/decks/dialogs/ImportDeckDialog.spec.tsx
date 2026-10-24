import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { lookupCards, parseCod } from '@app/services';

import { ImportDeckDialog } from './ImportDeckDialog';

vi.mock('@app/services', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@app/services')>()),
  lookupCards: vi.fn(),
}));

const COD = '<cockatrice_deck version="1"><deckname>From File</deckname><format>legacy</format>'
  + '<comments>{"v":1,"updatedAt":"x","priceUsd":5}</comments>'
  + '<zone name="main"><card number="4" name="Lightning Bolt"/></zone></cockatrice_deck>';

function fileInput(): HTMLInputElement {
  return screen.getByLabelText('ImportDeckDialog.uploadFile', { selector: 'input' }) as HTMLInputElement;
}

describe('ImportDeckDialog', () => {
  it('rejects a paste with no recognisable cards', () => {
    render(<ImportDeckDialog open onClose={() => {}} onImport={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('ImportDeckDialog.placeholder'), { target: { value: '???' } });
    fireEvent.click(screen.getByRole('button', { name: 'ImportDeckDialog.next' }));
    expect(screen.getByRole('alert')).toHaveTextContent('DeckImport.error.noCards');
    expect(lookupCards).not.toHaveBeenCalled();
  });

  it('resolves a paste, reviews matched and unknown cards, then imports the .cod', async () => {
    vi.mocked(lookupCards).mockResolvedValue(new Map([
      ['Sol Ring', { found: true, source: 'scryfall', name: 'Sol Ring', printings: [] }],
    ]));
    const onImport = vi.fn((_xml: string, _colors: string) => true);
    render(<ImportDeckDialog open onClose={() => {}} onImport={onImport} />);

    fireEvent.change(screen.getByPlaceholderText('ImportDeckDialog.placeholder'), {
      target: { value: '1 Sol Ring\n2 Nope\n???' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'ImportDeckDialog.next' }));

    expect(await screen.findByText('ImportDeckDialog.review.matched')).toBeInTheDocument();
    expect(screen.getByText('ImportDeckDialog.review.missing')).toBeInTheDocument();
    expect(screen.getByText(/ImportDeckDialog.review.ignored/)).toBeInTheDocument();
    expect(screen.getByText('???')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Common.action.back' }));
    expect(screen.getByPlaceholderText('ImportDeckDialog.placeholder')).toHaveValue('1 Sol Ring\n2 Nope\n???');
    fireEvent.click(screen.getByRole('button', { name: 'ImportDeckDialog.next' }));
    fireEvent.click(await screen.findByRole('button', { name: 'ImportDeckDialog.importCards' }));

    expect(screen.getByText('ImportDeckDialog.importing')).toBeInTheDocument();
    const deck = parseCod(onImport.mock.calls[0][0]);
    expect(deck.cards.map((c) => [c.name, c.quantity])).toEqual([['Sol Ring', 1], ['Nope', 2]]);
  });

  it('opens a .cod file into the review and imports it with its own name, format and metadata', async () => {
    vi.mocked(lookupCards).mockResolvedValue(new Map());
    const onImport = vi.fn((_xml: string, _colors: string) => true);
    render(<ImportDeckDialog open onClose={() => {}} onImport={onImport} />);

    fireEvent.change(fileInput(), { target: { files: [new File([COD], 'bolt.cod')] } });

    expect(await screen.findByText('bolt.cod')).toBeInTheDocument();
    expect(screen.getByText('ImportDeckDialog.review.missing')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ImportDeckDialog.importCards' }));
    await waitFor(() => expect(onImport).toHaveBeenCalledOnce());

    const deck = parseCod(onImport.mock.calls[0][0]);
    expect(deck.name).toBe('From File');
    expect(deck.format).toBe('legacy');
    expect(deck.meta.priceUsd).toBe(5);
  });

  it('reports a file that is not a deck', async () => {
    render(<ImportDeckDialog open onClose={() => {}} onImport={() => {}} />);
    fireEvent.change(fileInput(), { target: { files: [new File(['x'], 'notes.pdf')] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('DeckImport.error.notDeckFile');
  });
});
