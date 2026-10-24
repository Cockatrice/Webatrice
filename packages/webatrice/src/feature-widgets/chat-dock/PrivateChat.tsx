import { memo, useEffect, useRef, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Send } from 'lucide-react';

import { MessageText } from '@app/components';
import { useAppSelector } from '@app/store';
import { cx, isPrivilegedUser, type ChatHighlight } from '@app/utils';

import { server, type PrivateConversationEntry } from '@cockatrice/datatrice';
import { getChatDraft, useChatDraft, useChatHighlight, useCommandFailureMessage, useReduxEffect } from '@app/hooks';

interface PrivateChatProps {
  peerName: string;
  selfName: string | null;
  entries: PrivateConversationEntry[];
  isOnline: boolean;
  isIgnored: boolean;
  onSend: (message: string) => void;
  compact?: boolean;
  inputRef?: Ref<HTMLInputElement>;
}

export default function PrivateChat({ peerName, selfName, entries, isOnline, isIgnored, onSend, compact, inputRef }: PrivateChatProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useChatDraft(peerName);

  useReduxEffect<{ userName: string; message: string }>((action) => {
    if (action.payload.userName === peerName) {
      setDraft(getChatDraft(peerName) || action.payload.message);
    }
  }, server.Types.PRIVATE_MESSAGE_FAILED, [peerName]);

  let blockedReason: string | null = null;
  if (isIgnored) {
    blockedReason = t('PrivateChat.blocked.ignoring', { name: peerName });
  } else if (!isOnline) {
    blockedReason = t('PrivateChat.blocked.offline', { name: peerName });
  }

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || blockedReason) {
      return;
    }
    setDraft('');
    onSend(trimmed);
  };

  return (
    <section className={cx('flex h-full flex-col overflow-hidden bg-bg-surface', !compact && 'rounded-ui-lg border border-border-subtle')}>
      {!compact && <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border-subtle">
        <MessageSquare size={14} className="text-text-muted" />
        <span className="text-sm font-semibold text-text-primary truncate">{peerName}</span>
        <span className="text-xs text-text-muted">
          <span aria-hidden>· </span>
          {t('PrivateChat.subtitle')}
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-text-muted" data-testid="private-chat-presence">
          <span
            aria-hidden
            className={['h-2 w-2 rounded-full', isOnline ? 'bg-success' : 'bg-text-muted'].join(' ')}
          />
          {isOnline ? t('PrivateChat.presence.online') : t('PrivateChat.presence.offline')}
        </span>
      </div>}

      <PrivateTranscript peerName={peerName} selfName={selfName} entries={entries} compact={compact} />

      <div
        role="status"
        className={blockedReason ? 'shrink-0 px-4 py-1.5 text-xs text-text-muted border-t border-border-subtle' : 'sr-only'}
      >
        {blockedReason}
      </div>
      <form
        onSubmit={send}
        className={cx('shrink-0 flex items-center gap-2 border-t border-border-subtle bg-bg-surface', compact ? 'p-1.5' : 'px-3 py-2')}
      >
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('PrivateChat.input', { name: peerName })}
          aria-label={t('PrivateChat.input', { name: peerName })}
          className={cx(
            'w-full min-w-0 flex-1 rounded-ui border border-border-control bg-bg-sunken px-2.5 text-[13px] text-text-primary',
            'placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 transition-colors',
            compact ? 'h-8' : 'h-9',
          )}
        />
        <button
          type="submit"
          disabled={!draft.trim() || blockedReason !== null}
          className={cx(
            'inline-flex shrink-0 items-center justify-center rounded-ui bg-accent text-on-accent hover:bg-accent-hover transition-colors',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            compact ? 'h-8 w-8' : 'h-9 w-9',
          )}
          title={t('Common.action.send')}
          aria-label={t('Common.action.send')}
        >
          <Send size={15} />
        </button>
      </form>
    </section>
  );
}

const PrivateTranscript = memo(function PrivateTranscript({ peerName, selfName, entries, compact }: Pick<
  PrivateChatProps, 'peerName' | 'selfName' | 'entries' | 'compact'
>) {
  const { t } = useTranslation();
  const describeFailure = useCommandFailureMessage();
  const highlights = useChatHighlight();
  const users = useAppSelector(server.Selectors.getUsers);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [entries.length]);

  return (
    <div
      ref={scrollRef}
      role="log"
      aria-label={t('PrivateChat.log', { name: peerName })}
      tabIndex={0}
      className={cx(
        'flex flex-1 min-h-0 flex-col overflow-y-auto',
        'bg-bg-base/40 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
        compact ? 'gap-1 px-3 py-3' : 'gap-1.5 px-4 py-3',
      )}
    >
      {entries.length > 0 && <div className="flex-1" aria-hidden />}
      {entries.length === 0 && (
        <div className="flex flex-1 items-center justify-center text-center text-xs text-text-muted italic">
          {t('PrivateChat.empty')}
        </div>
      )}
      {entries.map((entry, index) => {
        if (entry.type === 'notice') {
          return (
            <div key={`notice-${entry.notice.id}`} className="py-1 text-center text-xs text-text-muted italic">
              {t(`PrivateChat.notice.${entry.notice.kind}`, {
                name: peerName,
                reason: describeFailure(entry.notice.failure, ''),
              })}
            </div>
          );
        }
        return (
          <PrivateMessageRow
            key={`message-${index}`}
            message={entry.message}
            isSelf={selfName != null && entry.message.senderName === selfName}
            compact={compact}
            highlight={isPrivilegedUser(users[entry.message.senderName]) ? highlights.moderator : highlights.user}
          />
        );
      })}
    </div>
  );
});

const PrivateMessageRow = memo(function PrivateMessageRow({ message: m, isSelf, compact, highlight }: {
  message: Extract<PrivateConversationEntry, { type: 'message' }>['message'];
  isSelf: boolean;
  compact: boolean | undefined;
  highlight: ChatHighlight;
}) {
  return (
    <div className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}>
      <div
        className={cx(
          'max-w-[78%] whitespace-pre-wrap break-words rounded-ui border px-3 text-text-primary',
          compact ? 'py-1 text-[12.5px]' : 'py-1.5 text-[13px]',
          isSelf ? 'border-accent/30 bg-accent-soft' : 'border-border-subtle bg-bg-elevated',
        )}
      >
        <span className="sr-only">{`${m.senderName}: `}</span>
        <MessageText text={m.message} highlight={highlight} />
      </div>
    </div>
  );
});
