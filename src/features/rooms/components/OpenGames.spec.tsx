import { screen } from '@testing-library/react';
import type { Room } from 'datatrice';
import { renderWithProviders, connectedWithRoomsState } from '../../../__test-utils__';
import OpenGames from './OpenGames';

vi.mock('@app/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@app/hooks')>();
  return { ...actual, useWebClient: vi.fn(() => ({})) };
});

describe('OpenGames', () => {
  // ServerInfo_Room is a protobuf-es Message with a required `$typeName`
  // brand; tests skip the runtime brand and rely on the cast since OpenGames
  // only reads info.roomId / info.name etc.
  const roomWithGames = {
    info: { roomId: 1, name: 'Main Room' },
    gametypeMap: {},
    order: 0,
    games: {},
    users: {},
  } as unknown as Room;

  it('renders the games table headers', () => {
    renderWithProviders(<OpenGames room={roomWithGames} />, {
      preloadedState: connectedWithRoomsState,
    });

    expect(screen.getByText('Age')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Creator')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Players')).toBeInTheDocument();
    expect(screen.getByText('Spectators')).toBeInTheDocument();
  });

  it('renders without crashing when no games exist', () => {
    const { container } = renderWithProviders(<OpenGames room={roomWithGames} />, {
      preloadedState: connectedWithRoomsState,
    });

    expect(container.querySelector('.games')).toBeInTheDocument();
  });
});
