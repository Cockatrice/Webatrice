import { KeepAliveService } from './KeepAliveService';

type KeepAliveInternal = KeepAliveService & {
  worker: Worker | null;
  fallbackTimer: ReturnType<typeof setInterval> | null;
  lastPingPending: boolean;
};

describe('KeepAliveService', () => {
  let service: KeepAliveService;
  let mockIsOpen: ReturnType<typeof vi.fn>;
  let mockOnDisconnected: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('Worker', undefined);

    mockIsOpen = vi.fn().mockReturnValue(true);
    mockOnDisconnected = vi.fn();
    service = new KeepAliveService(mockIsOpen, mockOnDisconnected);
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

    it('should fire onDisconnected if lastPingPending is still true', () => {
      vi.advanceTimersByTime(interval);

      expect(mockOnDisconnected).toHaveBeenCalled();
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
    let workerOnDisconnected: ReturnType<typeof vi.fn>;
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
      workerOnDisconnected = vi.fn();
      workerService = new KeepAliveService(workerIsOpen, workerOnDisconnected);
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

    it('should fire onDisconnected when a tick arrives with a ping still pending', () => {
      workerService.startPingLoop(5000, pingFn);

      mockWorker._listener!({ data: { type: 'tick' } } as MessageEvent);
      mockWorker._listener!({ data: { type: 'tick' } } as MessageEvent);

      expect(workerOnDisconnected).toHaveBeenCalledTimes(1);
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
