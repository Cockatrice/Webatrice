import { Event_ServerIdentification_ServerOptions } from '../generated';

const HASH_ROUNDS = 1_000;
const SALT_LENGTH = 16;

export const hashPassword = async (salt: string, password: string): Promise<string> => {
  let bytes: Uint8Array<ArrayBuffer> = new TextEncoder().encode(salt + password);
  for (let i = 0; i < HASH_ROUNDS; i++) {
    bytes = new Uint8Array(await crypto.subtle.digest('SHA-512', bytes));
  }

  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return salt + btoa(binary);
};

export const generateSalt = (): string => {
  const characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

  const bytes = new Uint8Array(SALT_LENGTH);
  crypto.getRandomValues(bytes);

  let salt = '';
  for (let i = 0; i < SALT_LENGTH; i++) {
    salt += characters.charAt(bytes[i] % characters.length);
  }

  return salt;
};

export const passwordSaltSupported = (serverOptions: number): boolean => {
  // Servatrice ServerOptions is a bitmask. See .github/instructions/sockatrice.instructions.md#protocol-version-and-feature-flags.
  return (serverOptions & Event_ServerIdentification_ServerOptions.SupportsPasswordHash) !== 0;
};
