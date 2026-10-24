import { act } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';

import { server } from '@cockatrice/datatrice';
import { Response_DeckShareCreateSchema } from '@cockatrice/sockatrice/generated';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { connected31State, connectedState, createMockWebClient, renderWithProviders } from '../../../__test-utils__';
import { useDeckShareCreate, useDeckSharingSupported, useDeckVisibility } from './useDeckSharing';

let create$: ReturnType<typeof useDeckShareCreate>;
let visibility: ReturnType<typeof useDeckVisibility>;
let supported: boolean;
function Probe() {
  create$ = useDeckShareCreate();
  visibility = useDeckVisibility();
  supported = useDeckSharingSupported();
  return null;
}

let activeClient: ReturnType<typeof createMockWebClient>;
const requestId = () => vi.mocked(activeClient.request.session.deckShareCreate).mock.calls.at(-1)?.[1];

function setup(preloadedState = connected31State, endpoint: string | null = 'wss://server.example:4748/') {
  const webClient = createMockWebClient();
  activeClient = webClient;
  Object.assign(webClient, { socket: { connectedEndpoint: endpoint } });
  const { store, unmount } = renderWithProviders(<Probe />, { preloadedState, webClient });
  return { webClient, store, unmount };
}

const writeText = vi.fn();
beforeEach(() => {
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

describe('useDeckSharingSupported', () => {
  it('follows the server version', () => {
    setup();
    expect(supported).toBe(true);
    setup(connectedState);
    expect(supported).toBe(false);
  });
});

describe('useDeckShareCreate', () => {
  it('sends the share, then builds the link to this page and copies it', async () => {
    const { webClient, store } = setup();
    act(() => create$.create({ name: 'Shared decks', folderPath: 'Cube' }));
    expect(webClient.request.session.deckShareCreate).toHaveBeenCalledWith(
      { name: 'Shared decks', folderPath: 'Cube' }, expect.any(String),
    );
    expect(create$.state).toEqual({ status: 'pending' });

    const share = create(Response_DeckShareCreateSchema, { token: 'tok', expiresAt: 1800000000n, itemCount: 3 });
    await act(async () => {
      store.dispatch(server.Actions.deckShareCreated({ requestId: requestId(), share }));
    });
    const link = new URL(window.location.href);
    link.search = '';
    link.hash = 'share=tok&hostname=wss%3A%2F%2Fserver.example%3A4748%2F&port=4748';
    expect(create$.state).toEqual({
      status: 'created', link: link.toString(), expiresAt: 1800000000n, itemCount: 3, copied: true,
    });
    expect(writeText).toHaveBeenCalledWith(link.toString());
  });

  it('shows the link without "copied" when the browser refuses the clipboard', async () => {
    writeText.mockRejectedValue(new Error('denied'));
    const { store } = setup();
    act(() => create$.create({ name: 'x', items: [{ deckId: 1 }] }));
    await act(async () => {
      store.dispatch(server.Actions.deckShareCreated({
        requestId: requestId(), share: create(Response_DeckShareCreateSchema, { token: 't' }),
      }));
    });
    expect(create$.state).toMatchObject({ status: 'created', copied: false });
  });

  it('refuses to make a link that names no server', () => {
    const { webClient } = setup(connected31State, null);
    act(() => create$.create({ name: 'x', items: [{ deckId: 1 }] }));
    expect(webClient.request.session.deckShareCreate).not.toHaveBeenCalled();
    expect(create$.state).toEqual({ status: 'failed', message: 'DeckSharing.noServer' });
  });

  it('drops an answer that arrives after a reset', async () => {
    const { store } = setup();
    act(() => create$.create({ name: 'x', items: [{ deckId: 1 }] }));
    act(() => create$.reset());
    await act(async () => {
      store.dispatch(server.Actions.deckShareCreated({
        requestId: requestId(), share: create(Response_DeckShareCreateSchema, { token: 't' }),
      }));
    });
    expect(create$.state).toEqual({ status: 'idle' });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('ignores a share it did not ask for', () => {
    const { store } = setup();
    act(() => {
      store.dispatch(server.Actions.deckShareCreated({
        requestId: requestId(), share: create(Response_DeckShareCreateSchema, { token: 't' }),
      }));
    });
    expect(create$.state).toEqual({ status: 'idle' });
  });

  it('reports desktop\'s failure with the response code, or the transport reason', () => {
    const { store } = setup();
    act(() => create$.create({ name: 'x', items: [{ deckId: 1 }] }));
    act(() => {
      store.dispatch(server.Actions.sessionCommandFailed({
        requestId: requestId(), command: 'deckShareCreate', target: '', responseCode: 11,
      }));
    });
    expect(create$.state).toEqual({ status: 'failed', message: 'DeckSharing.createFailed' });

    act(() => create$.create({ name: 'x', items: [{ deckId: 1 }] }));
    act(() => {
      store.dispatch(server.Actions.sessionCommandFailed({
        requestId: requestId(), command: 'deckShareCreate', target: '', responseCode: -1, failure: WebsocketTypes.CommandFailure.Timeout,
      }));
    });
    expect(create$.state).toMatchObject({ status: 'failed' });
    expect(create$.state).not.toEqual({ status: 'failed', message: 'DeckSharing.createFailed' });
  });

  it.each(['success', 'failure'] as const)('ignores a late %s after cancel and create again', async (outcome) => {
    const { store } = setup();
    act(() => create$.create({ name: 'A' }));
    const firstId = requestId();
    act(() => create$.reset());
    act(() => create$.create({ name: 'B' }));
    const secondId = requestId();
    await act(async () => {
      store.dispatch(outcome === 'success'
        ? server.Actions.deckShareCreated({ requestId: firstId, share: create(Response_DeckShareCreateSchema, { token: 'old' }) })
        : server.Actions.sessionCommandFailed({ requestId: firstId, command: 'deckShareCreate', target: '', responseCode: 7 }));
    });
    expect(create$.state).toEqual({ status: 'pending' });
    expect(writeText).not.toHaveBeenCalled();
    expect(firstId).toEqual(expect.any(String));
    expect(secondId).not.toBe(firstId);
    await act(async () => {
      store.dispatch(server.Actions.deckShareCreated({
        requestId: secondId, share: create(Response_DeckShareCreateSchema, { token: 'new' }),
      }));
    });
    expect(create$.state).toMatchObject({ status: 'created' });
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain('share=new');
  });

  it('invalidates the request on unmount', async () => {
    const { store, unmount } = setup();
    act(() => create$.create({ name: 'A' }));
    const oldId = requestId();
    unmount();
    await act(async () => {
      store.dispatch(server.Actions.deckShareCreated({
        requestId: oldId, share: create(Response_DeckShareCreateSchema, { token: 'old' }),
      }));
    });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('sends one request at a time', () => {
    const { webClient } = setup();
    act(() => create$.create({ name: 'a', items: [{ deckId: 1 }] }));
    act(() => create$.create({ name: 'b', items: [{ deckId: 1 }] }));
    expect(webClient.request.session.deckShareCreate).toHaveBeenCalledTimes(1);
  });
});

describe('useDeckVisibility', () => {
  it('flips the node\'s own bit: public → private, private or inherited → public', () => {
    const { webClient } = setup();
    act(() => visibility.toggle({ deckId: 4 }, 'public'));
    act(() => visibility.toggle({ folderPath: 'Cube' }, 'inherited'));
    act(() => visibility.toggle({ deckId: 5 }, 'private'));
    expect(vi.mocked(webClient.request.session.deckSetVisibility).mock.calls).toEqual([
      [{ deckId: 4, isPublic: false }],
      [{ folderPath: 'Cube', isPublic: true }],
      [{ deckId: 5, isPublic: true }],
    ]);
  });

  it('reports a rejected change until dismissed', () => {
    const { store } = setup();
    act(() => {
      store.dispatch(server.Actions.sessionCommandFailed({ command: 'deckSetVisibility', target: '4', responseCode: 11 }));
    });
    expect(visibility.error).toBe('DeckSharing.visibilityFailed');
    act(() => visibility.clearError());
    expect(visibility.error).toBeNull();
  });

  it('ignores other commands\' failures', () => {
    const { store } = setup();
    act(() => {
      store.dispatch(server.Actions.sessionCommandFailed({ command: 'deckShareList', target: 't', responseCode: 11 }));
    });
    expect(visibility.error).toBeNull();
  });
});
