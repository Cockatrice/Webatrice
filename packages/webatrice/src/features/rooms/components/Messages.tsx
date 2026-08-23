import { memo } from 'react';
import { Message } from '@app/components';
import { Message as MessageData } from '@cockatrice/datatrice';
import './Messages.css';

interface MessagesProps {
  messages?: MessageData[];
}

// Variable-height chat rows can't use fixed-height virtualization; memoize rows
// instead (see webatrice.instructions.md § Virtualized lists) and key on the
// store-assigned `message.id`, not the array index (see rooms.reducer.inline.ts).
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
