import { fireEvent, render, screen } from '@testing-library/react';

import { DeckLinkHandoff } from './DeckLinkHandoff';

function typeUrl(url: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'DeckLink.label' }), { target: { value: url } });
}

describe('DeckLinkHandoff', () => {
  it('links a TappedOut deck to its text export', () => {
    render(<DeckLinkHandoff />);
    typeUrl('https://tappedout.net/mtg-decks/my-burn/');
    expect(screen.getByText('DeckLink.copyText')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'DeckLink.open' });
    expect(link).toHaveAttribute('href', 'https://tappedout.net/mtg-decks/my-burn/?fmt=txt');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('links a Moxfield deck to its page, whose Export copies the list', () => {
    render(<DeckLinkHandoff />);
    typeUrl('https://moxfield.com/decks/abc_123');
    expect(screen.getByText('DeckLink.copyFromPage')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'DeckLink.open' })).toHaveAttribute('href', 'https://moxfield.com/decks/abc_123');
  });

  it('says which sites are supported for any other link, and nothing for an empty field', () => {
    render(<DeckLinkHandoff />);
    expect(screen.queryByRole('alert')).toBeNull();
    typeUrl('https://example.com/deck/1');
    expect(screen.getByRole('alert')).toHaveTextContent('DeckLink.unsupported');
  });
});
