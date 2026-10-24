import { act, fireEvent } from '@testing-library/react';
import { ZoneName } from '@cockatrice/sockatrice';
import { Phase } from '@cockatrice/datatrice';
import { makeCard } from '@cockatrice/datatrice/testing';
import { ArrowColor } from '@app/types';

import { renderSeatHook } from '../__test-utils__/seatFixtures';
import { usePendingTarget, type PendingTargetSource } from './usePendingTarget';

vi.mock('../../../hooks/useSettings');

vi.mock('../../../services/dexie/DexieDTOs/CardDTO', () => ({
  CardDTO: { get: vi.fn(async () => ({ tablerow: { value: '1' } })) },
}));

const BOLT: PendingTargetSource = { playerId: 1, zone: ZoneName.TABLE, cardId: 10, name: 'Bolt' };

const added: HTMLElement[] = [];

function addElement(attrs: Record<string, string>): HTMLElement {
  const el = document.createElement('div');
  added.push(el);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
  document.body.appendChild(el);
  return el;
}

const cardElement = (playerId: number, zone: string, cardId: number) =>
  addElement({ 'data-card-id': String(cardId), 'data-card-owner': String(playerId), 'data-card-zone': zone });

function renderPicker() {
  const utils = renderSeatHook(() => usePendingTarget(1), {
    localPlayerId: 1,
    seats: [{ playerId: 1, hand: [makeCard({ id: 30, name: 'Shock' })] }, { playerId: 2 }],
  });
  const picker = () => utils.result();
  return { ...utils, picker };
}

const arrow = (startCardId: number, target: object, startZone: string = ZoneName.TABLE) =>
  [1, { startPlayerId: 1, startZone, startCardId, ...target, arrowColor: ArrowColor.RED, deleteInPhase: Phase.FirstMain }];

afterEach(() => {
  added.splice(0).forEach((el) => el.remove());
});

describe('usePendingTarget', () => {
  it('draws a red arrow to the next card clicked, in that card\'s zone', () => {
    const { picker, game } = renderPicker();
    const target = cardElement(2, ZoneName.STACK, 21);
    act(() => picker().startArrow(BOLT));

    fireEvent.click(target);

    expect(vi.mocked(game.createArrow).mock.calls).toEqual([
      arrow(10, { targetPlayerId: 2, targetZone: ZoneName.STACK, targetCardId: 21 }),
    ]);
    expect(picker().pending).toBeNull();
  });

  it('draws the arrow to a player\'s life total', () => {
    const { picker, game } = renderPicker();
    const life = addElement({ 'data-arrow-target-kind': 'player', 'data-arrow-target-player-id': '2' });
    act(() => picker().startArrow(BOLT));

    fireEvent.click(life);

    expect(vi.mocked(game.createArrow).mock.calls).toEqual([arrow(10, { targetPlayerId: 2 })]);
  });

  it('plays a local hand card before drawing its arrow', async () => {
    const { picker, game } = renderPicker();
    const target = cardElement(2, ZoneName.TABLE, 20);
    act(() => picker().startArrow({ playerId: 1, zone: ZoneName.HAND, cardId: 30, name: 'Shock' }));

    fireEvent.click(target);

    await vi.waitFor(() => expect(game.createArrow).toHaveBeenCalled());
    expect(vi.mocked(game.moveCard).mock.calls[0][1]).toMatchObject({ startZone: ZoneName.HAND, targetZone: ZoneName.STACK });
    expect(vi.mocked(game.createArrow).mock.calls).toEqual([
      arrow(30, { targetPlayerId: 2, targetZone: ZoneName.TABLE, targetCardId: 20 }, ZoneName.STACK),
    ]);
  });

  it('cancels an arrow on its source card, on empty space and on Escape, sending nothing', () => {
    const { picker, game } = renderPicker();
    const source = cardElement(1, ZoneName.TABLE, 10);

    act(() => picker().startArrow(BOLT));
    fireEvent.click(source);
    expect(picker().pending).toBeNull();

    act(() => picker().startArrow(BOLT));
    fireEvent.click(document.body);
    expect(picker().pending).toBeNull();

    act(() => picker().startArrow(BOLT));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(picker().pending).toBeNull();

    act(() => picker().startAttach(BOLT, [11]));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(picker().pending).toBeNull();
    expect(game.createArrow).not.toHaveBeenCalled();
  });

  it('leaves Escape to an open MUI dialog', () => {
    const { picker } = renderPicker();
    addElement({ class: 'MuiDialog-root', role: 'dialog' });
    act(() => picker().startArrow(BOLT));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(picker().pending).not.toBeNull();
  });

  it('resolves an attach only through a pick, attaching every source', () => {
    const { picker, game } = renderPicker();
    act(() => picker().startAttach(BOLT, [11]));

    fireEvent.click(cardElement(1, ZoneName.TABLE, 12));
    expect(picker().pending?.kind).toBe('attach');

    let picked = false;
    act(() => {
      picked = picker().pickAttachTarget({ kind: 'card', playerId: 1, zone: ZoneName.TABLE, cardId: 12 });
    });
    expect(picked).toBe(true);
    expect(vi.mocked(game.attachCard).mock.calls.map(([, params]) => params)).toEqual([
      { startZone: ZoneName.TABLE, cardId: 10, targetPlayerId: 1, targetZone: ZoneName.TABLE, targetCardId: 12 },
      { startZone: ZoneName.TABLE, cardId: 11, targetPlayerId: 1, targetZone: ZoneName.TABLE, targetCardId: 12 },
    ]);
    expect(picker().pending).toBeNull();
  });

  it('cancels an attach on one of its sources, and ignores picks while nothing is pending', () => {
    const { picker, game } = renderPicker();
    expect(picker().pickAttachTarget({ kind: 'card', playerId: 1, zone: ZoneName.TABLE, cardId: 12 })).toBe(false);
    expect(picker().pick({ kind: 'player', playerId: 2 })).toBe(false);

    act(() => picker().startAttach(BOLT, [11]));
    let picked = false;
    act(() => {
      picked = picker().pickAttachTarget({ kind: 'card', playerId: 1, zone: ZoneName.TABLE, cardId: 11 });
    });
    expect(picked).toBe(true);
    expect(picker().pending).toBeNull();

    act(() => picker().startArrow(BOLT));
    expect(picker().pickAttachTarget({ kind: 'card', playerId: 1, zone: ZoneName.TABLE, cardId: 12 })).toBe(false);
    expect(game.attachCard).not.toHaveBeenCalled();
  });

  it('resolves a pick started in the same handler, before a re-render', () => {
    const { picker, game } = renderPicker();
    act(() => {
      picker().startArrow(BOLT);
      expect(picker().pick({ kind: 'player', playerId: 2 })).toBe(true);
    });
    expect(vi.mocked(game.createArrow).mock.calls).toEqual([arrow(10, { targetPlayerId: 2 })]);
  });

  it('leaves the pick pending, reporting false, until the game id is known', () => {
    const { result } = renderSeatHook(() => usePendingTarget(undefined), { localPlayerId: 1, seats: [{ playerId: 1 }] });
    act(() => result().startArrow(BOLT));
    let picked = true;
    act(() => {
      picked = result().pick({ kind: 'player', playerId: 2 });
    });
    expect(picked).toBe(false);
    expect(result().pending).not.toBeNull();
  });

  it('follows the pointer only while a pick is pending, without changing the picker', () => {
    const { picker } = renderPicker();
    fireEvent.mouseMove(window, { clientX: 5, clientY: 6 });
    expect(picker().pointer.get()).toBeNull();

    act(() => picker().startArrow(BOLT));
    const during = picker();
    fireEvent.mouseMove(window, { clientX: 50, clientY: 60 });
    expect(picker().pointer.get()).toEqual({ x: 50, y: 60 });
    expect(picker()).toBe(during);

    act(() => picker().cancel());
    expect(picker().pointer.get()).toBeNull();
  });
});
