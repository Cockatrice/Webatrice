import { create } from '@bufbuild/protobuf';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';

import { server } from '@cockatrice/datatrice';
import { Response_CardArtRuleEntrySchema, ServerInfo_User_UserLevelFlag } from '@cockatrice/sockatrice/generated';

import { connectedState, createMockWebClient, makeUser, renderWithProviders } from '../../__test-utils__';
import CardArtRules from './CardArtRules';
import { loadCardPrintings, type CardPrinting } from './cardPrintings';

const pins = vi.hoisted(() => ({ overrides: {} as Record<string, string> }));

vi.mock('@app/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@app/hooks')>()),
  useCardOverride: (name: string) => ({ pinnedPrintingId: pins.overrides[name] }),
}));

vi.mock('./cardPrintings', () => ({
  loadCardPrintings: vi.fn(async (name: string) => (name === 'Island'
    ? [{ providerId: 'uuid-1', label: 'Alpha #1' }, { providerId: 'uuid-2', label: 'Beta #2' }]
    : [])),
}));

const MODERATOR = ServerInfo_User_UserLevelFlag.IsRegistered | ServerInfo_User_UserLevelFlag.IsModerator;

function setup(version = '3.1.0 ()') {
  const webClient = createMockWebClient();
  const utils = renderWithProviders(
    <Routes>
      <Route path="/server" element={<div>server-page</div>} />
      <Route path="/card-art-rules" element={<CardArtRules />} />
    </Routes>,
    {
      preloadedState: {
        ...connectedState,
        server: {
          ...(connectedState.server as any),
          info: { message: null, name: 'Servatrice', version },
          user: makeUser({ userLevel: MODERATOR }),
        },
      },
      route: '/card-art-rules',
      webClient,
    },
  );
  return { ...utils, webClient };
}

const rule = (cardName: string, cardProviderId: string, mode = 'DENY') =>
  create(Response_CardArtRuleEntrySchema, { cardName, cardProviderId, mode, reason: '' });

describe('CardArtRules', () => {
  beforeEach(() => {
    pins.overrides = {};
  });

  it('is unavailable on a 3.0 server, and never asks it for the rules', () => {
    const { webClient } = setup('3.0.0 ()');
    expect(screen.getByText('server-page')).toBeInTheDocument();
    expect(webClient.request.moderator.listCardArtRules).not.toHaveBeenCalled();
  });

  it('lists the rules when opened', () => {
    const { webClient, store } = setup();
    expect(webClient.request.moderator.listCardArtRules).toHaveBeenCalledTimes(1);

    act(() => {
      store.dispatch(server.Actions.cardArtRules({ entries: [rule('Island', 'uuid-1')] }));
    });
    expect(screen.getByText('uuid-1')).toBeInTheDocument();
  });

  it('adds a rule for a printing from the local card database, then re-lists', async () => {
    const { webClient } = setup();
    const card = screen.getByRole('textbox', { name: /label\.card/ });
    fireEvent.change(card, { target: { value: 'Island' } });
    fireEvent.blur(card);
    await waitFor(() => expect(screen.getByRole('combobox', { name: /label\.providerId/ })).toHaveTextContent('Alpha #1'));

    fireEvent.change(screen.getByRole('textbox', { name: /label\.reason/ }), { target: { value: 'nsfw' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /button\.add/ }));
    });

    expect(webClient.request.moderator.addCardArtRule).toHaveBeenCalledWith('Island', 'uuid-1', 'ALLOW', 'nsfw');
    expect(webClient.request.moderator.listCardArtRules).toHaveBeenCalledTimes(2);
  });

  it('defaults a local card to its pinned printing', async () => {
    pins.overrides = { Island: 'uuid-2' };
    setup();
    const card = screen.getByRole('textbox', { name: /label\.card/ });
    fireEvent.change(card, { target: { value: 'Island' } });
    fireEvent.blur(card);
    await waitFor(() => expect(screen.getByRole('combobox', { name: /label\.providerId/ })).toHaveValue('uuid-2'));
  });

  it('accepts a typed provider id when the card is not in the local database', async () => {
    const { webClient } = setup();
    await act(async () => {
      fireEvent.change(screen.getByRole('textbox', { name: /label\.card/ }), { target: { value: 'Unknown Card' } });
    });
    fireEvent.change(screen.getByRole('textbox', { name: /label\.providerId/ }), { target: { value: 'custom-id' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /button\.add/ }));
    });
    expect(webClient.request.moderator.addCardArtRule).toHaveBeenCalledWith('Unknown Card', 'custom-id', 'ALLOW', '');
  });

  it('adds a rule without a provider id, as desktop does for a card missing from the local database', async () => {
    const { webClient } = setup();
    const card = screen.getByRole('textbox', { name: /label\.card/ });
    await act(async () => {
      fireEvent.change(card, { target: { value: 'Unknown Card' } });
      fireEvent.blur(card);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /button\.add/ }));
    });
    expect(webClient.request.moderator.addCardArtRule).toHaveBeenCalledWith('Unknown Card', '', 'ALLOW', '');
  });

  it('caps the card name and provider id at the server limit', () => {
    setup();
    expect(screen.getByRole('textbox', { name: /label\.card/ })).toHaveAttribute('maxLength', '255');
    expect(screen.getByRole('textbox', { name: /label\.providerId/ })).toHaveAttribute('maxLength', '255');
  });

  it('does not add a rule without a card', async () => {
    const { webClient } = setup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /button\.add/ }));
    });
    expect(webClient.request.moderator.addCardArtRule).not.toHaveBeenCalled();
  });

  it('removes the selected rule, then re-lists', () => {
    const { webClient, store } = setup();
    act(() => {
      store.dispatch(server.Actions.cardArtRules({ entries: [rule('Island', 'uuid-1'), rule('Forest', 'uuid-9')] }));
    });
    const remove = screen.getByRole('button', { name: /button\.remove/ });
    expect(remove).toBeDisabled();

    fireEvent.click(screen.getByText('Forest'));
    fireEvent.click(remove);

    expect(webClient.request.moderator.removeCardArtRule).toHaveBeenCalledWith('Forest', 'uuid-9');
    expect(webClient.request.moderator.listCardArtRules).toHaveBeenCalledTimes(2);
  });

  it.each([['Enter'], [' ']])('selects a rule row from the keyboard (%j) so it can be removed', (key) => {
    const { webClient, store } = setup();
    act(() => {
      store.dispatch(server.Actions.cardArtRules({ entries: [rule('Island', 'uuid-1'), rule('Forest', 'uuid-9')] }));
    });
    const first = screen.getByRole('row', { name: /Island/ });
    const row = screen.getByRole('row', { name: /Forest/ });
    expect(first).toHaveAttribute('tabindex', '0');
    expect(row).toHaveAttribute('tabindex', '-1');

    act(() => row.focus());
    expect(row).toHaveFocus();
    expect(row).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('button', { name: /button\.remove/ })).toBeDisabled();
    fireEvent.keyDown(row, { key });
    expect(row).toHaveAttribute('aria-selected', 'true');
    expect(row).toHaveAttribute('tabindex', '0');

    fireEvent.click(screen.getByRole('button', { name: /button\.remove/ }));
    expect(webClient.request.moderator.removeCardArtRule).toHaveBeenCalledWith('Forest', 'uuid-9');
  });
});

function deferredPrintings() {
  let resolve!: (value: CardPrinting[]) => void;
  let reject!: () => void;
  const promise = new Promise<CardPrinting[]>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('printing lookup ownership', () => {
  it('preserves a manual provider when an unchanged unknown card is blurred again', async () => {
    setup();
    const card = screen.getByRole('textbox', { name: 'CardArtRules.label.card' });
    await act(async () => {
      fireEvent.change(card, { target: { value: 'Unknown' } });
      fireEvent.blur(card);
    });
    const provider = screen.getByRole('textbox', { name: 'CardArtRules.label.providerId' });
    fireEvent.change(provider, { target: { value: 'manual-id' } });
    await act(async () => fireEvent.blur(card));
    expect(provider).toHaveValue('manual-id');
  });

  it.each(['resolve', 'reject'] as const)('ignores an older lookup that later %ss', async (finish) => {
    const old = deferredPrintings();
    const current = deferredPrintings();
    vi.mocked(loadCardPrintings).mockImplementationOnce(() => old.promise).mockImplementationOnce(() => current.promise);
    setup();
    const card = screen.getByRole('textbox', { name: 'CardArtRules.label.card' });
    fireEvent.change(card, { target: { value: 'Old' } });
    fireEvent.blur(card);
    fireEvent.change(card, { target: { value: 'Current' } });
    fireEvent.blur(card);
    await act(async () => current.resolve([{ providerId: 'new-id', label: 'Current printing' }]));
    await act(async () => {
      if (finish === 'resolve') {
        old.resolve([{ providerId: 'old-id', label: 'Old printing' }]);
      } else {
        old.reject();
      }
    });
    expect(screen.getByRole('combobox', { name: 'CardArtRules.label.providerId' })).toHaveTextContent('Current printing');
  });

  it('blocks submission while the changed card has unresolved printings, even before blur', async () => {
    const next = deferredPrintings();
    const { webClient } = setup();
    const card = screen.getByRole('textbox', { name: 'CardArtRules.label.card' });
    await act(async () => {
      fireEvent.change(card, { target: { value: 'Island' } });
      fireEvent.blur(card);
    });
    vi.mocked(loadCardPrintings).mockImplementationOnce(() => next.promise);
    fireEvent.change(card, { target: { value: 'Forest' } });
    await act(async () => fireEvent.submit(card.closest('form')!));
    expect(webClient.request.moderator.addCardArtRule).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'CardArtRules.button.add' })).toBeDisabled();
    await act(async () => next.resolve([{ providerId: 'forest-id', label: 'Forest printing' }]));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'CardArtRules.button.add' })));
    expect(webClient.request.moderator.addCardArtRule).toHaveBeenCalledWith('Forest', 'forest-id', 'ALLOW', '');
  });
});

it('moves focus and selection independently with ArrowDown', () => {
  const { store } = setup();
  act(() => store.dispatch(server.Actions.cardArtRules({ entries: [rule('Island', 'uuid-1'), rule('Forest', 'uuid-9')] })));
  const first = screen.getByRole('row', { name: /Island/ });
  const next = screen.getByRole('row', { name: /Forest/ });
  act(() => first.focus());
  fireEvent.keyDown(first, { key: 'ArrowDown' });
  expect(next).toHaveFocus();
  expect(next).toHaveAttribute('aria-selected', 'true');
  expect(next).toHaveAttribute('tabindex', '0');
  expect(first).toHaveAttribute('tabindex', '-1');
});

it.each(['add', 'remove'])('updates the visible list only from the re-list after %s', (command) => {
  const { store } = setup();
  act(() => store.dispatch(server.Actions.cardArtRules({ entries: [rule('Island', 'uuid-1')] })));
  act(() => store.dispatch(command === 'add'
    ? server.Actions.cardArtRuleAdded({ cardName: 'Forest', cardProviderId: 'uuid-9', mode: 'ALLOW', reason: '' })
    : server.Actions.cardArtRuleRemoved({ cardName: 'Island', cardProviderId: 'uuid-1' })));
  expect(screen.getByText('Island')).toBeInTheDocument();
  expect(screen.queryByText('Forest')).not.toBeInTheDocument();
  act(() => store.dispatch(server.Actions.cardArtRules({ entries: [rule('Forest', 'uuid-9')] })));
  expect(screen.getByText('Forest')).toBeInTheDocument();
  expect(screen.queryByText('Island')).not.toBeInTheDocument();
});
