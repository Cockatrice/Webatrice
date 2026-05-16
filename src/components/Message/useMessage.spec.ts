import { renderHook } from '@testing-library/react';

import { parseMessage, useParsedMessage } from './useMessage';

const parseChunk = (chunk: string, index: number) => `<${index}:${chunk}>`;

describe('useParsedMessage', () => {
  it('extracts the sender name and splits chunks around card callouts', () => {
    const { result } = renderHook(() =>
      useParsedMessage('alice: I cast [[Lightning Bolt]] on you', parseChunk),
    );

    expect(result.current.name).toBe('alice');
    expect(result.current.chunks).toEqual([
      '<0: I cast >',
      '<1:[[Lightning Bolt]]>',
      '<2: on you>',
    ]);
  });

  it('returns name=null when no sender prefix is present', () => {
    const { result } = renderHook(() => useParsedMessage('plain text', parseChunk));

    expect(result.current.name).toBeNull();
    expect(result.current.chunks).toEqual(['<0:plain text>']);
  });

  it('memoizes the parsed shape across renders with the same input', () => {
    const { result, rerender } = renderHook(
      ({ msg }: { msg: string }) => useParsedMessage(msg, parseChunk),
      { initialProps: { msg: 'bob: hi' } },
    );
    const first = result.current;

    rerender({ msg: 'bob: hi' });

    expect(result.current).toBe(first);
  });

  it('parseMessage drops the sender prefix and filters empty segments', () => {
    const chunks = parseMessage('alice: [[Bolt]]', parseChunk);
    expect(chunks).toEqual(['<0: >', '<1:[[Bolt]]>']);
  });
});
