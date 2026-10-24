import { server } from '@cockatrice/datatrice';
import type { RootState } from '@app/store';
import { setUnloadRisk } from '../../services/unloadGuard';

interface ActionEnvelope {
  type: string;
  payload?: { requestId?: string };
  count: number;
}

type SessionStore = {
  getState: () => RootState;
  subscribe: (listener: () => void) => () => void;
};

export function trackDeckImport(store: SessionStore, requestId: string): () => void {
  const risk = {};
  const initialState = store.getState();
  const initialEpoch = server.Selectors.selectSessionEpoch(initialState);
  let lastActionCount = (initialState as RootState & { action?: ActionEnvelope }).action?.count ?? -1;
  let active = true;
  let unsubscribe = () => {};

  const stop = () => {
    if (!active) {
      return;
    }
    active = false;
    unsubscribe();
    setUnloadRisk(risk, false);
  };
  const check = () => {
    const state = store.getState();
    if (server.Selectors.selectSessionEpoch(state) !== initialEpoch) {
      stop();
      return;
    }
    const action = (state as RootState & { action?: ActionEnvelope }).action;
    if (!action || action.count === lastActionCount) {
      return;
    }
    lastActionCount = action.count;
    if ((action.type === server.Types.DECK_UPLOAD || action.type === server.Types.DECK_UPLOAD_FAILED)
      && action.payload?.requestId === requestId) {
      stop();
    }
  };

  setUnloadRisk(risk, true);
  unsubscribe = store.subscribe(check);
  check();
  return stop;
}
