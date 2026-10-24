import { useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

import { useDialogFocus, useDialogReturnFocus, type ReturnFocusTo } from '@app/hooks';

export interface DialogShellProps {
  isOpen: boolean;
  handleClose?: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
  /** Tailwind max-width class, e.g. "max-w-lg". Defaults to "max-w-md"
   *  so login / small-form dialogs sit around 448px wide. Callers who
   *  want the pre-redo `xs`/`sm`/`md` breakpoints should pass the
   *  matching Tailwind class. */
  maxWidth?: string;
  returnFocusTo?: ReturnFocusTo;
}

const DialogShell = ({
  isOpen,
  handleClose,
  title,
  description,
  children,
  footer,
  className,
  contentClassName,
  maxWidth = 'max-w-md',
  returnFocusTo,
}: DialogShellProps) => {
  const { t } = useTranslation();
  const titleId = useId();
  const descriptionId = useId();
  const inheritedReturnFocusTo = useDialogReturnFocus();
  const { getDialogProps } = useDialogFocus({
    isOpen,
    isolate: true,
    onEscape: handleClose,
    returnFocusTo: returnFocusTo ?? inheritedReturnFocusTo,
  });

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div
      data-modal-layer
      className="fixed inset-0 z-[1300] flex items-center justify-center p-4"
      onSubmit={(e) => e.stopPropagation()}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={handleClose}
      />
      <div
        {...getDialogProps()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={[
          'relative z-10 w-full max-h-[90vh] flex flex-col overflow-hidden focus:outline-none',
          'rounded-xl bg-bg-surface border border-border-subtle shadow-glow',
          maxWidth,
          className ?? '',
        ].join(' ')}
      >
        <header className="shrink-0 flex items-start justify-between gap-3 px-5 py-4 border-b border-border-subtle">
          <div className="min-w-0">
            <h2 id={titleId} className="font-modern text-lg font-semibold text-text-primary">{title}</h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-xs text-text-secondary">{description}</p>
            )}
          </div>
          {handleClose && (
            <button
              type="button"
              onClick={handleClose}
              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
              title={t('Common.action.close')}
              aria-label={t('Common.action.close')}
            >
              <X size={16} />
            </button>
          )}
        </header>
        <div
          data-dialog-content
          className={[
            'flex-1 min-h-0 overflow-y-auto px-5 py-4 text-sm text-text-secondary',
            contentClassName ?? '',
          ].join(' ')}
        >
          {children}
        </div>
        {footer && (
          <footer className="shrink-0 flex items-center justify-end gap-2 px-5 py-3 border-t border-border-subtle">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default DialogShell;
