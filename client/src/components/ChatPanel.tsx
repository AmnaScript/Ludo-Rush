import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { ROOM_LIMITS } from '@ludo-rush/shared';
import { socket } from '../net/socket';
import { playerColor } from '../game/boardLayout';
import { useRoomStore } from '../store/roomStore';

export function ChatPanel({ playerCount, className = '' }: { playerCount: number; className?: string }) {
  const chat = useRoomStore((s) => s.chat);
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [chat]);

  const send = () => {
    const value = text.trim();
    if (!value) return;
    socket.emit('chat:send', { text: value });
    setText('');
  };

  return (
    <section className={`panel flex min-h-0 flex-col p-4 ${className}`}>
      <h2 className="panel-title mb-2">Chat</h2>

      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
        className="min-h-[8rem] flex-1 space-y-1.5 overflow-y-auto pr-1 text-sm font-bold"
      >
        {chat.map((m) =>
          m.type === 'system' ? (
            <p key={m.id} className="rounded-lg bg-[var(--paper-2)] px-2 py-1 text-xs font-extrabold text-[var(--ink-soft)]">
              {m.text}
            </p>
          ) : (
            <p key={m.id} className="break-words">
              <span
                className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle"
                style={{
                  backgroundColor:
                    m.seat !== null && m.seat !== undefined ? playerColor(m.seat, playerCount) : '#9aa8b1',
                }}
              />
              <b>{m.nickname}:</b> {m.text}
            </p>
          ),
        )}
      </div>

      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          value={text}
          maxLength={ROOM_LIMITS.maxChatLength}
          onChange={(e) => setText(e.target.value)}
          placeholder="Say something…"
          aria-label="Chat message"
          className="field min-w-0 flex-1 !py-1.5 text-sm"
        />
        <button
          aria-label="Send message"
          className="btn btn-small !px-3"
        >
          <Send size={16} />
        </button>
      </form>
    </section>
  );
}
