import { create, setExtension, toBinary } from '@bufbuild/protobuf';
import { act, render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { WebClientContext } from '@cockatrice/datatrice/react';
import { games, server } from '@cockatrice/datatrice';
import * as Data from '@cockatrice/sockatrice/generated';
import { settingsStore, setPlaymatSettings, PlaymatMode, PlaymatFallbackBehavior } from '@app/hooks';
import { SettingDTO } from '@app/services';
import AppShell from '../../../../src/AppShell';
import { clearPlaymatSyncState } from '../../../../src/features/game/hooks/playmatSyncState';
import { connectAndLogin, getWebClient, store } from '../../helpers/setup';
import { deliverMessage } from '../../helpers/protobuf-builders';
import { findAllGameCommands } from '../../helpers/command-capture';

vi.mock('../../../../src/AppShellRoutes', () => ({ default: () => null }));

it('observes identical deck selections and settings while no game route is mounted (wire to command)', async () => {
  vi.useRealTimers();
  connectAndLogin();
  clearPlaymatSyncState();
  await settingsStore.whenReady();
  settingsStore.setValue(new SettingDTO('*app'));
  await setPlaymatSettings({ mode: PlaymatMode.OVERRIDE_DECK, fallbackBehavior: PlaymatFallbackBehavior.RANDOM,
    fallbackList: ['A', 'B'].map((cardName) => ({ cardName, cardProviderId: '', params: games.DEFAULT_PLAYMAT_PARAMS })) });
  store.dispatch(server.Actions.updateInfo({ info: { name: 'Servatrice', version: '3.1.0 ()' } }));
  store.dispatch(games.Actions.gameJoined({ data: create(Data.Event_GameJoinedSchema, {
    gameInfo: { gameId: 42 }, playerId: 1, spectator: false,
  }) }));
  store.dispatch(games.Actions.playerJoined({ gameId: 42,
    playerProperties: create(Data.ServerInfo_PlayerPropertiesSchema, { playerId: 1 }) }));
  const { unmount } = render(<Provider store={store}><WebClientContext value={getWebClient()}><AppShell /></WebClientContext></Provider>);
  const context = create(Data.GameEventContextSchema);
  setExtension(context, Data.Context_DeckSelect_ext, create(Data.Context_DeckSelectSchema, { deckHash: 'same-hash' }));
  const event = create(Data.GameEventSchema, { playerId: 1 });
  setExtension(event, Data.Event_PlayerPropertiesChanged_ext, create(Data.Event_PlayerPropertiesChangedSchema, {
    playerProperties: { deckHash: 'same-hash', playmatParams: { cardName: 'Deck' } },
  }));
  const bytes = toBinary(Data.ServerMessageSchema, create(Data.ServerMessageSchema, {
    messageType: Data.ServerMessage_MessageType.GAME_EVENT_CONTAINER,
    gameEventContainer: { gameId: 42, context, eventList: [event] },
  }));
  act(() => {
    deliverMessage(bytes); deliverMessage(bytes);
  });
  const sent = findAllGameCommands(Data.Command_SetPlaymat_ext);
  expect(sent).toHaveLength(2);
  expect(new Set(sent.map(({ value }) => value.playmatParams?.cardName))).toEqual(new Set(['A', 'B']));
  const echo = create(Data.GameEventSchema, { playerId: 1 });
  setExtension(echo, Data.Event_PlayerPropertiesChanged_ext, create(Data.Event_PlayerPropertiesChangedSchema, {
    playerProperties: { playmatParams: { cardName: sent.at(-1)!.value.playmatParams!.cardName } },
  }));
  act(() => deliverMessage(toBinary(Data.ServerMessageSchema, create(Data.ServerMessageSchema, {
    messageType: Data.ServerMessage_MessageType.GAME_EVENT_CONTAINER,
    gameEventContainer: { gameId: 42, eventList: [echo] },
  }))));
  expect(findAllGameCommands(Data.Command_SetPlaymat_ext)).toHaveLength(2);
  await act(async () => {
    await setPlaymatSettings({ mode: PlaymatMode.DECK_ONLY });
  });
  expect(findAllGameCommands(Data.Command_SetPlaymat_ext).at(-1)?.value.playmatParams?.cardName).toBe('Deck');
  unmount();
});
