import { vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { makeGame, makeUser } from '@cockatrice/datatrice/testing';

import * as gameCardModel from './gameCardModel';
import GameCard from './GameCard';

const game = (overrides: Parameters<typeof makeGame>[0] = {}) => makeGame({
  gameId: 7,
  description: 'Commander night',
  playerCount: 1,
  maxPlayers: 4,
  spectatorsAllowed: true,
  creatorInfo: makeUser({ name: 'Alice', country: 'us' }),
  gameTypes: [1, 2, 3],
  ...overrides,
});

const MAP = { 1: 'Commander', 2: 'cEDH', 3: 'Legacy' };

describe('GameCard', () => {
  it('shows the title, host, formats and seats', () => {
    render(<GameCard game={game()} gametypeMap={MAP} onJoin={vi.fn()} onSpectate={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Commander night' })).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Commander')).toBeInTheDocument();
    expect(screen.getByText('cEDH')).toBeInTheDocument();
    expect(screen.queryByText('Legacy')).not.toBeInTheDocument();
    expect(screen.getByText('GameCard.moreFormats')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'DesignSystem.seats' })).toBeInTheDocument();
  });

  it('names an untitled game by its id', () => {
    render(<GameCard game={game({ description: '' })} onJoin={vi.fn()} onSpectate={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'GameCard.untitled' })).toBeInTheDocument();
  });

  it('hands the game to Join and Spectate', () => {
    const onJoin = vi.fn();
    const onSpectate = vi.fn();
    const g = game();
    render(<GameCard game={g} onJoin={onJoin} onSpectate={onSpectate} />);
    fireEvent.click(screen.getByRole('button', { name: 'GameCard.joinLabel' }));
    fireEvent.click(screen.getByRole('button', { name: 'GameCard.spectateLabel' }));
    expect(onJoin).toHaveBeenCalledWith(g);
    expect(onSpectate).toHaveBeenCalledWith(g);
  });

  it('disables Join with the reason for a full game', () => {
    render(<GameCard game={game({ playerCount: 4 })} onJoin={vi.fn()} onSpectate={vi.fn()} />);
    const join = screen.getByRole('button', { name: 'GameCard.joinBlockedLabel' });
    expect(join).toBeDisabled();
    expect(join).toHaveAttribute('title', 'GameCard.blocked.full');
  });

  it('says when Join asks for a password', () => {
    render(<GameCard game={game({ withPassword: true })} onJoin={vi.fn()} onSpectate={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'GameCard.joinPasswordLabel' })).toBeEnabled();
  });

  it('disables Spectate when spectators are not allowed', () => {
    render(<GameCard game={game({ spectatorsAllowed: false })} onJoin={vi.fn()} onSpectate={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'GameCard.spectateLabel' })).toBeDisabled();
  });

  it('disables both actions while a join is pending', () => {
    render(<GameCard game={game()} busy onJoin={vi.fn()} onSpectate={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'GameCard.joinLabel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'GameCard.spectateLabel' })).toBeDisabled();
  });

  it('does not recompute an unchanged card when its parent redraws', () => {
    const actions = vi.spyOn(gameCardModel, 'gameCardActions');
    const props = { game: game(), onJoin: vi.fn(), onSpectate: vi.fn() };
    const view = render(<GameCard {...props} />);
    actions.mockClear();

    view.rerender(<GameCard {...props} />);

    expect(actions).not.toHaveBeenCalled();
  });
});
