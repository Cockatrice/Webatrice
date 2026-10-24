import { games } from '@cockatrice/datatrice';
import { parseCod, readDeckPlaymat } from '@app/services';

import { setDeckPlaymat } from './deckEdits';
import { exportDeck } from './deckExport';
import { EMPTY_DECK_HISTORY, recordDeckEdit, redoDeck, undoDeck } from './deckHistory';
import { deckSaveSignature, serializeDeckForSave } from './deckPersistence';
import { isBlankDeck } from './deckSharing';
import type { HydratedDeck } from './types';

const deck: HydratedDeck = { name: '', format: '', meta: { v: 1, updatedAt: '' }, cards: [] };
const playmat: games.Playmat = { cardName: 'Island', cardProviderId: 'id', params: { ...games.DEFAULT_PLAYMAT_PARAMS } };

it('persists, exports and shares an authored playmat using the game playmat structure', () => {
  const edited = setDeckPlaymat(deck, playmat);
  expect(readDeckPlaymat(edited.playmatXml)).toEqual(playmat);
  expect(readDeckPlaymat(parseCod(serializeDeckForSave(edited)).playmatXml)).toEqual(playmat);
  expect(readDeckPlaymat(parseCod(exportDeck(edited, 'cockatrice')).playmatXml)).toEqual(playmat);
  expect(deckSaveSignature(edited)).not.toBe(deckSaveSignature(deck));
  expect(isBlankDeck(edited)).toBe(false);
  expect(setDeckPlaymat(edited, playmat)).toBe(edited);
  expect(isBlankDeck(setDeckPlaymat(edited, null))).toBe(true);
});

it('undoes and redoes playmat editing and removal', () => {
  const edited = setDeckPlaymat(deck, playmat);
  const history = recordDeckEdit(EMPTY_DECK_HISTORY, deck, { kind: 'playmat' }, { now: 1 });
  const undone = undoDeck(history, edited)!;
  expect(readDeckPlaymat(undone.deck.playmatXml)).toBeNull();
  expect(readDeckPlaymat(redoDeck(undone.history, undone.deck)!.deck.playmatXml)).toEqual(playmat);
  const removed = setDeckPlaymat(edited, null);
  const removal = recordDeckEdit(history, edited, { kind: 'playmat' }, { now: 2 });
  expect(readDeckPlaymat(undoDeck(removal, removed)!.deck.playmatXml)).toEqual(playmat);
});
