import { memo } from 'react';
import { Message } from '@app/components';
import { Message as MessageData } from '@cockatrice/datatrice';
import './Messages.css';

interface MessagesProps {
  messages?: MessageData[];
}

// Chat rows wrap to variable heights, so fixed-height virtualization doesn't
// fit and every message must stay reachable in scrollback. The per-append
// cost is bounded instead by memoizing rows (existing entries skip re-render).
// Keying on the stable store-assigned `message.id` — not the array index —
// keeps those keys stable across the head-trim at MAX_ROOM_MESSAGES.
const MemoMessage = memo(Message);

const Messages = ({ messages }: MessagesProps) => (
  <div className="messages">
    {
      messages && messages.map((message) => (
        <div className="message-wrapper" key={message.id}>
          <MemoMessage message={message} />
        </div>
      ))
    }
  </div>
);

export default Messages;
