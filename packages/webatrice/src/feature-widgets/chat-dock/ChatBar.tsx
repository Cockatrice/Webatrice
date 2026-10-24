import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

import { server } from '@cockatrice/datatrice';
import { Avatar } from '@app/components';
import { currentMaxExpandedChats, dispatchChatDock } from '@app/hooks';
import { useAppSelector } from '@app/store';
import { cx } from '@app/utils';

interface ChatBarProps {
  name: string;
  unread: number;
  registerButton: (name: string, el: HTMLButtonElement | null) => void;
  onClose: (name: string) => void;
}

export default function ChatBar({ name, unread, registerButton, onClose }: ChatBarProps) {
  const { t } = useTranslation();
  const online = useAppSelector((state) => server.Selectors.getIsUserOnline(state, name));

  return (
    <div
      className={cx(
        'pointer-events-auto flex h-10 w-40 shrink-0 items-center',
        'rounded-t-ui-lg border border-b-0 border-border-strong bg-bg-elevated shadow-pop',
      )}
    >
      <button
        ref={(el) => registerButton(name, el)}
        type="button"
        aria-label={unread > 0 ? t('ChatDock.openUnread', { name, count: unread }) : t('ChatDock.open', { name })}
        onClick={() => dispatchChatDock({ type: 'expand', name, max: currentMaxExpandedChats() })}
        className={cx(
          'flex h-full min-w-0 flex-1 items-center gap-2',
          'rounded-t-ui-lg pl-2.5 pr-1',
          'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
        )}
      >
        <span className="relative shrink-0">
          <Avatar name={name} size={24} />
          <span
            aria-hidden
            className={cx(
              'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-bg-elevated',
              online ? 'bg-success' : 'bg-text-muted',
            )}
          />
        </span>
        <span className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold text-text-primary">{name}</span>
        {unread > 0 && (
          <span
            aria-hidden
            className={cx(
              'inline-flex h-[18px] min-w-[18px] items-center justify-center',
              'rounded-full bg-accent px-1 text-[10px] font-bold text-on-accent',
            )}
          >
            {unread}
          </span>
        )}
      </button>
      <button
        type="button"
        aria-label={t('ChatDock.close', { name })}
        onClick={() => onClose(name)}
        className={cx(
          'mr-1 inline-flex h-7 w-7 shrink-0 items-center justify-center',
          'rounded-ui-sm text-text-muted hover:bg-bg-surface hover:text-text-primary',
          'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
        )}
      >
        <X size={13} />
      </button>
    </div>
  );
}
