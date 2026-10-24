
export type DebugLogLevel = 'debug' | 'log' | 'info' | 'warn' | 'error';

export interface DebugLogEntry {
  time: number;
  level: DebugLogLevel;
  message: string;
}

export const DEBUG_LOG_MAX_ENTRIES = 500;

export const DEBUG_LOG_MAX_MESSAGE_LENGTH = 4000;

const LEVELS: readonly DebugLogLevel[] = ['debug', 'log', 'info', 'warn', 'error'];

const SECRET_KEY = /password|passwd|secret|salt|^hash|token$|^auth(?!ors?$)|api_?key|e_?mail|real_?name|address|^ip(?:v[46])?$|(?:^|_)ip$/i;
const CAMEL_CASE_IP_KEY = /[a-z]Ip$/;
const REDACTED = '[redacted]';

function describeValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Error) {
    return value.stack ?? `${value.name}: ${value.message}`;
  }
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    return String(value);
  }
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(value, (key, nested: unknown) => {
      if (key && (SECRET_KEY.test(key) || CAMEL_CASE_IP_KEY.test(key))) {
        return REDACTED;
      }
      if (typeof nested === 'bigint') {
        return nested.toString();
      }
      if (nested && typeof nested === 'object') {
        if (seen.has(nested)) {
          return '[circular]';
        }
        seen.add(nested);
      }
      return nested;
    }) ?? String(value);
  } catch {
    return String(value);
  }
}

export function formatLogArguments(args: readonly unknown[]): string {
  const message = args.map(describeValue).join(' ');
  return message.length > DEBUG_LOG_MAX_MESSAGE_LENGTH
    ? `${message.slice(0, DEBUG_LOG_MAX_MESSAGE_LENGTH)}… [${message.length - DEBUG_LOG_MAX_MESSAGE_LENGTH} more characters]`
    : message;
}

function formatTime(time: number): string {
  const date = new Date(time);
  const pad = (n: number, width = 2) => String(n).padStart(width, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

export const formatLogEntry = ({ time, level, message }: DebugLogEntry): string =>
  `[${formatTime(time)}] ${level.toUpperCase().padEnd(5)} ${message}`;

export class DebugLog {
  private header: readonly string[] = [];
  private entries: DebugLogEntry[] = [];
  private readonly listeners = new Set<() => void>();
  private snapshot: readonly DebugLogEntry[] | null = [];
  private notifyQueued = false;

  constructor(private readonly capacity = DEBUG_LOG_MAX_ENTRIES) {}

  setHeader(lines: readonly string[]): void {
    this.header = [...lines];
    this.notify();
  }

  getHeader(): readonly string[] {
    return this.header;
  }

  append(level: DebugLogLevel, message: string, time = Date.now()): void {
    this.entries.push({ time, level, message });
    if (this.entries.length > this.capacity) {
      this.entries.splice(0, this.entries.length - this.capacity);
    }
    this.notify();
  }

  getEntries = (): readonly DebugLogEntry[] => (this.snapshot ??= [...this.entries]);

  clear(): void {
    this.entries = [];
    this.notify();
  }

  toText(): string {
    return [...this.header, ...this.entries.map(formatLogEntry)].join('\n');
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notify(): void {
    this.snapshot = null;
    if (this.notifyQueued || this.listeners.size === 0) {
      return;
    }
    this.notifyQueued = true;
    queueMicrotask(() => {
      this.notifyQueued = false;
      this.listeners.forEach((listener) => listener());
    });
  }
}

export const debugLog = new DebugLog();

let uninstallCapture: (() => void) | null = null;

export function installConsoleCapture(log: DebugLog = debugLog, target: Console = console): () => void {
  if (uninstallCapture) {
    return uninstallCapture;
  }
  const originals = new Map<DebugLogLevel, Console[DebugLogLevel]>();
  for (const level of LEVELS) {
    const original = target[level];
    originals.set(level, original);
    target[level] = function captured(this: Console, ...args: unknown[]) {
      original.apply(this, args);
      try {
        log.append(level, formatLogArguments(args));
      } catch {
        // Logging must never break the caller.
      }
    };
  }

  const onError = (event: ErrorEvent) => {
    log.append('error', `Uncaught ${formatLogArguments([event.error ?? event.message])}`);
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    log.append('error', `Unhandled rejection: ${formatLogArguments([event.reason])}`);
  };
  const hasWindow = typeof window !== 'undefined';
  if (hasWindow) {
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
  }

  uninstallCapture = () => {
    originals.forEach((original, level) => {
      target[level] = original;
    });
    if (hasWindow) {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    }
    uninstallCapture = null;
  };
  return uninstallCapture;
}
