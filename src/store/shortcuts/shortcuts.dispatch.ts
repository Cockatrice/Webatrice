import { store } from '..';
import { Actions } from './shortcuts.actions';

export const Dispatch = {
  hydrate: (overrides: Record<string, string[]>) => {
    store.dispatch(Actions.hydrate({ overrides }));
  },
  setOverride: (actionId: string, sequences: string[]) => {
    store.dispatch(Actions.setOverride({ actionId, sequences }));
  },
  resetAction: (actionId: string) => {
    store.dispatch(Actions.resetAction({ actionId }));
  },
  resetAll: () => {
    store.dispatch(Actions.resetAll());
  },
  startRecording: (actionId: string) => {
    store.dispatch(Actions.startRecording({ actionId }));
  },
  cancelRecording: () => {
    store.dispatch(Actions.cancelRecording());
  },
  appendCapturedSequence: (sequence: string) => {
    store.dispatch(Actions.appendCapturedSequence({ sequence }));
  },
  removeCapturedSequence: (sequence: string) => {
    store.dispatch(Actions.removeCapturedSequence({ sequence }));
  },
};
