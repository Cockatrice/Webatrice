import {
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { useTranslation } from 'react-i18next';

import { useListboxCombobox, usePreference, type ListboxComboboxInputProps } from '@app/hooks';

import { applyMention, findMentionQuery, matchMentions, type MentionQuery } from './mentionQuery';

const VISIBLE_ROWS = 5;
const MAX_MATCHES = 50;

export interface MentionCompleterOptions {
  names: readonly string[];
  value: string;
  onValueChange: (value: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}

export interface MentionCompleter {
  inputProps: Partial<ListboxComboboxInputProps> & {
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
    onSelect?: () => void;
    onBlur?: () => void;
  };
  popup: ReactNode;
}

const sameQuery = (a: MentionQuery | null, b: MentionQuery | null) =>
  a?.start === b?.start && a?.prefix === b?.prefix;

export function useMentionCompleter({ names, value, onValueChange, inputRef }: MentionCompleterOptions): MentionCompleter {
  const { t } = useTranslation();
  const enabled = usePreference('chatMentionCompleter');
  const [query, setQuery] = useState<MentionQuery | null>(null);
  const [active, setActive] = useState(0);
  const pendingCaret = useRef<number | null>(null);

  const matches = enabled && query ? matchMentions(names, query.prefix, MAX_MATCHES) : [];
  const open = matches.length > 0;
  const activeIndex = Math.min(active, matches.length - 1);

  useLayoutEffect(() => {
    if (pendingCaret.current !== null) {
      inputRef.current?.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [value, inputRef]);

  const follow = (input: HTMLInputElement) => {
    const next = findMentionQuery(input.value, input.selectionStart ?? input.value.length);
    if (!sameQuery(next, query)) {
      setQuery(next);
      setActive(0);
    }
  };

  const accept = (index: number) => {
    const input = inputRef.current;
    if (!query || !input) {
      return;
    }
    const result = applyMention(value, query, input.selectionStart ?? value.length, matches[index]);
    pendingCaret.current = result.caret;
    setQuery(null);
    onValueChange(result.text);
  };

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    onValueChange(event.target.value);
    if (enabled) {
      follow(event.target);
    }
  };

  const { listboxId, inputProps, getOptionProps } = useListboxCombobox({
    count: matches.length,
    open,
    highlight: activeIndex,
    onHighlightChange: setActive,
    onAccept: accept,
    onClose: () => setQuery(null),
    acceptOnTab: true,
  });

  if (!enabled) {
    return { inputProps: { onChange }, popup: null };
  }

  return {
    inputProps: {
      ...inputProps,
      onChange,
      onSelect: () => inputRef.current && follow(inputRef.current),
      onBlur: () => setQuery(null),
    },
    popup: (
      <ul
        id={listboxId}
        role="listbox"
        hidden={!open}
        aria-label={t('MentionCompleter.label')}
        className={[
          'absolute bottom-full left-0 z-20 mb-1 w-full max-w-xs overflow-y-auto',
          'rounded-md border border-border-subtle bg-bg-elevated py-1 text-sm shadow-lg',
        ].join(' ')}
        style={{ maxHeight: `${VISIBLE_ROWS * 1.75 + 0.5}rem` }}
      >
        {matches.map((name, index) => {
          const option = getOptionProps(index);
          return (
            <li
              key={name}
              {...option}
              className={[
                'h-7 cursor-pointer truncate px-3 leading-7',
                option['aria-selected'] ? 'bg-accent text-on-accent' : 'text-text-primary hover:bg-bg-base',
              ].join(' ')}
            >
              @{name}
            </li>
          );
        })}
      </ul>
    ),
  };
}
