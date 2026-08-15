import { create } from '@bufbuild/protobuf';
import { CardAttribute, Event_ChangeZonePropertiesSchema } from '@cockatrice/sockatrice/generated';

import {
  classifyLogTone,
  diffPlayerProperties,
  formatActivePhaseSet,
  formatActivePlayerSet,
  formatArrowCreated,
  formatCardAttached,
  formatCardAttrChanged,
  formatCardAttrChangedBulk,
  formatCardCounterChanged,
  formatCardDestroyed,
  formatCardFlipped,
  formatCardMoved,
  formatCardsDrawn,
  formatCounterSet,
  formatDieRolled,
  formatPlayerJoined,
  formatPropertyDiff,
  formatTokenCreated,
  formatTurnReversed,
  formatZoneDumped,
  formatZonePropertiesChanged,
  formatZoneShuffled,
} from './messageLog';
import {
  makeArrow,
  makeCard,
  makeGameEntry,
  makePlayerEntry,
  makePlayerProperties,
  makeZoneEntry,
} from '../../testing/fixtures/games';

function gameWithTwoPlayers() {
  return makeGameEntry({
    localPlayerId: 1,
    activePlayerId: 1,
    players: {
      1: makePlayerEntry({
        properties: makePlayerProperties({ playerId: 1, userInfo: { name: 'Alice' } }),
        zones: {
          hand: makeZoneEntry({ name: 'hand' }),
          table: makeZoneEntry({ name: 'table', cards: [makeCard({ id: 10, name: 'Bolt' })], cardCount: 1 }),
        },
      }),
      2: makePlayerEntry({
        properties: makePlayerProperties({ playerId: 2, userInfo: { name: 'Bob' } }),
        zones: {
          hand: makeZoneEntry({ name: 'hand' }),
          table: makeZoneEntry({ name: 'table', cards: [makeCard({ id: 20, name: 'Bear' })], cardCount: 1 }),
        },
      }),
    },
  });
}

describe('formatCardMoved', () => {
  const game = gameWithTwoPlayers();

  it('logs hand → battlefield as "puts into play from their hand" (Cockatrice parity)', () => {
    const msg = formatCardMoved(game, 1, {
      cardId: 5, cardName: 'Bolt',
      startPlayerId: 1, startZone: 'hand',
      targetPlayerId: 1, targetZone: 'table',
      position: -1, x: 0, y: 0, newCardId: -1, faceDown: false, newCardProviderId: '',
    }, { resolvedCardName: 'Bolt' });
    expect(msg?.text).toBe('Alice puts Bolt into play from their hand.');
  });

  it('logs hand → stack as "plays" (Cockatrice parity)', () => {
    const msg = formatCardMoved(game, 1, {
      cardId: 5, cardName: 'Bolt',
      startPlayerId: 1, startZone: 'hand',
      targetPlayerId: 1, targetZone: 'stack',
      position: -1, x: 0, y: 0, newCardId: -1, faceDown: false, newCardProviderId: '',
    }, { resolvedCardName: 'Bolt' });
    expect(msg?.text).toBe('Alice plays Bolt from their hand.');
  });

  it('logs library top → hand as "moves ... from the top of their library to their hand"', () => {
    const msg = formatCardMoved(game, 1, {
      cardId: 5, cardName: 'Mystery',
      startPlayerId: 1, startZone: 'deck',
      targetPlayerId: 1, targetZone: 'hand',
      position: 0, x: 0, y: 0, newCardId: -1, faceDown: false, newCardProviderId: '',
    }, { resolvedCardName: '' });
    expect(msg?.text).toBe('Alice moves Mystery from the top of their library to their hand.');
  });

  it('substitutes "the top card of their library" when name is empty (library top → hand)', () => {
    const msg = formatCardMoved(game, 1, {
      cardId: 5, cardName: '',
      startPlayerId: 1, startZone: 'deck',
      targetPlayerId: 1, targetZone: 'hand',
      position: 0, x: 0, y: 0, newCardId: -1, faceDown: false, newCardProviderId: '',
    }, { resolvedCardName: '' });
    expect(msg?.text).toBe('Alice moves the top card of their library to their hand.');
  });

  it('returns null for same-owner table-to-table reorder', () => {
    const msg = formatCardMoved(game, 1, {
      cardId: 5, cardName: 'Bolt',
      startPlayerId: 1, startZone: 'table',
      targetPlayerId: 1, targetZone: 'table',
      position: -1, x: 0, y: 0, newCardId: -1, faceDown: false, newCardProviderId: '',
    }, { resolvedCardName: 'Bolt' });
    expect(msg).toBeNull();
  });

  it('logs cross-owner control transfer', () => {
    const msg = formatCardMoved(game, 1, {
      cardId: 5, cardName: 'Bolt',
      startPlayerId: 1, startZone: 'table',
      targetPlayerId: 2, targetZone: 'table',
      position: -1, x: 0, y: 0, newCardId: -1, faceDown: false, newCardProviderId: '',
    }, { resolvedCardName: 'Bolt' });
    expect(msg?.text).toBe('Alice gives Bob control over Bolt.');
  });

  it('returns null for hand-to-hand (sideboard reorder)', () => {
    const msg = formatCardMoved(game, 1, {
      cardId: 5, cardName: 'Bolt',
      startPlayerId: 1, startZone: 'hand',
      targetPlayerId: 1, targetZone: 'hand',
      position: -1, x: 0, y: 0, newCardId: -1, faceDown: false, newCardProviderId: '',
    }, { resolvedCardName: 'Bolt' });
    expect(msg).toBeNull();
  });

  it('returns null for same-owner exile-to-exile reorder', () => {
    const msg = formatCardMoved(game, 1, {
      cardId: 5, cardName: 'Bolt',
      startPlayerId: 1, startZone: 'rfg',
      targetPlayerId: 1, targetZone: 'rfg',
      position: -1, x: 0, y: 0, newCardId: -1, faceDown: false, newCardProviderId: '',
    }, { resolvedCardName: 'Bolt' });
    expect(msg).toBeNull();
  });

  it('cross-owner table-to-table where actor is target logs as "puts into play from play"', () => {
    const msg = formatCardMoved(game, 2, {
      cardId: 5, cardName: 'Bolt',
      startPlayerId: 1, startZone: 'table',
      targetPlayerId: 2, targetZone: 'table',
      position: -1, x: 0, y: 0, newCardId: -1, faceDown: false, newCardProviderId: '',
    }, { resolvedCardName: 'Bolt' });
    expect(msg?.text).toBe('Bob puts Bolt into play from play.');
  });

  it('logs same-owner table → graveyard as "puts ... from play into their graveyard"', () => {
    const msg = formatCardMoved(game, 1, {
      cardId: 5, cardName: 'Bolt',
      startPlayerId: 1, startZone: 'table',
      targetPlayerId: 1, targetZone: 'grave',
      position: -1, x: 0, y: 0, newCardId: -1, faceDown: false, newCardProviderId: '',
    }, { resolvedCardName: 'Bolt' });
    expect(msg?.text).toBe('Alice puts Bolt from play into their graveyard.');
  });

  it('logs cross-owner move to hand as "moves ... to their hand"', () => {
    const msg = formatCardMoved(game, 2, {
      cardId: 5, cardName: 'Bolt',
      startPlayerId: 1, startZone: 'table',
      targetPlayerId: 2, targetZone: 'hand',
      position: -1, x: 0, y: 0, newCardId: -1, faceDown: false, newCardProviderId: '',
    }, { resolvedCardName: 'Bolt' });
    expect(msg?.text).toBe('Bob moves Bolt from play to their hand.');
  });

  it('falls back to "a card" when neither cardName nor resolvedCardName is set', () => {
    const msg = formatCardMoved(game, 1, {
      cardId: 5, cardName: '',
      startPlayerId: 1, startZone: 'hand',
      targetPlayerId: 1, targetZone: 'table',
      position: -1, x: 0, y: 0, newCardId: -1, faceDown: false, newCardProviderId: '',
    }, { resolvedCardName: '' });
    expect(msg?.text).toBe('Alice puts a card into play from their hand.');
  });

  it('falls back to "Player N" when the acting player is missing from the game', () => {
    const msg = formatCardMoved(game, 99, {
      cardId: 5, cardName: 'Bolt',
      startPlayerId: 99, startZone: 'hand',
      targetPlayerId: 99, targetZone: 'table',
      position: -1, x: 0, y: 0, newCardId: -1, faceDown: false, newCardProviderId: '',
    }, { resolvedCardName: 'Bolt' });
    expect(msg?.text).toBe('Player 99 puts Bolt into play from their hand.');
  });

  it('deck target with x=-1 generic → "puts into their library"', () => {
    const msg = formatCardMoved(game, 1, {
      cardId: 5, cardName: 'Bolt',
      startPlayerId: 1, startZone: 'hand',
      targetPlayerId: 1, targetZone: 'deck',
      position: -1, x: -1, y: 0, newCardId: -1, faceDown: false, newCardProviderId: '',
    }, { resolvedCardName: 'Bolt' });
    expect(msg?.text).toBe('Alice puts Bolt from their hand into their library.');
  });

  it('deck target with x=0 → "on top of their library"', () => {
    const msg = formatCardMoved(game, 1, {
      cardId: 5, cardName: 'Bolt',
      startPlayerId: 1, startZone: 'hand',
      targetPlayerId: 1, targetZone: 'deck',
      position: -1, x: 0, y: 0, newCardId: -1, faceDown: false, newCardProviderId: '',
    }, { resolvedCardName: 'Bolt' });
    expect(msg?.text).toBe('Alice puts Bolt from their hand on top of their library.');
  });

  it('emits segments with actor as player and card as card', () => {
    const msg = formatCardMoved(game, 1, {
      cardId: 5, cardName: 'Bolt',
      startPlayerId: 1, startZone: 'hand',
      targetPlayerId: 1, targetZone: 'table',
      position: -1, x: 0, y: 0, newCardId: -1, faceDown: false, newCardProviderId: '',
    }, { resolvedCardName: 'Bolt' });
    expect(msg?.segments).toEqual([
      { text: 'Alice', kind: 'player' },
      { text: ' puts ', kind: 'plain' },
      { text: 'Bolt', kind: 'card' },
      { text: ' into play from their hand.', kind: 'plain' },
    ]);
  });

  it('unknown card name renders as a plain "a card" segment (no hover)', () => {
    const msg = formatCardMoved(game, 1, {
      cardId: 5, cardName: '',
      startPlayerId: 1, startZone: 'hand',
      targetPlayerId: 1, targetZone: 'table',
      position: -1, x: 0, y: 0, newCardId: -1, faceDown: false, newCardProviderId: '',
    }, { resolvedCardName: '' });
    // "a card" is a placeholder — must NOT be a `card` segment (the
    // hover-preview handler would fire on a non-existent card).
    const cardSegments = msg?.segments.filter((s) => s.kind === 'card') ?? [];
    expect(cardSegments).toHaveLength(0);
  });
});

describe('formatCardFlipped', () => {
  const game = gameWithTwoPlayers();
  it('logs face-up as "turns ... face-up"', () => {
    const msg = formatCardFlipped(game, 1, {
      zoneName: 'hand', cardId: 5, cardName: 'Bolt', faceDown: false, cardProviderId: '',
    }, '');
    expect(msg.text).toBe('Alice turns Bolt face-up.');
  });
  it('logs face-down as "turns ... face-down"', () => {
    const msg = formatCardFlipped(game, 1, {
      zoneName: 'hand', cardId: 5, cardName: '', faceDown: true, cardProviderId: '',
    }, 'Bolt');
    expect(msg.text).toBe('Alice turns Bolt face-down.');
  });
});

describe('formatCardDestroyed', () => {
  it('logs destruction with card name', () => {
    const game = gameWithTwoPlayers();
    expect(formatCardDestroyed(game, 1, 'Bolt').text).toBe('Alice destroys Bolt.');
  });
  it('falls back to "a card" when name unknown', () => {
    const game = gameWithTwoPlayers();
    expect(formatCardDestroyed(game, 1, '').text).toBe('Alice destroys a card.');
  });
});

describe('formatCardAttached', () => {
  const game = gameWithTwoPlayers();
  it('logs attach to opponent card', () => {
    const msg = formatCardAttached(game, 1, {
      startZone: 'table', cardId: 10,
      targetPlayerId: 2, targetZone: 'table', targetCardId: 20,
    }, 'Bolt');
    expect(msg.text).toBe('Alice attaches Bolt to Bob\'s Bear.');
  });
  it('logs unattach when target cleared', () => {
    const msg = formatCardAttached(game, 1, {
      startZone: 'table', cardId: 10,
      targetPlayerId: -1, targetZone: '', targetCardId: -1,
    }, 'Bolt');
    expect(msg.text).toBe('Alice unattaches Bolt.');
  });

  it('logs unattach when only the target zone is cleared (targetCardId still set)', () => {
    const msg = formatCardAttached(game, 1, {
      startZone: 'table', cardId: 10,
      targetPlayerId: 2, targetZone: '', targetCardId: 20,
    }, 'Bolt');
    expect(msg.text).toBe('Alice unattaches Bolt.');
  });

  it('falls back to "a card" for the target when it is not found in the game state', () => {
    const msg = formatCardAttached(game, 1, {
      startZone: 'table', cardId: 10,
      targetPlayerId: 2, targetZone: 'table', targetCardId: 999,
    }, 'Bolt');
    expect(msg.text).toBe('Alice attaches Bolt to Bob\'s a card.');
  });
});

describe('formatTokenCreated', () => {
  const game = gameWithTwoPlayers();
  it('logs token with name and PT', () => {
    const msg = formatTokenCreated(game, 1, {
      zoneName: 'table', cardId: 99, cardName: 'Goblin',
      color: 'r', pt: '1/1', annotation: '',
      destroyOnZoneChange: true, x: 0, y: 0, cardProviderId: '', faceDown: false,
    });
    expect(msg.text).toBe('Alice creates token: Goblin (1/1).');
  });
  it('logs face-down token as "a face down token" (no hyphen)', () => {
    const msg = formatTokenCreated(game, 1, {
      zoneName: 'table', cardId: 99, cardName: '',
      color: '', pt: '', annotation: '',
      destroyOnZoneChange: true, x: 0, y: 0, cardProviderId: '', faceDown: true,
    });
    expect(msg.text).toBe('Alice creates a face down token.');
  });

  it('logs token with name but no PT', () => {
    const msg = formatTokenCreated(game, 1, {
      zoneName: 'table', cardId: 99, cardName: 'Spirit',
      color: 'w', pt: '', annotation: '',
      destroyOnZoneChange: true, x: 0, y: 0, cardProviderId: '', faceDown: false,
    });
    expect(msg.text).toBe('Alice creates token: Spirit.');
  });

  it('marks the token card name as a card segment', () => {
    const msg = formatTokenCreated(game, 1, {
      zoneName: 'table', cardId: 99, cardName: 'Goblin',
      color: 'r', pt: '1/1', annotation: '',
      destroyOnZoneChange: true, x: 0, y: 0, cardProviderId: '', faceDown: false,
    });
    expect(msg.segments.some((s) => s.kind === 'card' && s.text === 'Goblin')).toBe(true);
  });
});

describe('formatCardAttrChanged', () => {
  const game = gameWithTwoPlayers();
  it.each([
    [CardAttribute.AttrTapped, '1', 'Alice taps Bolt.'],
    [CardAttribute.AttrTapped, '0', 'Alice untaps Bolt.'],
    [CardAttribute.AttrAnnotation, 'note', 'Alice sets annotation of Bolt to "note".'],
    [CardAttribute.AttrDoesntUntap, '1', 'Alice sets Bolt to not untap normally.'],
  ])('attr=%i, val=%s → %s', (attribute, attrValue, expected) => {
    const msg = formatCardAttrChanged(game, 1, {
      zoneName: 'table', cardId: 10, attribute, attrValue,
    }, 'Bolt');
    expect(msg?.text).toBe(expected);
  });

  it('AttrPT with no previous → "changes ... from nothing to NEW"', () => {
    const msg = formatCardAttrChanged(game, 1, {
      zoneName: 'table', cardId: 10, attribute: CardAttribute.AttrPT, attrValue: '2/3',
    }, 'Bolt');
    expect(msg?.text).toBe('Alice changes the PT of Bolt from nothing to 2/3.');
  });

  it('AttrPT with previous → "changes ... from OLD to NEW"', () => {
    const msg = formatCardAttrChanged(game, 1, {
      zoneName: 'table', cardId: 10, attribute: CardAttribute.AttrPT, attrValue: '3/4',
    }, 'Bolt', '2/3');
    expect(msg?.text).toBe('Alice changes the PT of Bolt from 2/3 to 3/4.');
  });

  it('returns null for AttrFaceDown (flip path owns that message)', () => {
    const msg = formatCardAttrChanged(game, 1, {
      zoneName: 'table', cardId: 10, attribute: CardAttribute.AttrFaceDown, attrValue: '1',
    }, 'Bolt');
    expect(msg).toBeNull();
  });

  it('logs declaring an attacker for AttrAttacking="1"', () => {
    const msg = formatCardAttrChanged(game, 1, {
      zoneName: 'table', cardId: 10, attribute: CardAttribute.AttrAttacking, attrValue: '1',
    }, 'Bolt');
    expect(msg?.text).toBe('Alice declares Bolt as an attacker.');
  });

  it('returns null for AttrAttacking="0"', () => {
    const msg = formatCardAttrChanged(game, 1, {
      zoneName: 'table', cardId: 10, attribute: CardAttribute.AttrAttacking, attrValue: '0',
    }, 'Bolt');
    expect(msg).toBeNull();
  });

  it('returns null for AttrColor', () => {
    const msg = formatCardAttrChanged(game, 1, {
      zoneName: 'table', cardId: 10, attribute: CardAttribute.AttrColor, attrValue: 'r',
    }, 'Bolt');
    expect(msg).toBeNull();
  });

  it('AttrPT with empty value → "removes the PT of X"', () => {
    const msg = formatCardAttrChanged(game, 1, {
      zoneName: 'table', cardId: 10, attribute: CardAttribute.AttrPT, attrValue: '',
    }, 'Bolt');
    expect(msg?.text).toBe('Alice removes the PT of Bolt.');
  });

  it('AttrAnnotation empty → sets annotation to empty string', () => {
    const msg = formatCardAttrChanged(game, 1, {
      zoneName: 'table', cardId: 10, attribute: CardAttribute.AttrAnnotation, attrValue: '',
    }, 'Bolt');
    expect(msg?.text).toBe('Alice sets annotation of Bolt to "".');
  });

  it('logs untap-normally restored when AttrDoesntUntap="0"', () => {
    const msg = formatCardAttrChanged(game, 1, {
      zoneName: 'table', cardId: 10, attribute: CardAttribute.AttrDoesntUntap, attrValue: '0',
    }, 'Bolt');
    expect(msg?.text).toBe('Alice sets Bolt to untap normally.');
  });

  it('returns null for an unrecognized attribute (default case)', () => {
    const msg = formatCardAttrChanged(game, 1, {
      zoneName: 'table', cardId: 10, attribute: 9999 as CardAttribute, attrValue: '1',
    }, 'Bolt');
    expect(msg).toBeNull();
  });

  it('marks PT numeric values as number segments', () => {
    const msg = formatCardAttrChanged(game, 1, {
      zoneName: 'table', cardId: 10, attribute: CardAttribute.AttrPT, attrValue: '3/4',
    }, 'Bolt', '2/3');
    const numbers = msg?.segments.filter((s) => s.kind === 'number').map((s) => s.text);
    expect(numbers).toEqual(['2/3', '3/4']);
  });
});

describe('formatCardAttrChangedBulk', () => {
  const game = gameWithTwoPlayers();

  it('logs bulk untap as "untaps their permanents"', () => {
    const msg = formatCardAttrChangedBulk(game, 1, {
      zoneName: 'table', cardId: -1, attribute: CardAttribute.AttrTapped, attrValue: '0',
    });
    expect(msg?.text).toBe('Alice untaps their permanents.');
  });

  it('logs bulk tap as "taps their permanents"', () => {
    const msg = formatCardAttrChangedBulk(game, 1, {
      zoneName: 'table', cardId: -1, attribute: CardAttribute.AttrTapped, attrValue: '1',
    });
    expect(msg?.text).toBe('Alice taps their permanents.');
  });

  it('returns null for non-tap attributes', () => {
    const msg = formatCardAttrChangedBulk(game, 1, {
      zoneName: 'table', cardId: -1, attribute: CardAttribute.AttrPT, attrValue: '2/2',
    });
    expect(msg).toBeNull();
  });
});

describe('formatCardCounterChanged', () => {
  const game = gameWithTwoPlayers();
  it('logs added counters as "places N counter(s) on X (now Y)"', () => {
    const msg = formatCardCounterChanged(game, 1, {
      zoneName: 'table', cardId: 10, counterId: 1, counterValue: 3,
    }, 'Bolt', 1);
    expect(msg.text).toBe('Alice places 2 counter(s) on Bolt (now 3).');
  });

  it('logs removed counters as "removes N counter(s) from X (now Y)"', () => {
    const msg = formatCardCounterChanged(game, 1, {
      zoneName: 'table', cardId: 10, counterId: 1, counterValue: 0,
    }, 'Bolt', 3);
    expect(msg.text).toBe('Alice removes 3 counter(s) from Bolt (now 0).');
  });

  it('logs a plain "sets counters" message when the value is unchanged', () => {
    const msg = formatCardCounterChanged(game, 1, {
      zoneName: 'table', cardId: 10, counterId: 1, counterValue: 2,
    }, 'Bolt', 2);
    expect(msg.text).toBe('Alice sets counters on Bolt to 2.');
  });

  it('marks the delta and total as number segments', () => {
    const msg = formatCardCounterChanged(game, 1, {
      zoneName: 'table', cardId: 10, counterId: 1, counterValue: 3,
    }, 'Bolt', 1);
    const numbers = msg.segments.filter((s) => s.kind === 'number').map((s) => s.text);
    expect(numbers).toEqual(['2', '3']);
  });
});

describe('formatCounterSet', () => {
  const game = gameWithTwoPlayers();
  it('logs increase as "sets counter Life to N (+delta)"', () => {
    expect(formatCounterSet(game, 1, { counterId: 1, value: 22 }, 'life', 20).text)
      .toBe('Alice sets counter Life to 22 (+2).');
  });
  it('logs decrease as "sets counter Life to N (-delta)"', () => {
    expect(formatCounterSet(game, 1, { counterId: 1, value: 18 }, 'life', 20).text)
      .toBe('Alice sets counter Life to 18 (-2).');
  });

  it('logs a delta=0 update as "(0)"', () => {
    expect(formatCounterSet(game, 1, { counterId: 1, value: 20 }, 'life', 20).text)
      .toBe('Alice sets counter Life to 20 (0).');
  });

  it('falls back to generic "counter" label when the counter name is undefined', () => {
    expect(formatCounterSet(game, 1, { counterId: 7, value: 5 }, undefined, 0).text)
      .toBe('Alice sets counter counter to 5 (+5).');
  });

  it('translates mana counter letters to display names (r → Red)', () => {
    expect(formatCounterSet(game, 1, { counterId: 2, value: 3 }, 'r', 1).text)
      .toBe('Alice sets counter Red to 3 (+2).');
  });
});

describe('formatCardsDrawn', () => {
  const game = gameWithTwoPlayers();
  it('singularizes at 1', () => {
    expect(formatCardsDrawn(game, 1, 1).text).toBe('Alice draws 1 card.');
  });
  it('pluralizes at 2+', () => {
    expect(formatCardsDrawn(game, 1, 7).text).toBe('Alice draws 7 cards.');
  });
  it('marks the draw count as a number segment', () => {
    const msg = formatCardsDrawn(game, 1, 3);
    expect(msg.segments.find((s) => s.kind === 'number')?.text).toBe('3');
  });
});

describe('formatZoneShuffled / formatZoneDumped / formatZonePropertiesChanged', () => {
  const game = gameWithTwoPlayers();
  it('shuffle', () => {
    expect(formatZoneShuffled(game, 1).text).toBe('Alice shuffles their library.');
  });
  it('dumpZone by owner as "is looking at the top N cards"', () => {
    const msg = formatZoneDumped(game, 1, {
      zoneOwnerId: 1, zoneName: 'deck', numberCards: 4, isReversed: false,
    });
    expect(msg.text).toBe('Alice is looking at the top 4 cards of their library.');
  });
  it('dumpZone by another player names the zone owner', () => {
    const msg = formatZoneDumped(game, 1, {
      zoneOwnerId: 2, zoneName: 'deck', numberCards: 2, isReversed: false,
    });
    expect(msg.text).toBe('Alice is looking at the top 2 cards of Bob\'s library.');
  });
  it('dumpZone with numberCards=1 singularizes noun', () => {
    const msg = formatZoneDumped(game, 1, {
      zoneOwnerId: 1, zoneName: 'deck', numberCards: 1, isReversed: false,
    });
    expect(msg.text).toBe('Alice is looking at the top 1 card of their library.');
  });
  it('dumpZone with numberCards=-1 → "looking at their library" (full zone)', () => {
    const msg = formatZoneDumped(game, 1, {
      zoneOwnerId: 1, zoneName: 'deck', numberCards: -1, isReversed: false,
    });
    expect(msg.text).toBe('Alice is looking at their library.');
  });

  it('zone alwaysRevealTopCard → "keeping the top card revealed"', () => {
    expect(formatZonePropertiesChanged(game, 1, create(Event_ChangeZonePropertiesSchema, {
      zoneName: 'deck', alwaysRevealTopCard: true, alwaysLookAtTopCard: false,
    }))?.text).toBe('Alice is now keeping the top card of their library revealed.');
  });

  it('zone alwaysLookAtTopCard → "can now look at top card ... at any time"', () => {
    expect(formatZonePropertiesChanged(game, 1, create(Event_ChangeZonePropertiesSchema, {
      zoneName: 'deck', alwaysRevealTopCard: false, alwaysLookAtTopCard: true,
    }))?.text).toBe('Alice can now look at top card of their library at any time.');
  });

  it('zone stops revealing/looking when both flags are off', () => {
    expect(formatZonePropertiesChanged(game, 1, create(Event_ChangeZonePropertiesSchema, {
      zoneName: 'deck', alwaysRevealTopCard: false, alwaysLookAtTopCard: false,
    }))?.text).toBe('Alice is not revealing the top card of their library any longer.');
  });

  it('zoneLabel covers exile / sideboard / stack and custom zone names', () => {
    expect(formatZonePropertiesChanged(game, 1, create(Event_ChangeZonePropertiesSchema, {
      zoneName: 'rfg', alwaysRevealTopCard: true,
    }))?.text).toBe('Alice is now keeping the top card of their exile revealed.');
    expect(formatZonePropertiesChanged(game, 1, create(Event_ChangeZonePropertiesSchema, {
      zoneName: 'sb', alwaysRevealTopCard: true,
    }))?.text).toBe('Alice is now keeping the top card of their sideboard revealed.');
    expect(formatZonePropertiesChanged(game, 1, create(Event_ChangeZonePropertiesSchema, {
      zoneName: 'stack', alwaysRevealTopCard: true,
    }))?.text).toBe('Alice is now keeping the top card of their stack revealed.');
    expect(formatZonePropertiesChanged(game, 1, create(Event_ChangeZonePropertiesSchema, {
      zoneName: 'weird', alwaysRevealTopCard: true,
    }))?.text).toBe('Alice is now keeping the top card of custom zone \'weird\' revealed.');
  });
});

describe('formatActivePhaseSet / formatActivePlayerSet / formatTurnReversed', () => {
  const game = gameWithTwoPlayers();
  it('phase label matches desktop order', () => {
    expect(formatActivePhaseSet(0).text).toBe('It is now the untap step.');
    expect(formatActivePhaseSet(3).text).toBe('It is now the first main phase.');
    expect(formatActivePhaseSet(10).text).toBe('It is now the end step.');
  });
  it('falls back to "phase N" for an unknown phase index', () => {
    expect(formatActivePhaseSet(999).text).toBe('It is now the phase 999.');
  });
  it('active player as short-form turn banner', () => {
    expect(formatActivePlayerSet(game, 2).text).toBe('Bob\'s turn.');
  });
  it('active player marks player as player segment', () => {
    const msg = formatActivePlayerSet(game, 2);
    expect(msg.segments[0]).toEqual({ text: 'Bob', kind: 'player' });
  });
  it('turn reversed / restored', () => {
    expect(formatTurnReversed(game, 1, true).text).toBe('Alice reversed turn order, now it\'s reversed.');
    expect(formatTurnReversed(game, 1, false).text).toBe('Alice reversed turn order, now it\'s normal.');
  });
  it('attributes player 0 as the active player by name', () => {
    const gameWithHost = makeGameEntry({
      players: {
        0: makePlayerEntry({
          properties: makePlayerProperties({ playerId: 0, userInfo: { name: 'Host' } }),
        }),
      },
    });
    expect(formatActivePlayerSet(gameWithHost, 0).text).toBe('Host\'s turn.');
  });
});

describe('formatDieRolled', () => {
  const game = gameWithTwoPlayers();
  it('single-roll d20 → "rolls a N with a S-sided die"', () => {
    expect(formatDieRolled(game, 1, { sides: 20, value: 17, values: [17] }).text)
      .toBe('Alice rolls a 17 with a 20-sided die.');
  });
  it('multi-roll d6 → "rolls a S-sided dice N times: R,R,R"', () => {
    expect(formatDieRolled(game, 1, { sides: 6, value: 0, values: [3, 4, 5] }).text)
      .toBe('Alice rolls a 6-sided dice 3 times: 3, 4, 5.');
  });
  it('no-rolls falls back to bare sides', () => {
    expect(formatDieRolled(game, 1, { sides: 20, value: 0, values: [] }).text)
      .toBe('Alice rolls a 20-sided die.');
  });
  it('sides=2, single roll → "flipped a coin. It landed as Heads (1)"', () => {
    expect(formatDieRolled(game, 1, { sides: 2, value: 1, values: [1] }).text)
      .toBe('Alice flipped a coin. It landed as Heads (1).');
  });
  it('sides=2, single roll of 2 → "Tails (2)"', () => {
    expect(formatDieRolled(game, 1, { sides: 2, value: 2, values: [2] }).text)
      .toBe('Alice flipped a coin. It landed as Tails (2).');
  });
  it('sides=2, multi → "flips N coins. There are H heads and T tails"', () => {
    expect(formatDieRolled(game, 1, { sides: 2, value: 0, values: [1, 1, 2] }).text)
      .toBe('Alice flips 3 coins. There are 2 heads and 1 tails.');
  });
  it('attributes player 0 by name', () => {
    const gameWithHost = makeGameEntry({
      players: {
        0: makePlayerEntry({
          properties: makePlayerProperties({ playerId: 0, userInfo: { name: 'Host' } }),
        }),
      },
    });
    expect(formatDieRolled(gameWithHost, 0, { sides: 20, value: 17, values: [17] }).text)
      .toBe('Host rolls a 17 with a 20-sided die.');
  });
});

describe('formatArrowCreated', () => {
  const game = gameWithTwoPlayers();
  it('card → card arrow across players', () => {
    const arrow = makeArrow({
      id: 1, startPlayerId: 1, startZone: 'table', startCardId: 10,
      targetPlayerId: 2, targetZone: 'table', targetCardId: 20,
    });
    expect(formatArrowCreated(game, 1, arrow).text)
      .toBe('Alice points from their Bolt to Bob\'s Bear.');
  });

  it('self-targeted card → card', () => {
    const arrow = makeArrow({
      id: 1, startPlayerId: 1, startZone: 'table', startCardId: 10,
      targetPlayerId: 1, targetZone: 'table', targetCardId: 10,
    });
    expect(formatArrowCreated(game, 1, arrow).text)
      .toBe('Alice points from their Bolt to their Bolt.');
  });

  it('card → player arrow (actor is source owner)', () => {
    const arrow = makeArrow({
      id: 1, startPlayerId: 1, startZone: 'table', startCardId: 10,
      targetPlayerId: 2, targetZone: '', targetCardId: -1,
    });
    expect(formatArrowCreated(game, 1, arrow).text)
      .toBe('Alice points from their Bolt to Bob.');
  });

  it('card → player arrow when only the target zone is empty', () => {
    const arrow = makeArrow({
      id: 1, startPlayerId: 1, startZone: 'table', startCardId: 10,
      targetPlayerId: 2, targetZone: '', targetCardId: 20,
    });
    expect(formatArrowCreated(game, 1, arrow).text)
      .toBe('Alice points from their Bolt to Bob.');
  });

  it('self-targeted player arrow → "themselves"', () => {
    const arrow = makeArrow({
      id: 1, startPlayerId: 1, startZone: 'table', startCardId: 10,
      targetPlayerId: 1, targetZone: '', targetCardId: -1,
    });
    expect(formatArrowCreated(game, 1, arrow).text)
      .toBe('Alice points from their Bolt to themselves.');
  });

  it('falls back to "a card" for source/target when cards are not in game state', () => {
    const arrow = makeArrow({
      id: 1, startPlayerId: 1, startZone: 'table', startCardId: 777,
      targetPlayerId: 2, targetZone: 'table', targetCardId: 888,
    });
    expect(formatArrowCreated(game, 1, arrow).text)
      .toBe('Alice points from their a card to Bob\'s a card.');
  });
});

describe('formatPlayerJoined', () => {
  it('logs join', () => {
    const game = gameWithTwoPlayers();
    expect(formatPlayerJoined(game, 2).text).toBe('Bob has joined the game.');
  });
});

describe('diffPlayerProperties / formatPropertyDiff', () => {
  const game = gameWithTwoPlayers();
  it('detects concede + ready flips', () => {
    const previous = makePlayerProperties({ playerId: 1, conceded: false, readyStart: false });
    const next = makePlayerProperties({ playerId: 1, conceded: true, readyStart: true });
    const diff = diffPlayerProperties(previous, next);
    expect(diff.conceded).toBe(true);
    expect(diff.ready).toBe(true);
    const msgs = formatPropertyDiff(game, 1, diff).map((m) => m.text);
    expect(msgs).toContain('Alice has conceded the game.');
    expect(msgs).toContain('Alice is ready to start the game.');
  });

  it('detects sideboardLocked / unlocked and deckLoaded', () => {
    const previous = makePlayerProperties({ playerId: 1, sideboardLocked: true, deckHash: 'aaa' });
    const next = makePlayerProperties({ playerId: 1, sideboardLocked: false, deckHash: 'bbb' });
    const diff = diffPlayerProperties(previous, next);
    expect(diff.sideboardUnlocked).toBe(true);
    expect(diff.deckLoaded?.hash).toBe('bbb');
    const msgs = formatPropertyDiff(game, 1, diff).map((m) => m.text);
    expect(msgs).toContain('Alice has unlocked their sideboard.');
    expect(msgs).toContain('Alice has loaded a deck (bbb).');
  });

  it('detects unconcede + unready flips', () => {
    const previous = makePlayerProperties({ playerId: 1, conceded: true, readyStart: true });
    const next = makePlayerProperties({ playerId: 1, conceded: false, readyStart: false });
    const diff = diffPlayerProperties(previous, next);
    expect(diff.unconceded).toBe(true);
    expect(diff.unready).toBe(true);
    const msgs = formatPropertyDiff(game, 1, diff).map((m) => m.text);
    expect(msgs).toContain('Alice has unconceded the game.');
    expect(msgs).toContain('Alice is not ready to start the game any more.');
  });

  it('detects sideboardLocked transition', () => {
    const previous = makePlayerProperties({ playerId: 1, sideboardLocked: false });
    const next = makePlayerProperties({ playerId: 1, sideboardLocked: true });
    const diff = diffPlayerProperties(previous, next);
    expect(diff.sideboardLocked).toBe(true);
    expect(formatPropertyDiff(game, 1, diff).map((m) => m.text))
      .toContain('Alice has locked their sideboard.');
  });

  it('no diff → no messages', () => {
    const p = makePlayerProperties({ playerId: 1 });
    expect(formatPropertyDiff(game, 1, diffPlayerProperties(p, p))).toHaveLength(0);
  });
});

describe('classifyLogTone', () => {
  it('phase-change lines → "phase"', () => {
    expect(classifyLogTone('It is now the untap step.')).toBe('phase');
    expect(classifyLogTone('It is now the first main phase.')).toBe('phase');
  });
  it('turn banner → "turn"', () => {
    expect(classifyLogTone("Alice's turn.")).toBe('turn');
    expect(classifyLogTone("Bob's turn.")).toBe('turn');
  });
  it('accepts a LogEntry input directly', () => {
    expect(classifyLogTone({
      text: "Alice's turn.",
      segments: [{ text: 'Alice', kind: 'player' }, { text: "'s turn.", kind: 'plain' }],
    })).toBe('turn');
  });
  it('lifecycle events → "system"', () => {
    expect(classifyLogTone('The game has started.')).toBe('system');
    expect(classifyLogTone('Alice has joined the game.')).toBe('system');
    expect(classifyLogTone('Alice has left the game.')).toBe('system');
    expect(classifyLogTone('Alice has left the game (kicked by moderator).')).toBe('system');
    expect(classifyLogTone('Alice has conceded the game.')).toBe('system');
    expect(classifyLogTone('Alice has unconceded the game.')).toBe('system');
    expect(classifyLogTone('Alice is ready to start the game.')).toBe('system');
    expect(classifyLogTone('Alice is not ready to start the game any more.')).toBe('system');
    expect(classifyLogTone('Alice has locked their sideboard.')).toBe('system');
    expect(classifyLogTone('Alice has unlocked their sideboard.')).toBe('system');
    expect(classifyLogTone('Alice has loaded a deck (abc123).')).toBe('system');
  });
  it('routine card actions → "action"', () => {
    expect(classifyLogTone('Alice puts Bolt into play from their hand.')).toBe('action');
    expect(classifyLogTone('Alice draws 1 card.')).toBe('action');
    expect(classifyLogTone('Alice taps Bolt.')).toBe('action');
    expect(classifyLogTone('Alice points from their Bolt to Bob\'s Bear.')).toBe('action');
  });
});
