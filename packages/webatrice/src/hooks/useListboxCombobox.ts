import { useEffect, useId, useRef, type KeyboardEvent, type MouseEvent, type RefObject } from 'react';

export interface ListboxComboboxOptions {
  count: number;
  open: boolean;
  highlight: number;
  onHighlightChange: (index: number) => void;
  onAccept: (index: number) => void;
  onClose: () => void;
  popupShown?: boolean;
  onOpen?: () => void;
  onEnterWithoutOption?: () => void;
  onEscapeClosed?: () => void;
  acceptOnTab?: boolean;
  highlightOnHover?: boolean;
}

export interface ListboxComboboxInputProps {
  role: 'combobox';
  'aria-autocomplete': 'list';
  'aria-expanded': boolean;
  'aria-controls': string;
  'aria-activedescendant': string | undefined;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}

export interface ListboxComboboxOptionProps {
  id: string;
  role: 'option';
  'aria-selected': boolean;
  ref: RefObject<HTMLLIElement | null> | undefined;
  onMouseEnter: (() => void) | undefined;
  onMouseDown: (event: MouseEvent) => void;
  onClick: () => void;
}

export interface ListboxCombobox {
  listboxId: string;
  inputProps: ListboxComboboxInputProps;
  getOptionProps: (index: number) => ListboxComboboxOptionProps;
}

export function useListboxCombobox({
  count,
  open,
  highlight,
  onHighlightChange,
  onAccept,
  onClose,
  popupShown,
  onOpen,
  onEnterWithoutOption,
  onEscapeClosed,
  acceptOnTab = false,
  highlightOnHover = false,
}: ListboxComboboxOptions): ListboxCombobox {
  const listboxId = useId();
  const activeOption = useRef<HTMLLIElement>(null);
  const expanded = open && count > 0;
  const active = expanded && highlight >= 0 && highlight < count ? highlight : -1;
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  useEffect(() => {
    activeOption.current?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) {
      return;
    }
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        const down = event.key === 'ArrowDown';
        if (expanded) {
          onHighlightChange(down
            ? (active + 1) % count
            : active < 0 ? count - 1 : (active - 1 + count) % count);
        } else if (onOpen) {
          onOpen();
          if (count > 0 && (!down || highlight < 0 || highlight >= count)) {
            onHighlightChange(down ? 0 : count - 1);
          }
        } else {
          return;
        }
        break;
      }
      case 'Enter':
        if (active >= 0) {
          onAccept(active);
        } else if (onEnterWithoutOption) {
          onEnterWithoutOption();
        } else {
          return;
        }
        break;
      case 'Tab':
        if (acceptOnTab && active >= 0 && !event.shiftKey) {
          onAccept(active);
        }
        return;
      case 'Escape':
        if (expanded || popupShown) {
          onClose();
        } else if (onEscapeClosed) {
          onEscapeClosed();
        } else {
          return;
        }
        event.stopPropagation();
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  return {
    listboxId,
    inputProps: {
      role: 'combobox',
      'aria-autocomplete': 'list',
      'aria-expanded': expanded,
      'aria-controls': listboxId,
      'aria-activedescendant': active >= 0 ? optionId(active) : undefined,
      onKeyDown,
    },
    getOptionProps: (index) => ({
      id: optionId(index),
      role: 'option',
      'aria-selected': index === active,
      ref: index === active ? activeOption : undefined,
      onMouseEnter: highlightOnHover ? () => onHighlightChange(index) : undefined,
      onMouseDown: (event) => event.preventDefault(),
      onClick: () => onAccept(index),
    }),
  };
}
