import { disconnect as sessionDisconnect } from '../session';

export function disconnect(): void {
  sessionDisconnect();
}
