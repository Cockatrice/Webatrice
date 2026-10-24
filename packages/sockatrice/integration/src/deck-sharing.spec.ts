import { create } from '@bufbuild/protobuf';
import { describe, expect, it, vi } from 'vitest';
import * as Data from '../../src/generated';
import { SessionCommands } from '../../src';
import { CommandFailure } from '../../src/types/CommandFailure';
import { connectAndLogin, getMockResponse, getMockWebSocket, getWebClient } from '../../src/testing/setup';
import { buildResponse, buildResponseMessage, deliverMessage } from '../../src/testing/protobuf-builders';
import { findLastSessionCommand } from '../../src/testing/command-capture';

const scenarios = [
  {
    command: 'deckShareList',
    send: () => SessionCommands.deckShareList('secret'),
    capture: () => findLastSessionCommand(Data.Command_DeckShareList_ext),
    wire: { $typeName: 'Command_DeckShareList', token: 'secret' },
    target: 'secret',
    callback: () => getMockResponse().session.deckShareListed!,
    successArgs: ['secret', create(Data.Response_DeckShareListSchema, { name: 'Cube', items: [] })],
    reply: (cmdId: number) => buildResponse({
      cmdId, responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_DeckShareList_ext,
      value: create(Data.Response_DeckShareListSchema, { name: 'Cube', items: [] }),
    }),
  },
  {
    command: 'deckShareDownload',
    send: () => SessionCommands.deckShareDownload('secret', 9),
    capture: () => findLastSessionCommand(Data.Command_DeckShareDownload_ext),
    wire: { $typeName: 'Command_DeckShareDownload', token: 'secret', itemId: 9 },
    target: 'secret',
    callback: () => getMockResponse().session.deckShareDownloaded!,
    successArgs: ['secret', 9, '<shared/>'],
    reply: (cmdId: number) => buildResponse({
      cmdId, responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_DeckShareDownload_ext,
      value: create(Data.Response_DeckShareDownloadSchema, { deck: '<shared/>' }),
    }),
  },
  {
    command: 'deckShareListMine',
    send: () => SessionCommands.deckShareListMine(),
    capture: () => findLastSessionCommand(Data.Command_DeckShareListMine_ext),
    wire: { $typeName: 'Command_DeckShareListMine' },
    target: '',
    callback: () => getMockResponse().session.deckSharesMine!,
    successArgs: [[create(Data.ServerInfo_DeckShareSummarySchema, { id: 5, name: 'Cube' })]],
    reply: (cmdId: number) => buildResponse({
      cmdId, responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_DeckShareListMine_ext,
      value: create(Data.Response_DeckShareListMineSchema, { shares: [{ id: 5, name: 'Cube' }] }),
    }),
  },
  {
    command: 'deckShareRemove',
    send: () => SessionCommands.deckShareRemove(5),
    capture: () => findLastSessionCommand(Data.Command_DeckShareRemove_ext),
    wire: { $typeName: 'Command_DeckShareRemove', shareId: 5 },
    target: '5',
    callback: () => getMockResponse().session.deckShareRemoved!,
    successArgs: [5],
    reply: (cmdId: number) => buildResponse({
      cmdId, responseCode: Data.Response_ResponseCode.RespOk,
    }),
  },
  {
    command: 'deckListOtherUser',
    send: () => SessionCommands.deckListOtherUser('bob'),
    capture: () => findLastSessionCommand(Data.Command_DeckListOtherUser_ext),
    wire: { $typeName: 'Command_DeckListOtherUser', userName: 'bob' },
    target: 'bob',
    callback: () => getMockResponse().session.otherUserDecks!,
    successArgs: ['bob', create(Data.Response_DeckListSchema, { root: { items: [] } })],
    reply: (cmdId: number) => buildResponse({
      cmdId, responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_DeckList_ext,
      value: create(Data.Response_DeckListSchema, { root: { items: [] } }),
    }),
  },
  {
    command: 'deckDownloadPublic',
    send: () => SessionCommands.deckDownloadPublic(4),
    capture: () => findLastSessionCommand(Data.Command_DeckDownloadPublic_ext),
    wire: { $typeName: 'Command_DeckDownloadPublic', deckId: 4 },
    target: '4',
    callback: () => getMockResponse().session.publicDeckDownloaded!,
    successArgs: [4, '<public/>'],
    reply: (cmdId: number) => buildResponse({
      cmdId, responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_DeckDownload_ext,
      value: create(Data.Response_DeckDownloadSchema, { deck: '<public/>' }),
    }),
  },
];

describe('deck sharing protocol outcomes', () => {
  it.each(scenarios)('$command forwards successful responses, server refusals and disconnect reasons', (scenario) => {
    connectAndLogin();
    getMockWebSocket().send.mockClear();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      scenario.send();
      const first = scenario.capture();
      expect({ ...first.value }).toEqual(scenario.wire);
      expect(getMockWebSocket().send.mock.calls).toHaveLength(1);
      deliverMessage(buildResponseMessage(scenario.reply(first.cmdId)));
      expect(vi.mocked(scenario.callback()).mock.calls).toEqual([scenario.successArgs]);
      expect(vi.mocked(getMockResponse().session.commandFailed!).mock.calls).toEqual([]);

      scenario.send();
      const refused = scenario.capture();
      expect({ ...refused.value }).toEqual(scenario.wire);
      expect(getMockWebSocket().send.mock.calls).toHaveLength(2);
      deliverMessage(buildResponseMessage(buildResponse({
        cmdId: refused.cmdId, responseCode: Data.Response_ResponseCode.RespFunctionNotAllowed,
      })));
      expect(vi.mocked(getMockResponse().session.commandFailed!).mock.calls).toEqual([
        [scenario.command, Data.Response_ResponseCode.RespFunctionNotAllowed, scenario.target, undefined],
      ]);

      scenario.send();
      expect({ ...scenario.capture().value }).toEqual(scenario.wire);
      expect(getMockWebSocket().send.mock.calls).toHaveLength(3);
      getWebClient().protobuf.resetCommands();
      expect(vi.mocked(getMockResponse().session.commandFailed!).mock.calls).toEqual([
        [scenario.command, Data.Response_ResponseCode.RespFunctionNotAllowed, scenario.target, undefined],
        [scenario.command, Data.Response_ResponseCode.RespNotConnected, scenario.target, CommandFailure.Disconnected],
      ]);
      expect(vi.mocked(scenario.callback()).mock.calls).toEqual([scenario.successArgs]);
      expect(errors.mock.calls).toEqual([]);
    } finally {
      errors.mockRestore();
    }
  });

  it.each([
    { name: 'item share without identity', params: { name: 'Cube', items: [{ deckId: 4 }] }, correlation: [] as [string?],
      wire: { name: 'Cube', items: [create(Data.DeckShareItemSchema, { deckId: 4 })] }, target: '' },
    { name: 'folder share with identity', params: { name: 'Cube', folderPath: 'cubes' }, correlation: ['share-a'] as [string?],
      wire: { name: 'Cube', folderPath: 'cubes', items: [] }, target: 'cubes' },
  ])('echoes outcomes for $name without leaking the identity onto the wire', ({ params, correlation, wire, target }) => {
    connectAndLogin();
    getMockWebSocket().send.mockClear();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      SessionCommands.deckShareCreate(params, ...correlation);
      const first = findLastSessionCommand(Data.Command_DeckShareCreate_ext);
      expect({ ...first.value }).toEqual({ $typeName: 'Command_DeckShareCreate', ...wire });
      deliverMessage(buildResponseMessage(buildResponse({
        cmdId: first.cmdId, responseCode: Data.Response_ResponseCode.RespOk,
        ext: Data.Response_DeckShareCreate_ext,
        value: create(Data.Response_DeckShareCreateSchema, { token: 'secret', expiresAt: 100n, itemCount: 1 }),
      })));
      expect(vi.mocked(getMockResponse().session.deckShareCreated!).mock.calls).toEqual([
        [create(Data.Response_DeckShareCreateSchema, { token: 'secret', expiresAt: 100n, itemCount: 1 }), ...correlation],
      ]);
      SessionCommands.deckShareCreate(params, ...correlation);
      const second = findLastSessionCommand(Data.Command_DeckShareCreate_ext);
      expect({ ...second.value }).toEqual({ $typeName: 'Command_DeckShareCreate', ...wire });
      deliverMessage(buildResponseMessage(buildResponse({
        cmdId: second.cmdId, responseCode: Data.Response_ResponseCode.RespFunctionNotAllowed,
      })));
      expect(vi.mocked(getMockResponse().session.commandFailed!).mock.calls).toEqual([
        ['deckShareCreate', Data.Response_ResponseCode.RespFunctionNotAllowed, target, undefined, ...correlation],
      ]);
      SessionCommands.deckShareCreate(params, ...correlation);
      const disconnected = findLastSessionCommand(Data.Command_DeckShareCreate_ext);
      expect({ ...disconnected.value }).toEqual({ $typeName: 'Command_DeckShareCreate', ...wire });
      getWebClient().protobuf.resetCommands();
      expect(vi.mocked(getMockResponse().session.commandFailed!).mock.calls).toEqual([
        ['deckShareCreate', Data.Response_ResponseCode.RespFunctionNotAllowed, target, undefined, ...correlation],
        ['deckShareCreate', Data.Response_ResponseCode.RespNotConnected, target, CommandFailure.Disconnected, ...correlation],
      ]);
      expect(vi.mocked(getMockResponse().session.deckShareCreated!).mock.calls).toEqual([
        [create(Data.Response_DeckShareCreateSchema, { token: 'secret', expiresAt: 100n, itemCount: 1 }), ...correlation],
      ]);
      expect(getMockWebSocket().send.mock.calls).toHaveLength(3);
      expect(errors.mock.calls).toEqual([]);
    } finally {
      errors.mockRestore();
    }
  });
});
