import { isBuiltinZone, ZoneName } from './zoneNames';

describe('isBuiltinZone', () => {
  it('knows the seven Servatrice zones and nothing else', () => {
    for (const name of Object.values(ZoneName)) {
      expect(isBuiltinZone(name)).toBe(true);
    }
    expect(isBuiltinZone('commandzone')).toBe(false);
    expect(isBuiltinZone('')).toBe(false);
  });
});
