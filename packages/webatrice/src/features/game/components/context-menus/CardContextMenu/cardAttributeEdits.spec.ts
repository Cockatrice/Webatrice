import { applyPTDelta, applyPTSet, parsePT, ptTokenToInt } from './cardAttributeEdits';

describe('cardAttributeEdits', () => {
  it.each([
    ['', []],
    ['2/3', ['2', '3']],
    ['+1/-1', [1, -1]],
    ['*/1+*', ['*', '1+*']],
    ['/foo', ['foo']],
    ['3/', ['3', '']],
    ['+x', [0]],
    ['4', ['4']],
  ] as const)('parsePT(%j) = %j', (pt, tokens) => {
    expect(parsePT(pt)).toEqual(tokens);
  });

  it('reads string tokens as integers and opaque ones as 0', () => {
    expect([ptTokenToInt(3), ptTokenToInt('2'), ptTokenToInt('*'), ptTokenToInt('1+*'), ptTokenToInt('')]).toEqual([3, 2, 0, 1, 0]);
  });

  describe('applyPTDelta (desktop actIncPT)', () => {
    it.each([
      ['', 1, 1, '1/1'],
      ['', 1, 0, '1'],
      ['', 0, -1, '0/-1'],
      ['3', 1, 0, '4'],
      ['3', 1, 2, '4/2'],
      ['2/2', 1, 1, '3/3'],
      ['2/2', -1, 0, '1/2'],
      ['*/*', 1, 1, '1/1'],
      ['0/1/2', 2, 0, '2/1'],
    ] as const)('%j + (%i, %i) = %j', (pt, dp, dt, result) => {
      expect(applyPTDelta(pt, dp, dt)).toBe(result);
    });
  });

  describe('applyPTSet (desktop actSetPT)', () => {
    it.each([
      ['2/2', '', ''],
      ['2/2', '5/5', '5/5'],
      ['2/2', '+1/+1', '3/3'],
      ['2/2', '-1/+0', '1/2'],
      ['2/2', '4/+2', '4/4'],
      ['', '+1/+1', '1/1'],
      ['3', '+1/+1', '4/1'],
      ['2/2', '*/*', '*/*'],
      ['2/2', '/X', 'X'],
    ] as const)('%j set to %j = %j', (pt, input, result) => {
      expect(applyPTSet(pt, input)).toBe(result);
    });
  });
});
