import { useEffect, useState } from 'react';

const nowSeconds = () => Math.floor(Date.now() / 1000);

export function useNowSeconds(intervalMs = 30_000): number {
  const [now, setNow] = useState(nowSeconds);
  useEffect(() => {
    const id = window.setInterval(() => setNow(nowSeconds()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
