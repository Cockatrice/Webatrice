// Spec-isolation shim. The games slice lives in datatrice; specs that build
// their own test-local store reach for the reducer here instead of `@app/store`
// to avoid evaluating `src/store/index.ts` → singleton instantiation.
import { games } from 'datatrice';

export const gamesReducer = games.gamesReducer;
