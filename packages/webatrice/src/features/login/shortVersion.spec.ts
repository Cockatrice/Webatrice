import { shortVersion } from './shortVersion';

describe('shortVersion', () => {
  test('shortens a commit SHA to seven characters', () => {
    expect(shortVersion('05AB7157139757227EB44E781FED056883E85D46')).toBe('05AB715');
  });

  test('leaves other version strings alone', () => {
    expect(shortVersion('2.10.3')).toBe('2.10.3');
    expect(shortVersion('05ab715')).toBe('05ab715');
  });
});
