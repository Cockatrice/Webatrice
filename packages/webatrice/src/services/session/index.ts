type SessionEndHandler = () => void;
const handlers = new Set<SessionEndHandler>();
let ending = false;
let generation = 0;

export function sessionGeneration(): number {
  return generation;
}

export function onSessionEnd(handler: SessionEndHandler): () => void {
  const registration = () => handler();
  handlers.add(registration);
  return () => {
    handlers.delete(registration);
  };
}

export function endSession(): void {
  if (ending) {
    return;
  }
  ending = true;
  generation += 1;
  try {
    for (const handler of [...handlers]) {
      if (!handlers.has(handler)) {
        continue;
      }
      try {
        handler();
      } catch (error) {
        console.error('Session cleanup failed:', error);
      }
    }
  } finally {
    ending = false;
  }
}
