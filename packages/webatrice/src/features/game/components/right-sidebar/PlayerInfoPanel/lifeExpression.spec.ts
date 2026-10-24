import { evalLifeExpression } from './lifeExpression';

describe('evalLifeExpression', () => {
  it.each([
    ['20', 20],
    [' 40 + 10 ', 50],
    ['20*2', 40],
    ['(20-3)/2', 8],
    ['-7/2', -3],
    ['17 % 5', 2],
    ['0.9', 0],
    ['-5', -5],
  ])('%j evaluates to %i, truncated toward zero', (input, value) => {
    expect(evalLifeExpression(input)).toBe(value);
  });

  it.each([
    [''],
    ['   '],
    ['abc'],
    ['20+x'],
    ['alert(1)'],
    ['1/0'],
    ['2**'],
    ['()'],
    ['1e3'],
  ])('rejects %j', (input) => {
    expect(evalLifeExpression(input)).toBeNull();
  });
});
