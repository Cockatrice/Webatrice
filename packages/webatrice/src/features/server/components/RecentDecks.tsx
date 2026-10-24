import { FileUp, Layers, Library, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { generatePath, useNavigate } from 'react-router-dom';

import { server } from '@cockatrice/datatrice';
import { Button, Chip, ColorPips } from '@app/components';
import { useRecentDecks } from '@app/hooks';
import { recentDeckArtUrl, type RecentDeck } from '@app/services';
import { useAppSelector } from '@app/store';
import { RouteEnum } from '@app/types';
import { useDeckEditorRoutePrefetch } from '../../../RoutePrefetch';

import { deckFormatLabel, liveRecentDecks, serverDeckCount } from '../homeModel';
import HomeEmpty from './HomeEmpty';
import SectionHead from './SectionHead';

export const RECENT_DECKS_SHOWN = 4;

function DeckTile({ deck, onOpen, onPrefetch }: {
  deck: RecentDeck;
  onOpen: (deckId: number) => void;
  onPrefetch: () => void;
}) {
  const { t } = useTranslation();
  const art = recentDeckArtUrl(deck);
  const format = deck.format ? deckFormatLabel(deck.format, t) : null;
  return (
    <li className="flex min-w-0">
      <button
        type="button"
        onClick={() => onOpen(deck.deckId)}
        onFocus={onPrefetch}
        onPointerEnter={onPrefetch}
        className={[
          'group flex w-full min-w-0 flex-col overflow-hidden rounded-ui-lg border border-border-subtle bg-bg-surface text-left',
          'shadow-panel hover:border-accent/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
        ].join(' ')}
      >
        <span className="relative block h-[92px] w-full overflow-hidden bg-bg-sunken">
          {art && <img src={art} alt="" draggable={false} className="h-full w-full object-cover" />}
          {format && (
            <span className="absolute left-2 top-2">
              <Chip className="bg-bg-base/80 text-text-primary backdrop-blur-sm">{format}</Chip>
            </span>
          )}
        </span>
        <span className="flex w-full min-w-0 flex-col gap-1 px-3 py-2.5">
          <span className="truncate text-[13.5px] font-semibold text-text-primary">{deck.name}</span>
          <span className="flex items-center gap-2 text-[11.5px] text-text-muted">
            {deck.colors && <ColorPips colors={[...deck.colors]} />}
            <span>{t('RecentDecks.cards', { count: deck.cardCount })}</span>
            {deck.bracketLevel != null && <span>{t('RecentDecks.bracket', { level: deck.bracketLevel })}</span>}
          </span>
        </span>
      </button>
    </li>
  );
}

function RecentDecksEmpty({ savedDecks }: { savedDecks: number }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const openDecks = (open?: 'create' | 'migrate') => navigate(RouteEnum.DECKS, open ? { state: { open } } : undefined);
  const newDeck = (
    <Button size="sm" icon={<Plus size={14} aria-hidden />} onClick={() => openDecks('create')}>
      {t('RecentDecks.newDeck')}
    </Button>
  );
  if (savedDecks > 0) {
    return (
      <HomeEmpty
        icon={<Layers size={17} />}
        actions={(
          <>
            <Button size="sm" variant="primary" icon={<Library size={14} aria-hidden />} onClick={() => openDecks()}>
              {t('RecentDecks.openDecks')}
            </Button>
            {newDeck}
          </>
        )}
      >
        {t('RecentDecks.emptySaved', { count: savedDecks })}
      </HomeEmpty>
    );
  }
  return (
    <HomeEmpty
      icon={<Layers size={17} />}
      actions={(
        <>
          <Button size="sm" variant="primary" icon={<FileUp size={14} aria-hidden />} onClick={() => openDecks('migrate')}>
            {t('RecentDecks.importDeck')}
          </Button>
          {newDeck}
        </>
      )}
    >
      {t('RecentDecks.empty')}
    </HomeEmpty>
  );
}

export default function RecentDecks() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const prefetchDeckEditor = useDeckEditorRoutePrefetch();
  const recent = useRecentDecks();
  const tree = useAppSelector(server.Selectors.getBackendDecks);
  const decks = liveRecentDecks(recent, tree?.root).slice(0, RECENT_DECKS_SHOWN);
  const openDeck = (deckId: number) => navigate(generatePath(RouteEnum.DECK, { deckId: String(deckId) }));

  return (
    <section className="flex shrink-0 flex-col gap-2.5" aria-labelledby="home-recent-decks">
      <SectionHead
        id="home-recent-decks"
        title={t('RecentDecks.title')}
        count={decks.length > 0 ? t('RecentDecks.where') : undefined}
        action={decks.length > 0 && (
          <Button size="sm" variant="ghost" icon={<Library size={14} aria-hidden />} onClick={() => navigate(RouteEnum.DECKS)}>
            {t('RecentDecks.allDecks')}
          </Button>
        )}
      />
      {decks.length === 0 ? (
        <RecentDecksEmpty savedDecks={serverDeckCount(tree?.root)} />
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-gap">
          {decks.map((deck) => (
            <DeckTile key={deck.deckId} deck={deck} onOpen={openDeck} onPrefetch={prefetchDeckEditor} />
          ))}
          <li className="flex min-h-[150px] min-w-0">
            <button
              type="button"
              onClick={() => navigate(RouteEnum.DECKS, { state: { open: 'create' } })}
              className={[
                'flex w-full flex-col items-center justify-center gap-2 rounded-ui-lg border border-dashed border-border-strong px-3',
                'text-[13px] font-medium text-text-secondary hover:border-accent/60 hover:text-accent',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
              ].join(' ')}
            >
              <Plus size={20} aria-hidden />
              {t('RecentDecks.newDeck')}
            </button>
          </li>
        </ul>
      )}
    </section>
  );
}
