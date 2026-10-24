import type { ReactNode } from 'react';

import { useDialogFocus, useDialogReturnFocus } from '@app/hooks';

export function DialogFocus({ isOpen, children }: { isOpen: boolean; children: ReactNode }) {
  const returnFocusTo = useDialogReturnFocus();
  const { getDialogProps } = useDialogFocus({ isOpen, isolate: true, returnFocusTo });
  const props = getDialogProps();
  return <div {...props} ref={(element) => props.ref(element?.closest<HTMLElement>('[role="dialog"]') ?? null)}>{children}</div>;
}
