import { ReactNode, SyntheticEvent, useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** Same severity levels the pre-redo MUI `Alert` accepted. Callers
 *  passing 'success' / 'info' / 'warning' / 'error' keep working. */
export type ToastSeverity = 'success' | 'info' | 'warning' | 'error';

export interface ToastProps {
  open: boolean;
  onClose: (event?: SyntheticEvent) => void;
  severity?: ToastSeverity;
  autoHideDuration?: number;
  children?: ReactNode;
}

// Severity → icon + accent color. Uses tailwind palette values that
// contrast well against bg-surface without depending on fancy tokens
// so a toast severity feels universal, not theme-specific.
const SEVERITY_ICON: Record<ToastSeverity, LucideIcon> = {
  success: CheckCircle,
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
};
const SEVERITY_COLOR: Record<ToastSeverity, string> = {
  success: 'text-emerald-400',
  info: 'text-sky-400',
  warning: 'text-yellow-400',
  error: 'text-red-400',
};

/**
 * Tailwind toast pill. Replaces the pre-redo MUI Snackbar + Alert +
 * Slide. Callers use it via useToast() from ToastContext — same
 * public hook contract as before (openToast / closeToast).
 *
 * Behavior preserved:
 *   • auto-close after `autoHideDuration` (default 10s)
 *   • click X to close
 *   • severity icon on the left
 *   • slide-in animation from the right on mount
 *
 * Behavior intentionally dropped: MUI's clickaway suppression. On
 * the redo surface, the toast is a portalled pill outside the
 * click target — a clickaway event no longer means "user clicked
 * the toast itself" so the check was moot.
 */
function Toast({
  open,
  onClose,
  severity = 'success',
  autoHideDuration = 10000,
  children,
}: ToastProps) {
  // Delay the slide-in one frame so the initial `translate-x-full`
  // paints first and the transition actually animates. Without this,
  // React commits both classes in the same frame and there's no
  // visible slide.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // Auto-hide timer.
  useEffect(() => {
    if (!open || autoHideDuration <= 0) return;
    const t = window.setTimeout(() => onClose(), autoHideDuration);
    return () => window.clearTimeout(t);
  }, [open, autoHideDuration, onClose]);

  if (!open) return null;

  const Icon = SEVERITY_ICON[severity];
  const iconColor = SEVERITY_COLOR[severity];

  return (
    <div
      role="alert"
      aria-live="polite"
      className={[
        'pointer-events-auto flex items-center gap-3 pl-4 pr-2 py-2.5 rounded-lg',
        'bg-bg-surface border border-border-subtle shadow-glow',
        'text-sm text-text-primary min-w-[240px] max-w-md',
        'transition-transform duration-200 ease-out',
        entered ? 'translate-x-0' : 'translate-x-[calc(100%+2rem)]',
      ].join(' ')}
    >
      <Icon size={18} className={`${iconColor} shrink-0`} />
      <div className="flex-1 min-w-0">{children}</div>
      <button
        type="button"
        onClick={() => onClose()}
        className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors shrink-0"
        title="Dismiss"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default Toast;
