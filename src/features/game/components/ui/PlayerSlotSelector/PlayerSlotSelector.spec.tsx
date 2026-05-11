import { render, screen, fireEvent, within } from '@testing-library/react';

import PlayerSlotSelector from './PlayerSlotSelector';

describe('PlayerSlotSelector', () => {
  it('renders nothing when no players are eligible', () => {
    const { container } = render(
      <PlayerSlotSelector
        label="Player 1"
        slot="a"
        players={[]}
        selectedPlayerId={undefined}
        onSelect={vi.fn()}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders with a single eligible player', () => {
    render(
      <PlayerSlotSelector
        label="Player 1"
        slot="a"
        players={[{ playerId: 2, name: 'Solo' }]}
        selectedPlayerId={2}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByTestId('player-slot-selector-a')).toBeInTheDocument();
    expect(screen.getByText('Player 1:')).toBeInTheDocument();
    expect(screen.getByText('Solo')).toBeInTheDocument();
  });

  it('renders with multiple players', () => {
    render(
      <PlayerSlotSelector
        label="Player 2"
        slot="b"
        players={[
          { playerId: 2, name: 'Alice' },
          { playerId: 3, name: 'Bob' },
        ]}
        selectedPlayerId={2}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByTestId('player-slot-selector-b')).toBeInTheDocument();
    expect(screen.getByText('Player 2:')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('fires onSelect with the chosen playerId', () => {
    const onSelect = vi.fn();
    render(
      <PlayerSlotSelector
        label="Player 1"
        slot="a"
        players={[
          { playerId: 2, name: 'Alice' },
          { playerId: 3, name: 'Bob' },
          { playerId: 4, name: 'Carol' },
        ]}
        selectedPlayerId={2}
        onSelect={onSelect}
      />,
    );

    fireEvent.mouseDown(screen.getByRole('combobox'));
    const listbox = within(screen.getByRole('listbox'));
    fireEvent.click(listbox.getByText('Carol'));

    expect(onSelect).toHaveBeenCalledWith(4);
  });
});
