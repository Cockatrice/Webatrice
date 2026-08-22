import { KeepAliveService } from './KeepAliveService';

type KeepAliveInternal = KeepAliveService & {
  worker: Worker | null;
  fallbackTimer: ReturnType<typeof setInterval> | null;
  lastPingPending: boolean;
};

describe('KeepAliveService', () => {
  let service: KeepAliveService;
  let mockIsOpen: ReturnType<typeof vi.fn>;
  let mockOnHealthChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('Worker', undefined);

    mockIsOpen = vi.fn().mockReturnValue(true);
    mockOnHealthChange = vi.fn();
    service = new KeepAliveService(mockIsOpen, mockOnHealthChange);
  });

  it('should create', () => {
    expect(service).toBeDefined();
  });

  describe('fallback path (no Worker available)', () => {
    let resolvePing;
    let interval;
    let promise;
    let ping;

    beforeEach(() => {
      interval = 100;
      promise = new Promise(resolve => resolvePing = resolve);
      ping = (done) => promise.then(done);

      service.startPingLoop(interval, ping);
      vi.advanceTimersByTime(interval);
    });

    it('should start ping loop using setInterval fallback', () => {
      expect((service as KeepAliveInternal).fallbackTimer).toBeDefined();
      expect((service as KeepAliveInternal).worker).toBeNull();
      expect((service as KeepAliveInternal).lastPingPending).toBeTruthy();
    });

    it('should call ping callback when done', () => {
      resolvePing();

      return promise.then(() => {
        expect((service as KeepAliveInternal).lastPingPending).toBeFalsy();
      });
    });

    it('should not report degraded health on the first missed pong', () => {
      vi.advanceTimersByTime(interval);

      expect(mockOnHealthChange).not.toHaveBeenCalled();
    });

    it('should report degraded health from the second consecutive miss onward', () => {
      vi.advanceTimersByTime(interval * 2);
      expect(mockOnHealthChange).toHaveBeenCalledWith(2, expect.any(Number));

      vi.advanceTimersByTime(interval);
      expect(mockOnHealthChange).toHaveBeenCalledWith(3, expect.any(Number));
    });

    it('should NEVER close the connection, no matter how many pongs are missed', () => {
      // Policy: without credential retention a self-disconnect is strictly
      // destructive; the socket's own close/error events decide death.
      const timersBefore = vi.getTimerCount();
      vi.advanceTimersByTime(interval * 20);

      // Loop still running (interval timer alive), health degraded, no teardown.
      expect(vi.getTimerCount()).toBe(timersBefore);
      expect(mockOnHealthChange).toHaveBeenLastCalledWith(20, expect.any(Number));
      expect((service as KeepAliveInternal).fallbackTimer).not.toBeNull();
    });

    it('should endPingLoop if socket is not open', () => {
      vi.spyOn(service, 'endPingLoop');
      mockIsOpen.mockReturnValue(false);

      resolvePing();
      vi.advanceTimersByTime(interval);

      expect(service.endPingLoop).toHaveBeenCalled();
    });

    it('should clear previous interval when startPingLoop is called again', () => {
      const clearSpy = vi.spyOn(globalThis, 'clearInterval');
      const previousTimer = (service as KeepAliveInternal).fallbackTimer;

      service.startPingLoop(interval, ping);

      expect(clearSpy).toHaveBeenCalledWith(previousTimer);
    });

    it('should reset lastPingPending in endPingLoop', () => {
      expect((service as KeepAliveInternal).lastPingPending).toBe(true);

      service.endPingLoop();

      expect((service as KeepAliveInternal).lastPingPending).toBe(false);
      expect((service as KeepAliveInternal).fallbackTimer).toBeNull();
    });

    it('should fall back when the Worker constructor throws', () => {
      service.endPingLoop();
      class ThrowingWorker {
        constructor() {
          throw new Error('not allowed');
        }
      }
      vi.stubGlobal('Worker', ThrowingWorker);

      service.startPingLoop(interval, ping);

      expect((service as KeepAliveInternal).worker).toBeNull();
      expect((service as KeepAliveInternal).fallbackTimer).not.toBeNull();
    });
  });

  describe('worker path', () => {
    let mockWorker: {
      postMessage: ReturnType<typeof vi.fn>;
      addEventListener: ReturnType<typeof vi.fn>;
      removeEventListener: ReturnType<typeof vi.fn>;
      terminate: ReturnType<typeof vi.fn>;
      _listener?: (event: MessageEvent) => void;
    };
    let workerCtor: ReturnType<typeof vi.fn>;
    let constructorArgs: { url: unknown; options: unknown }[];
    let workerService: KeepAliveService;
    let workerIsOpen: ReturnType<typeof vi.fn>;
    let workerOnHealthChange: ReturnType<typeof vi.fn>;
    let pingFn: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockWorker = {
        postMessage: vi.fn(),
        addEventListener: vi.fn((type, listener) => {
          if (type === 'message') {
            mockWorker._listener = listener as (event: MessageEvent) => void;
          }
        }),
        removeEventListener: vi.fn((type) => {
          if (type === 'message') {
            mockWorker._listener = undefined;
          }
        }),
        terminate: vi.fn(),
      };
      constructorArgs = [];
      workerCtor = vi.fn(function WorkerStub(this: object, url: unknown, options: unknown) {
        constructorArgs.push({ url, options });
        Object.assign(this, mockWorker);
      });
      vi.stubGlobal('Worker', workerCtor);

      workerIsOpen = vi.fn().mockReturnValue(true);
      workerOnHealthChange = vi.fn();
      workerService = new KeepAliveService(workerIsOpen, workerOnHealthChange);
      pingFn = vi.fn();
    });

    it('should construct a module Worker pointing at the sibling worker entrypoint', () => {
      workerService.startPingLoop(5000, pingFn);

      expect(workerCtor).toHaveBeenCalledTimes(1);
      expect(constructorArgs[0].url).toBeInstanceOf(URL);
      expect((constructorArgs[0].url as URL).pathname).toMatch(/keepAliveWorker\.(js|ts)$/);
      expect(constructorArgs[0].options).toEqual({ type: 'module' });
    });

    it('should post a start message and attach a listener on startPingLoop', () => {
      workerService.startPingLoop(5000, pingFn);

      expect(mockWorker.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWorker.postMessage).toHaveBeenCalledWith({ type: 'start', interval: 5000 });
      expect((workerService as unknown as KeepAliveInternal).fallbackTimer).toBeNull();
    });

    it('should send a ping when the worker posts a tick', () => {
      workerService.startPingLoop(5000, pingFn);

      mockWorker._listener!({ data: { type: 'tick' } } as MessageEvent);

      expect(pingFn).toHaveBeenCalledTimes(1);
      expect((workerService as unknown as KeepAliveInternal).lastPingPending).toBe(true);
    });

    it('should ignore non-tick messages', () => {
      workerService.startPingLoop(5000, pingFn);

      mockWorker._listener!({ data: { type: 'something-else' } } as MessageEvent);
      mockWorker._listener!({ data: null } as MessageEvent);

      expect(pingFn).not.toHaveBeenCalled();
    });

    it('should ignore burst-drained ticks (pending ping younger than an interval)', () => {
      // Field-captured failure mode: ticks queue behind a stalled main thread
      // and drain back-to-back; the tick right after a ping is armed must not
      // count it as missed.
      workerService.startPingLoop(5000, pingFn);

      mockWorker._listener!({ data: { type: 'tick' } } as MessageEvent);
      mockWorker._listener!({ data: { type: 'tick' } } as MessageEvent);
      mockWorker._listener!({ data: { type: 'tick' } } as MessageEvent);
      mockWorker._listener!({ data: { type: 'tick' } } as MessageEvent);

      expect(workerOnHealthChange).not.toHaveBeenCalled();
    });

    it('should report escalating degraded health but keep pinging through sustained silence', () => {
      workerService.startPingLoop(5000, pingFn);

      mockWorker._listener!({ data: { type: 'tick' } } as MessageEvent);
      for (let i = 0; i < 3; i += 1) {
        vi.advanceTimersByTime(5000);
        mockWorker._listener!({ data: { type: 'tick' } } as MessageEvent);
      }

      // Degraded from the 2nd miss; a ping is still armed on every tick.
      expect(workerOnHealthChange).toHaveBeenCalledWith(2, expect.any(Number));
      expect(workerOnHealthChange).toHaveBeenLastCalledWith(3, expect.any(Number));
      expect(pingFn).toHaveBeenCalledTimes(4);
      expect(mockWorker.postMessage).not.toHaveBeenCalledWith({ type: 'stop' });
    });

    it('should report recovery when a pong arrives after degradation', () => {
      workerService.startPingLoop(5000, pingFn);

      mockWorker._listener!({ data: { type: 'tick' } } as MessageEvent);
      // Two genuine misses → degraded.
      vi.advanceTimersByTime(5000);
      mockWorker._listener!({ data: { type: 'tick' } } as MessageEvent);
      vi.advanceTimersByTime(5000);
      mockWorker._listener!({ data: { type: 'tick' } } as MessageEvent);
      expect(workerOnHealthChange).toHaveBeenLastCalledWith(2, expect.any(Number));

      // The latest ping is answered: proof of life, recovery reported.
      const onPong = pingFn.mock.calls.at(-1)![0] as () => void;
      onPong();
      expect(workerOnHealthChange).toHaveBeenLastCalledWith(0, 0);

      // Escalation restarts fresh: arm → miss 1 (no report) → miss 2 (report).
      workerOnHealthChange.mockClear();
      vi.advanceTimersByTime(5000);
      mockWorker._listener!({ data: { type: 'tick' } } as MessageEvent);
      vi.advanceTimersByTime(5000);
      mockWorker._listener!({ data: { type: 'tick' } } as MessageEvent);
      vi.advanceTimersByTime(5000);
      mockWorker._listener!({ data: { type: 'tick' } } as MessageEvent);
      expect(workerOnHealthChange).toHaveBeenCalledTimes(1);
      expect(workerOnHealthChange).toHaveBeenCalledWith(2, expect.any(Number));
    });

    it('should post stop and detach listener on endPingLoop', () => {
      workerService.startPingLoop(5000, pingFn);
      workerService.endPingLoop();

      expect(mockWorker.postMessage).toHaveBeenCalledWith({ type: 'stop' });
      expect(mockWorker.removeEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('should reuse the worker across start/stop cycles', () => {
      workerService.startPingLoop(5000, pingFn);
      workerService.endPingLoop();
      workerService.startPingLoop(7500, pingFn);

      expect(workerCtor).toHaveBeenCalledTimes(1);
      expect(mockWorker.postMessage).toHaveBeenCalledWith({ type: 'start', interval: 5000 });
      expect(mockWorker.postMessage).toHaveBeenCalledWith({ type: 'start', interval: 7500 });
      expect(mockWorker.postMessage).toHaveBeenCalledWith({ type: 'stop' });
    });

    it('should request endPingLoop when the socket is not open at tick time', () => {
      workerService.startPingLoop(5000, pingFn);
      const endSpy = vi.spyOn(workerService, 'endPingLoop');
      workerIsOpen.mockReturnValue(false);

      mockWorker._listener!({ data: { type: 'tick' } } as MessageEvent);

      expect(endSpy).toHaveBeenCalled();
    });
  });
});
