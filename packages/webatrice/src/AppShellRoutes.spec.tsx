import { screen } from '@testing-library/react';
import { useParams } from 'react-router-dom';
import { connectedState, renderWithProviders } from './__test-utils__';
import { persistLastRoute, loadPersistedLastRoute } from './services/storage/lastRoute';
import AppShellRoutes from './AppShellRoutes';

const staff = vi.hoisted(() => ({ allowed: false, imported: vi.fn(), rendered: vi.fn() }));
vi.mock('./feature-wrappers/staff/useStaffTools', () => ({ useStaffToolAvailable: () => staff.allowed }));
vi.mock('./feature-wrappers/layout', () => ({ Layout: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock('./features/server', () => ({ Server: () => <div>Home</div> }));
vi.mock('./RoutePrefetch', () => ({ default: () => null }));
vi.mock('./features/administration/Administration', () => {
  staff.imported('administration');
  return { default: () => {
    staff.rendered(); return <div>Administration</div>;
  } };
});
vi.mock('./features/moderation/Moderation', () => {
  staff.imported('moderation');
  return { default: () => {
    staff.rendered(); return <div>Moderation</div>;
  } };
});
vi.mock('./features/logs/Logs', () => {
  staff.imported('logs');
  return { default: () => {
    staff.rendered(); return <div>Logs</div>;
  } };
});
vi.mock('./features/card-art-rules/CardArtRules', () => {
  staff.imported('cardArtRules');
  return { default: () => {
    staff.rendered(); return <div>Card art rules</div>;
  } };
});
vi.mock('./features/developer/Developer', () => {
  staff.imported('developer');
  return { default: () => {
    staff.rendered(); return <div>Developer</div>;
  } };
});
vi.mock('./features/reports/ReportQueue', () => {
  staff.imported('reports');
  return { default: () => {
    staff.rendered(); return <div>Report queue</div>;
  } };
});
vi.mock('./features/game/Game', () => ({ default: function Game() {
  return <div>Game {useParams().gameId}</div>;
} }));
vi.mock('./features/game/replay/GameReplay', () => ({ default: function Replay() {
  return <div>Replay {useParams().replayKey}</div>;
} }));
vi.mock('./features/decks/DeckEditor', () => ({
  default: function Editor() {
    const params = useParams();
    return <div>Editor {params.deckId ?? params.token}</div>;
  },
}));
vi.mock('./features/decks/SharedDeck', () => ({ default: () => <div>Shared deck</div> }));
vi.mock('./features/decks/PublicDecks', () => ({ default: function Decks() {
  return <div>Public decks {useParams().userName}</div>;
} }));
vi.mock('./features/settings/Settings', () => ({ default: () => <div>Settings</div> }));

afterEach(() => {
  staff.allowed = false;
  localStorage.removeItem('webatrice.lastRoute');
});

it.each(['/administration', '/moderation', '/logs', '/card-art-rules', '/developer', '/report-queue'])(
  'gates %s before importing or rendering the staff page', async route => {
    renderWithProviders(<AppShellRoutes />, { route, preloadedState: connectedState });
    expect(await screen.findByText('Home')).toBeInTheDocument();
    expect(staff.imported).not.toHaveBeenCalled();
    expect(staff.rendered).not.toHaveBeenCalled();
  },
);

it('loads an authorized staff route', async () => {
  staff.allowed = true;
  renderWithProviders(<AppShellRoutes />, { route: '/administration', preloadedState: connectedState });
  expect(await screen.findByText('Administration')).toBeInTheDocument();
  expect(staff.rendered).toHaveBeenCalled();
});

it.each([
  ['/game/42', 'Game 42'],
  ['/deck/27', 'Editor 27'],
  ['/deck/draft/saved-draft', 'Editor saved-draft'],
  ['/replay/saved-replay', 'Replay saved-replay'],
  ['/decks/shared?share=abc', 'Shared deck'],
  ['/decks/public/alex', 'Public decks alex'],
  ['/settings', 'Settings'],
])('resolves the saved lazy route %s with its original parameters', async (route, expected) => {
  persistLastRoute(route);
  renderWithProviders(<AppShellRoutes />, { route: loadPersistedLastRoute()!, preloadedState: connectedState });
  expect(await screen.findByText(expected)).toBeInTheDocument();
});
