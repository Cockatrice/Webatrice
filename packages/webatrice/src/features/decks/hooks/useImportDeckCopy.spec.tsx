import { act } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';

import { server } from '@cockatrice/datatrice';
import { ServerInfo_DeckStorage_TreeItemSchema } from '@cockatrice/sockatrice/generated';

import { connectedState, createMockWebClient, renderWithProviders } from '../../../__test-utils__';
import { useImportDeckCopy } from './useImportDeckCopy';

const COD = '<cockatrice_deck version="1"><deckname>Burn</deckname><zone name="main"/></cockatrice_deck>';

let importCopy: (xml: string, colorIdentity?: string) => void;
function Probe({ onImported }: { onImported: (id: number) => void }) {
  importCopy = useImportDeckCopy(onImported);
  return null;
}

function setup() {
  const webClient = createMockWebClient();
  const onImported = vi.fn();
  const { store } = renderWithProviders(<Probe onImported={onImported} />, { preloadedState: connectedState, webClient });
  return { webClient, store, onImported };
}

const uploaded = (path: string, id: number, name: string, requestId?: string) =>
  server.Actions.deckUpload({ path, requestId, treeItem: create(ServerInfo_DeckStorage_TreeItemSchema, { id, name }) });

describe('useImportDeckCopy', () => {
  it('uploads a copy to the storage root and hands on its new id', () => {
    const { webClient, store, onImported } = setup();
    act(() => importCopy(COD));
    expect(webClient.request.session.deckUpload).toHaveBeenCalledWith('', 0, COD, undefined, undefined, expect.any(String));
    act(() => {
      store.dispatch(uploaded('', 12, 'Burn', vi.mocked(webClient.request.session.deckUpload).mock.calls[0][5]));
    });
    expect(onImported).toHaveBeenCalledWith(12);
  });

  it('stores the color identity the share already gave', () => {
    const { webClient } = setup();
    act(() => importCopy(COD, 'WR'));
    expect(webClient.request.session.deckUpload).toHaveBeenCalledWith('', 0, COD, undefined, 'WR', expect.any(String));
  });

  it('ignores uploads it did not send', () => {
    const { store, onImported } = setup();
    act(() => importCopy(COD));
    act(() => {
      store.dispatch(uploaded('Cube', 13, 'Burn'));
      store.dispatch(uploaded('', 14, 'Other'));
    });
    expect(onImported).not.toHaveBeenCalled();
  });

  it.each(['', '   '])('correlates an imported deck with name %j by request identity', (name) => {
    const { webClient, store, onImported } = setup();
    act(() => importCopy(COD.replace('Burn', name)));
    const requestId = vi.mocked(webClient.request.session.deckUpload).mock.calls[0][5];
    act(() => store.dispatch(uploaded('', 22, 'Unnamed deck', requestId)));
    expect(onImported).toHaveBeenCalledWith(22);
  });

  it('ignores an unrelated reply with the same name', () => {
    const { webClient, store, onImported } = setup();
    act(() => importCopy(COD));
    const requestId = vi.mocked(webClient.request.session.deckUpload).mock.calls[0][5];
    act(() => store.dispatch(uploaded('', 99, 'Burn', 'unrelated-request')));
    expect(onImported).not.toHaveBeenCalled();
    act(() => store.dispatch(uploaded('', 22, 'Burn', requestId)));
    expect(onImported).toHaveBeenCalledWith(22);
  });

  it('clears a failed import before another upload with the same name arrives', () => {
    const { webClient, store, onImported } = setup();
    act(() => importCopy(COD));
    const requestId = vi.mocked(webClient.request.session.deckUpload).mock.calls[0][5];
    act(() => store.dispatch(server.Actions.deckUploadFailed({ path: '', requestId, responseCode: 7 })));
    act(() => store.dispatch(uploaded('', 99, 'Burn', requestId)));
    expect(onImported).not.toHaveBeenCalled();
  });

  it('sends nothing for an unreadable deck', () => {
    const { webClient } = setup();
    act(() => importCopy('nope'));
    expect(webClient.request.session.deckUpload).not.toHaveBeenCalled();
  });
});
