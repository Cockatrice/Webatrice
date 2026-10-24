import type { SensorProps } from '@dnd-kit/core';

import { GamePointerSensor, type GamePointerSensorOptions, type PointerGestureData } from './gamePointerSensor';

function pointer(type: string, x: number, y: number, init: PointerEventInit = {}) {
  return new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true, ...init });
}

function start(
  data: PointerGestureData | undefined,
  at = { x: 100, y: 100 },
  instances?: Set<GamePointerSensor>,
) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const event = pointer('pointerdown', at.x, at.y);
  Object.defineProperty(event, 'target', { value: target });
  const props = {
    active: 'card',
    activeNode: { data: { current: data } },
    event,
    options: { activationDistance: 0, instances },
    onStart: vi.fn(),
    onMove: vi.fn(),
    onEnd: vi.fn(),
    onCancel: vi.fn(),
    onAbort: vi.fn(),
    onPending: vi.fn(),
  } as unknown as SensorProps<GamePointerSensorOptions>;
  const sensor = new GamePointerSensor(props);
  return { props: props as unknown as Record<string, ReturnType<typeof vi.fn>>, sensor };
}

describe('GamePointerSensor', () => {
  it('disposes only its board sensors and forgets sensors after a normal release', () => {
    const first = new Set<GamePointerSensor>();
    const second = new Set<GamePointerSensor>();
    const onRelease = vi.fn();
    const old = start({ activationDistance: 4, onRelease }, undefined, first);
    const live = start({ activationDistance: 4 }, undefined, second);
    expect(first.size).toBe(1);
    expect(second.size).toBe(1);

    for (const sensor of first) {
      sensor.dispose();
    }
    window.dispatchEvent(pointer('pointerup', 100, 100));

    expect(old.props.onEnd).not.toHaveBeenCalled();
    expect(old.props.onCancel).not.toHaveBeenCalled();
    expect(onRelease).not.toHaveBeenCalled();
    expect(live.props.onEnd).toHaveBeenCalledTimes(1);
    expect(first.size).toBe(0);
    expect(second.size).toBe(0);
  });

  it('starts a seat drag only once the pointer leaves the four-pixel box on either axis', () => {
    const { props } = start({ activationDistance: 4 });

    window.dispatchEvent(pointer('pointermove', 104, 104));
    expect(props.onStart).not.toHaveBeenCalled();

    window.dispatchEvent(pointer('pointermove', 105, 100));
    expect(props.onStart).toHaveBeenCalledWith({ x: 100, y: 100 });
    expect(props.onMove).toHaveBeenLastCalledWith({ x: 105, y: 100 });

    window.dispatchEvent(pointer('pointerup', 105, 100));
    expect(props.onEnd).toHaveBeenCalledTimes(1);
    expect(props.onAbort).not.toHaveBeenCalled();
  });

  it('starts a structured drag on any motion', () => {
    const { props } = start(undefined);

    window.dispatchEvent(pointer('pointermove', 100, 101));
    window.dispatchEvent(pointer('pointerup', 100, 101));

    expect(props.onStart).toHaveBeenCalledTimes(1);
  });

  it('turns a release inside the box into a click and ends without a drag', () => {
    const onRelease = vi.fn();
    const { props } = start({ activationDistance: 4, onRelease });

    window.dispatchEvent(pointer('pointermove', 103, 99));
    const up = pointer('pointerup', 103, 99, { ctrlKey: true });
    window.dispatchEvent(up);

    expect(props.onStart).not.toHaveBeenCalled();
    expect(props.onAbort).toHaveBeenCalledWith('card');
    expect(onRelease).toHaveBeenCalledWith(up);
    expect(props.onEnd).toHaveBeenCalledTimes(1);
  });

  it('cancels on Escape', () => {
    const { props } = start({ activationDistance: 4 });
    window.dispatchEvent(pointer('pointermove', 120, 100));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(props.onEnd).not.toHaveBeenCalled();
  });

  it('removes every window listener it added when the gesture ends', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    start({ activationDistance: 4 });
    const added = add.mock.calls.map(([type, listener]) => [type, listener]);
    expect(added.map(([type]) => type)).toEqual(
      expect.arrayContaining(['pointermove', 'pointerup', 'pointercancel', 'keydown']),
    );

    window.dispatchEvent(pointer('pointerup', 100, 100));

    for (const [type, listener] of added) {
      expect(remove).toHaveBeenCalledWith(type, listener);
    }
    vi.restoreAllMocks();
  });

  it('activates on the primary button; structured leaves also need the primary pointer', () => {
    const [activator] = GamePointerSensor.activators;
    const seat = { active: { data: { current: { activationDistance: 4 } } } } as never;
    const leaf = { active: { data: { current: undefined } } } as never;
    const press = (init: PointerEventInit) => ({ nativeEvent: pointer('pointerdown', 0, 0, init) });

    expect(activator.handler(press({ button: 0, isPrimary: false }), { activationDistance: 0 }, seat)).toBe(true);
    expect(activator.handler(press({ button: 2 }), { activationDistance: 0 }, seat)).toBe(false);
    expect(activator.handler(press({ button: 0, isPrimary: false }), { activationDistance: 0 }, leaf)).toBe(false);
    expect(activator.handler(press({ button: 0, isPrimary: true }), { activationDistance: 0 }, leaf)).toBe(true);
  });
});
