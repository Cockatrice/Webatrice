import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface DialogShellProps {
  isOpen: boolean;
  handleClose?: () => void;
  title: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  /** Tailwind max-width class, e.g. "max-w-lg". Defaults to "max-w-md"
   *  so login / small-form dialogs sit around 448px wide. Callers who
   *  want the pre-redo `xs`/`sm`/`md` breakpoints should pass the
   *  matching Tailwind class. */
  maxWidth?: string;
}

/**
 * Reusable Tailwind modal shell. Replaces the pre-redo MUI Dialog +
 * DialogTitle + DialogContent + IconButton wrapper. Backdrop click
 * and Escape close the modal (only when `handleClose` is provided —
 * matching MUI's behavior where an omitted `onClose` prop kept the
 * modal open). Same public prop contract so every existing caller
 * (KnownHostDialog, Registration, Reset flows) keeps working.
 */
const DialogShell = ({
  isOpen,
  handleClose,
  title,
  children,
  className,
  contentClassName,
  maxWidth = 'max-w-md',
}: DialogShellProps) => {
  useEffect(() => {
    if (!isOpen || !handleClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={handleClose}
      />
      <div
        className={[
          'relative z-10 w-full max-h-[90vh] flex flex-col rounded-xl bg-bg-surface border border-border-subtle shadow-glow overflow-hidden',
          maxWidth,
          className ?? '',
        ].join(' ')}
      >
        <header className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <h2 className="font-modern text-lg font-semibold text-text-primary">{title}</h2>
          {handleClose && (
            <button
              type="button"
              onClick={handleClose}
              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
              title="Close"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          )}
        </header>
        <div
          className={[
            'flex-1 min-h-0 overflow-y-auto px-5 py-4 text-sm text-text-secondary',
            contentClassName ?? '',
          ].join(' ')}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default DialogShell;
