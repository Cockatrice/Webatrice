import { App, Enriched } from '../../types';
import {
  Response_DeckList,
  Response_DeckListSchema,
  Response_WarnList,
  Response_WarnListSchema,
  ServerInfo_Ban,
  ServerInfo_BanSchema,
  ServerInfo_ChatMessage,
  ServerInfo_ChatMessageSchema,
  ServerInfo_DeckStorage_FolderSchema,
  ServerInfo_DeckStorage_TreeItem,
  ServerInfo_DeckStorage_TreeItemSchema,
  ServerInfo_GameSchema,
  ServerInfo_ReplayMatch,
  ServerInfo_ReplayMatchSchema,
  ServerInfo_User,
  ServerInfo_UserSchema,
  ServerInfo_Warning,
  ServerInfo_WarningSchema,
} from '@cockatrice/sockatrice/generated';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import type { MessageInitShape } from '@bufbuild/protobuf';

import { create } from '@bufbuild/protobuf';
import { ServerState } from '../../store/server/server.interfaces';

export function makeUser(
  overrides: MessageInitShape<typeof ServerInfo_UserSchema> = {}
): ServerInfo_User {
  return create(ServerInfo_UserSchema, {
    name: 'TestUser',
    accountageSecs: 0n,
    privlevel: '',
    userLevel: 0,
    ...overrides,
  });
}

export function makeLogItem(
  overrides: MessageInitShape<typeof ServerInfo_ChatMessageSchema> = {}
): ServerInfo_ChatMessage {
  return create(ServerInfo_ChatMessageSchema, {
    message: '',
    senderId: '',
    senderIp: '',
    senderName: '',
    targetId: '',
    targetName: '',
    targetType: '',
    time: '',
    ...overrides,
  });
}

export function makeBanHistoryItem(
  overrides: MessageInitShape<typeof ServerInfo_BanSchema> = {}
): ServerInfo_Ban {
  return create(ServerInfo_BanSchema, {
    adminId: '',
    adminName: '',
    banTime: '',
    banLength: '',
    banReason: '',
    visibleReason: '',
    ...overrides,
  });
}

export function makeWarnHistoryItem(
  overrides: MessageInitShape<typeof ServerInfo_WarningSchema> = {}
): ServerInfo_Warning {
  return create(ServerInfo_WarningSchema, {
    userName: '',
    adminName: '',
    reason: '',
    timeOf: '',
    ...overrides,
  });
}

export function makeWarnListItem(
  overrides: MessageInitShape<typeof Response_WarnListSchema> = {}
): Response_WarnList {
  return create(Response_WarnListSchema, {
    warning: [],
    userName: '',
    userClientid: '',
    ...overrides,
  });
}

export function makeDeckTreeItem(
  overrides: MessageInitShape<typeof ServerInfo_DeckStorage_TreeItemSchema> = {},
): ServerInfo_DeckStorage_TreeItem {
  return create(ServerInfo_DeckStorage_TreeItemSchema, {
    id: 1,
    name: 'item',
    ...overrides,
  });
}

export function makeDeckList(
  overrides: MessageInitShape<typeof Response_DeckListSchema> = {}
): Response_DeckList {
  return create(Response_DeckListSchema, {
    root: create(ServerInfo_DeckStorage_FolderSchema, { items: [] }),
    ...overrides,
  });
}

export function makeReplayMatch(
  overrides: MessageInitShape<typeof ServerInfo_ReplayMatchSchema> = {}
): ServerInfo_ReplayMatch {
  return create(ServerInfo_ReplayMatchSchema, {
    gameId: 1,
    roomName: 'Test Room',
    timeStarted: 0,
    length: 0,
    gameName: 'Test Game',
    playerNames: [],
    doNotHide: false,
    replayList: [],
    ...overrides,
  });
}

type MakeGameOverrides = MessageInitShape<typeof ServerInfo_GameSchema> & {
  gameType?: string;
};

export function makeGame(overrides: MakeGameOverrides = {}): Enriched.Game {
  const { gameType = '', ...protoFields } = overrides;
  return {
    info: create(ServerInfo_GameSchema, { description: '', ...protoFields }),
    gameType,
  };
}

export function makeLoginSuccessContext(
  overrides: Partial<WebsocketTypes.LoginSuccessContext> = {}
): WebsocketTypes.LoginSuccessContext {
  return {
    hashedPassword: 'hash',
    ...overrides,
  };
}

export function makePendingActivationContext(
  overrides: Partial<WebsocketTypes.PendingActivationContext> = {}
): WebsocketTypes.PendingActivationContext {
  return {
    host: 'localhost',
    port: '4747',
    userName: 'user',
    ...overrides,
  };
}

export function makeServerState(overrides: Partial<ServerState> = {}): ServerState {
  return {
    initialized: false,
    testConnectionStatus: null,
    buddyList: {},
    ignoreList: {},
    status: {
      connectionAttemptMade: false,
      state: WebsocketTypes.StatusEnum.DISCONNECTED,
      description: null,
    },
    info: {
      message: null,
      name: null,
      version: null,
    },
    logs: {
      room: [],
      game: [],
      chat: [],
    },
    user: null,
    users: {},
    sortUsersBy: {
      field: App.UserSortField.NAME,
      order: App.SortDirection.ASC,
    },
    messages: {},
    userInfo: {},
    notifications: [],
    serverShutdown: null,
    banUser: '',
    banHistory: {},
    warnHistory: {},
    warnListOptions: [],
    warnUser: '',
    adminNotes: {},
    replays: {},
    backendDecks: null,
    downloadedDeck: null,
    downloadedReplay: null,
    gamesOfUser: {},
    registrationError: null,
    ...overrides,
  };
}
