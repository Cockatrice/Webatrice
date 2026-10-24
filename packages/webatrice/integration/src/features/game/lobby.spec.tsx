import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';
import { describe, expect, it } from 'vitest';
import { useState } from 'react';

import { games } from '@cockatrice/datatrice';
import {
  Command_DeckSelect_ext,
  Command_KickFromGame_ext,
  Command_ReadyStart_ext,
  Command_SetSideboardLock_ext,
  Command_SetSideboardPlan_ext,
  Event_GameStateChangedSchema,
  Event_PlayerPropertiesChanged_ext,
  Event_PlayerPropertiesChangedSchema,
  Response_ResponseCode,
  Response_DeckDownload_ext,
  Response_DeckDownloadSchema,
  ServerInfo_PlayerPropertiesSchema,
  ServerInfo_PlayerSchema,
  ServerInfo_UserSchema,
} from '@cockatrice/sockatrice/generated';
import GameLobby from '../../../../src/features/game/GameLobby';
import { connectRaw, store } from '../../helpers/setup';
import { findAllGameCommands, findLastGameCommand } from '../../helpers/command-capture';
import { buildGameEventMessage, buildResponse, buildResponseMessage, deliverMessage } from '../../helpers/protobuf-builders';
import { renderFeatureScreen } from '../helpers';
import { buildEventGameJoined, registerGameBoardHooks } from './helpers';

registerGameBoardHooks();

const GAME_ID = 42;
const UPLOADED = `<?xml version="1.0" encoding="UTF-8"?>
<cockatrice_deck version="1"><deckname>Burn</deckname>
<zone name="main"><card number="4" name="Lightning Bolt"/><card number="20" name="Mountain"/></zone>
<zone name="side"><card number="2" name="Smash to Smithereens"/></zone>
</cockatrice_deck>`;

function LobbyRouteHarness() {
  const [visible, setVisible] = useState(true);
  return <>
    <button onClick={() => setVisible(value => !value)}>{visible ? 'Other route' : 'Lobby route'}</button>
    {visible && <GameLobby gameId={GAME_ID} />}
  </>;
}

function enterLobby() {
  connectRaw();
  renderFeatureScreen(<LobbyRouteHarness />);
  act(() => {
    store.dispatch(games.Actions.gameJoined({ data: buildEventGameJoined({ gameId: GAME_ID, localPlayerId: 1, hostId: 1 }) }));
    store.dispatch(games.Actions.gameStateChanged({
      gameId: GAME_ID,
      data: create(Event_GameStateChangedSchema, {
        gameStarted: false,
        playerList: [1, 2].map((playerId) => create(ServerInfo_PlayerSchema, {
          properties: create(ServerInfo_PlayerPropertiesSchema, {
            playerId,
            sideboardLocked: true,
            userInfo: create(ServerInfo_UserSchema, { name: `P${playerId}` }),
          }),
        })),
      }),
    }));
  });
}

function setLocalProperties(properties: Partial<{ sideboardLocked: boolean; readyStart: boolean; deckHash: string }>) {
  act(() => {
    deliverMessage(buildGameEventMessage({
      gameId: GAME_ID,
      playerId: 1,
      ext: Event_PlayerPropertiesChanged_ext,
      value: create(Event_PlayerPropertiesChangedSchema, {
        playerProperties: create(ServerInfo_PlayerPropertiesSchema, { playerId: 1, ...properties }),
      }),
    }));
  });
}

async function loadDeck() {
  const previousCount = findAllGameCommands(Command_DeckSelect_ext).length;
  const input = document.querySelector<HTMLInputElement>('input[type="file"][accept*=".cod"]')!;
  fireEvent.change(input, { target: { files: [new File([UPLOADED], 'burn.cod', { type: 'text/xml' })] } });
  await waitFor(() => expect(findAllGameCommands(Command_DeckSelect_ext)).toHaveLength(previousCount + 1));
  const deckSelect = findLastGameCommand(Command_DeckSelect_ext);
  expect(deckSelect.value.deck).toBe(UPLOADED);
  act(() => {
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: deckSelect.cmdId,
      ext: Response_DeckDownload_ext,
      value: create(Response_DeckDownloadSchema, { deck: UPLOADED }),
    })));
  });
  setLocalProperties({ sideboardLocked: true, deckHash: 'abcd1234' });
  await screen.findByTestId('lobby-deck-view');
}

describe('GameLobby integration (GAME-013 / GAME-014)', () => {
  it('retains edits across route navigation and unload sends unready before the ready echo', async () => {
    enterLobby();
    await loadDeck();
    setLocalProperties({ sideboardLocked: false });
    const bolt = await waitFor(() => {
      const row = screen.getByRole('button', { name: '4 Lightning Bolt' });
      expect(row).toBeEnabled();
      return row;
    });
    fireEvent.click(bolt);
    fireEvent.click(screen.getByRole('button', { name: 'Other route' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lobby route' }));
    expect(within(screen.getByTestId('lobby-deck-side')).getByText('Lightning Bolt')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '2 Smash to Smithereens' }));
    expect(findLastGameCommand(Command_SetSideboardPlan_ext).value.moveList.map(({ cardName, startZone, targetZone }) => (
      { cardName, startZone, targetZone }
    ))).toEqual([
      { cardName: 'Smash to Smithereens', startZone: 'side', targetZone: 'main' },
      { cardName: 'Lightning Bolt', startZone: 'main', targetZone: 'side' },
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'GameLobby.action.readyStart' }));
    fireEvent.click(screen.getByRole('button', { name: 'GameLobby.action.unloadDeck' }));
    expect(findAllGameCommands(Command_ReadyStart_ext).map(command => command.value.ready)).toEqual([true, false]);
  });

  it('builds the deck view from the Response_DeckDownload to Command_DeckSelect', async () => {
    enterLobby();
    await loadDeck();
    expect(within(screen.getByTestId('lobby-deck-main')).getByText('Lightning Bolt')).toBeInTheDocument();
    expect(within(screen.getByTestId('lobby-deck-side')).getByText('Smash to Smithereens')).toBeInTheDocument();
  });

  it('unlock → swap a card → ready sends the lock, the plan in deck zones, then ready', async () => {
    enterLobby();
    await loadDeck();

    fireEvent.click(screen.getByRole('button', { name: 'GameLobby.action.sideboardLocked' }));
    expect(findLastGameCommand(Command_SetSideboardLock_ext).value.locked).toBe(false);
    setLocalProperties({ sideboardLocked: false });

    const bolt = await waitFor(() => {
      const row = within(screen.getByTestId('lobby-deck-main')).getByText('Lightning Bolt').closest('button')!;
      expect(row).toBeEnabled();
      return row;
    });
    fireEvent.click(bolt);
    fireEvent.click(within(screen.getByTestId('lobby-deck-side')).getByText('Smash to Smithereens').closest('button')!);

    const plan = findLastGameCommand(Command_SetSideboardPlan_ext).value.moveList;
    expect(plan.map(({ cardName, startZone, targetZone }) => ({ cardName, startZone, targetZone }))).toEqual([
      { cardName: 'Smash to Smithereens', startZone: 'side', targetZone: 'main' },
      { cardName: 'Lightning Bolt', startZone: 'main', targetZone: 'side' },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'GameLobby.action.readyStart' }));
    const ready = findLastGameCommand(Command_ReadyStart_ext).value;
    expect(ready.ready).toBe(true);
    expect(ready.forceStart).toBe(false);

    setLocalProperties({ readyStart: true });
    await waitFor(() => expect(screen.getByRole('button', { name: 'GameLobby.action.sideboardUnlocked' })).toBeDisabled());
    expect(within(screen.getByTestId('lobby-deck-side')).getByText('Lightning Bolt').closest('button')).toBeDisabled();
  });

  it('re-selecting a deck with a stored plan shows that plan after Servatrice\'s lock event and response', async () => {
    enterLobby();
    await loadDeck();
    setLocalProperties({ sideboardLocked: false });
    fireEvent.click(screen.getByRole('button', { name: 'GameLobby.action.unloadDeck' }));

    const withPlan = UPLOADED.replace(
      '</cockatrice_deck>',
      '<sideboard_plan><name></name><move_card_to_zone><card_name>Lightning Bolt</card_name>'
        + '<start_zone>main</start_zone><target_zone>side</target_zone></move_card_to_zone></sideboard_plan></cockatrice_deck>',
    );
    const input = document.querySelector<HTMLInputElement>('input[type="file"][accept*=".cod"]')!;
    fireEvent.change(input, { target: { files: [new File([withPlan], 'burn.cod', { type: 'text/xml' })] } });
    await waitFor(() => expect(findLastGameCommand(Command_DeckSelect_ext).value.deck).toBe(withPlan));
    const deckSelect = findLastGameCommand(Command_DeckSelect_ext);

    setLocalProperties({ sideboardLocked: true });
    act(() => {
      deliverMessage(buildResponseMessage(buildResponse({
        cmdId: deckSelect.cmdId,
        ext: Response_DeckDownload_ext,
        value: create(Response_DeckDownloadSchema, { deck: withPlan }),
      })));
    });

    await waitFor(() => expect(within(screen.getByTestId('lobby-deck-side')).getByText('Lightning Bolt')).toBeInTheDocument());
  });

  it('host force start sends one Command_ReadyStart{ready, force_start} and no kicks', async () => {
    enterLobby();
    await loadDeck();

    fireEvent.click(screen.getByRole('button', { name: 'GameLobby.action.forceStart' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'GameLink.yes' }));

    const readyStarts = findAllGameCommands(Command_ReadyStart_ext);
    expect(readyStarts).toHaveLength(1);
    expect(readyStarts[0].value.ready).toBe(true);
    expect(readyStarts[0].value.forceStart).toBe(true);
    expect(readyStarts[0].gameId).toBe(GAME_ID);
    expect(findAllGameCommands(Command_KickFromGame_ext)).toHaveLength(0);
  });
});

it('ignores an earlier upload rejection after a later deck selection succeeds', async () => {
  enterLobby();
  const input = document.querySelector<HTMLInputElement>('input[type="file"][accept*=".cod"]')!;
  fireEvent.change(input, { target: { files: [new File([UPLOADED], 'first.cod', { type: 'text/xml' })] } });
  await waitFor(() => expect(findAllGameCommands(Command_DeckSelect_ext)).toHaveLength(1));
  const first = findLastGameCommand(Command_DeckSelect_ext);
  await loadDeck();
  expect(findAllGameCommands(Command_DeckSelect_ext)).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'GameLobby.action.unloadDeck' }));
  act(() => deliverMessage(buildResponseMessage(buildResponse({
    cmdId: first.cmdId, responseCode: Response_ResponseCode.RespContextError,
  }))));
  expect(screen.queryByText('GameLobby.deckSelectFailed')).not.toBeInTheDocument();
  expect(screen.getByText('GameLobby.upload.heading')).toBeInTheDocument();
});
