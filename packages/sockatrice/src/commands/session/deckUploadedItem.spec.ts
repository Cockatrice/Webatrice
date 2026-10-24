vi.mock('../../WebClient');

import { Mock } from 'vitest';
import { create, isFieldSet } from '@bufbuild/protobuf';

import { WebClient } from '../../WebClient';
import {
  ServerInfo_DeckStorage_FileSchema,
  ServerInfo_DeckStorage_TreeItemSchema,
  type ServerInfo_DeckStorage_TreeItem,
} from '../../generated';
import { deckUpdate } from './deckUpdate';
import { deckUpload } from './deckUpload';

function serverEcho(): ServerInfo_DeckStorage_TreeItem {
  return create(ServerInfo_DeckStorage_TreeItemSchema, {
    id: 9,
    name: 'Yisan',
    file: create(ServerInfo_DeckStorage_FileSchema, { creationTime: 100, isPublic: false }),
  });
}

function succeedLast(newFile: ServerInfo_DeckStorage_TreeItem | undefined): void {
  const calls = (WebClient.instance.protobuf.sendSessionCommand as Mock).mock.calls;
  calls.at(-1)![2].onSuccess({ newFile });
}

describe('deck upload responses carry the stored colour identity', () => {
  it('deckUpdate routes the identity it sent, since the server echo omits it', () => {
    deckUpdate(9, '<deck/>', undefined, 'UB');
    succeedLast(serverEcho());
    const item = vi.mocked(WebClient.instance.response.session.updateServerDeck!).mock.calls.at(-1)![1]!;
    expect(item.file!.colorIdentity).toBe('UB');
    expect(item.file!.creationTime).toBe(100);
    expect(item.name).toBe('Yisan');
  });

  it('deckUpload stores the identity as the server does: WUBRG letters only, upper case, once each', () => {
    deckUpload('', 0, '<deck/>', undefined, 'gwxg');
    succeedLast(serverEcho());
    const item = vi.mocked(WebClient.instance.response.session.uploadServerDeck).mock.calls.at(-1)![1];
    expect(item.file!.colorIdentity).toBe('GW');
  });

  it('marks an omitted identity as stored empty, so a merge clears the old one', () => {
    deckUpdate(9, '<deck/>');
    succeedLast(serverEcho());
    const item = vi.mocked(WebClient.instance.response.session.updateServerDeck!).mock.calls.at(-1)![1]!;
    expect(item.file!.colorIdentity).toBe('');
    expect(isFieldSet(item.file!, ServerInfo_DeckStorage_FileSchema.field.colorIdentity)).toBe(true);
  });

  it('does not change the response it was given', () => {
    const echo = serverEcho();
    deckUpdate(9, '<deck/>', undefined, 'R');
    succeedLast(echo);
    expect(isFieldSet(echo.file!, ServerInfo_DeckStorage_FileSchema.field.colorIdentity)).toBe(false);
  });

  it('passes a folder echo through untouched', () => {
    deckUpdate(9, '<deck/>', undefined, 'R');
    succeedLast(undefined);
    expect(WebClient.instance.response.session.updateServerDeck).toHaveBeenLastCalledWith(9, undefined);
  });
});
