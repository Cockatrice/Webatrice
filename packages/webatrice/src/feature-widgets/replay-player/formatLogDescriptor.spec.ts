import i18next from 'i18next';
import ICU from 'i18next-icu';
import { CardAttribute } from '@cockatrice/sockatrice/generated';
import type { LogDescriptor } from '@cockatrice/datatrice';
import logText from './formatLogDescriptor.i18n.json';
import phaseText from '../../utils/phaseLabels.i18n.json';
import { phaseLabel } from '@app/utils';
import { formatLogDescriptor } from './formatLogDescriptor';
import { translatedLog, p, n } from './logTranslation';

const actor = { id: 1, name: 'Alice' };
const other = { id: 2, name: 'Bob' };
const card = { actor, cardName: 'Bolt' };
const cases: [LogDescriptor, string][] = [
  [{ kind: 'cardMoved', params: {
    ...card, sourceOwner: actor, targetOwner: actor, startZone: 'hand', targetZone: 'table',
    position: -1, targetPosition: 0, sourceCount: 2, targetCount: 1, faceDown: false,
  } }, 'Alice puts Bolt into play from their hand.'],
  [{ kind: 'cardFlipped', params: { ...card, faceDown: true } }, 'Alice turns Bolt face-down.'],
  [{ kind: 'cardDestroyed', params: card }, 'Alice destroys Bolt.'],
  [{ kind: 'cardAttached', params: { ...card, detached: false, targetOwner: other, targetCardName: 'Bear' } },
    'Alice attaches Bolt to Bob\'s Bear.'],
  [{ kind: 'tokenCreated', params: { ...card, faceDown: false, pt: '2/2' } }, 'Alice creates token: Bolt (2/2).'],
  [{ kind: 'cardAttrChanged', params: { ...card, attribute: CardAttribute.AttrPT, value: '3/3', previousPT: '2/2' } },
    'Alice changes the PT of Bolt from 2/2 to 3/3.'],
  [{ kind: 'cardAttrChangedBulk', params: { actor, tapped: false } }, 'Alice untaps their permanents.'],
  [{ kind: 'cardCounterChanged', params: { ...card, counterId: 0, value: 1, previousValue: 3 } },
    'Alice removes 2 counter(s) from Bolt (now 1).'],
  [{ kind: 'counterSet', params: { actor, counterId: 0, counterName: 'life', value: 19, previousValue: 20 } },
    'Alice sets counter Life to 19 (-1).'],
  [{ kind: 'cardsDrawn', params: { actor, count: 2 } }, 'Alice draws 2 cards.'],
  [{ kind: 'cardUndoneDraw', params: card }, 'Alice undoes their last draw (Bolt).'],
  [{ kind: 'undoDrawFailed', params: { actor } }, 'Alice failed to undo their last draw.'],
  [{ kind: 'zoneShuffled', params: { actor } }, 'Alice shuffles their library.'],
  [{ kind: 'cardPeeked', params: { ...card, cardId: 5 } }, 'Alice peeks at face down card #5: Bolt.'],
  [{ kind: 'cardsRevealed', params: { actor, zoneName: 'hand', target: other, mode: 'top', count: 2, lend: false } },
    'Alice reveals 2 cards from their hand to Bob.'],
  [{ kind: 'zoneDumped', params: { actor, owner: other, zoneName: 'deck', count: 1 } },
    'Alice is looking at the top 1 card of Bob\'s library.'],
  [{ kind: 'zonePropertiesChanged', params: { actor, zoneName: 'deck', reveal: true, look: false } },
    'Alice is now keeping the top card of their library revealed.'],
  [{ kind: 'activePhaseSet', params: { phase: 3 } }, 'It is now the first main phase.'],
  [{ kind: 'activePlayerSet', params: { actor } }, 'Alice\'s turn.'],
  [{ kind: 'turnReversed', params: { actor, reversed: true } }, 'Alice reversed turn order, now it\'s reversed.'],
  [{ kind: 'dieRolled', params: { actor, sides: 2, rolls: [1, 2] } }, 'Alice flips 2 coins. There are 1 heads and 1 tails.'],
  [{ kind: 'playerJoined', params: { actor } }, 'Alice has joined the game.'],
  [{ kind: 'playerLeft', params: { actor, reason: 2 } }, 'Alice has left the game (kicked by game host or moderator).'],
  [{ kind: 'gameStarted', params: {} }, 'The game has started.'],
  [{ kind: 'gameClosed', params: {} }, 'The game has been closed.'],
  [{ kind: 'replayStarted', params: { gameId: 7 } }, 'You are watching a replay of game #7.'],
  [{ kind: 'arrowCreated', params: {
    actor, sourceOwner: actor, targetOwner: other, sourceCardName: 'Bolt', targetCardName: 'Bear', playerTarget: false,
  } }, 'Alice points from their Bolt to Bob\'s Bear.'],
  [{ kind: 'playerConceded', params: { actor } }, 'Alice has conceded the game.'],
  [{ kind: 'playerUnconceded', params: { actor } }, 'Alice has unconceded the game.'],
  [{ kind: 'playerReady', params: { actor } }, 'Alice is ready to start the game.'],
  [{ kind: 'playerUnready', params: { actor } }, 'Alice is not ready to start the game any more.'],
  [{ kind: 'sideboardLocked', params: { actor } }, 'Alice has locked their sideboard.'],
  [{ kind: 'sideboardUnlocked', params: { actor } }, 'Alice has unlocked their sideboard.'],
  [{ kind: 'deckLoaded', params: { actor, hash: 'abc123' } }, 'Alice has loaded a deck (abc123).'],
];

async function translator() {
  const instance = i18next.createInstance().use(ICU);
  await instance.init({
    lng: 'en', resources: { en: { translation: { ...logText, ...phaseText } } }, interpolation: { escapeValue: false },
  });
  return instance;
}

describe('translated game-log descriptors', () => {
  it.each(cases)('preserves the English text and span text for %j', async (descriptor, expected) => {
    const instance = await translator();
    const result = formatLogDescriptor(descriptor, instance.t);
    expect(result.text).toBe(expected);
    expect(result.segments.map(segment => segment.text).join('')).toBe(expected);
  });

  it('shares every phase name with the phase track and translates unknown phases', async () => {
    const instance = await translator();
    for (let phase = 0; phase < 11; phase++) {
      expect(formatLogDescriptor({ kind: 'activePhaseSet', params: { phase } }, instance.t).text)
        .toBe(`It is now the ${phaseLabel(instance.t, phase, 'log')}.`);
    }
    expect(formatLogDescriptor({ kind: 'activePhaseSet', params: { phase: 99 } }, instance.t).text).toBe('It is now the phase 99.');
  });

  it('supports reordered/repeated placeholders and treats markup and token-like user names literally', async () => {
    const instance = await translator();
    instance.addResource('en', 'translation', 'sentence', '{value}: {actor}, {actor}.');
    const name = '<b>Alice</b>\uE0000\uE001';
    const result = translatedLog(instance.t, 'sentence', { actor: p(name), value: n(19) });
    expect(result.text).toBe(`19: ${name}, ${name}.`);
    expect(result.segments.filter(segment => segment.kind === 'player')).toEqual([p(name), p(name)]);
    expect(result.segments[0]).toEqual(n(19));
  });

  it('localizes counter and fallback labels while keeping real card names hoverable', async () => {
    const instance = await translator();
    instance.addResourceBundle('fr', 'translation', { GameLog: {
      player: { number: 'Joueur {id}' }, cardDestroyed: { message: '{actor} détruit {card}.' },
    } });
    await instance.changeLanguage('fr');
    const result = formatLogDescriptor({ kind: 'cardDestroyed', params: { actor: { id: 9 }, cardName: 'Bolt' } }, instance.t);
    expect(result.text).toBe('Joueur 9 détruit Bolt.');
    expect(result.segments.find(segment => segment.kind === 'card')).toEqual({ kind: 'card', text: 'Bolt' });
  });
});
