import { ZoneName, type ZoneNameValue } from '@cockatrice/sockatrice';
import { ArrowColor } from '@app/types';

import type { ArrowTarget, PlayerTargetCommands } from '../components/ui/PlayerBoard/playerBoard.types';
import { arrowColorForModifiers, planArrow, planAttach, sendArrowPlan, type ArrowSource } from './arrowResolution';

const TABLE_CARD: ArrowSource = { playerId: 1, zone: ZoneName.TABLE, cardId: 10 };
const HAND_CARD: ArrowSource = { playerId: 1, zone: ZoneName.HAND, cardId: 30 };
const card = (playerId: number, zone: ZoneNameValue, cardId: number): ArrowTarget => ({ kind: 'card', playerId, zone, cardId });
const player = (playerId: number): ArrowTarget => ({ kind: 'player', playerId });

describe('planArrow', () => {
  it.each([
    ['a battlefield card to a card', TABLE_CARD, card(2, ZoneName.STACK, 21), 'arrow'],
    ['a battlefield card to a player', TABLE_CARD, player(2), 'arrow'],
    ['the source card onto itself', TABLE_CARD, card(1, ZoneName.TABLE, 10), 'none'],
    ['the same id in another zone', TABLE_CARD, card(1, ZoneName.GRAVE, 10), 'arrow'],
    ['a local hand card to a battlefield card', HAND_CARD, card(2, ZoneName.TABLE, 20), 'playThenArrow'],
    ['a local hand card to a player', HAND_CARD, player(2), 'playThenArrow'],
    ['a local hand card to another hand card', HAND_CARD, card(1, ZoneName.HAND, 31), 'arrow'],
    ['another player\'s hand card', { ...HAND_CARD, playerId: 2 }, card(1, ZoneName.TABLE, 10), 'arrow'],
  ])('%s: %s', (_, source, target, kind) => {
    expect(planArrow(source, target, 1).kind).toBe(kind);
  });

  it('keeps the source and target it was given', () => {
    expect(planArrow(TABLE_CARD, player(2), 1)).toEqual({ kind: 'arrow', source: TABLE_CARD, target: player(2) });
  });
});

describe('planAttach', () => {
  it('attaches every source to a card, and cancels on a source or a player', () => {
    expect(planAttach(1, [10, 11], card(1, ZoneName.TABLE, 12))).toEqual({
      kind: 'attach', sourcePlayerId: 1, sourceCardIds: [10, 11], target: { playerId: 1, cardId: 12 },
    });
    expect(planAttach(1, [10, 11], card(1, ZoneName.TABLE, 11)).kind).toBe('none');
    expect(planAttach(1, [10, 11], card(2, ZoneName.TABLE, 11)).kind).toBe('attach');
    expect(planAttach(1, [10], player(2)).kind).toBe('none');
  });

  it('cancels on a card that is attached itself (desktop ArrowAttachItem::attachCards)', () => {
    expect(planAttach(1, [10], { kind: 'card', playerId: 2, zone: ZoneName.TABLE, cardId: 12, attached: true }).kind).toBe('none');
    expect(planAttach(1, [10], { kind: 'card', playerId: 2, zone: ZoneName.TABLE, cardId: 12, attached: false }).kind).toBe('attach');
  });

  it('cancels on a card outside the battlefield', () => {
    expect(planAttach(1, [10], card(2, ZoneName.STACK, 21)).kind).toBe('none');
    expect(planAttach(1, [10], card(1, ZoneName.GRAVE, 12)).kind).toBe('none');
  });
});

describe('arrowColorForModifiers', () => {
  it.each([
    [{ ctrlKey: false, altKey: false, shiftKey: false }, ArrowColor.RED],
    [{ ctrlKey: true, altKey: true, shiftKey: true }, ArrowColor.YELLOW],
    [{ ctrlKey: false, altKey: true, shiftKey: true }, ArrowColor.BLUE],
    [{ ctrlKey: false, altKey: false, shiftKey: true }, ArrowColor.GREEN],
  ])('%o draws %o', (modifiers, color) => {
    expect(arrowColorForModifiers(modifiers)).toEqual(color);
  });
});

describe('sendArrowPlan', () => {
  function ports() {
    const commands = {
      attach: vi.fn(),
      unattach: vi.fn(),
      createArrow: vi.fn(),
      playAndCreateArrow: vi.fn(),
      clearOwnArrows: vi.fn(),
    } satisfies PlayerTargetCommands;
    const commandsFor = vi.fn(() => commands);
    return { commands, commandsFor };
  }

  it('sends through the source owner\'s commands, in the given colour', () => {
    const { commands, commandsFor } = ports();
    sendArrowPlan(planArrow({ ...TABLE_CARD, playerId: 2 }, player(1), 1), commandsFor, ArrowColor.BLUE);
    sendArrowPlan(planArrow(HAND_CARD, player(2), 1), commandsFor);
    sendArrowPlan(planAttach(1, [10, 11], card(2, ZoneName.TABLE, 20)), commandsFor);
    sendArrowPlan({ kind: 'none' }, commandsFor);

    expect(commandsFor.mock.calls).toEqual([[2], [1], [1]]);
    expect(commands.createArrow).toHaveBeenCalledWith(10, ZoneName.TABLE, player(1), ArrowColor.BLUE);
    expect(commands.playAndCreateArrow).toHaveBeenCalledWith(30, player(2), ArrowColor.RED);
    expect(commands.attach.mock.calls).toEqual([[10, { playerId: 2, cardId: 20 }], [11, { playerId: 2, cardId: 20 }]]);
  });
});
