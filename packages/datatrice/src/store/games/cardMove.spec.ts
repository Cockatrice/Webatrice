import { create, type MessageInitShape } from '@bufbuild/protobuf';
import { Event_MoveCardSchema } from '@cockatrice/sockatrice/generated';
import {
  arrowsTouchingCard,
  buildMovedCard,
  cardMovedLogEntry,
  planAttachmentReparent,
  planMovePlacement,
  planOptimisticReconcile,
  planZoneViewSync,
  resolveMoveIdentity,
  sweepsArrows,
} from './cardMove';
import {
  makeArrow,
  makeCard,
  makeGameEntry,
  makePlayerEntry,
  makePlayerProperties,
  makeState,
  makeZoneEntry,
} from '../../testing/fixtures/games';

function move(init: MessageInitShape<typeof Event_MoveCardSchema>) {
  return create(Event_MoveCardSchema, {
    cardId: -1, cardName: '', startPlayerId: 1, startZone: 'hand', position: -1,
    targetPlayerId: 1, targetZone: '', x: 0, y: 0, newCardId: -1, faceDown: false,
    ...init,
  });
}

const BOLT = makeCard({ id: 20, name: 'Lightning Bolt', providerId: 'bolt-1' });
const ISLAND = makeCard({ id: 21, name: 'Island' });
const hand = makeZoneEntry({ name: 'hand', cards: [BOLT, ISLAND], cardCount: 2 });
const hiddenHand = makeZoneEntry({ name: 'hand', type: 2, cardCount: 7 });
const viewedDeck = makeZoneEntry({
  name: 'deck', type: 2, cardCount: 30, revealedCards: [makeCard({ id: 100, name: 'Opt' })],
});

describe('resolveMoveIdentity', () => {
  it.each([
    ['the event card id', hand, { cardId: 21 }, 21, ISLAND],
    ['the card at `position` when the id is hidden', hand, { position: 0 }, 20, BOLT],
    ['nothing for an out-of-range position', hand, { position: 5 }, -1, undefined],
    ['nothing for a hidden zone', hiddenHand, { position: 0 }, -1, undefined],
  ])('resolves %s', (_label, zone, init, cardId, sourceCard) => {
    const identity = resolveMoveIdentity(zone, move({ targetZone: 'grave', ...init }));
    expect(identity.cardId).toBe(cardId);
    expect(identity.sourceCard).toBe(sourceCard);
  });

  it.each([
    ['newCardId when the server reassigns it', { cardId: 20, newCardId: 70 }, 70],
    ['the source id otherwise', { cardId: 20 }, 20],
    ['the event id for a card the client never held', { cardId: 99 }, 99],
  ])('takes the new id from %s', (_label, init, newCardId) => {
    expect(resolveMoveIdentity(hand, move({ targetZone: 'grave', ...init })).newCardId).toBe(newCardId);
  });

  it.each([
    ['another zone', { startZone: 'hand', targetZone: 'grave' }, 'grave', true],
    ['the same zone', { startZone: 'hand', targetZone: 'hand' }, 'hand', false],
    ['an empty target zone (= the start zone)', { startZone: 'hand', targetZone: '' }, 'hand', false],
    ['the same zone of another player', { startZone: 'table', targetZone: 'table', targetPlayerId: 2 }, 'table', true],
  ])('treats a move to %s', (_label, init, targetZone, crossesZones) => {
    const identity = resolveMoveIdentity(hand, move({ cardId: 20, ...init }));
    expect(identity.targetZone).toBe(targetZone);
    expect(identity.crossesZones).toBe(crossesZones);
  });

  it.each([
    [{ cardId: -1, newCardId: -1 }, true],
    [{ cardId: -1, newCardId: 5 }, false],
    [{ cardId: 20, newCardId: -1 }, false],
  ])('marks %o hidden: %s', (init, hidden) => {
    expect(resolveMoveIdentity(hiddenHand, move({ targetZone: 'deck', ...init })).hidden).toBe(hidden);
  });
});

describe('buildMovedCard', () => {
  const tapped = makeCard({
    id: 10, name: 'Grizzly Bears', tapped: true, attacking: true, pt: '3/3', color: 'g',
    annotation: 'note', counterList: [{ id: 1, value: 2 }], providerId: 'bears-1',
  });
  const table = makeZoneEntry({ name: 'table', cards: [tapped], cardCount: 1 });

  it('carries the source card with the event fields applied', () => {
    const data = move({ cardId: 10, startZone: 'table', targetZone: 'table', x: 4, y: 1, newCardId: 40 });
    const card = buildMovedCard(resolveMoveIdentity(table, data), data);
    expect(card).toMatchObject({ id: 40, name: 'Grizzly Bears', x: 4, y: 1, tapped: true, pt: '3/3', providerId: 'bears-1' });
    expect(card.counterList).toEqual(tapped.counterList);
    expect(card.counterList).not.toBe(tapped.counterList);
  });

  it('prefers the event name and provider id when present', () => {
    const data = move({ cardId: 20, targetZone: 'grave', cardName: 'Bolt (alt)', newCardProviderId: 'bolt-2' });
    expect(buildMovedCard(resolveMoveIdentity(hand, data), data)).toMatchObject({ name: 'Bolt (alt)', providerId: 'bolt-2' });
  });

  it('builds a blank card the client never held', () => {
    const data = move({ cardId: 99, startZone: 'deck', targetZone: 'hand', cardName: 'Opt', faceDown: true });
    expect(buildMovedCard(resolveMoveIdentity(viewedDeck, data), data)).toMatchObject({
      id: 99, name: 'Opt', faceDown: true, attachPlayerId: -1, attachCardId: -1, counterList: [],
    });
  });

  it.each([
    ['grave', ''],
    ['hand', ''],
    ['stack', 'note'],
  ])('resets battlefield state when leaving for %s (annotation %j)', (targetZone, annotation) => {
    const data = move({ cardId: 10, startZone: 'table', targetZone });
    expect(buildMovedCard(resolveMoveIdentity(table, data), data)).toMatchObject({
      tapped: false, attacking: false, pt: '', color: '', annotation, counterList: [],
    });
  });
});

describe('planMovePlacement', () => {
  const pile = (name: string) => makeZoneEntry({ name, cards: [BOLT, ISLAND], cardCount: 2 });
  const viewedHiddenDeck = { ...viewedDeck, order: [] };
  it.each([
    ['a hidden cross-zone move', hiddenHand, { startZone: 'hand', targetZone: 'deck' }, 'count-transfer'],
    ['a hidden same-zone move', hiddenHand, { startZone: 'hand', targetZone: 'hand' }, 'none'],
    ['a hidden move inside an open view', viewedHiddenDeck, { startZone: 'deck', targetZone: 'deck', position: 5 }, 'view-reorder'],
    ['a visible move inside an open view', viewedDeck, { cardId: 100, startZone: 'deck', targetZone: 'deck', position: 0 }, 'view-reorder'],
    ['an open-view zone left without a position', viewedDeck, { cardId: 100, startZone: 'deck', targetZone: 'deck' }, 'between-zones'],
    ['a hand reorder', hand, { cardId: 20, targetZone: 'hand' }, 'same-zone'],
    ['a stack reorder', pile('stack'), { cardId: 20, startZone: 'stack', targetZone: 'stack' }, 'same-zone'],
    ['a graveyard reorder', pile('grave'), { cardId: 20, startZone: 'grave', targetZone: 'grave' }, 'same-zone'],
    ['an exile reorder', pile('rfg'), { cardId: 20, startZone: 'rfg', targetZone: 'rfg' }, 'same-zone'],
    ['a table reposition', hand, { cardId: 20, startZone: 'table', targetZone: 'table' }, 'between-zones'],
    ['a cross-zone move', hand, { cardId: 20, targetZone: 'grave' }, 'between-zones'],
    ['an unidentified same-zone hand move with a new id', hand, { newCardId: 7, targetZone: 'hand' }, 'between-zones'],
  ])('places %s as %s', (_label, zone, init, placement) => {
    const data = move(init);
    expect(planMovePlacement(resolveMoveIdentity(zone, data), zone, data)).toBe(placement);
  });
});

describe('planOptimisticReconcile', () => {
  const optimistic = makeCard({ id: 10, name: 'Grizzly Bears', x: 3, annotation: 'Owner: Alice', providerId: 'bears-1' });
  const target = makeZoneEntry({ name: 'table', cards: [optimistic], cardCount: 1 });

  it('re-keys the optimistic entry to a new server id, keeping its client-only fields', () => {
    const plan = planOptimisticReconcile(target, 10, makeCard({ id: 70, name: '', x: 4, y: 1, faceDown: true }));
    expect(plan?.kind).toBe('migrate');
    expect(plan?.kind === 'migrate' && plan.card).toMatchObject({
      id: 70, x: 4, y: 1, faceDown: true, name: 'Grizzly Bears', annotation: 'Owner: Alice', providerId: 'bears-1',
    });
  });

  it('patches the position when the id is unchanged', () => {
    expect(planOptimisticReconcile(target, 10, makeCard({ id: 10, x: 6, y: 0 }))).toEqual({
      kind: 'patch', fields: { x: 6, y: 0, faceDown: false },
    });
  });

  it('patches a face-down landing', () => {
    expect(planOptimisticReconcile(target, 10, makeCard({ id: 10, x: 6, y: 1, faceDown: true }))).toEqual({
      kind: 'patch', fields: { x: 6, y: 1, faceDown: true },
    });
  });

  it('patches the server entry when the new id is already present', () => {
    const both = makeZoneEntry({ name: 'table', cards: [optimistic, makeCard({ id: 70 })] });
    expect(planOptimisticReconcile(both, 10, makeCard({ id: 70, x: 2 }))?.kind).toBe('patch');
  });

  it.each([
    ['no target zone', undefined],
    ['neither id in the target zone', makeZoneEntry({ name: 'table' })],
  ])('does nothing with %s', (_label, zone) => {
    expect(planOptimisticReconcile(zone, 10, makeCard({ id: 70 }))).toBeNull();
  });
});

describe('planZoneViewSync', () => {
  const plainDeck = makeZoneEntry({ name: 'deck', type: 2, cardCount: 30 });
  const viewedGrave = makeZoneEntry({ name: 'grave', revealedCards: [] });
  it.each([
    ['the top card leaves a viewed library', viewedDeck, hand, { cardId: 100, startZone: 'deck', position: 0, targetZone: 'hand' },
      { removeAt: 0, clearTop: true, insertAt: undefined }],
    ['a deeper card leaves a viewed library', viewedDeck, hand, { cardId: 100, startZone: 'deck', position: 3, targetZone: 'hand' },
      { removeAt: 3, clearTop: false, insertAt: undefined }],
    ['the top card leaves an unviewed library', plainDeck, hand, { cardId: 100, startZone: 'deck', position: 0, targetZone: 'hand' },
      { removeAt: undefined, clearTop: true, insertAt: undefined }],
    ['a card arrives in a viewed zone', hand, viewedGrave, { cardId: 20, targetZone: 'grave', x: 2 },
      { removeAt: undefined, clearTop: false, insertAt: 2 }],
    ['a card moves within a viewed library', viewedDeck, viewedDeck, { cardId: 100, startZone: 'deck', position: 0, targetZone: 'deck' },
      { removeAt: undefined, clearTop: true, insertAt: undefined }],
  ])('when %s', (_label, source, target, init, expected) => {
    const data = move(init);
    expect(planZoneViewSync(resolveMoveIdentity(source, data), source, target, data)).toEqual(expected);
  });
});

describe('sweepsArrows', () => {
  it.each([
    ['a card leaving its zone', { cardId: 20, targetZone: 'grave' }, true],
    ['a card changing controller on the table', { cardId: 20, startZone: 'table', targetZone: 'table', targetPlayerId: 2 }, true],
    ['a same-player table reposition', { cardId: 20, startZone: 'table', targetZone: 'table' }, false],
    ['a hidden card', { targetZone: 'grave' }, false],
  ])('%s → %s', (_label, init, expected) => {
    expect(sweepsArrows(resolveMoveIdentity(hand, move(init)))).toBe(expected);
  });
});

describe('arrowsTouchingCard', () => {
  const state = makeState({
    games: {
      1: makeGameEntry({
        players: {
          1: makePlayerEntry({
            arrows: {
              1: makeArrow({ id: 1, startPlayerId: 1, startZone: 'table', startCardId: 10, targetPlayerId: 2, targetCardId: 30 }),
              2: makeArrow({ id: 2, startPlayerId: 1, startZone: 'table', startCardId: 11, targetPlayerId: 2, targetCardId: 30 }),
            },
          }),
          2: makePlayerEntry({
            arrows: {
              3: makeArrow({ id: 3, startPlayerId: 2, startZone: 'table', startCardId: 30, targetPlayerId: 1, targetCardId: 10 }),
              4: makeArrow({ id: 4, startPlayerId: 2, startZone: 'table', startCardId: 30, targetPlayerId: 1, targetZone: 'hand',
                targetCardId: 10 }),
            },
          }),
        },
      }),
    },
  });

  it.each([
    ['both endpoints across players', 1, 'table', 10, [{ ownerPlayerId: 1, arrowId: 1 }, { ownerPlayerId: 2, arrowId: 3 }]],
    ['the zone, not just the id', 1, 'hand', 10, [{ ownerPlayerId: 2, arrowId: 4 }]],
    ['the owning player', 2, 'table', 10, []],
    ['a card with no arrows', 1, 'table', 12, []],
  ])('matches %s', (_label, playerId, zoneName, cardId, expected) => {
    expect(arrowsTouchingCard(state, 1, playerId, zoneName, cardId)).toEqual(expected);
  });

  it('returns nothing for an unknown game', () => {
    expect(arrowsTouchingCard(state, 999, 1, 'table', 10)).toEqual([]);
  });
});

describe('planAttachmentReparent', () => {
  it.each([
    ['a cross-player table move', { cardId: 20, startZone: 'table', targetZone: 'table', targetPlayerId: 2, newCardId: 70 },
      { fromPlayerId: 1, fromCardId: 20, toPlayerId: 2, toCardId: 70 }],
    ['a same-player reposition', { cardId: 20, startZone: 'table', targetZone: 'table' },
      { fromPlayerId: 1, fromCardId: 20, toPlayerId: 1, toCardId: 20 }],
    ['a move off the table', { cardId: 20, startZone: 'table', targetZone: 'grave' }, null],
    ['a move onto the table', { cardId: 20, startZone: 'hand', targetZone: 'table' }, null],
    ['an unidentified card', { startZone: 'table', targetZone: 'table' }, null],
  ])('%s', (_label, init, expected) => {
    const data = move(init);
    expect(planAttachmentReparent(resolveMoveIdentity(hand, data), data)).toEqual(expected);
  });
});

describe('cardMovedLogEntry', () => {
  const game = makeGameEntry({
    players: {
      1: makePlayerEntry({
        properties: makePlayerProperties({ playerId: 1, userInfo: { name: 'Alice' } }),
        zones: { hand },
      }),
    },
  });

  it.each([
    ['names the known card', { cardId: 20, targetZone: 'grave' }, false, 'Alice puts Lightning Bolt from their hand into their graveyard.'],
    ['logs an undo draw with the known name', { cardId: 20, targetZone: 'deck' }, true, 'Alice undoes their last draw (Lightning Bolt).'],
    ['prefers the known name over the event name on an undo draw', { cardId: 20, cardName: 'Shock', targetZone: 'deck' }, true,
      'Alice undoes their last draw (Lightning Bolt).'],
    ['logs an undo draw with the event name', { cardId: 99, cardName: 'Opt', targetZone: 'deck' }, true,
      'Alice undoes their last draw (Opt).'],
    ['logs an undo draw of a hidden card', { targetZone: 'deck' }, true, 'Alice undoes their last draw.'],
  ])('%s', (_label, init, isUndoDraw, text) => {
    const data = move(init);
    expect(cardMovedLogEntry(game, 1, data, resolveMoveIdentity(hand, data), isUndoDraw)?.text).toBe(text);
  });

  it('stays silent for a same-zone reorder', () => {
    const data = move({ cardId: 20, targetZone: 'hand', x: 1 });
    expect(cardMovedLogEntry(game, 1, data, resolveMoveIdentity(hand, data), false)).toBeNull();
  });
});
