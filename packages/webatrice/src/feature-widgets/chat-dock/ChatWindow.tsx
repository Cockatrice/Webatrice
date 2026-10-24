import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Minus, X } from 'lucide-react';

import { server } from '@cockatrice/datatrice';

import { Avatar, IconButton } from '@app/components';
import { ReportChatScope } from '@app/dialogs';
import { useChatVisible, useMarkRead } from '@app/hooks';
import { useAppDispatch } from '@app/store';
import { cx } from '@app/utils';

import { CountryFlag } from './CountryFlag';
import PrivateChat from './PrivateChat';
import ProfileCard from './ProfileCard';
import { usePeer } from './usePeer';
import { usePopover } from './usePopover';

interface ChatWindowProps {
  name: string;
  focusSeq: number | null;
  registerInput: (name: string, el: HTMLInputElement | null) => void;
  onMinimise: (name: string) => void;
  onClose: (name: string) => void;
}

const CARD_GAP_PX = 14;

export default function ChatWindow({ name, focusSeq, registerInput, onMinimise, onClose }: ChatWindowProps) {
  const { t } = useTranslation();
  const peer = usePeer(name);
  const { markChatRead } = useMarkRead();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const cardBoxRef = useRef<HTMLDivElement>(null);
  const [cardInside, setCardInside] = useState(false);
  const profile = usePopover();
  const visible = useChatVisible(name);
  const latest = peer.conversation.at(-1);
  const setInput = useCallback((el: HTMLInputElement | null) => {
    inputRef.current = el;
    registerInput(name, el);
  }, [name, registerInput]);
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(server.Actions.privateChatOpened({ userName: name }));
  }, [dispatch, name]);

  useEffect(() => {
    if (visible) {
      markChatRead(name);
    }
  }, [markChatRead, name, visible, latest]);

  useLayoutEffect(() => {
    const card = cardBoxRef.current;
    const wrapper = wrapperRef.current;
    if (!profile.open || !card || !wrapper) {
      setCardInside(false);
      return;
    }
    setCardInside(card.offsetHeight + CARD_GAP_PX > wrapper.getBoundingClientRect().top);
  }, [profile.open]);

  useEffect(() => {
    if (focusSeq !== null) {
      inputRef.current?.focus();
    }
  }, [focusSeq]);

  const status = peer.isOnline ? t('PrivateChat.presence.online') : t('PrivateChat.presence.offline');

  return (
    <div ref={wrapperRef} className="relative flex w-[300px] shrink-0 flex-col">
      {profile.open && (
        <div
          ref={cardBoxRef}
          className={cx('absolute right-0 z-10 max-h-full overflow-y-auto rounded-ui-lg', cardInside ? 'top-0' : 'bottom-full mb-1.5')}
        >
          <ProfileCard ref={profile.popoverRef} name={name} peer={peer} onDone={profile.close} />
        </div>
      )}
      <section
        aria-label={t('ChatDock.window', { name })}
        className={cx(
          'pointer-events-auto flex flex-col overflow-hidden rounded-t-ui-lg',
          'border border-b-0 border-border-strong bg-bg-surface shadow-pop',
        )}
        style={{ height: 'min(420px, calc(100vh - var(--chat-dock-bottom, 0px) - 140px))' }}
      >
        <header className="flex shrink-0 items-center gap-2 bg-bg-elevated px-2.5 py-2">
          <button
            ref={profile.triggerRef}
            type="button"
            aria-expanded={profile.open}
            aria-haspopup="dialog"
            aria-label={t('ChatDock.showProfile', { name })}
            onClick={profile.toggle}
            className={cx(
              'flex min-w-0 flex-1 items-center gap-2',
              'rounded-ui-sm text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
            )}
          >
            <span className="relative shrink-0">
              <Avatar name={name} size={28} src={peer.avatarUrl ?? undefined} />
              <span
                aria-hidden
                className={cx(
                  'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-bg-elevated',
                  peer.isOnline ? 'bg-success' : 'bg-text-muted',
                )}
              />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-text-primary">
                <span className="truncate">{name}</span>
                <CountryFlag cc={peer.userInfo?.country} />
              </span>
              <span className="block truncate text-[11px] text-text-muted">
                {peer.isABuddy ? `${status} · ${t('ChatDock.buddy')}` : status}
              </span>
            </span>
            <ChevronDown
              size={14}
              aria-hidden
              className={cx('ml-auto shrink-0 text-text-muted transition-transform', profile.open && 'rotate-180')}
            />
          </button>
          <IconButton label={t('ChatDock.minimise', { name })} size="sm" onClick={() => onMinimise(name)}>
            <Minus size={15} />
          </IconButton>
          <IconButton label={t('ChatDock.close', { name })} size="sm" onClick={() => onClose(name)}>
            <X size={15} />
          </IconButton>
        </header>
        <div className="min-h-0 flex-1">
          <ReportChatScope getChatContext={peer.getChatContext}>
            <PrivateChat
              compact
              inputRef={setInput}
              peerName={name}
              selfName={peer.currentUser?.name ?? null}
              entries={peer.conversation}
              isOnline={peer.isOnline}
              isIgnored={peer.isIgnored}
              onSend={peer.onSendMessage}
            />
          </ReportChatScope>
        </div>
      </section>
    </div>
  );
}
