import { useTranslation } from 'react-i18next';
import { server } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';
import { deckColorIdentity } from '../deckPersistence';
import { readDeckTags } from '../deckTags';
import type { UseDeckEditor } from './useDeckEditor';
import { useKnownDeckData } from './useKnownDeckData';

type EditorFrameState = Pick<UseDeckEditor,
  'deck' | 'loading' | 'hydrating' | 'readOnlyReason' | 'totalMainboardCount' | 'totalSideboardCount'>;

export function useDeckEditorFrame(deckId: number | null, editor: EditorFrameState) {
  const known = useKnownDeckData(deckId);
  const connected = useAppSelector(server.Selectors.getIsConnected);
  const { t } = useTranslation();
  const loading = editor.loading && !editor.deck;
  const readOnly = loading || editor.hydrating;
  const readOnlyReason = loading
    ? t(connected ? 'DeckEditor.hydrating' : 'Decks.grid.disconnected') : editor.readOnlyReason;
  const count = known.cardCount;
  const rows = count == null || !Number.isFinite(count) ? 6 : Math.min(12, Math.max(0, Math.ceil(count)));
  return {
    deck: editor.deck ?? known.deck,
    loading,
    readOnly,
    readOnlyReason,
    placeholderRows: loading && connected ? Array.from({ length: rows }, (_, index) => index) : undefined,
    waitingMessage: loading && !connected ? t('Decks.grid.disconnected') : undefined,
    colors: loading || editor.hydrating ? known.colors : editor.deck ? deckColorIdentity(editor.deck.cards) : undefined,
    tags: loading ? known.tags : readDeckTags(editor.deck?.tagsXml),
    totalMainboardCount: loading ? count ?? 0 : editor.totalMainboardCount,
    totalSideboardCount: loading ? 0 : editor.totalSideboardCount,
  };
}
