import { createContext, useContext, useEffect, useRef } from 'react';

const NEVER_REWOUND = () => 0;

const ReplayRewindContext = createContext<() => number>(NEVER_REWOUND);

export const ReplayRewindProvider = ReplayRewindContext.Provider;

export function useJustRewound(): boolean {
  const rewinds = useContext(ReplayRewindContext)();
  const seen = useRef(rewinds);
  useEffect(() => {
    seen.current = rewinds;
  });
  return rewinds !== seen.current;
}
