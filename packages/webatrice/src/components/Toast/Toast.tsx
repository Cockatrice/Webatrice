import { ReactNode, SyntheticEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cx } from '@app/utils';

import { Button, IconButton } from '../ds';

export type ToastSeverity = 'success' | 'info' | 'warning' | 'error';

export interface ToastActionButton {
  label: string;
  onSelect: () => void;
}

export const TOAST_DURATION = 6000;

export interface ToastProps {
  open: boolean;
  onClose: (event?: SyntheticEvent) => void;
  severity?: ToastSeverity;
  autoHideDuration?: number;
  children?: ReactNode;
  icon?: LucideIcon;
  lead?: ReactNode;
  action?: ToastActionButton;
  onFocusChange?: (focused: boolean) => void;
}

const SEVERITY_ICON: Record<ToastSeverity, LucideIcon> = {
  success: CheckCircle,
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
};
const SEVERITY_COLOR: Record<ToastSeverity, string> = {
  success: 'text-success',
  info: 'text-info',
  warning: 'text-warning',
  error: 'text-danger',
};

function Toast({
  open,
  onClose,
  severity = 'success',
  autoHideDuration = TOAST_DURATION,
  children,
  icon,
  lead,
  action,
  onFocusChange,
}: ToastProps) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;
  const remaining = useRef(autoHideDuration);
  useEffect(() => {
    remaining.current = autoHideDuration;
  }, [open, autoHideDuration]);
  useEffect(() => {
    if (!open || paused || autoHideDuration <= 0) {
      return;
    }
    const started = Date.now();
    const timer = window.setTimeout(() => onClose(), Math.max(0, remaining.current));
    return () => {
      window.clearTimeout(timer);
      remaining.current -= Date.now() - started;
    };
  }, [open, paused, autoHideDuration, onClose]);

  if (!open) {
    return null;
  }

  const Icon = icon ?? SEVERITY_ICON[severity];

  return (
    <div
      data-testid="toast"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => {
        setFocused(true);
        onFocusChange?.(true);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setFocused(false);
          onFocusChange?.(false);
        }
      }}
      className={cx(
        'pointer-events-auto flex min-h-[50px] w-[400px] max-w-[calc(100vw-2rem)] items-center gap-2.5',
        'rounded-ui-lg border border-border-strong bg-bg-surface py-1.5 pl-2.5 pr-1.5 shadow-pop',
        'text-[13px] text-text-primary motion-safe:transition-[transform,opacity] motion-safe:duration-200 ease-out',
        entered ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0',
      )}
    >
      {lead ?? (
        <span className="inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center" aria-hidden>
          <Icon size={18} className={SEVERITY_COLOR[severity]} />
        </span>
      )}
      <div className="min-w-0 flex-1">{children}</div>
      {action && (
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            action.onSelect();
            onClose();
          }}
        >
          {action.label}
        </Button>
      )}
      <IconButton label={t('Common.action.dismiss')} size="sm" onClick={() => onClose()}>
        <X size={14} />
      </IconButton>
    </div>
  );
}

export default Toast;
