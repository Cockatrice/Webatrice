import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';

import { Button, Message as MessageBubble, Panel, TextInput, useMentionCompleter } from '@app/components';
import { ReportChatScope } from '@app/dialogs';
import { useChatHighlight, useCommandFailureMessage, useReduxEffect, useRoomChatFilter } from '@app/hooks';
import { chatFilterVerdicts, cx, isPrivilegedUser, isRoomMessageVisible, type ChatHighlight } from '@app/utils';
import { rooms, type Message } from '@cockatrice/datatrice';
import type { ServerInfo_User } from '@cockatrice/sockatrice/generated';

import { chatLineTime, isAlertLine, isBlankLine, isChatHistory, isWelcome, roomChatContext } from './roomChatContext';

interface RoomChatProps {
  roomId: number;
  roomName: string;
  messages: Message[] | undefined;
  users: Readonly<Record<string, ServerInfo_User>>;
  onSay: (args: { message: string }) => void;
}

export default function RoomChat(props: RoomChatProps) {
  const { messages: allMessages, users } = props;
  const filter = useRoomChatFilter();
  const messages = useMemo(
    () => allMessages?.filter((m) => !isBlankLine(m) && isRoomMessageVisible(m, users, filter, chatFilterVerdicts)),
    [allMessages, users, filter],
  );
  const getChatContext = useCallback(() => roomChatContext(messages), [messages]);
  return (
    <ReportChatScope getChatContext={getChatContext}>
      <RoomChatView {...props} messages={messages} />
    </ReportChatScope>
  );
}

function RoomChatView({ roomId, roomName, messages, users, onSay }: RoomChatProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState('');
  const userNames = useMemo(() => Object.keys(users), [users]);
  const mention = useMentionCompleter({ names: userNames, value: draft, onValueChange: setDraft, inputRef });

  useReduxEffect<{ roomId: number; message: string }>((action) => {
    if (action.payload.roomId === roomId) {
      setDraft((current) => current || action.payload.message);
    }
  }, rooms.Types.ROOM_SAY_FAILED, [roomId]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) {
      return;
    }
    setDraft('');
    onSay({ message: trimmed });
  };

  return (
    <Panel
      title={(
        <span className="flex items-baseline gap-2">
          {roomName}
          <span className="text-[12px] font-normal text-text-muted">
            <span aria-hidden>· </span>
            {t('RoomChat.subtitle')}
          </span>
        </span>
      )}
      flush
      className="h-full"
      bodyClassName="flex flex-col"
    >
      <RoomTranscript roomName={roomName} messages={messages} users={users} />

      <form onSubmit={send} className="flex shrink-0 gap-2 border-t border-border-subtle p-2">
        <div className="relative min-w-0 flex-1">
          <TextInput
            ref={inputRef}
            icon={null}
            type="text"
            value={draft}
            {...mention.inputProps}
            placeholder={t('RoomChat.input', { room: roomName })}
            aria-label={t('RoomChat.input', { room: roomName })}
          />
          {mention.popup}
        </div>
        <Button
          type="submit"
          variant="primary"
          disabled={!draft.trim()}
          className="w-9 shrink-0 px-0"
          title={t('Common.action.send')}
          aria-label={t('Common.action.send')}
          icon={<Send size={15} aria-hidden />}
        />
      </form>
    </Panel>
  );
}

const RoomTranscript = memo(function RoomTranscript({ roomName, messages, users }: Pick<RoomChatProps, 'roomName' | 'messages' | 'users'>) {
  const { t } = useTranslation();
  const describeFailure = useCommandFailureMessage();
  const highlights = useChatHighlight();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages?.length]);

  return (
    <div
      ref={scrollRef}
      role="log"
      aria-label={t('RoomChat.log', { room: roomName })}
      tabIndex={0}
      className={cx(
        'flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-pad py-2',
        'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
      )}
    >
      {(!messages || messages.length === 0) && (
        <div className="flex h-full items-center justify-center text-[12px] italic text-text-muted">
          {t('RoomChat.empty')}
        </div>
      )}
      {messages?.map((m, idx) => (
        <RoomChatRow
          key={m.id ?? `${m.timeReceived}-${idx}`}
          message={m}
          highlight={isPrivilegedUser(users[m.name]) ? highlights.moderator : highlights.user}
          noticeText={m.notice ? t(`RoomChat.notice.${m.notice}`, { reason: describeFailure(m.failure, '') }) : undefined}
        />
      ))}
    </div>
  );
});

const RoomChatRow = memo(function RoomChatRow({ message: m, highlight, noticeText }: {
  message: Message;
  highlight: ChatHighlight;
  noticeText: string | undefined;
}) {
  if (isWelcome(m)) {
    return (
      <div className="whitespace-pre-line text-[13px] leading-relaxed text-accent">
        <MessageBubble message={m} />
      </div>
    );
  }
  const time = chatLineTime(m);
  return (
    <div
      className={cx(
        'flex items-baseline gap-2 text-[13px] leading-relaxed',
        '[&_a.link]:font-semibold [&_a.link]:text-accent [&_a.link:hover]:underline [&_strong]:mr-1',
        isAlertLine(m, highlight) && '-mx-2 rounded-ui-sm bg-warning/10 px-2',
        isChatHistory(m) ? 'text-text-secondary' : 'text-text-primary',
      )}
    >
      <time dateTime={time.dateTime} title={time.full} className="shrink-0 text-[11px] tabular-nums text-text-muted">
        {time.label}
      </time>
      <div className="min-w-0 flex-1 break-words">
        {m.notice
          ? <div className="italic text-text-muted">{noticeText}</div>
          : <MessageBubble message={m} highlight={highlight} />}
      </div>
    </div>
  );
});
