import { act } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';

import { server } from '@cockatrice/datatrice';
import { ServerInfo_DeckShareSummarySchema } from '@cockatrice/sockatrice/generated';

import { connectedState, createMockWebClient, renderWithProviders } from '../../../__test-utils__';
import { useDeckShareLinks } from './useDeckShareLinks';

let links: ReturnType<typeof useDeckShareLinks>;
function Probe({ active }: { active: boolean }) {
  links = useDeckShareLinks(active);
  return null;
}

function setup(active = true) {
  const webClient = createMockWebClient();
  const { store } = renderWithProviders(<Probe active={active} />, { preloadedState: connectedState, webClient });
  return { webClient, store };
}

describe('useDeckShareLinks', () => {
  it('lists the user\'s links when opened, and not before', () => {
    expect(setup(false).webClient.request.session.deckShareListMine).not.toHaveBeenCalled();
    const { webClient, store } = setup();
    expect(webClient.request.session.deckShareListMine).toHaveBeenCalledTimes(1);
    expect(links.shares).toBeNull();
    const shares = [create(ServerInfo_DeckShareSummarySchema, { id: 4, name: 'Cube' })];
    act(() => {
      store.dispatch(server.Actions.deckSharesMine({ shares }));
    });
    expect(links.shares).toEqual(shares);
  });

  it('revokes a link', () => {
    const { webClient } = setup();
    act(() => links.revoke(4));
    expect(webClient.request.session.deckShareRemove).toHaveBeenCalledWith(4);
  });

  it.each([
    ['deckShareListMine', 'DeckShareLinks.listFailed'],
    ['deckShareRemove', 'DeckShareLinks.revokeFailed'],
  ] as const)('reports a failed %s', (command, message) => {
    const { store } = setup();
    if (command === 'deckShareRemove') {
      act(() => links.revoke(4));
    }
    act(() => {
      store.dispatch(server.Actions.sessionCommandFailed({ command, target: command === 'deckShareRemove' ? '4' : '', responseCode: 15 }));
    });
    expect(links.error).toBe(message);
  });
});
