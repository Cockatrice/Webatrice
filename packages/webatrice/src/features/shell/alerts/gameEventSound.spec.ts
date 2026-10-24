import { ZoneName } from '@cockatrice/sockatrice';
import { CardAttribute } from '@cockatrice/sockatrice/generated';
import { games, type GamesState } from '@cockatrice/datatrice';
import {
  makeGameEntry,
  makePlayerEntry,
  makePlayerProperties,
} from '@cockatrice/datatrice/testing';

import { gameEventSound, isGameAttentionEvent } from './gameEventSound';

const T = games.Types;

const state = (players: Record<number, ReturnType<typeof makePlayerEntry>>, pings: Record<number, number> = {}): GamesState => ({
  games: { 1: makeGameEntry({ localPlayerId: 1, players }) },
  pings: { 1: pings },
});

const seated = state({
  1: makePlayerEntry({
    properties: makePlayerProperties({ playerId: 1 }),
    counters: { 7: { id: 7, name: 'life', count: 20 } as never, 8: { id: 8, name: 'poison', count: 0 } as never },
  }),
  2: makePlayerEntry({ properties: makePlayerProperties({ playerId: 2, spectator: true }) }),
});

const sound = (type: string, payload: object, before = seated, after = before) =>
  gameEventSound({ type, payload: { gameId: 1, playerId: 1, ...payload } }, before, after);

describe('gameEventSound', () => {
  it('plays the phase sound for each phase', () => {
    expect(sound(T.ACTIVE_PHASE_SET, { phase: 0 })).toBe('untap_step');
    expect(sound(T.ACTIVE_PHASE_SET, { phase: 5 })).toBe('attack_step');
    expect(sound(T.ACTIVE_PHASE_SET, { phase: 42 })).toBeNull();
  });

  it('plays draw, shuffle and dice sounds', () => {
    expect(sound(T.CARDS_DRAWN, {})).toBe('draw_card');
    expect(sound(T.ZONE_SHUFFLED, {})).toBe('shuffle');
    expect(sound(T.DIE_ROLLED, {})).toBe('roll_dice');
  });

  it('plays a card onto the battlefield or stack, but not a move within your battlefield', () => {
    const move = (startZone: string, targetZone: string, startPlayerId = 1, targetPlayerId = 1) =>
      sound(T.CARD_MOVED, { data: { startZone, targetZone, startPlayerId, targetPlayerId } });

    expect(move(ZoneName.HAND, ZoneName.TABLE)).toBe('play_card');
    expect(move(ZoneName.HAND, ZoneName.STACK)).toBe('play_card');
    expect(move(ZoneName.TABLE, ZoneName.TABLE)).toBeNull();
    expect(move(ZoneName.TABLE, '')).toBeNull();
    expect(move(ZoneName.HAND, ZoneName.GRAVE)).toBeNull();
    expect(move(ZoneName.TABLE, ZoneName.TABLE, 1, 2)).toBeNull();
  });

  it('plays tap and untap for the tapped attribute only', () => {
    expect(sound(T.CARD_ATTR_CHANGED, { data: { attribute: CardAttribute.AttrTapped, attrValue: '1' } })).toBe('tap_card');
    expect(sound(T.CARD_ATTR_CHANGED, { data: { attribute: CardAttribute.AttrTapped, attrValue: '0' } })).toBe('untap_card');
    expect(sound(T.CARD_ATTR_CHANGED, { data: { attribute: CardAttribute.AttrAttacking, attrValue: '1' } })).toBeNull();
  });

  it('plays the life sound only for the life counter', () => {
    expect(sound(T.COUNTER_SET, { data: { counterId: 7, value: 18 } })).toBe('life_change');
    expect(sound(T.COUNTER_SET, { data: { counterId: 8, value: 1 } })).toBeNull();
  });

  it('tells players from spectators joining and leaving', () => {
    const join = (playerId: number, spectator: boolean) =>
      sound(T.PLAYER_JOINED, { playerProperties: { playerId, spectator } });
    expect(join(3, false)).toBe('player_join');
    expect(join(3, true)).toBe('spectator_join');
    expect(join(1, false)).toBeNull();

    expect(sound(T.PLAYER_LEFT, { playerId: 1 })).toBe('player_leave');
    expect(sound(T.PLAYER_LEFT, { playerId: 2 })).toBe('spectator_leave');
    expect(sound(T.PLAYER_LEFT, { playerId: 9 })).toBeNull();
  });

  describe('player property updates', () => {
    const updated = games.Actions.playerPropertiesUpdated.type;
    const player = (conceded: boolean) => makePlayerEntry({ properties: makePlayerProperties({ playerId: 1, conceded }) });

    it('plays the concede sound on conceding and unconceding', () => {
      expect(sound(updated, {}, state({ 1: player(false) }), state({ 1: player(true) }))).toBe('player_concede');
      expect(sound(updated, {}, state({ 1: player(true) }), state({ 1: player(false) }))).toBe('player_concede');
    });

    it('plays disconnect and reconnect when the ping crosses -1, and nothing for a ping tick', () => {
      const p = player(false);
      expect(sound(updated, {}, state({ 1: p }, { 1: 3 }), state({ 1: p }, { 1: -1 }))).toBe('player_disconnect');
      expect(sound(updated, {}, state({ 1: p }, { 1: -1 }), state({ 1: p }, { 1: 0 }))).toBe('player_reconnect');
      expect(sound(updated, {}, state({ 1: p }, { 1: 3 }), state({ 1: p }, { 1: 4 }))).toBeNull();
    });
  });

  it('is silent for anything else', () => {
    expect(sound(T.ARROW_CREATED, {})).toBeNull();
    expect(sound('rooms/addMessage', {})).toBeNull();
  });
});

describe('isGameAttentionEvent', () => {
  it('covers game-changing events but not property ticks or local bookkeeping', () => {
    expect(isGameAttentionEvent(T.CARD_MOVED)).toBe(true);
    expect(isGameAttentionEvent(T.ACTIVE_PLAYER_SET)).toBe(true);
    expect(isGameAttentionEvent(T.PLAYER_PROPERTIES_CHANGED)).toBe(false);
    expect(isGameAttentionEvent(T.GAME_JOINED)).toBe(false);
    expect(isGameAttentionEvent(null)).toBe(false);
  });
});
