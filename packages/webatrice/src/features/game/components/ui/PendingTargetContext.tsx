import { createRequiredContext } from './createRequiredContext';
import type { PendingTargetPicker } from '../../hooks/usePendingTarget';

export const [PendingTargetProvider, usePendingTargetContext] =
  createRequiredContext<PendingTargetPicker>('PendingTargetContext');
