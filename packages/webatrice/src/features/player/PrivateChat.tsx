import { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';

import type { Event_UserMessage } from '@cockatrice/sockatrice/generated';

interface PrivateChatProps {
  peerName: string;
  selfName: string | null;
  messages: Event_UserMessage[];
  onSend: (message: string) => void;
}

/**
 * Private-chat panel for the Player page. Renders the full conversation
 * with a single peer as a row of message bubbles (own messages align
 * right, incoming align left) and a composer at the bottom.
 *
 * Wire model: `webClient.request.session.message(name, text)` fires
 * Command_Message; the server broadcasts Event_UserMessage back to
 * both parties, the reducer stores it under the OTHER user's name
 * (see server.reducer.users.ts::userMessage), and this component
 * re-renders from that state — no local optimistic buffer needed.
 */
export default function PrivateChat({ peerName, selfName, messages, onSend }: PrivateChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState('');

  // Auto-scroll to newest message on receive / send. Runs on length
  // change so scroll doesn't fight the user while they're reading
  // history and no new message has arrived.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setDraft('');
  };

  return (
    <section className="flex h-full flex-col bg-bg-surface border border-border-subtle rounded-lg overflow-hidden">
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border-subtle">
        <MessageSquare size={14} className="text-text-muted" />
        <span className="text-sm font-semibold text-text-primary truncate">{peerName}</span>
        <span className="text-xs text-text-muted">· private chat</span>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2 bg-bg-base/40">
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center text-xs text-text-muted italic">
            No messages yet — say hi.
          </div>
        )}
        {messages.map((m, idx) => {
          const isSelf = selfName != null && m.senderName === selfName;
          return (
            <div
              key={`${m.senderName}-${m.receiverName}-${idx}`}
              className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={[
                  'max-w-[75%] px-3 py-1.5 rounded-lg text-sm whitespace-pre-wrap break-words',
                  isSelf
                    ? 'bg-accent/20 text-text-primary border border-accent/30'
                    : 'bg-bg-elevated text-text-primary border border-border-subtle',
                ].join(' ')}
              >
                {m.message}
              </div>
            </div>
          );
        })}
      </div>

      <form
        onSubmit={send}
        className="shrink-0 flex items-center gap-2 px-3 py-2 border-t border-border-subtle bg-bg-surface"
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Message ${peerName}`}
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
