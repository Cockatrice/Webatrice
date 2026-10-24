import { fireEvent, render, screen } from '@testing-library/react';

import { MoveDeckDialog } from './MoveDeckDialog';

const deck = { id: 3, name: 'Burn', path: 'Modern', creationTime: 0, visibility: 'private' as const };

describe('MoveDeckDialog', () => {
  it('offers every folder except the current one and moves to the chosen one', () => {
    const props = { onCancel: vi.fn(), onMove: vi.fn() };
    render(<MoveDeckDialog deck={deck} folderPaths={['', 'Cube', 'Modern', 'Modern/Old']} {...props} />);

    const select = screen.getByRole('combobox', { name: 'MoveDeck.target' }) as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(['DeckFolders.root', 'Cube', 'Modern/Old']);

    fireEvent.change(select, { target: { value: 'Modern/Old' } });
    fireEvent.click(screen.getByRole('button', { name: /MoveDeck.move/ }));
    expect(props.onMove).toHaveBeenCalledWith('Modern/Old');
  });

  it('cannot move when there is no other folder', () => {
    render(<MoveDeckDialog deck={{ ...deck, path: '' }} folderPaths={['']} onCancel={vi.fn()} onMove={vi.fn()} />);
    expect(screen.getByRole('button', { name: /MoveDeck.move/ })).toBeDisabled();
  });
});
