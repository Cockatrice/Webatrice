import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Download,
  FileText,
  FolderInput,
  Globe,
  ImageIcon,
  MoreHorizontal,
  Pencil,
  Share2,
  Tag,
  Trash2,
} from 'lucide-react';

import { IconButton, Menu, MenuItem, MenuSeparator, type MenuRect } from '@app/components';

import type { DeckStorageEditKind } from '../../deckStorageEdits';
import type { FlatDeck } from '../../deckTree';

export type { DeckStorageEditKind } from '../../deckStorageEdits';

export interface DeckActions {
  onOpen: () => void;
  onEdit?: (kind: DeckStorageEditKind) => void;
  editDisabledReason?: string;
  onShare?: () => void;
  onTogglePublic?: () => void;
  onMove?: () => void;
  onDownload?: () => void;
  onDelete: () => void;
}

export function DeckActionsMenu({ deck, actions, onOpenChange }: {
  deck: FlatDeck;
  actions: DeckActions;
  onOpenChange?: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [rect, setRect] = useState<MenuRect | null>(null);
  const setOpen = (next: MenuRect | null) => {
    setRect(next);
    onOpenChange?.(next != null);
  };
  const { onEdit, editDisabledReason } = actions;
  const editProps = (kind: DeckStorageEditKind) => ({
    onSelect: () => onEdit?.(kind),
    disabled: editDisabledReason != null,
    disabledReason: editDisabledReason,
  });
  const tagsProps = editProps('tags');
  const bannerProps = editProps('banner');
  const renameProps = editProps('rename');
  return (
    <>
      <IconButton
        ref={triggerRef}
        size="sm"
        label={t('DeckActionsMenu.more', { name: deck.name })}
        aria-haspopup="menu"
        aria-expanded={rect != null}
        className={rect ? 'bg-accent/15 text-accent' : undefined}
        onClick={(e) => {
          if (rect) {
            setOpen(null);
            return;
          }
          const box = e.currentTarget.getBoundingClientRect();
          setOpen({ left: box.left, top: box.top, right: box.right, bottom: box.bottom });
        }}
      >
        <MoreHorizontal size={15} />
      </IconButton>
      {rect && (
        <Menu
          anchor={{ rect, placement: 'below', align: 'end' }}
          label={t('DeckActionsMenu.label', { name: deck.name })}
          triggerRef={triggerRef}
          onClose={() => setOpen(null)}
          className="w-56"
        >
          <MenuItem icon={<FileText size={14} />} onSelect={actions.onOpen}>{t('DeckActionsMenu.open')}</MenuItem>
          {actions.onShare && (
            <MenuItem icon={<Share2 size={14} />} onSelect={actions.onShare}>{t('DeckActionsMenu.share')}</MenuItem>
          )}
          {actions.onTogglePublic && (
            <MenuItem icon={<Globe size={14} />} onSelect={actions.onTogglePublic}>
              {t(deck.visibility === 'public' ? 'DeckActionsMenu.makePrivate' : 'DeckActionsMenu.makePublic')}
            </MenuItem>
          )}
          {onEdit && (
            <>
              <MenuItem icon={<Tag size={14} />} {...tagsProps}>{t('DeckActionsMenu.editTags')}</MenuItem>
              <MenuItem icon={<ImageIcon size={14} />} {...bannerProps}>{t('DeckActionsMenu.setBanner')}</MenuItem>
              <MenuItem icon={<Pencil size={14} />} {...renameProps}>{t('DeckActionsMenu.rename')}</MenuItem>
            </>
          )}
          {actions.onMove && (
            <MenuItem icon={<FolderInput size={14} />} onSelect={actions.onMove}>{t('DeckActionsMenu.move')}</MenuItem>
          )}
          {actions.onDownload && (
            <MenuItem icon={<Download size={14} />} onSelect={actions.onDownload}>{t('DeckActionsMenu.download')}</MenuItem>
          )}
          <MenuSeparator />
          <MenuItem icon={<Trash2 size={14} className="text-danger" />} onSelect={actions.onDelete}>
            <span className="text-danger">{t('DeckActionsMenu.delete')}</span>
          </MenuItem>
        </Menu>
      )}
    </>
  );
}
