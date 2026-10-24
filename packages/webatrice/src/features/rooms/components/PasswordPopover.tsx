import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@app/components';

import { AnchoredPopover, type PopoverAnchor } from './AnchoredPopover';

export interface PasswordPopoverProps {
  anchor: PopoverAnchor;
  fallback?: HTMLElement | null;
  focusFallback?: HTMLElement | null;
  layoutKey?: unknown;
  gameName: string;
  spectating: boolean;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}

export default function PasswordPopover({
  anchor,
  fallback,
  focusFallback,
  layoutKey,
  gameName,
  spectating,
  onSubmit,
  onCancel,
}: PasswordPopoverProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const inputId = useId();

  return (
    <AnchoredPopover
      anchor={anchor}
      fallback={fallback}
      focusFallback={focusFallback}
      layoutKey={layoutKey}
      label={t('PasswordPopover.label', { game: gameName })}
      onClose={onCancel}
      align="end"
      className="w-[280px]"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(password);
        }}
      >
        <label htmlFor={inputId} className="block text-[12px] font-medium text-text-secondary">
          {t('PasswordPopover.label', { game: gameName })}
        </label>
        <input
          id={inputId}
          type="password"
          data-autofocus
          autoComplete="off"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={[
            'mt-1.5 h-9 w-full rounded-ui border border-border-control bg-bg-sunken px-2.5 text-[13px] text-text-primary',
            'focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25',
          ].join(' ')}
        />
        <div className="mt-2.5 flex justify-end gap-2">
          <Button size="sm" variant="quiet" onClick={onCancel}>
            {t('Common.action.cancel')}
          </Button>
          <Button size="sm" variant="primary" type="submit">
            {spectating ? t('GamesList.action.spectate') : t('Common.action.join')}
          </Button>
        </div>
      </form>
    </AnchoredPopover>
  );
}
