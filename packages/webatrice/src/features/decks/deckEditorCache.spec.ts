import { endSession } from '@app/services/session';

import {
  clearDeckEditorCache, deleteDraft, getCachedDeck, getCachedDraft, getDraftDocument,
  setCachedDeck, setCachedDraft, setDraftDocument,
} from './deckEditorCache';
import type { HydratedDeck } from './types';

const draft: HydratedDeck = { name: 'Draft', meta: { v: 1, updatedAt: 'x' }, cards: [], format: '' };
const token = 'session-draft';

beforeEach(() => {
  clearDeckEditorCache();
  deleteDraft(token);
});
afterEach(() => {
  clearDeckEditorCache();
  deleteDraft(token);
});

describe('deck editor session cache', () => {
  it('clears both the draft document and hydrated draft at session end', () => {
    setDraftDocument(token, '<cockatrice_deck/>');
    setCachedDraft(token, draft);
    expect(getDraftDocument(token)).toBe('<cockatrice_deck/>');
    expect(getCachedDraft(token)).toBe(draft);

    endSession();

    expect.soft(getDraftDocument(token)).toBeUndefined();
    expect.soft(getCachedDraft(token)).toBeUndefined();
  });

  it('clears stored decks at session end but preserves drafts during list refresh', () => {
    setCachedDeck(1, { deck: draft, savedSignature: null });
    setDraftDocument(token, '<cockatrice_deck/>');
    setCachedDraft(token, draft);

    clearDeckEditorCache();

    expect(getCachedDeck(1)).toBeUndefined();
    expect(getDraftDocument(token)).toBe('<cockatrice_deck/>');
    expect(getCachedDraft(token)).toBe(draft);

    setCachedDeck(1, { deck: draft, savedSignature: null });
    endSession();
    expect(getCachedDeck(1)).toBeUndefined();
  });
});
