import { act, fireEvent, screen, within } from '@testing-library/react';
import { useLocation, type InitialEntry } from 'react-router-dom';
import type { i18n as I18n } from 'i18next';
import { useTranslation } from 'react-i18next';

import { create } from '@bufbuild/protobuf';
import {
  Response_DeckListSchema,
  ServerInfo_DeckStorage_FileSchema,
  ServerInfo_DeckStorage_FolderSchema,
  ServerInfo_DeckStorage_TreeItemSchema,
  ServerInfo_User_UserLevelFlag as Level,
} from '@cockatrice/sockatrice/generated';
import {
  connectedState, connectedWithRoomsState, createMockWebClient, disconnectedState, makeUser, renderWithProviders,
} from '../../__test-utils__';
import { RouteEnum } from '@app/types';
import { closeReplay, getOpenedReplay, getOpenedReplays, loadPersistedLastRoute, openReplay } from '@app/services';
import { buildReplay, sayContainer } from '../../services/replay/__mocks__/fixtures';

import { getSettings, settingsStore } from '../../hooks/useSettings';
import NavRail from './NavRail';
import TopBar from './TopBar';

const TABS_KEY = 'webatrice.stickyTabs';
const OWNER_KEY = 'webatrice.stickyTabs.owner';
const IDENTITY = 'Test Server::testUser';

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

function Shell() {
  return (
    <>
      <NavRail />
      <TopBar />
    </>
  );
}

function renderTopBar(route: InitialEntry = RouteEnum.SERVER, preloadedState = connectedState) {
  return renderWithProviders(
    <>
      <Shell />
      <LocationProbe />
    </>,
    { preloadedState, route },
  );
}

const play = () => screen.getByRole('link', { name: 'NavRail.place.play' });
const strip = () => screen.getByRole('navigation', { name: 'TopBar.tabs.label' });

describe('TopBar identity changes', () => {
  it('leaves private chats out of the strip and out of saved tabs', () => {
    renderTopBar('/player/alice');

    expect(within(strip()).queryByRole('link', { name: 'alice' })).not.toBeInTheDocument();
    expect(within(strip()).queryByText('TopBar.group.chats')).not.toBeInTheDocument();
    fireEvent.click(play());
    expect(screen.queryByRole('link', { name: 'alice' })).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(TABS_KEY) ?? '[]')).toEqual([]);
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it.each(['/decks', '/deck/1', '/deck/draft/old'])(
    'strips persisted deck tabs and redirects from %s for a different identity', (route) => {
      renderTopBar(RouteEnum.DECKS).unmount();
      renderTopBar('/deck/1').unmount();
      expect(JSON.parse(window.localStorage.getItem(TABS_KEY)!)).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'deck' }),
      ]));
      window.localStorage.setItem(OWNER_KEY, 'Other Server::someoneElse');

      renderTopBar(route);

      expect(screen.getByTestId('location')).toHaveTextContent(RouteEnum.SERVER);
      expect(JSON.parse(window.localStorage.getItem(TABS_KEY)!)).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'deck' }),
      ]));
      expect(JSON.parse(window.localStorage.getItem(TABS_KEY)!)).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'decks' }),
      ]));
      expect(window.localStorage.getItem(OWNER_KEY)).toBe(IDENTITY);
    },
  );

  it('keeps the deck tab and route when the same identity signs in again', () => {
    window.localStorage.setItem(OWNER_KEY, IDENTITY);

    renderTopBar('/deck/1');

    expect(screen.getByTestId('location')).toHaveTextContent('/deck/1');
    expect(JSON.parse(window.localStorage.getItem(TABS_KEY)!)).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'deck', route: '/deck/1' }),
    ]));
  });

  it('records the owner on the first sign-in', () => {
    renderTopBar();

    expect(window.localStorage.getItem(OWNER_KEY)).toBe(IDENTITY);
  });
});

describe('TopBar user menu', () => {
  it('focuses a surviving tab after closing the focused tab', () => {
    renderTopBar(RouteEnum.ACCOUNT, connectedWithRoomsState);
    const accountTab = screen.getByRole('link', { name: 'UserMenu.account' }).parentElement!;
    const close = within(accountTab).getByRole('button', { name: 'TopBar.tabs.close' });
    close.focus();
    fireEvent.click(close);
    expect(screen.queryByRole('link', { name: 'UserMenu.account' })).not.toBeInTheDocument();
    expect(strip()).toContainElement(document.activeElement as HTMLElement);
    expect(document.activeElement).toHaveAttribute('href');
  });
  const moderatorState = {
    ...connectedState,
    server: {
      ...(connectedState.server as any),
      user: makeUser({ userLevel: Level.IsUser | Level.IsRegistered | Level.IsModerator }),
    },
  };

  const openMenuAndPick = (label: string) => {
    fireEvent.click(screen.getByRole('button', { name: 'testUser' }));
    fireEvent.click(screen.getByRole('menuitem', { name: label }));
  };

  afterEach(() => {
    window.localStorage.clear();
  });

  it('reaches Account from the menu and Settings from the rail, without stacking page tabs', () => {
    renderTopBar();

    openMenuAndPick('UserMenu.account');
    expect(screen.getByTestId('location')).toHaveTextContent(RouteEnum.ACCOUNT);
    expect(screen.getByRole('link', { name: /UserMenu\.account/ })).toHaveAttribute('aria-current', 'page');
    expect(document.title).toMatch(/UserMenu\.account · Webatrice$/);

    fireEvent.click(screen.getByRole('link', { name: 'NavRail.place.settings' }));
    expect(screen.getByTestId('location')).toHaveTextContent(RouteEnum.SETTINGS);
    expect(screen.getByRole('link', { name: 'NavRail.place.settings' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('link', { name: /UserMenu\.account/ })).not.toBeInTheDocument();
    expect(within(strip()).queryByRole('link', { name: /UserMenu\.settings/ })).not.toBeInTheDocument();
    expect(document.title).toMatch(/UserMenu\.settings · Webatrice$/);

    fireEvent.click(play());
    expect(screen.getByTestId('location')).toHaveTextContent(RouteEnum.SERVER);
  });

  it('leaves Settings out of the account menu, since the rail holds it', () => {
    renderTopBar();

    fireEvent.click(screen.getByRole('button', { name: 'testUser' }));

    expect(screen.queryByRole('menuitem', { name: 'UserMenu.settings' })).not.toBeInTheDocument();
  });

  it('gives an unsaved deck draft the deck editor tab', () => {
    renderTopBar('/deck/draft/abc');

    expect(screen.getByRole('link', { name: /TopBar\.tab\.unsavedDeck/ })).toHaveAttribute('aria-current', 'page');

    fireEvent.click(play());
    fireEvent.click(screen.getByRole('link', { name: /TopBar\.tab\.unsavedDeck/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/deck/draft/abc');
  });

  it('offers Logs to moderators only', () => {
    renderTopBar(RouteEnum.SERVER, moderatorState);

    openMenuAndPick('UserMenu.logs');
    expect(screen.getByTestId('location')).toHaveTextContent(RouteEnum.LOGS);
  });

  it('hides Logs from regular users', () => {
    renderTopBar();

    fireEvent.click(screen.getByRole('button', { name: 'testUser' }));
    expect(screen.getByRole('menuitem', { name: 'UserMenu.account' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'UserMenu.logs' })).not.toBeInTheDocument();
  });

  it('opens the card import dialog', () => {
    renderTopBar();

    openMenuAndPick('UserMenu.importCards');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('opens the debug log', () => {
    renderTopBar();

    openMenuAndPick('UserMenu.debugLog');
    expect(screen.getByRole('dialog', { name: /DebugLogDialog\.title/ })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'TopBar.user.signOut' })).not.toBeInTheDocument();
  });
});

describe('TopBar replays entry', () => {
  it('opens the replay list from the rail, without a strip tab for it', () => {
    renderTopBar();

    fireEvent.click(screen.getByRole('link', { name: 'NavRail.place.replays' }));

    expect(screen.getByTestId('location')).toHaveTextContent(RouteEnum.REPLAYS);
    expect(screen.getByRole('link', { name: 'NavRail.place.replays' })).toHaveAttribute('aria-current', 'page');
    expect(within(strip()).queryByRole('link', { name: 'TopBar.replays.tab' })).not.toBeInTheDocument();
  });

  afterEach(() => {
    getOpenedReplays().forEach(({ key }) => closeReplay(key));
  });

  it('shows an open replay as a tab titled after it', () => {
    const replayKey = openReplay(buildReplay([sayContainer(0)]), 'final.cor', createMockWebClient());
    renderTopBar(`/replay/${replayKey}`);

    expect(screen.getByRole('link', { name: /final\.cor/ })).toHaveAttribute('aria-current', 'page');
  });

  it('keeps the replay tab after switching to another tab, and returns to it', () => {
    const replayKey = openReplay(buildReplay([sayContainer(0)]), 'final.cor', createMockWebClient());
    renderTopBar(`/replay/${replayKey}`);

    fireEvent.click(play());
    expect(screen.getByTestId('location')).toHaveTextContent(RouteEnum.SERVER);
    const replayTab = screen.getByRole('link', { name: /final\.cor/ });
    expect(replayTab).not.toHaveAttribute('aria-current');

    fireEvent.click(replayTab);
    expect(screen.getByTestId('location')).toHaveTextContent(`/replay/${replayKey}`);
  });

  it('closing a replay tab closes the replay and unloads its game', () => {
    const webClient = createMockWebClient();
    const replayKey = openReplay(buildReplay([sayContainer(0)]), 'final.cor', webClient);
    const { gameId } = getOpenedReplay(replayKey)!;
    renderTopBar(RouteEnum.SERVER);

    const replayTab = screen.getByRole('link', { name: /final\.cor/ }).closest('li')!;
    fireEvent.click(within(replayTab).getByRole('button', { name: 'TopBar.tabs.close' }));

    expect(screen.queryByRole('link', { name: /final\.cor/ })).not.toBeInTheDocument();
    expect(getOpenedReplay(replayKey)).toBeUndefined();
    expect(webClient.unloadReplayGame).toHaveBeenCalledWith(gameId);
  });

  it('closes a tab on middle-click', () => {
    const replayKey = openReplay(buildReplay([sayContainer(0)]), 'final.cor', createMockWebClient());
    renderTopBar(RouteEnum.SERVER);

    fireEvent(screen.getByRole('link', { name: /final\.cor/ }), new MouseEvent('auxclick', { bubbles: true, button: 1 }));

    expect(screen.queryByRole('link', { name: /final\.cor/ })).not.toBeInTheDocument();
    expect(getOpenedReplay(replayKey)).toBeUndefined();
  });

  it('lists tabs as links in a labelled nav, with Close beside the link rather than inside it', () => {
    openReplay(buildReplay([sayContainer(0)]), 'final.cor', createMockWebClient());
    renderTopBar(RouteEnum.SERVER);

    const nav = screen.getByRole('navigation', { name: 'TopBar.tabs.label' });
    const replayLink = screen.getByRole('link', { name: /final\.cor/ });
    expect(nav).toContainElement(replayLink);
    const close = within(replayLink.closest('li')!).getByRole('button', { name: 'TopBar.tabs.close' });
    expect(replayLink).not.toContainElement(close);
    expect(screen.getByRole('list', { name: 'TopBar.group.replays' })).toContainElement(replayLink);
    expect(within(nav).queryByRole('link', { name: /TopBar\.tab\.lobby/ })).not.toBeInTheDocument();
  });
});

describe('TopBar report entries (#7091)', () => {
  function renderAs(version: string, userLevel: number) {
    renderTopBar(RouteEnum.SERVER, {
      ...connectedState,
      server: {
        ...(connectedState.server as any),
        info: { message: null, name: 'Test Server', version },
        user: makeUser({ userLevel }),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'testUser' }));
  }

  afterEach(() => {
    window.localStorage.clear();
  });

  it('shows My Reports to a registered user on 3.1 and opens it in a tab', () => {
    renderAs('3.1.0 ()', Level.IsUser | Level.IsRegistered);
    expect(screen.queryByRole('menuitem', { name: 'UserMenu.reportQueue' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'UserMenu.myReports' }));
    expect(screen.getByTestId('location')).toHaveTextContent(RouteEnum.MY_REPORTS);
    expect(screen.getByRole('link', { name: /UserMenu\.myReports/ })).toHaveAttribute('aria-current', 'page');
  });

  it('adds the Report Queue for moderators', () => {
    renderAs('3.1.0 ()', Level.IsUser | Level.IsRegistered | Level.IsModerator);
    fireEvent.click(screen.getByRole('menuitem', { name: 'UserMenu.reportQueue' }));
    expect(screen.getByTestId('location')).toHaveTextContent(RouteEnum.REPORT_QUEUE);
  });

  it('hides My Reports and disables the Report Queue on a 3.0 server', () => {
    renderAs('3.0.0 ()', Level.IsUser | Level.IsRegistered | Level.IsModerator);
    expect(screen.queryByRole('menuitem', { name: 'UserMenu.myReports' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'UserMenu.reportQueue' })).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('TopBar tab titles', () => {
  let i18n: I18n;
  function I18nProbe() {
    i18n = useTranslation().i18n;
    return null;
  }

  afterEach(async () => {
    await act(() => i18n.changeLanguage('en-US'));
    i18n.removeResourceBundle('en-US', 'translation');
    i18n.addResourceBundle('en-US', 'translation', {});
    i18n.removeResourceBundle('de', 'translation');
    window.localStorage.clear();
  });

  it('retitles sticky tabs when the language changes', async () => {
    window.localStorage.setItem(OWNER_KEY, IDENTITY);
    renderWithProviders(
      <>
        <I18nProbe />
        <TopBar />
      </>,
      { preloadedState: connectedState, route: '/decks/public/bob' },
    );
    i18n.addResourceBundle('en-US', 'translation', { TopBar: { tab: { publicDecks: 'Public decks of {name}' } } });
    i18n.addResourceBundle('de', 'translation', { TopBar: { tab: { publicDecks: 'Decks von {name}' } } });
    await act(() => i18n.changeLanguage('en-US'));
    expect(screen.getByRole('link', { name: 'Public decks of bob' })).toBeInTheDocument();

    await act(() => i18n.changeLanguage('de'));

    expect(screen.getByRole('link', { name: 'Decks von bob' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Public decks of bob' })).not.toBeInTheDocument();
  });

  it('names the browser tab after the active tab in the current language', async () => {
    renderWithProviders(
      <>
        <I18nProbe />
        <TopBar />
      </>,
      { preloadedState: connectedState, route: RouteEnum.SETTINGS },
    );
    i18n.addResourceBundle('en-US', 'translation', { UserMenu: { settings: 'Settings' } });
    i18n.addResourceBundle('de', 'translation', { UserMenu: { settings: 'Einstellungen' } });
    await act(() => i18n.changeLanguage('en-US'));
    expect(document.title).toBe('Settings · Webatrice');

    await act(() => i18n.changeLanguage('de'));

    expect(document.title).toBe('Einstellungen · Webatrice');
  });
});

describe('TopBar document title', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it.each([
    [RouteEnum.SERVER, 'TopBar.tab.lobby', {}],
    [RouteEnum.DECKS, 'TopBar.tab.myDecks', {}],
    [RouteEnum.REPLAYS, 'TopBar.replays.tab', {}],
    [RouteEnum.SETTINGS, 'UserMenu.settings', {}],
    ['/decks/public/bob', 'TopBar.tab.publicDecks', { name: 'bob' }],
  ])('names %s after its own page on a fresh profile', async (route, key, params) => {
    vi.resetModules();
    const { renderWithProviders: renderFresh } = await import('../../__test-utils__');
    const { default: FreshTopBar } = await import('./TopBar');
    let expected = '';
    function TitleProbe() {
      expected = useTranslation().t(key, params);
      return null;
    }

    renderFresh(<><FreshTopBar /><TitleProbe /></>, { preloadedState: connectedState, route });

    expect(document.title).toBe(`${expected} · Webatrice`);
  });
});

describe('TopBar deck tabs', () => {
  const deckTab = () => screen
    .queryAllByRole('link', { name: 'TopBar.tab.deck' })
    .map((tab) => tab.getAttribute('href'));

  beforeEach(async () => {
    window.localStorage.clear();
    settingsStore.reset();
    await getSettings();
  });

  afterEach(() => {
    window.localStorage.clear();
    settingsStore.reset();
  });

  it('opens each deck from Deck Storage in its own tab, as desktop always does', () => {
    renderTopBar('/deck/1').unmount();
    renderTopBar('/deck/2');

    expect(deckTab().sort()).toEqual(['/deck/1', '/deck/2']);
  });

  it('opens each deck in its own tab whatever "Open deck in new tab by default" says', async () => {
    const settings = await getSettings();
    settings.openDeckInNewTab = false;
    settingsStore.setValue(settings);

    renderTopBar('/deck/3').unmount();
    renderTopBar('/deck/4');

    expect(deckTab()).toEqual(expect.arrayContaining(['/deck/3', '/deck/4']));
  });

  it('puts a deck the editor loaded into its own tab in that tab\'s place', () => {
    renderTopBar('/deck/5').unmount();
    renderTopBar('/deck/6').unmount();
    renderTopBar({ pathname: '/deck/7', state: { replacesDeckId: 5 } });

    const tabs = deckTab();
    expect(tabs).not.toContain('/deck/5');
    expect(tabs.indexOf('/deck/7')).toBeLessThan(tabs.indexOf('/deck/6'));
  });

  it('closes the replaced tab when the loaded deck already has one', () => {
    renderTopBar('/deck/8').unmount();
    renderTopBar('/deck/9').unmount();
    renderTopBar({ pathname: '/deck/8', state: { replacesDeckId: 9 } });

    const tabs = deckTab();
    expect(tabs).not.toContain('/deck/9');
    expect(tabs.filter((tab) => tab === '/deck/8')).toHaveLength(1);
  });
});

describe('TopBar requests', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('asks for the deck list once connected, so a deck tab can be titled', () => {
    const webClient = createMockWebClient();
    renderWithProviders(<TopBar />, { preloadedState: connectedState, route: RouteEnum.SERVER, webClient });

    expect(webClient.request.session.deckList).toHaveBeenCalledTimes(1);
    expect(webClient.request.session.deckList).toHaveBeenCalledWith();
  });

  it('does not ask for the deck list when it is loaded or the client is offline', () => {
    const webClient = createMockWebClient();
    const loaded = {
      ...connectedState,
      server: { ...(connectedState.server as any), backendDecks: create(Response_DeckListSchema, {}) },
    };
    renderWithProviders(<TopBar />, { preloadedState: loaded, route: RouteEnum.SERVER, webClient }).unmount();
    renderWithProviders(<TopBar />, { preloadedState: disconnectedState, route: RouteEnum.SERVER, webClient });

    expect(webClient.request.session.deckList).not.toHaveBeenCalled();
  });

  it('leaves a room when its tab closes, and falls back to the Lobby when it was current', () => {
    const webClient = createMockWebClient();
    renderWithProviders(
      <>
        <TopBar />
        <LocationProbe />
      </>,
      { preloadedState: connectedWithRoomsState, route: '/room/1', webClient },
    );

    const roomTab = screen.getByRole('link', { name: /Main Room/ });
    expect(roomTab).toHaveAttribute('aria-current', 'page');
    fireEvent.click(within(roomTab.closest('li')!).getByRole('button', { name: 'TopBar.tabs.close' }));

    expect(webClient.request.rooms.leaveRoom).toHaveBeenCalledWith(1);
    expect(screen.getByTestId('location')).toHaveTextContent(RouteEnum.SERVER);
  });

  it('signs out by disconnecting', () => {
    const webClient = createMockWebClient();
    renderWithProviders(<Shell />, { preloadedState: connectedState, route: RouteEnum.SERVER, webClient });

    fireEvent.click(screen.getByRole('button', { name: 'testUser' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'TopBar.user.signOut' }));

    expect(webClient.request.authentication.disconnect).toHaveBeenCalledWith();
  });
});

describe('TopBar sticky tabs', () => {
  const STICKY_KEY = 'webatrice.stickyTabs';
  const persisted = (): { key: string }[] => JSON.parse(window.localStorage.getItem(STICKY_KEY) ?? '[]');

  afterEach(() => {
    window.localStorage.clear();
  });

  it('keeps a Shortcuts tab after leaving it, and saves it without its handlers', () => {
    renderTopBar(RouteEnum.SHORTCUTS);

    fireEvent.click(play());

    expect(screen.getByRole('link', { name: 'UserMenu.shortcuts' })).not.toHaveAttribute('aria-current');
    expect(persisted()).toContainEqual({
      key: 'shortcuts', type: 'shortcuts', titleKey: 'UserMenu.shortcuts', route: RouteEnum.SHORTCUTS, closeable: true,
    });
  });

  it('shows other pages only while they are current, and never saves them', () => {
    renderTopBar(RouteEnum.ACCOUNT);

    expect(screen.getByRole('link', { name: /UserMenu\.account/ })).toHaveAttribute('aria-current', 'page');
    expect(persisted().map(({ key }) => key)).not.toContain('account');
  });

  it('moves focus to the rail toggle when the last session tab closes', async () => {
    vi.resetModules();
    const { renderWithProviders: renderFresh } = await import('../../__test-utils__');
    const { default: FreshTopBar } = await import('./TopBar');
    const { default: FreshNavRail } = await import('./NavRail');
    renderFresh(<><FreshNavRail /><FreshTopBar /></>, { preloadedState: connectedState, route: RouteEnum.SHORTCUTS });
    fireEvent.click(play());

    const close = within(screen.getByRole('link', { name: 'UserMenu.shortcuts' }).closest('li')!)
      .getByRole('button', { name: 'TopBar.tabs.close' });
    close.focus();
    fireEvent.click(close);

    expect(within(strip()).queryAllByRole('link')).toEqual([]);
    expect(screen.getByRole('button', { name: 'NavRail.toggle.hide' })).toHaveFocus();
  });

  it('drops a sticky tab from the strip and from storage when it closes', () => {
    renderTopBar(RouteEnum.SHORTCUTS);

    const shortcuts = screen.getByRole('link', { name: 'UserMenu.shortcuts' }).closest('li')!;
    fireEvent.click(within(shortcuts).getByRole('button', { name: 'TopBar.tabs.close' }));

    expect(screen.queryByRole('link', { name: 'UserMenu.shortcuts' })).not.toBeInTheDocument();
    expect(persisted().map(({ key }) => key)).not.toContain('shortcuts');
    expect(screen.getByTestId('location')).toHaveTextContent(RouteEnum.SERVER);
  });

  it('titles a deck tab with its name from the deck list, and saves that name', () => {
    const burn = create(ServerInfo_DeckStorage_TreeItemSchema, {
      id: 21, name: 'Burn', file: create(ServerInfo_DeckStorage_FileSchema, {}),
    });
    const folder = create(ServerInfo_DeckStorage_TreeItemSchema, {
      name: 'Modern', folder: create(ServerInfo_DeckStorage_FolderSchema, { items: [burn] }),
    });
    const withDecks = {
      ...connectedState,
      server: {
        ...(connectedState.server as any),
        backendDecks: create(Response_DeckListSchema, {
          root: create(ServerInfo_DeckStorage_FolderSchema, { items: [folder] }),
        }),
      },
    };
    renderTopBar('/deck/21', withDecks);

    expect(screen.getByRole('link', { name: 'Burn' })).toHaveAttribute('aria-current', 'page');
    expect(persisted()).toContainEqual(expect.objectContaining({ key: 'deck:21', title: 'Burn' }));
  });

  it('restores saved tabs on load, dropping malformed ones and retitling ones saved translated', async () => {
    window.localStorage.setItem(STICKY_KEY, JSON.stringify([
      { key: 'public-decks:ann', type: 'decks', title: 'Decks von ann', route: '/decks/public/ann', closeable: true },
      { key: 'player:bob', type: 'player', title: 'bob', route: '/player/bob', closeable: true },
      { key: 'bogus', type: 'bogus', title: 'Bogus', route: '/bogus', closeable: true },
      { key: 'player:', type: 'player', route: '/player', closeable: true },
    ]));
    vi.resetModules();
    const { renderWithProviders: renderFresh } = await import('../../__test-utils__');
    const { default: FreshTopBar } = await import('./TopBar');

    renderFresh(<FreshTopBar />, { preloadedState: connectedState, route: RouteEnum.SERVER });

    expect(screen.getByRole('link', { name: 'TopBar.tab.publicDecks' })).toHaveAttribute('href', '/decks/public/ann');
    expect(screen.queryByRole('link', { name: 'bob' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Decks von ann' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Bogus' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'TopBar.tab.player' })).not.toBeInTheDocument();
  });

  it('purges a foreign owner\'s deck tabs before selecting the Lobby on a restored deck route', async () => {
    window.localStorage.setItem(OWNER_KEY, 'Test Server::someoneElse');
    window.localStorage.setItem(STICKY_KEY, JSON.stringify([
      { key: 'decks', type: 'decks', titleKey: 'TopBar.tab.myDecks', route: '/decks', closeable: true },
      { key: 'deck:5', type: 'deck', title: 'Foreign deck', route: '/deck/5', closeable: true },
    ]));
    vi.resetModules();
    const { renderWithProviders: renderFresh } = await import('../../__test-utils__');
    const { default: FreshTopBar } = await import('./TopBar');

    renderFresh(<><FreshTopBar /><LocationProbe /></>, { preloadedState: connectedState, route: '/deck/5' });

    expect(screen.getByTestId('location')).toHaveTextContent(RouteEnum.SERVER);
    expect(document.title).toMatch(/TopBar\.tab\.lobby · Webatrice$/);
    expect(screen.queryAllByRole('link').filter((link) => /^\/decks?$|^\/deck\//.test(link.getAttribute('href') ?? ''))).toEqual([]);
    expect(persisted().filter(({ key }) => key === 'decks' || key.startsWith('deck:'))).toEqual([]);
  });
});

describe('TopBar last route', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('saves the current route for the next launch', () => {
    renderTopBar(RouteEnum.SETTINGS);
    expect(loadPersistedLastRoute()).toBe(RouteEnum.SETTINGS);

    fireEvent.click(play());

    expect(loadPersistedLastRoute()).toBe(RouteEnum.SERVER);
  });
});

describe('TopBar without local storage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('still renders when the browser blocks local storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    renderTopBar(RouteEnum.SETTINGS);

    expect(screen.getByRole('link', { current: 'page' })).toHaveAttribute('href', RouteEnum.SETTINGS);
  });
});
