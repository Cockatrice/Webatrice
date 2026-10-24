import { onSessionEnd } from '@app/services/session';

const staged = new Map<string, string>();
onSessionEnd(() => staged.clear());
let nextToken = 0;

export function stageDeckDocument(cod: string): string {
  nextToken += 1;
  const token = `${Date.now().toString(36)}-${nextToken}`;
  staged.set(token, cod);
  return token;
}

export function takeStagedDeck(token: string): string | undefined {
  const cod = staged.get(token);
  staged.delete(token);
  return cod;
}
