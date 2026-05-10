/**
 * Keyboard shortcut feature module.
 *
 * Architecture (data flow):
 *   defaults.ts  ──┐
 *                  ├──> ShortcutProvider (window keydown listener)
 *   slice          ──┘   │
 *   (store/shortcuts/)   ├──> registered handlers from useShortcut(...)
 *                        │
 *   useSettings ──────── └──> useShortcutsHydration (Dexie → slice on app start)
 *   (Dexie)              ┌──> useShortcutsPersistence (slice → Dexie on change)
 *                        │
 *   Settings container ──┘   reads catalog + slice; rebinding writes to slice
 *
 * Catalog lives here (types.ts + defaults.ts). Generic registration lives in
 * @app/hooks/useShortcut. Runtime state lives in @app/store/shortcuts (state-only
 * selectors — they don't import the catalog). Persistence is Dexie via SettingDTO,
 * bridged by the feature-layer hooks below.
 *
 * Mount <ShortcutProvider> once inside the Router + Redux Provider; consumers then
 * call `useShortcut('action.id', handler, { scope: ShortcutScope.X })` to subscribe.
 */
export * from './types';
export * from './defaults';
export { ShortcutProvider } from './ShortcutProvider';
export { useResolvedBinding } from './useResolvedBinding';
