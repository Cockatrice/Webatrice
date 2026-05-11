import { createContext } from 'react';

import { App } from '@app/types';

export interface ShortcutContextValue {
  register: (registration: App.ShortcutRegistration) => () => void;
}

const noopUnregister = () => {};

export const ShortcutContext = createContext<ShortcutContextValue>({
  register: () => noopUnregister,
});
