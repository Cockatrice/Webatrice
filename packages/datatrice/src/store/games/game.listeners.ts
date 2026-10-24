import type { ListenerMiddlewareInstance } from '@reduxjs/toolkit';

import { registerArrowsListeners } from './game.listeners.arrows';
import { registerCardsListeners } from './game.listeners.cards';
import { registerCountersListeners } from './game.listeners.counters';
import { registerPhasesListeners } from './game.listeners.phases';
import { registerPlayersListeners } from './game.listeners.players';
import { registerZonesListeners } from './game.listeners.zones';

export function registerGameListeners(mw: ListenerMiddlewareInstance<unknown>): void {
  registerZonesListeners(mw);
  registerCardsListeners(mw);
  registerCountersListeners(mw);
  registerArrowsListeners(mw);
  registerPlayersListeners(mw);
  registerPhasesListeners(mw);
}
