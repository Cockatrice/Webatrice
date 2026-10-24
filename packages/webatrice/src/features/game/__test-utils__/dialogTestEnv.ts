import { ZoneName } from '@cockatrice/sockatrice';
import { makeGameEntry, makePlayerEntry, makePlayerProperties, makeZoneEntry } from '@cockatrice/datatrice/testing';
import type { GameEntry } from '@cockatrice/datatrice';
import type { Mock } from 'vitest';

import { createMockWebClient } from '../../../__test-utils__';
import type { GameDialogEnv } from '../hooks/dialogs/gameDialogEnv';
import type { GameDialogSetters } from '../hooks/dialogs/useGameDialogState';

export function makeDialogTestGame({ deckCount = 40, hand = [] as number[] } = {}): GameEntry {
  const local = makePlayerEntry({
    properties: makePlayerProperties({ playerId: 1 }),
    zones: {
      [ZoneName.DECK]: makeZoneEntry({ name: ZoneName.DECK, cardCount: deckCount }),
      [ZoneName.HAND]: makeZoneEntry({ name: ZoneName.HAND, cardCount: hand.length, order: hand }),
    },
  });
  return makeGameEntry({ localPlayerId: 1, started: true, players: { 1: local } });
}

export function makeDialogTestEnv(game: GameEntry = makeDialogTestGame()) {
  const webClient = createMockWebClient();
  const env: GameDialogEnv = {
    gameId: 1,
    webClient,
    readGame: () => game,
    readLocalPlayer: () => game.players[game.localPlayerId],
    judgeTarget: () => undefined,
  };
  return { env, webClient, game };
}

type SetterSpies = { [K in keyof GameDialogSetters]: Mock<GameDialogSetters[K]> };

const SETTER_NAMES: ReadonlyArray<keyof GameDialogSetters> = [
  'setZoneViews',
  'setPrompt',
  'setRollDieOpen',
  'setLastDieSides',
  'setLastDieCount',
  'setCreateTokenRequest',
  'setConcedeConfirm',
  'setLeaveConfirm',
];

export function makeSetterSpies(): SetterSpies {
  return Object.fromEntries(SETTER_NAMES.map((name) => [name, vi.fn()])) as unknown as SetterSpies;
}
