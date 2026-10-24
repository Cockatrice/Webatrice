import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';

import { SectionLabel } from '@app/components';
import { useImageCandidates } from '@app/hooks';
import { imageCandidatesOf, type PrintingSummary } from '@app/services';
import { cx } from '@app/utils';

import type { PriceLookup } from '../../pricing';
import { artCropUrl } from './dockModel';

function PrintingArt({ printing, cardName }: { printing: PrintingSummary; cardName: string }) {
  const candidates = imageCandidatesOf(printing)
    .map(artCropUrl)
    .filter((url): url is string => Boolean(url));
  const { src, onError } = useImageCandidates(candidates);
  return src ? (
    <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" draggable={false} onError={onError} />
  ) : (
    <span className="flex h-full items-center justify-center px-1 text-center text-[10px] text-text-muted">{cardName}</span>
  );
}

export function PrintingStrip({
  cardName,
  printings,
  loading,
  prices,
  chosen,
  onChoose,
}: {
  cardName: string;
  printings: readonly PrintingSummary[];
  loading: boolean;
  prices: PriceLookup;
  chosen: string | undefined;
  onChoose: (scryfallId: string | undefined) => void;
}) {
  const { t } = useTranslation();
  return (
    <section
      className="shrink-0 border-t border-border-subtle bg-bg-surface px-pad pb-3 pt-2.5"
      aria-label={t('CardSearchDock.printings.label', { name: cardName })}
    >
      <div className="mb-2 flex items-baseline gap-2">
        <SectionLabel>{t('CardSearchDock.printings.title')}</SectionLabel>
        <span className="min-w-0 truncate text-[12px] text-text-secondary">{cardName}</span>
        {!loading && printings.length > 0 && (
          <span className="ml-auto shrink-0 text-[11.5px] tabular-nums text-text-muted">
            {t('CardSearchDock.printings.count', { count: printings.length })}
          </span>
        )}
      </div>
      {loading ? (
        <p className="flex h-[88px] items-center gap-2 text-[12px] text-text-muted">
          <Loader2 size={13} className="animate-spin" aria-hidden /> {t('CardSearchDock.printings.loading')}
        </p>
      ) : printings.length === 0 ? (
        <p className="flex h-[88px] items-center text-[12px] text-text-muted">{t('CardSearchDock.printings.empty')}</p>
      ) : (
        <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {printings.map((p, i) => {
            const isChosen = p.scryfallId != null && p.scryfallId === chosen;
            const usd = p.scryfallId ? prices.byId.get(p.scryfallId)?.usd : undefined;
            const set = p.set?.toUpperCase() ?? '?';
            return (
              <li key={p.scryfallId ?? `${p.set}-${p.collectorNumber}-${i}`} className="w-[88px] shrink-0">
                <button
                  type="button"
                  aria-pressed={isChosen}
                  disabled={!p.scryfallId}
                  onClick={() => onChoose(isChosen ? undefined : p.scryfallId)}
                  title={t('CardSearchDock.printings.choose', { set, number: p.collectorNumber ?? '' })}
                  className={cx(
                    'flex w-full flex-col gap-1 rounded-ui border p-1.5 text-left',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
                    isChosen ? 'border-accent bg-accent/10' : 'border-border-subtle hover:bg-bg-elevated',
                  )}
                >
                  <span className="relative block h-[44px] overflow-hidden rounded-ui-sm bg-bg-sunken">
                    <PrintingArt printing={p} cardName={cardName} />
                    {isChosen && (
                      <span className="absolute left-1 top-1 rounded-full bg-accent px-1.5 text-[10px] font-semibold text-on-accent">
                        {t('CardSearchDock.printings.chosen')}
                      </span>
                    )}
                  </span>
                  <span className="flex flex-col whitespace-nowrap text-[11px] leading-tight">
                    <span className="truncate font-semibold text-text-primary">
                      {set}
                      {p.collectorNumber ? ` #${p.collectorNumber}` : ''}
                    </span>
                    <span className={cx('tabular-nums', usd != null ? 'text-success' : 'text-text-muted')}>
                      {usd != null ? `$${usd.toFixed(2)}` : t('CardSearchDock.noPrice')}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
