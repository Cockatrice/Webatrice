import { createWorkerHandler } from './keepAliveWorkerHandler';

describe('keepAliveWorker.worker', () => {
  describe('createWorkerHandler', () => {
    it('should schedule ticks on start and stop them on stop', () => {
      vi.useFakeTimers();
      const post = vi.fn();
      const handler = createWorkerHandler(post);

      handler({ data: { type: 'start', interval: 1000 } } as MessageEvent);
      vi.advanceTimersByTime(2500);

      expect(post).toHaveBeenCalledTimes(2);
      expect(post).toHaveBeenNthCalledWith(1, { type: 'tick' });
      expect(post).toHaveBeenNthCalledWith(2, { type: 'tick' });

      handler({ data: { type: 'stop' } } as MessageEvent);
      vi.advanceTimersByTime(5000);

      expect(post).toHaveBeenCalledTimes(2);
    });

    it('should clear a previous interval if start is called twice', () => {
      vi.useFakeTimers();
      const post = vi.fn();
      const handler = createWorkerHandler(post);

      handler({ data: { type: 'start', interval: 100 } } as MessageEvent);
      vi.advanceTimersByTime(50);
      handler({ data: { type: 'start', interval: 1000 } } as MessageEvent);
      vi.advanceTimersByTime(500);

      expect(post).not.toHaveBeenCalled();
    });

    it('should ignore stop when no interval is running', () => {
      const post = vi.fn();
      const handler = createWorkerHandler(post);

      expect(() => handler({ data: { type: 'stop' } } as MessageEvent)).not.toThrow();
      expect(post).not.toHaveBeenCalled();
    });

    it('should ignore messages with no data or unknown type', () => {
      const post = vi.fn();
      const handler = createWorkerHandler(post);

      expect(() => handler({ data: null } as MessageEvent)).not.toThrow();
      expect(() => handler({ data: { type: 'unknown' } } as unknown as MessageEvent)).not.toThrow();
      expect(post).not.toHaveBeenCalled();
    });
  });
});
