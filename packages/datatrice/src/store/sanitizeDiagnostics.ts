const REDACTED = '[REDACTED]';

export function sanitizeDiagnostics<T>(value: T): T {
  if (value === null || typeof value !== 'object' || value instanceof Uint8Array) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeDiagnostics) as T;
  }
  const record = value as Record<string, unknown>;
  const tokenTarget = record.command === 'deckShareList' || record.command === 'deckShareDownload';
  return Object.fromEntries(Object.entries(record).map(([key, entry]) => {
    const secret = key === 'token' || key === '$unknown'
      || (key === 'target' && tokenTarget)
      || ((key === 'deck' || key === 'deckList') && typeof entry === 'string');
    return [key, secret ? REDACTED : sanitizeDiagnostics(entry)];
  })) as T;
}
