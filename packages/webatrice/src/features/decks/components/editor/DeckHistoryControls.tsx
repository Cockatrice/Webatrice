import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { History, Redo2, Undo2 } from 'lucide-react';

import { IconButton, Menu, MenuItem, MenuSeparator, type MenuAnchor } from '@app/components';

import { deckHistoryRows, type DeckHistory, type DeckHistoryReason } from '../../deckHistory';

export interface DeckHistoryControlsProps {
  history: DeckHistory;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: (steps?: number) => void;
  onRedo: (steps?: number) => void;
}

export function DeckHistoryControls({ history, canUndo, canRedo, onUndo, onRedo }: DeckHistoryControlsProps) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rows = deckHistoryRows(history);

  return (
    <span className="inline-flex items-center gap-1">
      <IconButton size="sm" label={t('DeckHistory.undo')} disabled={!canUndo} onClick={() => onUndo()}>
        <Undo2 size={14} />
      </IconButton>
      <IconButton size="sm" label={t('DeckHistory.redo')} disabled={!canRedo} onClick={() => onRedo()}>
        <Redo2 size={14} />
      </IconButton>
      <IconButton
        ref={triggerRef}
        size="sm"
        label={t('DeckHistory.history')}
        active={anchor != null}
        aria-haspopup="menu"
        aria-expanded={anchor != null}
        disabled={!canUndo && !canRedo}
        onClick={() => setAnchor(anchor
          ? null
          : { rect: triggerRef.current!.getBoundingClientRect(), placement: 'below', align: 'end' })}
      >
        <History size={14} />
      </IconButton>

      {anchor && (
        <Menu
          anchor={anchor}
          label={t('DeckHistory.history')}
          onClose={() => setAnchor(null)}
          triggerRef={triggerRef}
          className="w-[320px]"
        >
          <p className="border-b border-border-subtle px-3 py-1.5 text-xs text-text-muted">{t('DeckHistory.hint')}</p>
          {rows.redo.map((row) => (
            <MenuItem key={`redo-${row.steps}`} onSelect={() => onRedo(row.steps)}>
              <span className="text-text-muted">{t('DeckHistory.redoEntry', { reason: reasonText(row.reason, t) })}</span>
            </MenuItem>
          ))}
          {rows.redo.length > 0 && rows.undo.length > 0 && <MenuSeparator />}
          {rows.undo.map((row) => (
            <MenuItem key={`undo-${row.steps}`} onSelect={() => onUndo(row.steps)}>
              {t('DeckHistory.undoEntry', { reason: reasonText(row.reason, t) })}
            </MenuItem>
          ))}
        </Menu>
      )}
    </span>
  );
}

type Translate = ReturnType<typeof useTranslation>['t'];

export function reasonText(reason: DeckHistoryReason, t: Translate): string {
  const zone = (z: 'main' | 'sideboard') => t(`DeckHistory.zone.${z}`);
  switch (reason.kind) {
    case 'adjustCard':
      return reason.delta > 0
        ? t('DeckHistory.reason.added', { count: reason.delta, name: reason.name })
        : t('DeckHistory.reason.removed', { count: -reason.delta, name: reason.name });
    case 'addCard':
      return t('DeckHistory.reason.addCard', { zone: zone(reason.zone), name: reason.name });
    case 'moveCard':
      return t('DeckHistory.reason.moveCard', { count: reason.count, name: reason.name, zone: zone(reason.zone) });
    default: {
      const { kind, ...values } = reason;
      return t(`DeckHistory.reason.${kind}`, values);
    }
  }
}
