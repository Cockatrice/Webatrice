import { act, renderHook } from '@testing-library/react';
import type React from 'react';

import type { SeatDropPoint } from '../../../hooks/seatDropPlan';
import type { PlayerCardViewModel } from './playerBoard.types';
import { useSeatDnd, type UseSeatDndArgs } from './useSeatDnd';

const dnd = vi.hoisted(() => ({
  starts: new Map<string, ReturnType<typeof vi.fn>>(),
  zones: new Map<string, { resolve: (drop: SeatDropPoint, source: unknown) => unknown }>(),
  canAct: true,
}));

vi.mock('../SeatDragContext', () => ({
  useActiveSeatDrag: () => null,
  useSeatDragSource: (id: string) => {
    if (!dnd.starts.has(id)) {
      dnd.starts.set(id, vi.fn());
    }
    return dnd.starts.get(id);
  },
  useSeatDropZone: (id: string, zone: { resolve: (drop: SeatDropPoint, source: unknown) => unknown }) => {
    dnd.zones.set(id, zone);
    return () => undefined;
  },
}));

vi.mock('../CardVisualStateContext', () => ({
  useCanActFor: () => () => dnd.canAct,
}));

const card = (id: number): PlayerCardViewModel => ({ id: String(id), name: `Card ${id}`, scryfallId: '' });
const press = {} as React.PointerEvent<HTMLElement>;
const release = (init: Partial<PointerEvent> = {}) => init as PointerEvent;

function element(rect: DOMRect): HTMLDivElement {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => rect;
  return el;
}

function seatBox(handRects: DOMRect[]): HTMLDivElement {
  const box = element(new DOMRect(0, 0, 1000, 800));
  handRects.forEach((rect, i) => {
    const handCard = element(rect);
    handCard.setAttribute('data-card', '');
    handCard.setAttribute('data-zone', 'hand');
    handCard.setAttribute('data-card-id', String(30 + i));
    box.append(handCard);
  });
  return box;
}

function setup(args: Partial<UseSeatDndArgs> = {}) {
  const box = seatBox([100, 200, 300].map((left) => new DOMRect(left, 600, 80, 110)));
  const props: UseSeatDndArgs = {
    seatId: 1,
    seatDrag: null,
    selection: null,
    setSelection: vi.fn(),
    resolveAttachPress: vi.fn(() => false),
    printedPT: () => undefined,
    stackDisplayList: [card(50), card(51)],
    handDisplayList: [card(30), card(31), card(32)],
    horizontalHand: true,
    handRef: { current: box },
    stackRef: { current: element(new DOMRect(0, 0, 100, 400)) },
    libraryRef: { current: null },
    graveyardRef: { current: null },
    exileRef: { current: null },
    CARD_W_PX: 72,
    CARD_H_PX: 102,
    stackPileOptions: { overlapPercent: 33, minOffset: 10, xSpace: 5 },
    ...args,
  };
  const { result } = renderHook(() => useSeatDnd(props));
  return { result, props };
}

beforeEach(() => {
  dnd.starts.clear();
  dnd.zones.clear();
  dnd.canAct = true;
});

describe('useSeatDnd', () => {
  it('drags the pressed card alone, and a press released in place selects it', () => {
    const { result, props } = setup();
    result.current.startSeatCardDrag(press, card(10), 'battlefield', [card(10), card(11)]);

    const start = dnd.starts.get('seat-1-battlefield')!;
    expect(start).toHaveBeenCalledWith(press, [card(10)], expect.any(Function));
    act(() => start.mock.calls[0][2](release()));
    expect(props.setSelection).toHaveBeenCalledWith({ zone: 'battlefield', ids: new Set(['10']) });
  });

  it('drags the whole selection when the pressed card is in it', () => {
    const { result } = setup({ selection: { zone: 'hand', ids: new Set(['30', '32']) } });
    result.current.startSeatCardDrag(press, card(30), 'hand', [card(30), card(31), card(32)]);
    expect(dnd.starts.get('seat-1-hand')).toHaveBeenCalledWith(press, [card(30), card(32)], expect.any(Function));
  });

  it('toggles a card in the selection on Ctrl / Cmd click, and clears it when the last one goes', () => {
    const { result, props } = setup({ selection: { zone: 'stack', ids: new Set(['50']) } });
    result.current.startSeatCardDrag(press, card(51), 'stack', [card(50), card(51)]);
    const onRelease = dnd.starts.get('seat-1-stack')!.mock.calls[0][2];
    act(() => onRelease(release({ metaKey: true })));
    expect(props.setSelection).toHaveBeenLastCalledWith({ zone: 'stack', ids: new Set(['50', '51']) });

    result.current.startSeatCardDrag(press, card(50), 'stack', [card(50), card(51)]);
    act(() => dnd.starts.get('seat-1-stack')!.mock.calls[1][2](release({ ctrlKey: true })));
    expect(props.setSelection).toHaveBeenLastCalledWith(null);
  });

  it('hands a battlefield click to a pending attach pick first, and selects only when none took it', () => {
    const { result, props } = setup({ resolveAttachPress: vi.fn((pressed: { id: string }) => pressed.id === '20') });
    result.current.startSeatCardDrag(press, card(20), 'battlefield', [card(20)]);
    act(() => dnd.starts.get('seat-1-battlefield')!.mock.calls[0][2](release()));
    expect(props.resolveAttachPress).toHaveBeenCalledWith(expect.objectContaining({ id: '20' }));
    expect(props.setSelection).not.toHaveBeenCalled();

    result.current.startSeatCardDrag(press, card(21), 'battlefield', [card(21)]);
    act(() => dnd.starts.get('seat-1-battlefield')!.mock.calls[1][2](release()));
    expect(props.setSelection).toHaveBeenCalledWith({ zone: 'battlefield', ids: new Set(['21']) });

    result.current.startSeatCardDrag(press, card(50), 'stack', [card(50)]);
    act(() => dnd.starts.get('seat-1-stack')!.mock.calls[0][2](release()));
    expect(props.resolveAttachPress).toHaveBeenCalledTimes(2);
  });

  it('hands a click on to onCardClick once the selection is updated', () => {
    const onCardClick = vi.fn();
    const { result, props } = setup({ onCardClick });
    result.current.startSeatCardDrag(press, card(31), 'hand', [card(30), card(31)]);
    const up = release({ shiftKey: true });
    act(() => dnd.starts.get('seat-1-hand')!.mock.calls[0][2](up));
    expect(props.setSelection).toHaveBeenCalledWith({ zone: 'hand', ids: new Set(['31']) });
    expect(onCardClick).toHaveBeenCalledWith('hand', card(31), up, null);
  });

  it('hands onCardClick the selection from before the click it replaced', () => {
    const onCardClick = vi.fn();
    const before = { zone: 'hand' as const, ids: new Set(['30', '32']) };
    const { result, props } = setup({ onCardClick, selection: before });
    result.current.startSeatCardDrag(press, card(31), 'hand', [card(30), card(31), card(32)]);
    const up = release();
    act(() => dnd.starts.get('seat-1-hand')!.mock.calls[0][2](up));
    expect(props.setSelection).toHaveBeenCalledWith({ zone: 'hand', ids: new Set(['31']) });
    expect(onCardClick).toHaveBeenCalledWith('hand', card(31), up, before);
  });

  it('keeps a group selected on a click on one of its cards, and still hands the click on', () => {
    const onCardClick = vi.fn();
    const { result, props } = setup({ onCardClick, selection: { zone: 'hand', ids: new Set(['30', '32']) } });
    result.current.startSeatCardDrag(press, card(30), 'hand', [card(30), card(31), card(32)]);
    const up = release();
    act(() => dnd.starts.get('seat-1-hand')!.mock.calls[0][2](up));
    expect(props.setSelection).not.toHaveBeenCalled();
    expect(onCardClick).toHaveBeenCalledWith('hand', card(30), up, { zone: 'hand', ids: new Set(['30', '32']) });
  });

  it('drags the top card of a pile', () => {
    const { result } = setup();
    result.current.startPileDrag(press, card(41), 'graveyard');
    expect(dnd.starts.get('seat-1-graveyard')).toHaveBeenCalledWith(press, [card(41)]);
  });

  it('gives a card dragged from outside the battlefield its printed P/T, for a battlefield drop', () => {
    const { result } = setup({ printedPT: (cardName) => (cardName === 'Card 30' ? '2/2' : undefined) });
    result.current.startSeatCardDrag(press, card(30), 'hand', [card(30)]);
    result.current.startPileDrag(press, card(30), 'graveyard');
    result.current.startSeatCardDrag(press, card(30), 'battlefield', [card(30)]);
    expect(dnd.starts.get('seat-1-hand')!.mock.calls[0][1]).toEqual([{ ...card(30), printedPT: '2/2' }]);
    expect(dnd.starts.get('seat-1-graveyard')!.mock.calls[0][1]).toEqual([{ ...card(30), printedPT: '2/2' }]);
    expect(dnd.starts.get('seat-1-battlefield')!.mock.calls[0][1]).toEqual([card(30)]);
  });

  it('resolves a hand drop to the cards left of the pointer, not counting the dragged ones', () => {
    setup();
    const hand = dnd.zones.get('seat-1-hand')!;
    const drop = (x: number) => ({ pointer: { x, y: 650 }, cardOrigin: { x, y: 650 } });
    const order = ['30', '31', '32'];
    expect(hand.resolve(drop(250), { zone: 'battlefield', cards: [] })).toEqual({ zone: 'hand', index: 2, order });
    expect(hand.resolve(drop(250), { zone: 'hand', cards: [card(30)] })).toEqual({ zone: 'hand', index: 1, order });
  });

  it('resolves a vertical hand drop to the nearest gap between card tops, as desktop does', () => {
    const box = seatBox([100, 150, 200].map((top, i) => new DOMRect(i % 2 ? 31 : 5, top, 72, 102)));
    setup({ horizontalHand: false, handRef: { current: box } });
    const hand = dnd.zones.get('seat-1-hand')!;
    const drop = (y: number) => ({ pointer: { x: 40, y }, cardOrigin: { x: 40, y } });
    const order = ['30', '31', '32'];
    expect(hand.resolve(drop(120), { zone: 'battlefield', cards: [] })).toEqual({ zone: 'hand', index: 0, order });
    expect(hand.resolve(drop(130), { zone: 'battlefield', cards: [] })).toEqual({ zone: 'hand', index: 1, order });
    expect(hand.resolve(drop(400), { zone: 'battlefield', cards: [] })).toEqual({ zone: 'hand', index: 3, order });
    expect(hand.resolve(drop(180), { zone: 'hand', cards: [card(30)] })).toEqual({ zone: 'hand', index: 1, order });
  });

  it('resolves pile drops to their zone', () => {
    setup();
    for (const zone of ['library', 'graveyard', 'exile'] as const) {
      expect(dnd.zones.get(`seat-1-${zone}`)!.resolve({ pointer: { x: 0, y: 0 }, cardOrigin: { x: 0, y: 0 } }, {}))
        .toEqual({ zone });
    }
  });
});
