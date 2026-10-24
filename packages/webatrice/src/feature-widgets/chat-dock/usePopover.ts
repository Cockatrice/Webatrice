import { useCallback, useEffect, useRef, useState } from 'react';

export function usePopover() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((value) => !value), []);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    popoverRef.current?.querySelector<HTMLElement>('button:not(:disabled)')?.focus();
    const inMenu = (target: EventTarget | null) => target instanceof Element && target.closest('[role="menu"]') !== null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !inMenu(event.target)) {
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!popoverRef.current?.contains(target) && !triggerRef.current?.contains(target) && !inMenu(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  return { open, close, toggle, triggerRef, popoverRef };
}
