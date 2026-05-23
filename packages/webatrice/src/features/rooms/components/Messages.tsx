import { Message } from '@app/components';
import { Message as MessageData } from '@cockatrice/datatrice';
import './Messages.css';

interface MessagesProps {
  messages?: MessageData[];
}

const Messages = ({ messages }: MessagesProps) => (
  <div className="messages">
    {
      messages && messages.map((message, idx) => (
        <div className="message-wrapper" key={`${message.timeReceived}-${idx}`}>
          <Message message={message} />
        </div>
      ))
    }
  </div>
);

export default Messages;
