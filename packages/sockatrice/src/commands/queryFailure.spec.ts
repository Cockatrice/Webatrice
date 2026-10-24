
vi.mock('../WebClient');

import { create } from '@bufbuild/protobuf';
import { Mock } from 'vitest';
import { WebClient } from '../WebClient';
import { ResponseSchema, Response_ResponseCode } from '../generated';
import { CommandFailure, handleFailure, handleResponse } from '../services/command-options';

import * as DeveloperCommands from './developer';
import * as ModeratorCommands from './moderator';
import * as SessionCommands from './session';

type Scope = 'session' | 'moderator' | 'developer';
type Query = [command: string, scope: Scope, run: () => void, target: string, onSuccess: string];

const SEND: Record<Scope, 'sendSessionCommand' | 'sendModeratorCommand' | 'sendDeveloperCommand'> = {
  session: 'sendSessionCommand',
  moderator: 'sendModeratorCommand',
  developer: 'sendDeveloperCommand',
};

const queries: Query[] = [
  ['deckShareCreate', 'session', () => SessionCommands.deckShareCreate({ folderPath: 'Cube' }), 'Cube', 'deckShareCreated'],
  ['deckShareList', 'session', () => SessionCommands.deckShareList('tok'), 'tok', 'deckShareListed'],
  ['deckShareDownload', 'session', () => SessionCommands.deckShareDownload('tok', 1), 'tok', 'deckShareDownloaded'],
  ['deckShareListMine', 'session', () => SessionCommands.deckShareListMine(), '', 'deckSharesMine'],
  ['deckShareRemove', 'session', () => SessionCommands.deckShareRemove(3), '3', 'deckShareRemoved'],
  ['deckListOtherUser', 'session', () => SessionCommands.deckListOtherUser('bob'), 'bob', 'otherUserDecks'],
  ['deckSetVisibility', 'session', () => SessionCommands.deckSetVisibility({ deckId: 2, isPublic: true }), '2', 'deckVisibilityChanged'],
  ['deckDownloadPublic', 'session', () => SessionCommands.deckDownloadPublic(2), '2', 'publicDeckDownloaded'],
  ['reportMyList', 'session', () => SessionCommands.reportMyList(), '', 'reportMyList'],
  ['reportDetails', 'session', () => SessionCommands.reportDetails(4), '4', 'reportDetails'],
  ['listCardArtRules', 'moderator', () => ModeratorCommands.listCardArtRules(), '', 'cardArtRules'],
  ['addCardArtRule', 'moderator', () => ModeratorCommands.addCardArtRule('Bolt', 'p1', 'DENY'), 'Bolt', 'cardArtRuleAdded'],
  ['removeCardArtRule', 'moderator', () => ModeratorCommands.removeCardArtRule('Bolt', 'p1'), 'Bolt', 'cardArtRuleRemoved'],
  ['getUserSessions', 'moderator', () => ModeratorCommands.getUserSessions('bob'), 'bob', 'userSessions'],
  ['getUserAlts', 'moderator', () => ModeratorCommands.getUserAlts('bob'), 'bob', 'userAlts'],
  ['getModeratorLastLogins', 'moderator', () => ModeratorCommands.getModeratorLastLogins(), '', 'moderatorLastLogins'],
  ['removeUserAvatar', 'moderator', () => ModeratorCommands.removeUserAvatar('bob'), 'bob', 'userAvatarRemoved'],
  ['reportList', 'moderator', () => ModeratorCommands.reportList(true), '', 'reportList'],
  ['reportAssign', 'moderator', () => ModeratorCommands.reportAssign(4), '4', 'reportAssigned'],
  ['reportResolve', 'moderator', () => ModeratorCommands.reportResolve(4), '4', 'reportResolved'],
  ['reportUserInfo', 'moderator', () => ModeratorCommands.reportUserInfo('bob'), 'bob', 'reportUserInfo'],
  ['reportStats', 'moderator', () => ModeratorCommands.reportStats(), '', 'reportStats'],
  ['replayDownloadByGameId', 'moderator', () => ModeratorCommands.replayDownloadByGameId(9), '9', 'replayDownloadedByGameId'],
  ['getServerStats', 'developer', () => DeveloperCommands.getServerStats(), '', 'serverStats'],
];

const responseScope = (scope: Scope) => WebClient.instance.response[scope] as unknown as Record<string, Mock>;

function answer(scope: Scope, responseCode: Response_ResponseCode): void {
  const calls = (WebClient.instance.protobuf[SEND[scope]] as Mock).mock.calls;
  const options = calls[calls.length - 1][2];
  handleResponse('Command', create(ResponseSchema, { cmdId: 1n, responseCode }), options);
}

describe('3.1 query failure reporting', () => {
  it.each([
    ['deckShareCreate', 'for a deck selection, which has no folder', () => SessionCommands.deckShareCreate({ items: [{ deckId: 7 }] })],
    ['deckSetVisibility', 'with neither a deck nor a folder', () => SessionCommands.deckSetVisibility({ isPublic: false })],
  ] as const)('%s %s reports an empty target', (command, _case, run) => {
    run();
    answer('session', Response_ResponseCode.RespInvalidData);
    expect(responseScope('session').commandFailed).toHaveBeenCalledExactlyOnceWith(
      command, Response_ResponseCode.RespInvalidData, '', undefined,
    );
    expect(responseScope('session').deckShareCreated).not.toHaveBeenCalled();
    expect(responseScope('session').deckVisibilityChanged).not.toHaveBeenCalled();
  });

  it('viewLogHistory reports an empty target for an unfiltered lookup', () => {
    DeveloperCommands.viewLogHistory({ dateRange: 1 });
    answer('developer', Response_ResponseCode.RespAccessDenied);
    expect(responseScope('moderator').commandFailed).toHaveBeenCalledExactlyOnceWith(
      'viewLogHistory', Response_ResponseCode.RespAccessDenied, '', undefined,
    );
    expect(responseScope('moderator').viewLogs).not.toHaveBeenCalled();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(queries)('%s reports a refusal through %s.commandFailed', (command, scope, run, target, onSuccess) => {
    run();
    answer(scope, Response_ResponseCode.RespFunctionNotAllowed);

    expect(responseScope(scope).commandFailed).toHaveBeenCalledTimes(1);
    const [failed] = responseScope(scope).commandFailed.mock.calls;
    expect(failed.slice(0, 3)).toEqual([command, Response_ResponseCode.RespFunctionNotAllowed, target]);
    expect(failed[3]).toBeUndefined();
    expect(responseScope(scope)[onSuccess]).not.toHaveBeenCalled();
  });

  it('the developer-family viewLogHistory reports through moderator.commandFailed, beside its viewLogs result', () => {
    DeveloperCommands.viewLogHistory({ userName: 'bob', dateRange: 1 });
    answer('developer', Response_ResponseCode.RespFunctionNotAllowed);

    expect(responseScope('moderator').commandFailed)
      .toHaveBeenCalledWith('viewLogHistory', Response_ResponseCode.RespFunctionNotAllowed, 'bob', undefined);
    expect(responseScope('moderator').viewLogs).not.toHaveBeenCalled();
  });

  it('deckSetVisibility names a folder target by its path', () => {
    SessionCommands.deckSetVisibility({ folderPath: 'Cube', isPublic: true });
    answer('session', Response_ResponseCode.RespNameNotFound);

    expect(responseScope('session').commandFailed)
      .toHaveBeenCalledWith('deckSetVisibility', Response_ResponseCode.RespNameNotFound, 'Cube', undefined);
  });

  describe('a response implementation without commandFailed', () => {
    it.each(queries)('%s does not throw', (_command, scope, run) => {
      const bag = responseScope(scope);
      const saved = bag.commandFailed;
      delete bag.commandFailed;
      try {
        run();
        expect(() => answer(scope, Response_ResponseCode.RespLoginNeeded)).not.toThrow();
      } finally {
        bag.commandFailed = saved;
      }
    });

    it('getServerStats does not throw when the developer scope is absent', () => {
      const response = WebClient.instance.response as unknown as Record<string, unknown>;
      const saved = response.developer;
      delete response.developer;
      try {
        DeveloperCommands.getServerStats();
        expect(() => answer('developer', Response_ResponseCode.RespLoginNeeded)).not.toThrow();
      } finally {
        response.developer = saved;
      }
    });
  });
});

describe('card art transport failures', () => {
  it.each(queries.filter(([command]) => ['listCardArtRules', 'addCardArtRule', 'removeCardArtRule'].includes(command)))(
    '%s forwards the timeout reason', (command, scope, run, target, onSuccess) => {
      run();
      const calls = (WebClient.instance.protobuf[SEND[scope]] as Mock).mock.calls;
      handleFailure('Command', CommandFailure.Timeout, calls[calls.length - 1][2]);
      expect(responseScope(scope).commandFailed).toHaveBeenCalledWith(
        command, Response_ResponseCode.RespNotConnected, target, CommandFailure.Timeout,
      );
      expect(responseScope(scope)[onSuccess]).not.toHaveBeenCalled();
    },
  );
});
