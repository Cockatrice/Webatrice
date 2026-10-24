import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { server } from '@cockatrice/datatrice';

import { connectedState, renderWithProviders } from '../../__test-utils__';
import { makeHost, makeKnownHostsHook } from './__mocks__/useKnownHosts';

const { loadPublicServers } = vi.hoisted(() => ({ loadPublicServers: vi.fn() }));

vi.mock('./useKnownHosts');
vi.mock('@app/services', async (orig) => ({
  ...(await orig<typeof import('@app/services')>()),
  loadPublicServers,
}));

import { useKnownHosts } from './useKnownHosts';
import { publicServersStore } from './usePublicServers';
import KnownHosts from './KnownHosts';

const SAVED = makeHost({ id: 1, name: 'Rooster', host: 'server.cockatrice.us/servatrice', port: '4748' });

function setup() {
  const created = makeHost({ id: 7, name: 'Fresh', host: 'fresh.example', port: '443', lastSelected: false });
  const hook = makeKnownHostsHook({ add: vi.fn().mockResolvedValue(created) });
  hook.value = { hosts: [SAVED], selectedHost: SAVED };
  vi.mocked(useKnownHosts).mockReturnValue(hook);
  const onChange = vi.fn();
  const view = renderWithProviders(<KnownHosts value={SAVED} onChange={onChange} />, { preloadedState: connectedState });
  return { ...view, hook, onChange, created };
}

const openPicker = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'KnownHosts.toggle' }));
  });
};

describe('KnownHosts public servers', () => {
  it('allows configuring the desktop port of a built-in host', async () => {
    setup();
    await openPicker();
    fireEvent.click(screen.getByRole('button', { name: 'KnownHosts.edit' }));
    expect(screen.getByRole('spinbutton', { name: 'KnownHostForm.label.desktopPort' })).toBeEnabled();
    expect(screen.getByRole('textbox', { name: 'Common.label.hostAddress' })).toBeDisabled();
  });

  beforeEach(() => {
    publicServersStore.reset();
    loadPublicServers.mockResolvedValue({
      stale: false,
      servers: [
        { name: 'Rooster Ranges', host: 'server.cockatrice.us', port: '4747', websocketPort: '443', isInactive: false },
        { name: 'Fresh', host: 'fresh.example', port: '4747', websocketPort: '443', location: 'USA', isInactive: false },
        { name: 'Desktop Only', host: 'tcp.example', port: '4747', isInactive: false },
        { name: 'Plain WS', host: 'ws.example', port: '4747', websocketPort: '4748', isInactive: false },
        { name: 'Gone', host: 'gone.example', isInactive: true },
      ],
    });
  });

  it('downloads the list only once the picker is opened', async () => {
    setup();
    expect(loadPublicServers).not.toHaveBeenCalled();

    await openPicker();
    expect(loadPublicServers).toHaveBeenCalledTimes(1);
  });

  it('lists new public servers without duplicating saved hosts, disabling the ones a browser cannot reach', async () => {
    setup();
    await openPicker();

    expect(screen.getByRole('button', { name: /Fresh/ })).toBeEnabled();
    const desktopOnly = screen.getByRole('button', { name: /Desktop Only/ });
    expect(desktopOnly).toBeDisabled();
    expect(desktopOnly).toHaveTextContent('KnownHosts.public.unavailable.noWebSocket');
    const plainWs = screen.getByRole('button', { name: /Plain WS/ });
    expect(plainWs).toBeDisabled();
    expect(plainWs).toHaveTextContent('KnownHosts.public.unavailable.noSecureWebSocket');
    expect(screen.queryByRole('button', { name: /Rooster Ranges/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Gone/ })).not.toBeInTheDocument();
  });

  it('saves a picked public server as a host and selects it', async () => {
    const { hook, onChange, created } = setup();
    await openPicker();

    await act(async () => {
      screen.getByRole('button', { name: /Fresh/ }).focus();
      fireEvent.click(screen.getByRole('button', { name: /Fresh/ }));
    });

    expect(hook.add).toHaveBeenCalledWith({ name: 'Fresh', host: 'fresh.example/servatrice', port: '443', editable: true });
    expect(hook.select).toHaveBeenCalledWith(created.id);
    expect(onChange).toHaveBeenCalledWith(created);
    expect(screen.getByRole('button', { name: 'KnownHosts.label' })).toHaveFocus();
  });

  it('explains when the list cannot be downloaded', async () => {
    loadPublicServers.mockRejectedValue(new TypeError('Failed to fetch'));
    setup();
    await openPicker();

    expect(screen.getByText('KnownHosts.public.error')).toBeInTheDocument();
  });

  it('re-downloads on refresh', async () => {
    setup();
    await openPicker();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'KnownHosts.public.refresh' }));
    });

    expect(loadPublicServers).toHaveBeenCalledTimes(2);
  });
});

describe('KnownHosts keyboard and screen-reader access', () => {
  beforeEach(() => {
    publicServersStore.reset();
    loadPublicServers.mockResolvedValue({ stale: false, servers: [] });
  });

  it('exposes the open state on the toggles', async () => {
    setup();
    const toggle = screen.getByRole('button', { name: 'KnownHosts.toggle' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await openPicker();

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'KnownHosts.label' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('lists saved hosts as options, marking the selected one', async () => {
    setup();
    await openPicker();

    const listbox = screen.getByRole('listbox', { name: 'KnownHosts.saved' });
    const [option] = within(listbox).getAllByRole('option');
    expect(option).toHaveTextContent('Rooster');
    expect(option).toHaveAttribute('aria-selected', 'true');
  });

  function setupMany(selected = 1) {
    const hook = makeKnownHostsHook();
    const hosts = [
      makeHost({ id: 1, name: 'Alpha', editable: true }),
      makeHost({ id: 2, name: 'Bravo' }),
      makeHost({ id: 3, name: 'Charlie' }),
    ];
    hook.value = { hosts, selectedHost: hosts[selected] };
    vi.mocked(useKnownHosts).mockReturnValue(hook);
    renderWithProviders(<KnownHosts value={hosts[selected]} onChange={vi.fn()} />, { preloadedState: connectedState });
    return { hook, hosts };
  }

  const activeOption = (listbox: HTMLElement) =>
    document.getElementById(listbox.getAttribute('aria-activedescendant') ?? '');

  it('scrolls the active option into view on opening and keyboard navigation', async () => {
    const scroll = vi.spyOn(HTMLElement.prototype, 'scrollIntoView');
    setupMany();
    await openPicker();
    const listbox = screen.getByRole('listbox');
    expect(scroll).toHaveBeenCalledWith({ block: 'nearest' });
    expect(scroll.mock.instances.at(-1)).toBe(activeOption(listbox));
    for (const key of ['End', 'Home', 'ArrowDown', 'c']) {
      scroll.mockClear();
      fireEvent.keyDown(listbox, { key });
      expect(scroll.mock.instances.at(-1)).toBe(activeOption(listbox));
    }
    scroll.mockRestore();
  });

  it.each(['KnownHosts.add', 'KnownHosts.edit'])('returns focus to the picker after closing %s', async (name) => {
    const user = userEvent.setup();
    setupMany(0);
    await openPicker();
    await user.click(screen.getByRole('button', { name }));
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'KnownHosts.label' })).toHaveFocus();
  });

  it('is a single tab stop whose options are not themselves focusable', async () => {
    setupMany();
    await openPicker();

    const listbox = screen.getByRole('listbox', { name: 'KnownHosts.saved' });
    expect(listbox).toHaveAttribute('tabindex', '0');
    for (const option of within(listbox).getAllByRole('option')) {
      expect(option).not.toHaveAttribute('tabindex');
      expect(within(option).queryByRole('button')).not.toBeInTheDocument();
    }
  });

  it('starts on the selected host and moves with the arrow, Home and End keys', async () => {
    const user = userEvent.setup();
    setupMany();
    await user.click(screen.getByRole('button', { name: 'KnownHosts.toggle' }));

    const listbox = screen.getByRole('listbox');
    listbox.focus();
    expect(activeOption(listbox)).toHaveTextContent('Bravo');

    await user.keyboard('{ArrowDown}');
    expect(activeOption(listbox)).toHaveTextContent('Charlie');
    await user.keyboard('{ArrowDown}');
    expect(activeOption(listbox)).toHaveTextContent('Charlie');
    await user.keyboard('{Home}');
    expect(activeOption(listbox)).toHaveTextContent('Alpha');
    await user.keyboard('{ArrowUp}');
    expect(activeOption(listbox)).toHaveTextContent('Alpha');
    await user.keyboard('{End}');
    expect(activeOption(listbox)).toHaveTextContent('Charlie');
  });

  it('jumps to a host by typing the start of its name', async () => {
    const user = userEvent.setup();
    setupMany();
    await user.click(screen.getByRole('button', { name: 'KnownHosts.toggle' }));

    const listbox = screen.getByRole('listbox');
    listbox.focus();
    await user.keyboard('ch');

    expect(activeOption(listbox)).toHaveTextContent('Charlie');
  });

  it.each([['Enter', '{Enter}'], ['Space', ' ']])('picks the active host with %s and returns focus to the picker', async (_, key) => {
    const user = userEvent.setup();
    const { hook, hosts } = setupMany();
    await user.click(screen.getByRole('button', { name: 'KnownHosts.toggle' }));

    screen.getByRole('listbox').focus();
    await user.keyboard('{Home}');
    await user.keyboard(key);

    expect(hook.select).toHaveBeenCalledWith(hosts[0].id);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'KnownHosts.label' })).toHaveFocus();
  });

  it('picks a host by click', async () => {
    const user = userEvent.setup();
    const { hook, hosts } = setupMany();
    await user.click(screen.getByRole('button', { name: 'KnownHosts.toggle' }));

    await user.click(screen.getByRole('option', { name: /Charlie/ }));

    expect(hook.select).toHaveBeenCalledWith(hosts[2].id);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('reaches the listbox and then the Edit control by Tab', async () => {
    const user = userEvent.setup();
    const editable = makeHost({ id: 3, name: 'Mine', editable: true });
    const hook = makeKnownHostsHook();
    hook.value = { hosts: [editable], selectedHost: editable };
    vi.mocked(useKnownHosts).mockReturnValue(hook);
    renderWithProviders(<KnownHosts value={editable} onChange={vi.fn()} />, { preloadedState: connectedState });
    await user.click(screen.getByRole('button', { name: 'KnownHosts.toggle' }));

    await user.tab();
    expect(screen.getByRole('button', { name: 'KnownHosts.add' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('listbox')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'KnownHosts.edit' })).toHaveFocus();
  });

  it('closes on Escape and returns focus to the picker', async () => {
    setup();
    await openPicker();

    screen.getByRole('listbox').focus();
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'KnownHosts.label' })).toHaveFocus();
  });

  it('offers one Edit control, outside the listbox, for an editable selected host', async () => {
    setupMany(0);
    await openPicker();

    const edit = screen.getByRole('button', { name: 'KnownHosts.edit' });
    expect(screen.getByRole('listbox')).not.toContainElement(edit);
  });

  it('offers Edit for a built-in selected host too, for its desktop port', async () => {
    setup();
    await openPicker();

    expect(screen.getByRole('button', { name: 'KnownHosts.edit' })).toBeInTheDocument();
  });

  it('announces the connection test result in a status region', () => {
    const { store } = setup();
    expect(screen.getByText('KnownHosts.status.testing')).toHaveAttribute('role', 'status');

    act(() => {
      store.dispatch(server.Actions.testConnectionFailed());
    });

    expect(screen.getByText('KnownHosts.status.failed')).toHaveAttribute('role', 'status');
  });
});

describe('KnownHosts summary variant', () => {
  const renderSummary = (testConnectionStatus: 'testing' | 'success' | 'failed') => {
    const hook = makeKnownHostsHook();
    hook.value = { hosts: [SAVED], selectedHost: SAVED };
    vi.mocked(useKnownHosts).mockReturnValue(hook);
    return renderWithProviders(<KnownHosts variant="summary" value={SAVED} onChange={vi.fn()} />, {
      preloadedState: { ...connectedState, server: { ...(connectedState.server as any), testConnectionStatus } },
    });
  };

  it('shows the selected server on one line with its status and address', () => {
    const { store } = renderSummary('success');
    act(() => {
      store.dispatch(server.Actions.testConnectionSuccessful({ supportsHashedPassword: true }));
    });
    expect(screen.getByText('Rooster')).toBeInTheDocument();
    expect(screen.getByText('KnownHosts.summary.success')).toBeInTheDocument();
    expect(screen.getByText(/server\.cockatrice\.us\/servatrice:4748/)).toBeInTheDocument();
  });

  it('opens the saved host list from "Change server" and returns focus to it after a pick', async () => {
    renderSummary('success');
    const change = screen.getByRole('button', { name: 'KnownHosts.change' });
    expect(change).toHaveAttribute('aria-expanded', 'false');

    await act(async () => {
      fireEvent.click(change);
    });
    expect(change).toHaveAttribute('aria-expanded', 'true');
    const list = screen.getByRole('listbox', { name: 'KnownHosts.saved' });

    await act(async () => {
      fireEvent.click(within(list).getByRole('option'));
    });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(change).toHaveFocus();
  });

  it('offers a re-test, disabled while a test runs', () => {
    renderSummary('testing');
    expect(screen.getByRole('button', { name: 'KnownHosts.refresh' })).toBeDisabled();
    expect(screen.getByText('KnownHosts.summary.testing')).toBeInTheDocument();
  });
});
