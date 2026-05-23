import { useMemo, type ReactNode } from 'react';

import { CARD_CALLOUT_REGEX, MESSAGE_SENDER_REGEX } from '@app/types';
export interface ParsedMessage {
  name: string | null;
  chunks: ReactNode[];
}

export type ChunkParser = (chunk: string, index: number) => ReactNode;

// `parseChunk` must be a stable reference across renders (module-level function
// or `useCallback`). Passing a fresh closure every render will thrash the memo.
export function useParsedMessage(message: string, parseChunk: ChunkParser): ParsedMessage {
  return useMemo<ParsedMessage>(() => {
    const match = message.match(MESSAGE_SENDER_REGEX);
    const name = match ? match[1] : null;
    return {
      name,
      chunks: parseMessage(message, parseChunk),
    };
  }, [message, parseChunk]);
}

export function parseMessage(message: string, parseChunk: ChunkParser): ReactNode[] {
  return message
    .replace(MESSAGE_SENDER_REGEX, '')
    .split(CARD_CALLOUT_REGEX)
    .filter((chunk) => !!chunk)
    .map(parseChunk);
}
