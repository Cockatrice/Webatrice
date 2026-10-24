import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import { App } from '../../types';
import { Event_ServerShutdown } from '@cockatrice/sockatrice/generated';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { ServerConnectionHealth, ServerLatency, ServerState, ServerStateStatus } from './server.interfaces';
import { initialStaffState } from './server.reducer.staff';
import { initialReportsState } from './server.reducer.reports';

export const HEALTHY_CONNECTION_HEALTH: ServerConnectionHealth = {
  missedPongs: 0,
  silentForMs: 0,
};

export const EMPTY_LATENCY: ServerLatency = {
  stats: { lastMs: 0, medianMs: 0, p95Ms: 0, maxMs: 0, sampleCount: 0 },
  samplesMs: [],
};

export const initialState: ServerState = {
  initialized: false,
  sessionEpoch: 0,
  testConnectionStatus: null,
  buddyList: {},
  ignoreList: {},

  status: {
    connectionAttemptMade: false,
    state: WebsocketTypes.StatusEnum.DISCONNECTED,
    description: null
  },
  connectionHealth: HEALTHY_CONNECTION_HEALTH,
  latency: EMPTY_LATENCY,
  connectUnreachable: false,
  loginFailureCode: null,
  info: {
    message: null,
    name: null,
    version: null
  },
  logs: {
    room: [],
    game: [],
    chat: []
  },
  user: null,
  users: {},
  sortUsersBy: {
    field: App.UserSortField.NAME,
    order: App.SortDirection.ASC
  },
  locale: undefined,
  messages: {},
  privateChatNotices: {},
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
  deckSharesMine: null,
  publicDecks: {},
  downloadedReplay: null,
  gamesOfUser: {},
  gamesOfUserRoomNames: {},
  gamesOfUserStatus: {},
  registrationError: null,
  staff: initialStaffState,
  reports: initialReportsState,
};

export const connectionReducers = {
  initialized: ((state) => ({
    ...initialState,
    initialized: true,
    sessionEpoch: state.sessionEpoch ?? 0,
    locale: state.locale,
  })) as CaseReducer<ServerState>,

  setLocale: ((state, action) => {
    state.locale = action.payload;
  }) as CaseReducer<ServerState, PayloadAction<string | undefined>>,

  connectionAttempted: ((state) => {
    state.status.connectionAttemptMade = true;
    state.connectUnreachable = false;
    state.loginFailureCode = null;
  }) as CaseReducer<ServerState>,

  loginFailed: ((state, action) => {
    state.loginFailureCode = action.payload?.responseCode ?? null;
  }) as CaseReducer<ServerState, PayloadAction<{ responseCode?: number } | undefined>>,

  connectUnreachable: ((state) => {
    state.connectUnreachable = true;
  }) as CaseReducer<ServerState>,

  testConnectionStarted: ((state) => {
    state.testConnectionStatus = 'testing';
    state.connectUnreachable = false;
  }) as CaseReducer<ServerState>,

  // `supportsHashedPassword` is typed on the action so `useReduxEffect`
  // subscribers (see useKnownHostsComponent) can persist it to the host
  // record in Dexie. It's deliberately not stored in redux state since
  // only the lifecycle matters here; per-host capability lives in Dexie.
  testConnectionSuccessful: ((state, _action) => {
    state.testConnectionStatus = 'success';
  }) as CaseReducer<ServerState, PayloadAction<{ supportsHashedPassword: boolean }>>,

  testConnectionFailed: ((state) => {
    state.testConnectionStatus = 'failed';
  }) as CaseReducer<ServerState>,

  clearStore: ((state) => ({
    ...initialState,
    status: { ...state.status },
    sessionEpoch: (state.sessionEpoch ?? 0) + 1,
    locale: state.locale,
    testConnectionStatus: state.testConnectionStatus,
  })) as CaseReducer<ServerState>,

  disconnected: ((state) => ({
    ...initialState,
    status: { ...state.status },
    sessionEpoch: (state.sessionEpoch ?? 0) + 1,
    locale: state.locale,
    testConnectionStatus: state.testConnectionStatus,
    connectUnreachable: state.connectUnreachable,
    loginFailureCode: state.loginFailureCode,
  })) as CaseReducer<ServerState>,

  serverMessage: ((state, action) => {
    state.info.message = action.payload.message;
  }) as CaseReducer<ServerState, PayloadAction<{ message: string }>>,

  updateInfo: ((state, action) => {
    const { name, version, supportsPasswordHash } = action.payload.info;
    state.info.name = name;
    state.info.version = version;
    state.info.supportsPasswordHash = supportsPasswordHash;
  }) as CaseReducer<ServerState, PayloadAction<{ info: { name: string; version: string; supportsPasswordHash?: boolean } }>>,

  updateStatus: ((state, action) => {
    const { status } = action.payload;
    if (status.state === WebsocketTypes.StatusEnum.LOGGED_IN && state.status.state !== status.state) {
      state.sessionEpoch = (state.sessionEpoch ?? 0) + 1;
    }
    state.status.state = status.state;
    state.status.description = status.description;
    state.connectionHealth = HEALTHY_CONNECTION_HEALTH;

    if (status.state === WebsocketTypes.StatusEnum.DISCONNECTED) {
      state.status.connectionAttemptMade = false;
    }
  }) as CaseReducer<ServerState, PayloadAction<{ status: Pick<ServerStateStatus, 'state' | 'description'> }>>,

  connectionHealthChanged: ((state, action) => {
    const { missedPongs, silentForMs } = action.payload;
    state.connectionHealth = { missedPongs, silentForMs };
  }) as CaseReducer<ServerState, PayloadAction<{ missedPongs: number; silentForMs: number }>>,

  latencyStatsUpdated: ((state, action) => {
    state.latency = action.payload;
  }) as CaseReducer<ServerState, PayloadAction<ServerLatency>>,

  serverShutdown: ((state, action) => {
    state.serverShutdown = action.payload.data;
  }) as CaseReducer<ServerState, PayloadAction<{ data: Event_ServerShutdown }>>,
};
