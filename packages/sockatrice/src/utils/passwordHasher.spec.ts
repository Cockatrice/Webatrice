vi.mock('../../generated/proto/event_server_identification_pb', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../generated/proto/event_server_identification_pb')>()),
  Event_ServerIdentification_ServerOptions: { SupportsPasswordHash: 1 },
}));

import { hashPassword, generateSalt, passwordSaltSupported } from './passwordHasher';

describe('hashPassword', () => {
  it('returns a string starting with the salt', async () => {
    const result = await hashPassword('mysalt', 'mypassword');
    expect(result.startsWith('mysalt')).toBe(true);
  });

  it('returns the same value for the same inputs (deterministic)', async () => {
    expect(await hashPassword('salt', 'pass')).toBe(await hashPassword('salt', 'pass'));
  });

  it('returns different values for different salts', async () => {
    expect(await hashPassword('salt1', 'pass')).not.toBe(await hashPassword('salt2', 'pass'));
  });

  it('returns different values for different passwords', async () => {
    expect(await hashPassword('salt', 'pass1')).not.toBe(await hashPassword('salt', 'pass2'));
  });

  // Vectors captured from the previous crypto-js implementation prior to the
  // Web Crypto migration. They guarantee byte-for-byte parity with the desktop
  // Cockatrice client (which derives the same hash); a drift here means
  // Servatrice will reject the resulting login.
  describe('byte-parity vectors (do not regenerate without server-side coordination)', () => {
    it.each([
      ['xyz', 'mypass', 'xyzxkpMHfgOZf7oqwHI7ckjmVCjEMgZwjWrsUhzD7OPOsXk98+ILxHCn9bwl93QLLsD10b21dyANoqPNlqTb2f18g=='],
      ['mysalt', 'mypassword', 'mysaltgTmfCaOxqM/IN95RfEtRHd0qIzEcQOfcldQkEsi4Nj6mFRhLgfBkUq89S3hjdv7rbVq1Hs6uN0Ibq38pRbPwrw=='],
      ['salt', 'pass', 'saltlw9WOC1iZfScAlPWjXa/te6rQVhbbPymQler7XRKg17DTn4OvT+aACQaiXg0ncmMLYT7KLD+p1Bktk0IDlcDsQ=='],
      ['pässwörd', 'pässwörd', 'pässwörd2sPAVeLOACTdCfuFjxMlePu6koyvGk4c2FMC82MrCct92S3ir2VbhRTh6Ke7Ow/b2UDFl+38uPEnQgzhJ8C3kQ=='],
    ])('hashPassword(%j, %j) matches the captured vector', async (salt, password, expected) => {
      expect(await hashPassword(salt, password)).toBe(expected);
    });
  });
});

describe('generateSalt', () => {
  it('returns a string of 16 characters', () => {
    expect(generateSalt()).toHaveLength(16);
  });

  it('only contains alphanumeric characters', () => {
    expect(generateSalt()).toMatch(/^[A-Za-z0-9]{16}$/);
  });

  it('returns different values on successive calls (not constant)', () => {
    const salts = new Set(Array.from({ length: 10 }, () => generateSalt()));
    expect(salts.size).toBeGreaterThan(1);
  });
});

describe('passwordSaltSupported', () => {
  it('returns false for NoOptions (0)', () => {
    expect(passwordSaltSupported(0)).toBeFalsy();
  });

  it('returns true when the SupportsPasswordHash bit (1) is set', () => {
    expect(passwordSaltSupported(1)).toBeTruthy();
  });

  it('returns false when an unrelated bit is set (2)', () => {
    expect(passwordSaltSupported(2)).toBeFalsy();
  });

  it('returns true when bit 0 is set alongside other bits (3)', () => {
    expect(passwordSaltSupported(3)).toBeTruthy();
  });
});
