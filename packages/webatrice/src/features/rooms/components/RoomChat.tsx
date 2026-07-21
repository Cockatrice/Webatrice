import { useEffect, useRef, useState } from 'react';
import { Send, Hash } from 'lucide-react';

import { Message as MessageBubble } from '@app/components';
import type { Message } from '@cockatrice/datatrice';

interface RoomChatProps {
  roomName: string;
  messages: Message[] | undefined;
  onSay: (args: { message: string }) => void;
}

/**
 * Fancy-themed chat panel for the room page. Preserves og's rich
 * message parsing (card callouts, @mentions, URLs, Name: prefix) by
 * delegating each row to the `Message` component. Only chrome + input
 * are new; parsing logic is unchanged.
 */
export default function RoomChat({ roomName, messages, onSay }: RoomChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages?.length]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSay({ message: trimmed });
    setDraft('');
  };

  return (
    <section className="flex h-full flex-col bg-bg-surface border border-border-subtle rounded-lg overflow-hidden">
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border-subtle">
        <Hash size={14} className="text-text-muted" />
        <span className="text-sm font-semibold text-text-primary truncate">{roomName}</span>
        <span className="text-xs text-text-muted">· room chat</span>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-2 space-y-1 bg-bg-base/40">
        {(!messages || messages.length === 0) && (
          <div className="h-full flex items-center justify-center text-xs text-text-muted italic">
            No messages yet — say hi.
          </div>
        )}
        {messages?.map((m, idx) => (
          <div key={`${m.timeReceived}-${idx}`} className="text-sm text-text-secondary [&_a.link]:text-accent [&_a.link]:hover:text-accent-hover [&_strong]:text-text-primary [&_strong]:mr-1">
            <MessageBubble message={m} />
          </div>
        ))}
      </div>

      <form
        onSubmit={send}
        className="shrink-0 flex items-center gap-2 px-3 py-2 border-t border-border-subtle bg-bg-surface"
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Message ${roomName}`}
          className="flex-1 min-w-0 px-3 py-2 rounded-md bg-bg-base border border-border-subtle text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="p-2 rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Send"
          aria-label="Send"
        >
          <Send size={16} />
        </button>
      </form>
    </section>
  );
}
