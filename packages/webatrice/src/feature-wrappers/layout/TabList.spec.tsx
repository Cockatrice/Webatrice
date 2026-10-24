import { fireEvent, screen, within } from '@testing-library/react';

import { renderWithProviders } from '../../__test-utils__';

import TabList from './TabList';
import type { StripGroup, Tab } from './topBarTabs';

const account: Tab = { key: 'account', type: 'account', titleKey: 'UserMenu.account', route: '/account', closeable: false };
const deck: Tab = {
  key: 'deck:3', type: 'deck', titleKey: 'TopBar.tab.deck', titleParams: { id: '3' }, route: '/deck/3', closeable: true,
};
const game: Tab = { key: 'game:7', type: 'game', title: 'Friday', route: '/game/7', closeable: true, spectating: true };

const groups: StripGroup[] = [
  { key: 'games', tabs: [game] },
  { key: 'decks', tabs: [deck] },
  { key: 'pages', tabs: [account] },
];

function renderTabs(activeKey = 'account', unreadOf?: (tab: Tab) => number) {
  const onClose = vi.fn();
  renderWithProviders(<TabList groups={groups} activeKey={activeKey} onClose={onClose} unreadOf={unreadOf} />);
  return onClose;
}

describe('TabList', () => {
  it('lists each tab as a link in a labelled nav, marking the current one', () => {
    renderTabs('deck:3');

    const nav = screen.getByRole('navigation', { name: 'TopBar.tabs.label' });
    expect(within(nav).getByRole('link', { name: 'UserMenu.account' })).toHaveAttribute('href', '/account');
    expect(within(nav).getByRole('link', { name: 'UserMenu.account' })).not.toHaveAttribute('aria-current');
    expect(within(nav).getByRole('link', { name: 'TopBar.tab.deck' })).toHaveAttribute('aria-current', 'page');
  });

  it('groups tabs under their kind, in order', () => {
    renderTabs();

    expect(screen.getAllByRole('list')).toHaveLength(3);
    const list = (name: string) => screen.getByRole('list', { name });
    expect(list('TopBar.group.games')).toContainElement(screen.getByRole('link', { name: /Friday/ }));
    expect(list('TopBar.group.decks')).toContainElement(screen.getByRole('link', { name: 'TopBar.tab.deck' }));
    expect(list('TopBar.group.pages')).toContainElement(screen.getByRole('link', { name: 'UserMenu.account' }));
  });

  it('says when a game is only being watched', () => {
    renderTabs();

    expect(screen.getByRole('link', { name: /Friday/ })).toHaveAccessibleName('Friday TopBar.tabs.spectating');
  });

  it('shows the unread count in the tab name', () => {
    renderTabs('account', (tab) => (tab.key === 'deck:3' ? 0 : tab.key === 'game:7' ? 4 : 0));

    expect(screen.getByRole('link', { name: /Friday/ })).toHaveAccessibleName('Friday TopBar.tabs.spectating UnreadBadge.label');
    expect(screen.getByRole('link', { name: /Friday/ })).toHaveTextContent('4');
    expect(screen.getByRole('link', { name: 'TopBar.tab.deck' })).not.toHaveTextContent(/\d/);
  });

  it('closes a closeable tab from its Close button', () => {
    const onClose = renderTabs();

    const deckTab = screen.getByRole('link', { name: 'TopBar.tab.deck' }).closest('li')!;
    fireEvent.click(within(deckTab).getByRole('button', { name: 'TopBar.tabs.close' }));

    expect(onClose).toHaveBeenCalledWith(deck);
  });

  it('hands focus back when the last closeable tab goes', () => {
    const onClose = vi.fn();
    const onLastClosed = vi.fn();
    renderWithProviders(
      <TabList groups={[{ key: 'decks', tabs: [deck] }]} activeKey="" onClose={onClose} onLastClosed={onLastClosed} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'TopBar.tabs.close' }));

    expect(onLastClosed).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith(deck);
  });

  it('focuses a neighbour instead while other tabs remain', () => {
    const onLastClosed = vi.fn();
    renderWithProviders(<TabList groups={groups} activeKey="account" onClose={vi.fn()} onLastClosed={onLastClosed} />);

    const deckTab = screen.getByRole('link', { name: 'TopBar.tab.deck' }).closest('li')!;
    fireEvent.click(within(deckTab).getByRole('button', { name: 'TopBar.tabs.close' }));

    expect(onLastClosed).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'UserMenu.account' })).toHaveFocus();
  });

  it('gives a pinned tab no Close button', () => {
    renderTabs();

    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(within(screen.getByRole('link', { name: 'UserMenu.account' }).closest('li')!).queryByRole('button')).toBeNull();
  });

  it('closes on middle-click, but never a pinned tab', () => {
    const onClose = renderTabs();

    fireEvent(screen.getByRole('link', { name: 'UserMenu.account' }), new MouseEvent('auxclick', { bubbles: true, button: 1 }));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent(screen.getByRole('link', { name: 'TopBar.tab.deck' }), new MouseEvent('auxclick', { bubbles: true, button: 1 }));
    expect(onClose).toHaveBeenCalledWith(deck);
  });
});
