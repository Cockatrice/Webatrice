let inFlight = false;
const listeners = new Set<() => void>();

export const autoLoginGate = {
  hasChecked: false,
  target: null as string | null,
  source: null as 'boot' | 'page' | null,
  get inFlight() {
    return inFlight;
  },
  set inFlight(value: boolean) {
    if (value !== inFlight) {
      inFlight = value;
      listeners.forEach(listener => listener());
    }
  },
  getInFlight: () => inFlight,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
