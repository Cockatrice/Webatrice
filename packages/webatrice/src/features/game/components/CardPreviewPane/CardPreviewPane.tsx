import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronLeft, ChevronUp, ExternalLink, X } from 'lucide-react';

import { CardRelatedLinks, IconButton, ManaSymbols, Segmented, SymbolText } from '@app/components';
import { cx } from '@app/utils';

import { CARD_CORNER_RADIUS } from '../ui/SeatCard/cardSize';
import PreviewCardImage from '../ui/PreviewCardImage/PreviewCardImage';
import { useCardPreviewPane, type PreviewMode } from './useCardPreviewPane';

const MODES: ReadonlyArray<{ mode: PreviewMode; key: string }> = [
  { mode: 'image', key: 'modeImage' },
  { mode: 'text', key: 'modeDescription' },
  { mode: 'both', key: 'modeBoth' },
];

const IMAGE_VH: Record<PreviewMode, number> = { image: 42, both: 28, text: 0 };
const TEXT_VH: Record<PreviewMode, number> = { image: 0, both: 22, text: 42 };
const imageHeight = (mode: PreviewMode) => `min(${IMAGE_VH[mode]}vh, calc(100cqw * 102 / 72))`;

export default function CardPreviewPane() {
  const { t } = useTranslation();
  const pane = useCardPreviewPane();
  const { mode, activeCard, override, hoveredCard, text, detail } = pane;
  const showImage = mode === 'image' || mode === 'both';
  const showText = mode === 'text' || mode === 'both';

  return (
    <section
      aria-label={t('CardPreviewPane.label')}
      data-testid="card-preview-pane"
      className="flex shrink-0 flex-col gap-1.5 border-b border-border-subtle px-2 pb-2 pt-1.5 [container-type:inline-size]"
    >
      <div className="flex h-7 shrink-0 items-center gap-1">
        <h2 className="mr-auto truncate text-[10px] font-semibold uppercase tracking-widest text-text-muted">
          {t('CardPreviewPane.title')}
        </h2>
        <IconButton
          size="sm"
          className="h-6 w-6 board-motion"
          onClick={pane.togglePopup}
          active={pane.isPopupOpen}
          label={pane.isPopupOpen ? t('CardPreviewPane.closePreview') : t('CardPreviewPane.openPreview')}
        >
          {pane.isPopupOpen ? <X size={12} /> : <ExternalLink size={12} />}
        </IconButton>
        <IconButton
          size="sm"
          className="h-6 w-6 board-motion"
          onClick={pane.toggleHidden}
          aria-expanded={!pane.hidden}
          label={pane.hidden ? t('CardPreviewPane.show') : t('CardPreviewPane.hide')}
        >
          {pane.hidden ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        </IconButton>
      </div>
      {!pane.hidden && (
        <Segmented<PreviewMode>
          label={t('CardPreviewPane.modes')}
          value={mode}
          onChange={pane.setMode}
          items={MODES.map(({ mode: m, key }) => ({ value: m, label: t(`CardPreviewPane.${key}`) }))}
          className="board-motion self-start [&>button]:px-2 [&>button]:py-0.5 [&>button]:text-[11px]"
        />
      )}
      {!pane.hidden && (
        <div className="flex min-h-0 flex-col items-center gap-2">
          {pane.isPopupOpen ? (
            <button
              type="button"
              onClick={pane.togglePopup}
              className={cx(
                'flex h-20 w-full flex-col items-center justify-center gap-1 rounded-ui border border-dashed border-accent/40',
                'bg-accent/5 p-2 text-center text-[11px] text-text-muted hover:bg-accent/10 board-motion transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
              )}
              style={{ borderRadius: CARD_CORNER_RADIUS }}
            >
              <ExternalLink size={18} className="text-accent" aria-hidden />
              <span className="italic">{t('CardPreviewPane.previewInWindow')}</span>
              <span className="text-[10px] uppercase tracking-widest text-accent">{t('CardPreviewPane.bringBack')}</span>
            </button>
          ) : (
            <>
              {showImage && (
                pane.imageUrl ? (
                  <PreviewCardImage
                    src={pane.imageUrl}
                    name={activeCard?.name}
                    className="shrink-0 shadow-md"
                    style={{
                      height: imageHeight(mode),
                      aspectRatio: '72 / 102',
                      borderRadius: CARD_CORNER_RADIUS,
                      imageRendering: '-webkit-optimize-contrast',
                    }}
                  />
                ) : (
                  <div
                    className={cx(
                      'flex h-20 w-full shrink-0 items-center justify-center rounded-ui border border-dashed border-border-subtle',
                      'bg-bg-sunken/60 p-2 text-center text-[11px] italic text-text-muted',
                    )}
                  >
                    {t('CardPreviewPane.hoverToPreview')}
                  </div>
                )
              )}
              {showText && (
                activeCard ? (
                  <div
                    className={cx(
                      'flex w-full shrink-0 flex-col gap-1.5 overflow-y-auto',
                      'rounded-ui border border-border-subtle',
                      'bg-bg-sunken/60 p-2 text-[11.5px] text-text-primary',
                    )}
                    style={{ maxHeight: `${TEXT_VH[mode]}vh` }}
                  >
                    {pane.previousInStack && (
                      <button
                        type="button"
                        onClick={pane.back}
                        className={cx(
                          'inline-flex items-center gap-1 self-start text-[11px] font-medium text-text-secondary hover:text-text-primary',
                          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
                        )}
                        title={t('CardPreviewPane.backTo', { name: pane.previousInStack.name })}
                      >
                        <ChevronLeft size={12} aria-hidden />
                        <span className="max-w-[14rem] truncate">{t('CardPreviewPane.backTo', { name: pane.previousInStack.name })}</span>
                      </button>
                    )}
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[13px] font-semibold leading-tight">{text.name}</span>
                      {text.mana && (
                        <span className="shrink-0">
                          <ManaSymbols cost={text.mana} size={14} />
                        </span>
                      )}
                    </div>
                    {text.type && <div className="italic text-text-secondary">{text.type}</div>}
                    {text.oracle && (
                      <div className="whitespace-pre-line leading-snug">
                        <SymbolText text={text.oracle} />
                      </div>
                    )}
                    {text.flavor && (
                      <div className="whitespace-pre-line border-t border-border-subtle pt-1.5 italic leading-snug text-text-muted">
                        {text.flavor}
                      </div>
                    )}
                    {!override && hoveredCard?.annotation && (
                      <div className="italic text-text-secondary">{hoveredCard.annotation}</div>
                    )}
                    {(text.pt || text.loyalty) && (
                      <div className="text-right font-semibold tabular-nums">{text.pt ?? text.loyalty}</div>
                    )}
                    {!override && !text.pt && !text.loyalty && hoveredCard?.pt && (
                      <div className="text-right font-semibold tabular-nums">{hoveredCard.pt}</div>
                    )}
                    {pane.detailFetchState === 'loading' && (
                      <div className="italic text-text-muted">{t('CardPreviewPane.loading')}</div>
                    )}
                    {detail && (
                      <CardRelatedLinks
                        faces={detail.card_faces}
                        allParts={detail.all_parts}
                        parentName={detail.name}
                        parentTypeLine={text.type || detail.type_line}
                        currentFaceName={text.name}
                        onNavigate={pane.navigate}
                      />
                    )}
                  </div>
                ) : (
                  mode === 'text' && (
                    <div
                      className={cx(
                        'flex h-20 w-full shrink-0 items-center justify-center',
                        'rounded-ui border border-dashed border-border-subtle',
                        'bg-bg-sunken/60 p-2 text-center text-[11px] italic text-text-muted',
                      )}
                    >
                      {t('CardPreviewPane.hoverToPreview')}
                    </div>
                  )
                )
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
