import { createContext } from 'react';

import { ShortcutRegistration } from '@app/types';
export interface ShortcutContextValue {
  register: (registration: ShortcutRegistration) => () => void;
}

const noopUnregister = () => {};

export const ShortcutContext = createContext<ShortcutContextValue>({
  register: () => noopUnregister,
});
