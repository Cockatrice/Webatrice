import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Check, CircleAlert, FolderOpen, Image as ImageIcon, LayoutTemplate, Loader2, MoreHorizontal, Share2, Tag, Upload, Wallpaper,
} from 'lucide-react';

import { Chip, Divider, IconButton, Menu, MenuItem, MenuSeparator, type MenuAnchor } from '@app/components';
import { DialogShell } from '@app/dialogs';
import { RouteEnum } from '@app/types';

import type { BannerCandidate } from '../../deckTags';
import type { SaveState } from '../../hooks/useDeckAutosave';
import type { PriceLookup } from '../../pricing';
import type { HydratedDeck } from '../../types';
import { FormatPicker } from '../FormatPicker';
import { BRACKET_CHIP_TONE } from '../breakdown/BracketSection';
import { DeckBannerPicker } from './DeckBannerPicker';
import { DeckBuyButton } from './DeckBuyButton';
import { DeckOnlineServiceItems } from './DeckOnlineServices';
import { DeckTagsEditor } from './DeckTagsEditor';
import { useOpenDeck, type OpenDeckFlowProps } from './OpenDeckButton';
import { IdentityPips } from '../list/DeckBadges';

export interface DeckEditorHeaderProps {
  deck: HydratedDeck;
  saveState: SaveState;
  onRetrySave: () => void;
  totalMainboardCount: number;
  totalSideboardCount: number;
  tags: readonly string[];
  colors?: string;
  onNameChange: (name: string) => void;
  onFormatChange: (format: string) => void;
  onTagsChange: (tags: string[]) => void;
  onBannerChange: (banner: BannerCandidate | null) => void;
  onEditPlaymat: () => void;
  onExport: () => void;
  onShare?: () => void;
  openDeck: OpenDeckFlowProps;
  history: ReactNode;
  legality: ReactNode;
  prices: PriceLookup;
  pricesLoading: boolean;
  isMtg: boolean;
  bracketLevel?: number;
  trailing?: ReactNode;
  viewControls?: ReactNode;
  onResetLayout?: () => void;
}

export function DeckEditorHeader({
  deck,
  saveState,
  onRetrySave,
  totalMainboardCount,
  totalSideboardCount,
  tags,
  colors,
  onNameChange,
  onFormatChange,
  onTagsChange,
  onBannerChange,
  onEditPlaymat,
  onExport,
  onShare,
  openDeck,
  history,
  legality,
  prices,
  pricesLoading,
  isMtg,
  bracketLevel,
  trailing,
  viewControls,
  onResetLayout,
}: DeckEditorHeaderProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const moreRef = useRef<HTMLButtonElement>(null);
  const [moreAnchor, setMoreAnchor] = useState<MenuAnchor | null>(null);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(false);
  const openDeckFlow = useOpenDeck(openDeck);

  return (
    <header className="flex shrink-0 flex-col gap-2.5 border-b border-border-subtle px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-[14rem] flex-[1_1_16rem] flex-col">
          <span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[12px] text-text-muted">
            <button
              type="button"
              onClick={() => navigate(RouteEnum.DECKS)}
              className={[
                'shrink-0 rounded-ui-sm hover:text-accent',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
              ].join(' ')}
            >
              {t('DeckHeader.myDecks')}
            </button>
            <span aria-hidden>·</span>
            <span className="truncate tabular-nums">
              {t('DeckHeader.cardCount', { count: totalMainboardCount })}
              {totalSideboardCount > 0 && <> · {t('DeckHeader.sideboardCount', { count: totalSideboardCount })}</>}
            </span>
          </span>
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5">
            <input
              type="text"
              value={deck.name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder={t('DeckHeader.namePlaceholder')}
              aria-label={t('DeckHeader.name')}
              className={[
                'min-w-[10rem] flex-1 truncate rounded-ui-sm bg-transparent font-display text-[22px] font-semibold leading-tight',
                'text-text-primary placeholder:text-text-muted focus:bg-bg-elevated focus:outline-none',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
              ].join(' ')}
            />
            <span className="shrink-0 text-[12px]">
              <SaveIndicator state={saveState} onRetry={onRetrySave} />
            </span>
          </div>
        </div>
        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
          {history}
          <Divider vertical />
          <IconButton label={t('DeckHeader.export')} className="border border-border-subtle" onClick={onExport}>
            <Upload size={15} />
          </IconButton>
          {onShare && (
            <IconButton label={t('DeckSharing.shareDeck')} className="border border-border-subtle" onClick={onShare}>
              <Share2 size={15} />
            </IconButton>
          )}
          <IconButton
            ref={moreRef}
            label={t('DeckHeader.more')}
            className="border border-border-subtle"
            aria-haspopup="menu"
            aria-expanded={moreAnchor != null}
            active={moreAnchor != null}
            onClick={() => setMoreAnchor(moreAnchor
              ? null
              : { rect: moreRef.current!.getBoundingClientRect(), placement: 'below', align: 'end' })}
          >
            <MoreHorizontal size={15} />
          </IconButton>
          {isMtg && <DeckBuyButton cards={deck.cards} prices={prices} loading={pricesLoading} />}
          {trailing}
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className="w-44 shrink-0">
          <FormatPicker value={deck.format} onChange={onFormatChange} variant="sidebar" />
        </div>
        {legality}
        {colors != null && <IdentityPips colours={colors} />}
        {bracketLevel != null && (
          <Chip tone={BRACKET_CHIP_TONE[bracketLevel] ?? 'neutral'} title={t('DeckHeader.bracketHint')}>
            {t('DeckBracket.bracket')} {bracketLevel} · {t(`DeckBracket.level.${bracketLevel}`)}
          </Chip>
        )}
        <Divider vertical />
        <IconButton size="sm" label={t('DeckHeader.editTags')} onClick={() => setTagsOpen(true)}>
          <Tag size={13} />
        </IconButton>
        {tags.length > 0 && (
          <ul className="flex min-w-0 shrink items-center gap-1.5 overflow-hidden" aria-label={t('DeckTags.label')}>
            {tags.map((tag) => (
              <li key={tag} className="shrink-0">
                <Chip outline>{tag}</Chip>
              </li>
            ))}
          </ul>
        )}
        {viewControls && <div className="ml-auto flex shrink-0 items-center gap-1">{viewControls}</div>}
      </div>

      {moreAnchor && (
        <Menu
          anchor={moreAnchor}
          label={t('DeckHeader.more')}
          onClose={() => setMoreAnchor(null)}
          triggerRef={moreRef}
          className="w-[260px]"
        >
          {openDeck.deckId != null && (
            <MenuItem icon={<FolderOpen size={13} />} onSelect={openDeckFlow.openPicker}>
              {t('OpenDeckButton.label')}
            </MenuItem>
          )}
          <DeckOnlineServiceItems deck={deck} />
          <MenuSeparator />
          <MenuItem icon={<ImageIcon size={13} />} onSelect={() => setBannerOpen(true)}>
            {t('DeckHeader.bannerCard')}
          </MenuItem>
          <MenuItem icon={<Wallpaper size={13} />} onSelect={onEditPlaymat}>
            {t('DeckHeader.playmat')}
          </MenuItem>
          {onResetLayout && (
            <>
              <MenuSeparator />
              <MenuItem icon={<LayoutTemplate size={13} />} onSelect={onResetLayout}>
                {t('DeckHeader.resetLayout')}
              </MenuItem>
            </>
          )}
        </Menu>
      )}

      {openDeckFlow.dialogs}

      <DialogShell isOpen={tagsOpen} handleClose={() => setTagsOpen(false)} title={t('DeckHeader.editTags')}>
        <DeckTagsEditor tags={tags} onChange={onTagsChange} />
      </DialogShell>

      <DialogShell isOpen={bannerOpen} handleClose={() => setBannerOpen(false)} title={t('DeckHeader.bannerCard')}>
        <DeckBannerPicker
          cards={deck.cards}
          bannerCard={deck.bannerCard}
          bannerCardProviderId={deck.bannerCardProviderId}
          onChange={onBannerChange}
        />
      </DialogShell>
    </header>
  );
}

function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  const { t } = useTranslation();
  switch (state) {
    case 'saving':
      return (
        <span className="inline-flex items-center gap-1 text-text-secondary" role="status">
          <Loader2 size={12} className="animate-spin" aria-hidden /> {t('DeckHeader.saving')}
        </span>
      );
    case 'dirty':
      return <span className="text-warning">{t('DeckHeader.dirty')}</span>;
    case 'saved':
      return (
        <span className="inline-flex items-center gap-1 text-success">
          <Check size={13} aria-hidden /> {t('DeckHeader.saved')}
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1.5 text-danger" role="alert" title={t('DeckHeader.saveFailedHint')}>
          <CircleAlert size={12} /> {t('DeckHeader.saveFailed')}
          <button
            type="button"
            onClick={onRetry}
            className="underline hover:text-danger/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            {t('DeckHeader.retrySave')}
          </button>
        </span>
      );
    default:
      return null;
  }
}
