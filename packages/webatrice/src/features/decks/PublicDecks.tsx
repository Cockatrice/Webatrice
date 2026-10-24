import { useCallback, useMemo } from 'react';
import { generatePath, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, Loader2, RefreshCw } from 'lucide-react';

import { server } from '@cockatrice/datatrice';
import { AuthGuard } from '@app/components';
import { Layout } from '@app/feature-wrappers/layout';
import { useAppSelector } from '@app/store';
import { RouteEnum } from '@app/types';

import { ReadOnlyDeck } from './components/ReadOnlyDeck';
import { listPublicDecks } from './deckFolders';
import { useDeckSharingSupported } from './hooks/useDeckSharing';
import { useImportDeckCopy } from './hooks/useImportDeckCopy';
import { usePublicDecks } from './hooks/useSharedDeck';

function PublicDecks() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { userName = '' } = useParams<{ userName: string }>();
  const supported = useDeckSharingSupported();
  const isConnected = useAppSelector(server.Selectors.getIsConnected);
  const publicDecks = usePublicDecks(supported ? userName : '');
  const decks = useMemo(() => listPublicDecks(publicDecks.root), [publicDecks.root]);

  const openImported = useCallback(
    (deckId: number) => navigate(generatePath(RouteEnum.DECK, { deckId: String(deckId) })),
    [navigate],
  );
  const importCopy = useImportDeckCopy(openImported);
  const { open } = publicDecks;

  return (
    <Layout>
      <AuthGuard />
      <div className="h-full flex flex-col bg-bg-base bg-purple-radial">
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <h1 className="font-modern text-2xl font-semibold text-text-primary">{t('PublicDecks.title', { name: userName })}</h1>
          <button
            type="button"
            onClick={publicDecks.refresh}
            disabled={!isConnected || !supported}
            className={[
              'p-2 rounded-md text-text-secondary hover:text-text-primary',
              'hover:bg-bg-elevated disabled:opacity-40 disabled:cursor-not-allowed transition-colors',
            ].join(' ')}
            title={t('PublicDecks.refresh')}
            aria-label={t('PublicDecks.refresh')}
          >
            <RefreshCw size={16} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
          <div className="max-w-4xl mx-auto space-y-4 text-sm text-text-secondary">
            {publicDecks.listError && <p role="alert" className="text-danger">{publicDecks.listError}</p>}
            {supported && publicDecks.loading && (
              <p role="status" className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> {t('PublicDecks.loading')}
              </p>
            )}
            {!supported && <p role="alert">{t('DeckSharing.notSupported')}</p>}
            {supported && publicDecks.root && decks.length === 0 && <p>{t('PublicDecks.empty')}</p>}
            {decks.length > 0 && (
              <ul className="space-y-2">
                {decks.map((deck) => (
                  <li
                    key={deck.id}
                    className="flex items-center gap-3 rounded-md bg-bg-surface border border-border-subtle px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-text-primary truncate">{deck.name}</div>
                      <div className="text-xs text-text-muted flex gap-2 flex-wrap">
                        {deck.path && <span>{deck.path}</span>}
                        {deck.file.colorIdentity && <span>{deck.file.colorIdentity}</span>}
                        {deck.file.tags.map((tag) => <span key={tag}>{tag}</span>)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => publicDecks.openDeck(deck.id)}
                      disabled={!isConnected || (open.status === 'loading' && open.id === deck.id)}
                      className={[
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium',
                        'text-text-primary bg-bg-elevated border border-border-strong hover:bg-border-subtle',
                        'disabled:opacity-40 disabled:cursor-not-allowed',
                      ].join(' ')}
                      aria-label={t('PublicDecks.openDeckNamed', { name: deck.name })}
                    >
                      <Eye size={13} /> {t('SharedDeck.openDeck')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {open.status === 'failed' && <p role="alert" className="text-danger">{open.message}</p>}
            {open.status === 'open' && (
              <ReadOnlyDeck
                deck={open.opened.deck}
                onImport={isConnected
                  ? () => importCopy(open.opened.xml, decks.find((deck) => deck.id === open.opened.id)?.file.colorIdentity)
                  : undefined}
                onClose={publicDecks.close}
              />
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default PublicDecks;
