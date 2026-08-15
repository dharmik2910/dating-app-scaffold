'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { IconChevronLeft, IconMessageCircle, IconSend } from '@tabler/icons-react';

type Message = { id: string; senderId: string; content: string; sentAt: string };

export default function ChatPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .getChatHistory(matchId)
      .then((data) => {
        setMessages(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });

    const socket = getSocket();
    socket.emit('joinMatch', matchId);
    socket.on('newMessage', (msg: Message) => setMessages((prev) => [...prev, msg]));

    return () => {
      socket.off('newMessage');
    };
  }, [matchId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function sendMessage() {
    if (!text.trim()) return;
    getSocket().emit('sendMessage', { matchId, content: text });
    setText('');
  }

  return (
    <main className="flex flex-col h-[calc(100vh-4rem)] max-w-2xl mx-auto bg-neutral-950">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800 bg-neutral-900/40">
        <Link
          href="/matches"
          className="p-2 -ml-2 text-neutral-400 hover:text-white rounded-lg transition-colors"
        >
          <IconChevronLeft size={22} />
        </Link>
        <div className="w-9 h-9 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-xs font-semibold text-neutral-300">
          <IconMessageCircle size={18} className="text-ember" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">Match Chat</h2>
          <p className="text-[10px] text-emerald-400 font-medium">Online</p>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-3">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="w-6 h-6 border-2 border-ember border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-neutral-500 text-xs">
            No messages yet. Send a wave or say hi! 👋
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="flex flex-col">
              <div className="max-w-[78%] rounded-2xl bg-neutral-900 border border-neutral-800 px-4 py-2.5 text-sm text-neutral-200 shadow-sm leading-relaxed self-start">
                {m.content}
              </div>
              <span className="text-[10px] text-neutral-600 mt-1 ml-1">
                {m.sentAt
                  ? new Date(m.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : ''}
              </span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input controls */}
      <div className="border-t border-neutral-800 p-4 bg-neutral-900/30 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
          className="flex-1 rounded-full bg-neutral-900 border border-neutral-800 px-4 py-2.5 text-sm text-white outline-none focus:border-ember transition-colors"
        />
        <button
          onClick={sendMessage}
          disabled={!text.trim()}
          className="flex items-center gap-1 rounded-full bg-gradient-to-r from-ember to-rose-600 hover:opacity-95 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-ember/20 disabled:opacity-40 transition-all"
        >
          <span>Send</span>
          <IconSend size={14} />
        </button>
      </div>
    </main>
  );
}


