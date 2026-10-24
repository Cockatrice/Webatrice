import { create } from '@bufbuild/protobuf';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  Command_DeckList_ext,
  Command_DeckSetVisibility_ext,
  Command_DeckShareCreate_ext,
  Command_DeckShareDownload_ext,
  Command_DeckShareList_ext,
  Command_DeckShareListMine_ext,
  Command_DeckShareRemove_ext,
  Command_DeckUpload_ext,
  Command_Login_ext,
  Event_ServerIdentification_ext,
  Event_ServerIdentificationSchema,
  Response_DeckShareCreateSchema,
  Response_DeckShareCreate_ext,
  Response_DeckShareDownloadSchema,
  Response_DeckShareDownload_ext,
  Response_DeckShareListMineSchema,
  Response_DeckShareListMine_ext,
  Response_DeckShareListSchema,
  Response_DeckShareList_ext,
  Response_DeckUploadSchema,
  Response_DeckUpload_ext,
  Response_Login_ext,
  Response_LoginSchema,
  Response_ResponseCode,
  ServerInfo_DeckShareItemSchema,
  ServerInfo_DeckShareSummarySchema,
  ServerInfo_DeckStorage_FileSchema,
  ServerInfo_DeckStorage_TreeItemSchema,
  ServerInfo_UserSchema,
  ServerInfo_User_UserLevelFlag,
} from '@cockatrice/sockatrice/generated';
import { Decks, SharedDeck, clearDeckEditorCache, clearDecksListCache } from '@app/features/decks';
import { RouteEnum } from '@app/types';

import { connectAndLogin, connectRaw, PROTOCOL_VERSION } from '../helpers/setup';
import { findAllSessionCommands, findLastSessionCommand } from '../helpers/command-capture';
import { buildResponse, buildResponseMessage, buildSessionEventMessage, deliverMessage } from '../helpers/protobuf-builders';
import { renderFeatureScreen } from './helpers';
import { LocationProbe, codXml, deckFile, deckFolder, respondToDeckList, stubThirdPartyFetch } from './deckHelpers';

function loginTo31() {
  connectRaw({ userName: 'alice' });
  deliverMessage(buildSessionEventMessage(
    Event_ServerIdentification_ext,
    create(Event_ServerIdentificationSchema, {
      serverName: 'TestServer',
      serverVersion: '3.1.0 (2026-05-08)',
      protocolVersion: PROTOCOL_VERSION,
    }),
  ));
  const login = findLastSessionCommand(Command_Login_ext);
  deliverMessage(buildResponseMessage(buildResponse({
    cmdId: login.cmdId,
    ext: Response_Login_ext,
    value: create(Response_LoginSchema, {
      userInfo: create(ServerInfo_UserSchema, { name: 'alice', userLevel: ServerInfo_User_UserLevelFlag.IsRegistered }),
      buddyList: [],
      ignoreList: [],
    }),
  })));
}

function respondOk(cmdId: number, responseCode = Response_ResponseCode.RespOk) {
  act(() => {
    deliverMessage(buildResponseMessage(buildResponse({ cmdId, responseCode })));
  });
}

const publicDeck = create(ServerInfo_DeckStorage_TreeItemSchema, {
  id: 1,
  name: 'Burn',
  file: create(ServerInfo_DeckStorage_FileSchema, { creationTime: 1_700_000_000, isPublic: true }),
});

async function renderDecks() {
  renderFeatureScreen(
    <Routes>
      <Route path={RouteEnum.DECKS} element={<Decks />} />
      <Route path={RouteEnum.DECK} element={<LocationProbe />} />
    </Routes>,
    RouteEnum.DECKS,
  );
  await waitFor(() => expect(findAllSessionCommands(Command_DeckList_ext).length).toBeGreaterThan(0));
  act(() => {
    respondToDeckList([publicDeck, deckFolder('Cube', [deckFile(2, 'Elves')])]);
  });
}

function deckAction(deckName: string, item: string) {
  const tile = screen.getByRole('article', { name: deckName });
  fireEvent.click(within(tile).getByRole('button', { name: 'DeckActionsMenu.more' }));
  fireEvent.click(screen.getByRole('menuitem', { name: item }));
}

function folderAction(folder: string, item: string) {
  const tree = screen.getByRole('navigation', { name: 'DeckStorageSidebar.folders' });
  fireEvent.click(within(tree).getByRole('button', { name: new RegExp(`^${folder}`) }));
  fireEvent.click(screen.getByRole('button', { name: 'DeckGridToolbar.folderActions' }));
  fireEvent.click(screen.getByRole('menuitem', { name: item }));
}

beforeEach(() => {
  vi.useRealTimers();
  clearDecksListCache();
  clearDeckEditorCache();
  window.localStorage.clear();
  stubThirdPartyFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('deck sharing (integration)', () => {
  it('creates a share link for a stored deck and shows it with its expiry', async () => {
    loginTo31();
    await renderDecks();

    deckAction('Burn', 'DeckActionsMenu.share');
    fireEvent.change(screen.getByRole('textbox', { name: 'DeckSharing.nameLabel' }), { target: { value: 'For Bob' } });
    fireEvent.click(screen.getByRole('button', { name: /DeckSharing.create/ }));

    await waitFor(() => expect(findAllSessionCommands(Command_DeckShareCreate_ext)).toHaveLength(1));
    const { cmdId, value } = findLastSessionCommand(Command_DeckShareCreate_ext);
    expect(value.name).toBe('For Bob');
    expect(value.items.map((item) => item.deckId)).toEqual([1]);

    act(() => {
      deliverMessage(buildResponseMessage(buildResponse({
        cmdId,
        ext: Response_DeckShareCreate_ext,
        value: create(Response_DeckShareCreateSchema, { token: 'tok123', expiresAt: 1_800_000_000n, itemCount: 1 }),
      })));
    });
    const link = await screen.findByDisplayValue(/#share=tok123&hostname=ws%3A%2F%2Flocalhost%3A4748%2F&port=4748$/);
    expect(link).toBeInTheDocument();
    expect(screen.getByText('DeckSharing.expires')).toBeInTheDocument();
  });

  it('reports a share the server refuses, with desktop\'s message', async () => {
    loginTo31();
    await renderDecks();
    folderAction('Cube', 'DeckGridToolbar.shareFolder');
    fireEvent.click(screen.getByRole('button', { name: /DeckSharing.create/ }));

    await waitFor(() => expect(findAllSessionCommands(Command_DeckShareCreate_ext)).toHaveLength(1));
    const { cmdId, value } = findLastSessionCommand(Command_DeckShareCreate_ext);
    expect(value.folderPath).toBe('Cube');
    expect(value.items).toEqual([]);

    respondOk(cmdId, Response_ResponseCode.RespTooManyRequests);
    expect(await screen.findByRole('alert')).toHaveTextContent('DeckSharing.createFailed');
  });

  it('unpublishes a public deck and shows the change once acknowledged', async () => {
    loginTo31();
    await renderDecks();
    expect(screen.getByText('DeckSharing.public')).toBeInTheDocument();

    deckAction('Burn', 'DeckActionsMenu.makePrivate');
    const { cmdId, value } = findLastSessionCommand(Command_DeckSetVisibility_ext);
    expect(value.deckId).toBe(1);
    expect(value.isPublic).toBe(false);

    respondOk(cmdId);
    await waitFor(() => expect(screen.queryByText('DeckSharing.public')).toBeNull());
  });

  it('reports a rejected visibility change', async () => {
    loginTo31();
    await renderDecks();
    folderAction('Cube', 'DeckGridToolbar.makeFolderPublic');
    const { cmdId, value } = findLastSessionCommand(Command_DeckSetVisibility_ext);
    expect(value.folderPath).toBe('Cube');
    expect(value.isPublic).toBe(true);

    respondOk(cmdId, Response_ResponseCode.RespNameNotFound);
    expect(await screen.findByText('DeckSharing.visibilityFailed')).toBeInTheDocument();
  });

  it('lists the user\'s share links and revokes one', async () => {
    loginTo31();
    await renderDecks();
    fireEvent.click(screen.getByRole('button', { name: /DeckShareLinks.open/ }));
    const list = findLastSessionCommand(Command_DeckShareListMine_ext);
    act(() => {
      deliverMessage(buildResponseMessage(buildResponse({
        cmdId: list.cmdId,
        ext: Response_DeckShareListMine_ext,
        value: create(Response_DeckShareListMineSchema, {
          shares: [create(ServerInfo_DeckShareSummarySchema, { id: 5, name: 'For Bob', itemCount: 1, creationTime: 1n, expiresAt: 2n })],
        }),
      })));
    });
    fireEvent.click(await screen.findByRole('button', { name: 'DeckShareLinks.revokeNamed' }));
    fireEvent.click(screen.getByRole('button', { name: 'DeckShareLinks.revoke' }));
    const remove = findLastSessionCommand(Command_DeckShareRemove_ext);
    expect(remove.value.shareId).toBe(5);

    respondOk(remove.cmdId);
    expect(await screen.findByText('DeckShareLinks.none')).toBeInTheDocument();
  });

  it('opens a shared deck read-only and imports a copy into the user\'s decks', async () => {
    loginTo31();
    renderFeatureScreen(
      <Routes>
        <Route path={RouteEnum.SHARED_DECK} element={<SharedDeck />} />
        <Route path={RouteEnum.DECK} element={<LocationProbe />} />
      </Routes>,
      '/decks/shared?share=tok123&hostname=ws%3A%2F%2Flocalhost%3A4748%2F&port=4748',
    );

    const list = findLastSessionCommand(Command_DeckShareList_ext);
    expect(list.value.token).toBe('tok123');
    act(() => {
      deliverMessage(buildResponseMessage(buildResponse({
        cmdId: list.cmdId,
        ext: Response_DeckShareList_ext,
        value: create(Response_DeckShareListSchema, {
          name: 'For Bob',
          expiresAt: 1_800_000_000n,
          items: [create(ServerInfo_DeckShareItemSchema, { id: 3, name: 'Burn', gameFormat: 'modern', colorIdentity: 'R' })],
        }),
      })));
    });

    fireEvent.click(await screen.findByRole('button', { name: 'SharedDeck.openDeckNamed' }));
    const download = findLastSessionCommand(Command_DeckShareDownload_ext);
    expect(download.value).toMatchObject({ token: 'tok123', itemId: 3 });
    const xml = codXml({ name: 'Burn', format: 'modern', main: [{ name: 'Lightning Bolt', quantity: 4 }] });
    act(() => {
      deliverMessage(buildResponseMessage(buildResponse({
        cmdId: download.cmdId,
        ext: Response_DeckShareDownload_ext,
        value: create(Response_DeckShareDownloadSchema, { deck: xml }),
      })));
    });
    expect(await screen.findByText('Lightning Bolt')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /ReadOnlyDeck.import/ }));
    const upload = findLastSessionCommand(Command_DeckUpload_ext);
    expect(upload.value.path).toBe('');
    expect(upload.value.deckList).toBe(xml);
    act(() => {
      deliverMessage(buildResponseMessage(buildResponse({
        cmdId: upload.cmdId,
        ext: Response_DeckUpload_ext,
        value: create(Response_DeckUploadSchema, {
          newFile: create(ServerInfo_DeckStorage_TreeItemSchema, { id: 42, name: 'Burn' }),
        }),
      })));
    });
    expect(await screen.findByTestId('location')).toHaveTextContent('/deck/42');
  });

  it('shows desktop\'s message for an expired share', async () => {
    loginTo31();
    renderFeatureScreen(<SharedDeck />, '/decks/shared?share=gone&hostname=ws%3A%2F%2Flocalhost%3A4748%2F&port=4748');
    respondOk(findLastSessionCommand(Command_DeckShareList_ext).cmdId, Response_ResponseCode.RespNameNotFound);
    expect(await screen.findByText('SharedDeck.notFound')).toBeInTheDocument();
  });

  it('offers no sharing on a 3.0 server', async () => {
    connectAndLogin();
    await renderDecks();
    fireEvent.click(within(screen.getByRole('article', { name: 'Burn' })).getByRole('button', { name: 'DeckActionsMenu.more' }));
    expect(screen.getByRole('menuitem', { name: 'DeckActionsMenu.rename' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'DeckActionsMenu.share' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /DeckActionsMenu.make/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /DeckShareLinks.open/ })).toBeNull();
  });
});
