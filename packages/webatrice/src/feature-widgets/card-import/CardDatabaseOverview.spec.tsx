import { fireEvent, screen, waitFor } from '@testing-library/react';

import { renderWithProviders } from '../../__test-utils__';

const hoisted = vi.hoisted(() => ({ useCardDatabaseOverview: vi.fn() }));

vi.mock('./useCardDatabaseOverview', () => ({ useCardDatabaseOverview: hoisted.useCardDatabaseOverview }));

import CardDatabaseOverview from './CardDatabaseOverview';

const source = (overrides = {}) => ({
  id: 'main',
  kind: 'main',
  fileName: 'cards.xml',
  origin: 'file',
  order: 0,
  importedAt: '2026-10-01T00:00:00.000Z',
  counts: { cards: 10, sets: 2, tokens: 0, formats: 1 },
  sourceVersion: '5.2.1',
  ...overrides,
});

function makeHook(overrides = {}) {
  return {
    loading: false,
    busy: null,
    sources: [
      source(),
      source({ id: 'custom:01:cube.xml', kind: 'custom', fileName: 'cube.xml', sourceVersion: undefined }),
    ],
    summary: { cards: 10, sets: 2, tokens: 3, formats: 1 },
    lastUpdateCheck: undefined,
    message: null,
    unknownSets: [],
    reload: vi.fn(),
    addCustomFiles: vi.fn(),
    removeSource: vi.fn(),
    updateTokens: vi.fn(),
    updateSpoilers: vi.fn(),
    checkCardDatabase: vi.fn(),
    answerUnknownSets: vi.fn().mockResolvedValue(undefined),
    showUnknownSets: vi.fn(),
    ...overrides,
  };
}

describe('CardDatabaseOverview', () => {
  it('shows what is loaded, in load order, with versions', () => {
    hoisted.useCardDatabaseOverview.mockReturnValue(makeHook());
    renderWithProviders(<CardDatabaseOverview />);

    expect(screen.getByText('CardDatabaseOverview.summary')).toBeInTheDocument();
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((r) => r.querySelector('td')?.firstChild?.textContent)).toEqual(['cards.xml', 'cube.xml']);
    expect(screen.getByText('CardDatabaseOverview.version')).toBeInTheDocument();
  });

  it('only lets custom sets and spoilers be removed', () => {
    const hook = makeHook();
    hoisted.useCardDatabaseOverview.mockReturnValue(hook);
    renderWithProviders(<CardDatabaseOverview />);

    const removes = screen.getAllByRole('button', { name: /CardDatabaseOverview.button.remove/ });
    expect(removes).toHaveLength(1);
    fireEvent.click(removes[0]);
    expect(hook.removeSource).toHaveBeenCalledWith('custom:01:cube.xml');
  });

  it('lets an earlier import be removed', () => {
    const hook = makeHook({ sources: [source({ id: 'legacy', kind: 'legacy', origin: 'migration' })] });
    hoisted.useCardDatabaseOverview.mockReturnValue(hook);
    renderWithProviders(<CardDatabaseOverview />);

    fireEvent.click(screen.getByRole('button', { name: /CardDatabaseOverview.button.remove/ }));
    expect(hook.removeSource).toHaveBeenCalledWith('legacy');
  });

  it('runs the database actions', () => {
    const hook = makeHook();
    hoisted.useCardDatabaseOverview.mockReturnValue(hook);
    renderWithProviders(<CardDatabaseOverview />);

    fireEvent.click(screen.getByRole('button', { name: 'CardDatabaseOverview.button.reload' }));
    fireEvent.click(screen.getByRole('button', { name: 'CardDatabaseOverview.button.updateTokens' }));
    fireEvent.click(screen.getByRole('button', { name: 'CardDatabaseOverview.button.updateSpoilers' }));
    fireEvent.click(screen.getByRole('button', { name: 'CardDatabaseOverview.button.checkCards' }));
    expect(hook.reload).toHaveBeenCalled();
    expect(hook.updateTokens).toHaveBeenCalled();
    expect(hook.updateSpoilers).toHaveBeenCalled();
    expect(hook.checkCardDatabase).toHaveBeenCalled();

    const file = new File(['<x/>'], 'cube.xml');
    fireEvent.change(screen.getByTestId('custom-set-input'), { target: { files: [file] } });
    expect(hook.addCustomFiles).toHaveBeenCalledWith([file]);
  });

  it('disables actions while one is running', () => {
    hoisted.useCardDatabaseOverview.mockReturnValue(makeHook({ busy: 'tokens' }));
    renderWithProviders(<CardDatabaseOverview />);
    expect(screen.getByRole('button', { name: 'CardDatabaseOverview.button.updateSpoilers' })).toBeDisabled();
  });

  it('asks about new sets and opens Manage Sets on "View sets"', async () => {
    const hook = makeHook({ unknownSets: ['NEO', 'DMU'] });
    hoisted.useCardDatabaseOverview.mockReturnValue(hook);
    const onViewSets = vi.fn();
    renderWithProviders(<CardDatabaseOverview onViewSets={onViewSets} />);

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'CardDatabaseOverview.newSets.view' }));
    await waitFor(() => expect(onViewSets).toHaveBeenCalled());
    expect(hook.answerUnknownSets).toHaveBeenCalledWith('keep-disabled');
  });

  it('shows the outcome of the last action', () => {
    hoisted.useCardDatabaseOverview.mockReturnValue(makeHook({
      message: { severity: 'error', key: 'offline', params: { url: 'u' } },
    }));
    renderWithProviders(<CardDatabaseOverview />);
    expect(screen.getByText('CardDatabaseOverview.message.offline')).toBeInTheDocument();
  });

  it('explains an empty database', () => {
    hoisted.useCardDatabaseOverview.mockReturnValue(makeHook({ sources: [], summary: { cards: 0, sets: 0, tokens: 0, formats: 0 } }));
    renderWithProviders(<CardDatabaseOverview />);
    expect(screen.getByText('CardDatabaseOverview.empty')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CardDatabaseOverview.button.reload' })).toBeDisabled();
  });
});
