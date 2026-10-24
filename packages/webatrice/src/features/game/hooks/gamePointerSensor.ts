import type { Activators, SensorInstance, SensorProps } from '@dnd-kit/core';

export interface Coordinates {
  x: number;
  y: number;
}

export interface GamePointerSensorOptions {
  activationDistance: number;
  instances?: Set<GamePointerSensor>;
}

export interface PointerGestureData {
  activationDistance?: number;
  onRelease?: (event: PointerEvent) => void;
}

function gestureData(props: SensorProps<GamePointerSensorOptions>): PointerGestureData | undefined {
  return props.activeNode.data.current as PointerGestureData | undefined;
}

function coordinatesOf(event: PointerEvent): Coordinates {
  return { x: event.clientX, y: event.clientY };
}

export class GamePointerSensor implements SensorInstance {
  static activators: Activators<GamePointerSensorOptions> = [
    {
      eventName: 'onPointerDown',
      handler: ({ nativeEvent }: { nativeEvent: PointerEvent }, _options, { active }) => {
        if (nativeEvent.button !== 0) {
          return false;
        }
        const seat = (active.data.current as PointerGestureData | undefined)?.activationDistance != null;
        return seat || nativeEvent.isPrimary;
      },
    },
  ];

  autoScrollEnabled: boolean;

  private activated = false;
  private readonly initial: Coordinates;
  private readonly distance: number;
  private readonly window: Window;

  constructor(private readonly props: SensorProps<GamePointerSensorOptions>) {
    props.options.instances?.add(this);
    const event = props.event as PointerEvent;
    const data = gestureData(props);
    this.initial = coordinatesOf(event);
    this.distance = data?.activationDistance ?? props.options.activationDistance;
    this.autoScrollEnabled = data?.activationDistance == null;
    this.window = (event.target as Node | null)?.ownerDocument?.defaultView ?? window;
    this.window.addEventListener('pointermove', this.handleMove);
    this.window.addEventListener('pointerup', this.handleEnd);
    this.window.addEventListener('pointercancel', this.handleCancel);
    this.window.addEventListener('keydown', this.handleKeydown);
    this.window.addEventListener('resize', this.handleCancel);
    this.window.addEventListener('dragstart', preventDefault);
  }

  dispose() {
    this.detach();
  }

  private detach() {
    this.props.options.instances?.delete(this);
    this.window.removeEventListener('pointermove', this.handleMove);
    this.window.removeEventListener('pointerup', this.handleEnd);
    this.window.removeEventListener('pointercancel', this.handleCancel);
    this.window.removeEventListener('keydown', this.handleKeydown);
    this.window.removeEventListener('resize', this.handleCancel);
    this.window.removeEventListener('dragstart', preventDefault);
  }

  private handleMove = (event: PointerEvent) => {
    const coordinates = coordinatesOf(event);
    if (!this.activated) {
      const dx = Math.abs(coordinates.x - this.initial.x);
      const dy = Math.abs(coordinates.y - this.initial.y);
      if (dx <= this.distance && dy <= this.distance) {
        return;
      }
      this.activated = true;
      this.props.onStart(this.initial);
    }
    if (event.cancelable) {
      event.preventDefault();
    }
    this.props.onMove(coordinates);
  };

  private handleEnd = (event: PointerEvent) => {
    this.detach();
    if (!this.activated) {
      this.props.onAbort(this.props.active);
      gestureData(this.props)?.onRelease?.(event);
    }
    this.props.onEnd();
  };

  private handleCancel = () => {
    this.detach();
    if (!this.activated) {
      this.props.onAbort(this.props.active);
    }
    this.props.onCancel();
  };

  private handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      this.handleCancel();
    }
  };
}

function preventDefault(event: Event) {
  event.preventDefault();
}
