import { type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

import { CHAT_CHIP_WIDTH_PX, CHAT_DOCK_MARGIN_PX, CHAT_WINDOW_WIDTH_PX, useUnreadCounts } from '@app/hooks';

import ChatBar from './ChatBar';
import ChatWindow from './ChatWindow';
import { useChatDockController, useDockFootprint } from './useChatDockController';
import { useDockFocus } from './useDockFocus';

export default function ChatDock() {
  const { t } = useTranslation();
  const { visible, windows, bars, rightInset, placement, focus } = useChatDockController();
  const unread = useUnreadCounts((counts) => counts.chats);
  const { rootRef, registerInput, registerBar, minimise, close } = useDockFocus(windows, bars, focus);
  useDockFootprint(rootRef, rightInset, visible && placement.bottom === 0);

  if (!visible) {
    return null;
  }

  const style = {
    right: rightInset + CHAT_DOCK_MARGIN_PX,
    bottom: placement.bottom,
    maxWidth: Math.max(placement.room, CHAT_WINDOW_WIDTH_PX),
    '--chat-dock-bottom': `${placement.bottom}px`,
  } as CSSProperties;

  return (
    <div
      ref={rootRef}
      role="region"
      aria-label={t('ChatDock.region')}
      style={style}
      className="pointer-events-none fixed z-20 flex items-end justify-end gap-2"
    >
      {bars.length > 0 && (
        <div className="pointer-events-auto flex shrink items-end gap-1.5 overflow-x-auto" style={{ minWidth: CHAT_CHIP_WIDTH_PX }}>
          {bars.map((chat) => (
            <ChatBar
              key={chat.name}
              name={chat.name}
              unread={unread[chat.name] ?? 0}
              registerButton={registerBar}
              onClose={close}
            />
          ))}
        </div>
      )}
      {windows.map((chat) => (
        <ChatWindow
          key={chat.name}
          name={chat.name}
          focusSeq={focus?.name === chat.name ? focus.seq : null}
          registerInput={registerInput}
          onMinimise={minimise}
          onClose={close}
        />
      ))}
    </div>
  );
}
