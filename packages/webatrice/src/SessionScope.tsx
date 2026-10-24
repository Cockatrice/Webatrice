import { Fragment, useLayoutEffect, useRef, type ReactNode } from 'react';
import { useStore } from 'react-redux';
import { server } from '@cockatrice/datatrice';
import { useAppSelector, type RootState } from '@app/store';
import { endSession } from '@app/services/session';

export function SessionScope({ children }: { children: ReactNode }) {
  const store = useStore<RootState>();
  const epoch = useAppSelector(server.Selectors.selectSessionEpoch);
  const previousEpoch = useRef(epoch);
  useLayoutEffect(() => {
    const check = () => {
      const next = server.Selectors.selectSessionEpoch(store.getState());
      if (next !== previousEpoch.current) {
        previousEpoch.current = next;
        endSession();
      }
    };
    const unsubscribe = store.subscribe(check);
    check();
    return unsubscribe;
  }, [store]);
  return <Fragment key={epoch}>{children}</Fragment>;
}
