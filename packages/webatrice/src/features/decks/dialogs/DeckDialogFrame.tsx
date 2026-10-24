import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { useDialogFocus, useDialogReturnFocus } from '@app/hooks';

export interface DeckDialogFrameProps {
  onClose: () => void;
  titleId: string;
  descriptionId?: string;
  role?: 'dialog' | 'alertdialog';
  onEscape?: () => void;
  children: ReactNode;
}

export function DeckDialogFrame({
  onClose,
  titleId,
  descriptionId,
  role = 'dialog',
  onEscape = onClose,
  children,
}: DeckDialogFrameProps) {
  const returnFocusTo = useDialogReturnFocus();
  const { getDialogProps } = useDialogFocus({ isOpen: true, onEscape, returnFocusTo });

  return createPortal(
    <div
      {...getDialogProps()}
      className="fixed inset-0 z-50 flex items-center justify-center px-4 focus:outline-none"
      role={role}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onSubmit={(e) => e.stopPropagation()}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      {children}
    </div>,
    document.body,
  );
}
