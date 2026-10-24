import { handleBeforeUnload, hasUnloadRisk, setUnloadRisk } from './unloadGuard';

it('allows reloads until real unsaved work is registered', () => {
  const risk = {};
  const clean = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
  handleBeforeUnload(clean);
  expect(clean.defaultPrevented).toBe(false);

  setUnloadRisk(risk, true);
  const dirty = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
  handleBeforeUnload(dirty);
  expect(dirty.defaultPrevented).toBe(true);
  expect(hasUnloadRisk()).toBe(true);

  setUnloadRisk(risk, false);
  expect(hasUnloadRisk()).toBe(false);
});
