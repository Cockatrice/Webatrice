import { useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

import { IconButton } from '@app/components';

import { useDrawerReturnFocus } from './useDrawerReturnFocus';

interface StaffDrawerProps {
  label: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  onClose?: () => void;
  children: ReactNode;
}

export default function StaffDrawer({ label, title, subtitle, actions, onClose, children }: StaffDrawerProps) {
  const { t } = useTranslation();
  const drawerRef = useRef<HTMLElement>(null);
  useDrawerReturnFocus(drawerRef);
  return (
    <aside
      ref={drawerRef}
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && onClose) {
          event.stopPropagation();
          onClose();
        }
      }}
      className="flex w-[420px] shrink-0 flex-col border-l border-border-subtle bg-bg-surface shadow-pop min-[1400px]:w-[500px]"
    >
      <div className="flex items-start gap-2 border-b border-border-subtle px-4 pb-3 pt-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">{title}</div>
          {subtitle && <span className="text-[12px] text-text-muted">{subtitle}</span>}
        </div>
        {onClose && (
          <IconButton size="sm" label={t('Staff.drawer.close')} onClick={onClose}>
            <X size={15} aria-hidden />
          </IconButton>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border-subtle px-4 py-2.5">{actions}</div>
      )}
      <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-4 pb-6 pt-3">{children}</div>
    </aside>
  );
}
