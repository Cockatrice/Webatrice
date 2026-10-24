import { memo, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeftRight } from 'lucide-react';

import { DECK_ZONE_MAIN, DECK_ZONE_SIDE } from '@app/types';

import { groupDeckZone, type DeckView, type DeckZone } from './deckViewModel';

interface LobbyDeckViewProps {
  view: DeckView;
  editable: boolean;
  onMoveCard: (zone: DeckZone, cardName: string) => void;
}

function LobbyDeckView({ view, editable, onMoveCard }: LobbyDeckViewProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="lobby-deck-view">
      <DeckZoneColumn zone={DECK_ZONE_MAIN} view={view} editable={editable} onMoveCard={onMoveCard} />
      <DeckZoneColumn zone={DECK_ZONE_SIDE} view={view} editable={editable} onMoveCard={onMoveCard} />
    </div>
  );
}

interface DeckZoneColumnProps extends LobbyDeckViewProps {
  zone: DeckZone;
}

function DeckZoneColumn({ zone, view, editable, onMoveCard }: DeckZoneColumnProps) {
  const { t } = useTranslation();
  const hintId = useId();
  const cards = view[zone];
  const isMain = zone === DECK_ZONE_MAIN;
  const heading = isMain
    ? t('GameLobby.deck.maindeck', { count: cards.length })
    : t('GameLobby.deck.sideboard', { count: cards.length });

  return (
    <section
      aria-label={heading}
      className="rounded-lg bg-bg-surface border border-border-subtle overflow-hidden"
    >
      <h3 className="px-3 py-2 border-b border-border-subtle text-xs font-semibold uppercase tracking-widest text-text-secondary">
        {heading}
      </h3>
      <ul className="max-h-64 overflow-y-auto divide-y divide-border-subtle/50" data-testid={`lobby-deck-${zone}`}>
        {groupDeckZone(cards).map(({ name, count }, index) => {
          const moveLabel = isMain
            ? t('GameLobby.deck.moveToSideboard', { name })
            : t('GameLobby.deck.moveToMaindeck', { name });
          const rowHintId = `${hintId}-${index}`;
          return (
            <li key={name}>
              {editable && <span id={rowHintId} hidden>{moveLabel}</span>}
              <button
                type="button"
                disabled={!editable}
                onClick={() => onMoveCard(zone, name)}
                aria-describedby={editable ? rowHintId : undefined}
                title={editable ? moveLabel : undefined}
                className={[
                  'group w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm text-text-primary',
                  'enabled:hover:bg-bg-elevated disabled:cursor-default board-motion transition-colors',
                ].join(' ')}
              >
                <span className="w-6 shrink-0 text-right tabular-nums text-text-muted">{count}</span>
                {' '}
                <span className="flex-1 min-w-0 truncate">{name}</span>
                {editable && (
                  <ArrowLeftRight size={12} className="shrink-0 text-text-muted opacity-0 group-hover:opacity-100" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default memo(LobbyDeckView);
