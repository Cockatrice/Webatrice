import { act, fireEvent, renderHook } from '@testing-library/react';
import type React from 'react';

import { useSeatMarquee } from './useSeatMarquee';

function boxed<T extends HTMLElement>(el: T, left: number, top: number, width: number, height: number): T {
  el.getBoundingClientRect = () => new DOMRect(left, top, width, height);
  return el;
}

function card(zone: string, id: string, left: number, top: number): HTMLElement {
  const el = boxed(document.createElement('div'), left, top, 50, 70);
  el.setAttribute('data-card', '');
  el.setAttribute('data-zone', zone);
  el.setAttribute('data-card-id', id);
  return el;
}

function setup() {
  const box = boxed(document.createElement('div'), 0, 0, 1000, 800);
  const hand = boxed(document.createElement('div'), 0, 600, 1000, 200);
  hand.append(card('hand', '30', 10, 610), card('hand', '31', 100, 610));
  const stack = boxed(document.createElement('div'), 0, 400, 100, 200);
  const ownBoard = boxed(document.createElement('div'), 200, 0, 800, 300);
  ownBoard.setAttribute('data-battlefield-owner', '1');
  ownBoard.append(card('battlefield', '10', 210, 10), card('battlefield', '11', 400, 10));
  const oppBoard = boxed(document.createElement('div'), 200, 300, 800, 100);
  oppBoard.setAttribute('data-battlefield-owner', '2');
  oppBoard.append(card('battlefield', '20', 210, 310));
  box.append(hand, stack, ownBoard, oppBoard);
  document.body.append(box);

  const setSelection = vi.fn();
  const clearAllSelection = vi.fn();
  const hook = renderHook(() => useSeatMarquee({
    playerId: 1,
    handRef: { current: hand },
    stackRef: { current: stack },
    setSelection,
    clearAllSelection,
  }));
  const press = (target: Element, x: number, y: number) => act(() => {
    hook.result.current.onPointerDownBox({
      button: 0,
      target,
      clientX: x,
      clientY: y,
    } as unknown as React.PointerEvent<HTMLDivElement>);
  });
  return { ...hook, box, hand, ownBoard, setSelection, clearAllSelection, press };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('useSeatMarquee', () => {
  it('does not clear selection or start a marquee from a shared menu item descendant', () => {
    const { result, clearAllSelection, setSelection, press } = setup();
    const menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    menu.innerHTML = '<button role="menuitem"><span>All players</span></button>';
    document.body.append(menu);

    press(menu.querySelector('span')!, 10, 10);
    expect(result.current.marquee).toBeNull();
    expect(clearAllSelection).not.toHaveBeenCalled();
    fireEvent.pointerMove(window, { clientX: 100, clientY: 100 });
    expect(setSelection).not.toHaveBeenCalled();
  });

  it('selects the own battlefield cards the rectangle touches, live, and ends on release', () => {
    const { result, ownBoard, setSelection, clearAllSelection, press } = setup();
    press(ownBoard, 205, 5);
    expect(clearAllSelection).toHaveBeenCalled();
    expect(result.current.marquee).toMatchObject({ x1: 205, y1: 5, start: { zone: 'battlefield', ownerId: '1' } });

    act(() => {
      fireEvent.pointerMove(window, { clientX: 300, clientY: 50 });
    });
    expect(setSelection).toHaveBeenLastCalledWith({ zone: 'battlefield', ids: new Set(['10']) });
    expect(result.current.marquee).toMatchObject({ x2: 300, y2: 50, count: 1 });

    act(() => {
      fireEvent.pointerMove(window, { clientX: 500, clientY: 50 });
    });
    expect(result.current.marquee).toMatchObject({ count: 2 });

    act(() => {
      fireEvent.pointerUp(window);
    });
    expect(result.current.marquee).toBeNull();
  });

  it('prefers the zone it started in when the rectangle touches two', () => {
    const { hand, setSelection, press } = setup();
    press(hand, 5, 790);
    act(() => {
      fireEvent.pointerMove(window, { clientX: 250, clientY: 20 });
    });
    expect(setSelection).toHaveBeenLastCalledWith({ zone: 'hand', ids: new Set(['30', '31']) });
  });

  it('selects nothing on this seat over another player\'s battlefield', () => {
    const { box, setSelection, press } = setup();
    press(box, 205, 305);
    act(() => {
      fireEvent.pointerMove(window, { clientX: 260, clientY: 390 });
    });
    expect(setSelection).toHaveBeenLastCalledWith(null);
  });

  it('leaves presses on cards, piles, menus and other buttons alone', () => {
    const { result, ownBoard, press } = setup();
    press(ownBoard.querySelector('[data-card]')!, 220, 20);
    expect(result.current.marquee).toBeNull();
    act(() => {
      result.current.onPointerDownBox({ button: 2, target: ownBoard } as unknown as React.PointerEvent<HTMLDivElement>);
    });
    expect(result.current.marquee).toBeNull();
  });
});
