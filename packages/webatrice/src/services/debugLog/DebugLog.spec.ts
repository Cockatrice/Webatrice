import {
  DebugLog,
  DEBUG_LOG_MAX_MESSAGE_LENGTH,
  formatLogArguments,
  formatLogEntry,
  installConsoleCapture,
} from './DebugLog';

describe('DebugLog ring buffer', () => {
  test('keeps only the newest entries once full', () => {
    const log = new DebugLog(3);
    ['a', 'b', 'c', 'd', 'e'].forEach((message) => log.append('log', message));

    expect(log.getEntries().map((entry) => entry.message)).toEqual(['c', 'd', 'e']);
  });

  test('keeps the header across a clear, as desktop does', () => {
    const log = new DebugLog();
    log.setHeader(['Webatrice 1.0', '----']);
    log.append('warn', 'socket closed', new Date(2026, 9, 3, 9, 5, 7, 42).getTime());

    expect(log.toText()).toBe('Webatrice 1.0\n----\n[09:05:07.042] WARN  socket closed');

    log.clear();
    expect(log.toText()).toBe('Webatrice 1.0\n----');
    expect(log.getEntries()).toEqual([]);
  });

  test('notifies subscribers and hands out a stable snapshot between changes', async () => {
    const log = new DebugLog();
    const listener = vi.fn();
    const unsubscribe = log.subscribe(listener);

    log.append('info', 'one');
    await Promise.resolve();
    const snapshot = log.getEntries();
    expect(log.getEntries()).toBe(snapshot);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    log.append('info', 'two');
    await Promise.resolve();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(log.getEntries()).not.toBe(snapshot);
  });

  test('notifies after the logging call returns, once per burst', async () => {
    const log = new DebugLog();
    const listener = vi.fn();
    log.subscribe(listener);

    log.append('warn', 'one');
    log.append('warn', 'two');
    log.clear();
    expect(listener).not.toHaveBeenCalled();

    await Promise.resolve();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(log.getEntries()).toEqual([]);
  });
});

describe('formatLogArguments', () => {
  test('joins arguments like the console, serialising objects and errors', () => {
    const error = new Error('boom');
    error.stack = 'Error: boom\n    at test';

    expect(formatLogArguments(['Unknown message type:', { id: 3n, list: [1, 2] }, 7, null, undefined]))
      .toBe('Unknown message type: {"id":"3","list":[1,2]} 7 null undefined');
    expect(formatLogArguments(['Processing failed:', error])).toBe('Processing failed: Error: boom\n    at test');
  });

  test('never logs passwords, salts or tokens, however nested', () => {
    const message = formatLogArguments([{
      userName: 'alice',
      password: 'hunter2',
      options: { hashedPassword: 'abc', newPassword: 'x', passwordSalt: 's', authToken: 't' },
    }]);

    expect(message).toContain('"userName":"alice"');
    for (const secret of ['hunter2', '"abc"', '"x"', '"s"', '"t"']) {
      expect(message).not.toContain(secret);
    }
    expect(message.match(/\[redacted\]/g)).toHaveLength(5);
  });

  test('never logs credentials or account PII', () => {
    const message = formatLogArguments([{
      userName: 'alice',
      email: 'alice@example.com',
      realName: 'Alice Liddell',
      author: 'kept',
      headers: { Authorization: 'Bearer abc', apiKey: 'k' },
    }]);

    expect(message).toContain('"userName":"alice"');
    expect(message).toContain('"author":"kept"');
    for (const secret of ['alice@example.com', 'Alice Liddell', 'Bearer abc', '"k"']) {
      expect(message).not.toContain(secret);
    }
  });

  test('survives circular structures and truncates huge payloads', () => {
    const node: Record<string, unknown> = { name: 'loop' };
    node.self = node;
    expect(formatLogArguments([node])).toBe('{"name":"loop","self":"[circular]"}');

    const long = formatLogArguments(['x'.repeat(DEBUG_LOG_MAX_MESSAGE_LENGTH + 10)]);
    expect(long).toHaveLength(DEBUG_LOG_MAX_MESSAGE_LENGTH + '… [10 more characters]'.length);
  });

  test('pads the level column', () => {
    expect(formatLogEntry({ time: new Date(2026, 0, 1, 0, 0, 0, 5).getTime(), level: 'error', message: 'x' }))
      .toBe('[00:00:00.005] ERROR x');
  });
});

describe('installConsoleCapture', () => {
  let uninstall: () => void = () => {};

  afterEach(() => {
    uninstall();
  });

  const makeConsole = () => ({
    debug: vi.fn(), log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  }) as unknown as Console;

  test('records every console level and still calls the original with the same arguments', () => {
    const log = new DebugLog();
    const target = makeConsole();
    const originalWarn = target.warn;
    uninstall = installConsoleCapture(log, target);

    const payload = { a: 1 };
    target.warn('[WebSocketService] send() skipped', payload);
    target.error('failed');
    target.debug('detail');

    expect(originalWarn).toHaveBeenCalledWith('[WebSocketService] send() skipped', payload);
    expect(log.getEntries().map(({ level, message }) => [level, message])).toEqual([
      ['warn', '[WebSocketService] send() skipped {"a":1}'],
      ['error', 'failed'],
      ['debug', 'detail'],
    ]);

    uninstall();
    expect(target.warn).toBe(originalWarn);
  });

  test('installs once', () => {
    const log = new DebugLog();
    const target = makeConsole();
    uninstall = installConsoleCapture(log, target);
    const wrapped = target.log;

    expect(installConsoleCapture(log, target)).toBe(uninstall);
    expect(target.log).toBe(wrapped);

    target.log('once');
    expect(log.getEntries()).toHaveLength(1);
  });

  test('redacts nested protocol addresses and IP fields from captured and copied logs', () => {
    const log = new DebugLog();
    const target = makeConsole();
    uninstall = installConsoleCapture(log, target);
    const payload = {
      userInfo: { name: 'alice', address: '192.0.2.45' },
      results: [{ ip: '2001:db8::42', ipAddress: '198.51.100.7', ip_address: '203.0.113.8' }],
      clientAddress: '2001:db8::55',
      logMessages: [{ senderIp: '192.0.2.99', ship: 'kept ship', tip: 'kept tip' }],
    };

    target.debug('Response_GetUserInfo', payload);

    const message = log.getEntries()[0].message;
    expect(message).toContain('"name":"alice"');
    expect(message).toContain('"ship":"kept ship"');
    expect(message).toContain('"tip":"kept tip"');
    expect(message.match(/\[redacted\]/g)).toHaveLength(6);
    for (const value of ['192.0.2.45', '2001:db8::42', '198.51.100.7', '203.0.113.8', '2001:db8::55', '192.0.2.99']) {
      expect(message).not.toContain(value);
      expect(log.toText()).not.toContain(value);
    }
    expect(payload.userInfo.address).toBe('192.0.2.45');
  });

  test('records uncaught errors and unhandled rejections', () => {
    const log = new DebugLog();
    uninstall = installConsoleCapture(log, makeConsole());

    window.dispatchEvent(new ErrorEvent('error', { message: 'Script error.' }));
    const rejection = new Event('unhandledrejection') as PromiseRejectionEvent;
    Object.defineProperty(rejection, 'reason', { value: 'nope' });
    window.dispatchEvent(rejection);

    expect(log.getEntries().map((entry) => entry.message)).toEqual([
      'Uncaught Script error.',
      'Unhandled rejection: nope',
    ]);
  });
});
