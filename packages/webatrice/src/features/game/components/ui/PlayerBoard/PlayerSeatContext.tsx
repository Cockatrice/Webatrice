import { createRequiredContext } from '../createRequiredContext';
import type { PlayerSeat } from './usePlayerSeat';

export const [PlayerSeatProvider, usePlayerSeatContext] = createRequiredContext<PlayerSeat>('PlayerSeatContext');
