export interface CardDataError {
  key: 'load' | 'save';
  detail: string;
}

export function toCardDataError(key: CardDataError['key'], error: unknown): CardDataError {
  return { key, detail: error instanceof Error ? error.message : String(error) };
}
