'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuth } from '@/components/AuthContext';
import {
  IconChevronLeft,
  IconSend,
  IconUser,
  IconSparkles,
  IconCheck,
  IconChecks,
  IconHeart,
  IconMoodSmile,
  IconInfoCircle,
} from '@tabler/icons-react';
import ChatSkeleton from '@/components/ChatSkeleton';

type Message = { id: string; senderId: string; content: string; sentAt: string };

type MatchPartner = {
  name: string;
  photo?: string;
  userId?: string;
  bio?: string;
};

const ICEBREAKERS = [
  "Hey! What's your favorite weekend activity? ✨",
  "If you could travel anywhere tomorrow, where to? ✈️",
  "Coffee or tea for a first hang out? ☕",
  "What song are you playing on repeat lately? 🎵",
];

export default function ChatPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [partner, setPartner] = useState<MatchPartner | null>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const currentUserId = user?.id || user?.userId;

  useEffect(() => {
    // Fetch match partner details
    api
      .getMatches()
      .then((data) => {
        const matchesList = Array.isArray(data) ? data : data.items || [];
        const currentMatch = matchesList.find((m: any) => m.id === matchId);
        if (currentMatch?.otherUser) {
          setPartner({
            name: currentMatch.otherUser.name || 'Match',
            photo: currentMatch.otherUser.photos?.[0]?.url,
            userId: currentMatch.otherUser.userId || currentMatch.otherUser.id,
            bio: currentMatch.otherUser.bio,
          });
        }
      })
      .catch((err) => console.error('Failed to fetch match details:', err));

    // Fetch chat history with cursor pagination
    api
      .getChatHistory(matchId)
      .then((res) => {
        const items = Array.isArray(res) ? res : res.items || [];
        setMessages(items);
        setNextCursor(res.nextCursor || null);
        setHasMore(Boolean(res.hasMore));
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

  const loadOlderMessages = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const container = chatContainerRef.current;
      const oldScrollHeight = container ? container.scrollHeight : 0;

      const res = await api.getChatHistory(matchId, nextCursor);
      const newItems = Array.isArray(res) ? res : res.items || [];

      setMessages((prev) => [...newItems, ...prev]);
      setNextCursor(res.nextCursor || null);
      setHasMore(Boolean(res.hasMore));

      requestAnimationFrame(() => {
        if (container) {
          container.scrollTop = container.scrollHeight - oldScrollHeight;
        }
      });
    } catch (err) {
      console.error('Failed to load older messages:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!loadingMore && messages.length <= 25) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loadingMore]);

  function sendMessage(contentToSend?: string) {
    const finalMsg = contentToSend || text;
    if (!finalMsg.trim()) return;
    getSocket().emit('sendMessage', { matchId, content: finalMsg });
    if (!contentToSend) setText('');
  }

  const addEmoji = (emoji: string) => {
    setText((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  return (
    <main className="flex flex-col h-[calc(100vh-4rem)] max-w-2xl mx-auto bg-neutral-950 border-x border-neutral-900 shadow-2xl relative">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800/80 bg-neutral-900/80 backdrop-blur-md sticky top-0 z-20 shadow-md">
        <Link
          href="/chat"
          className="p-2 -ml-2 text-neutral-400 hover:text-white rounded-xl hover:bg-neutral-800/60 transition-colors"
          title="Back to conversations"
        >
          <IconChevronLeft size={22} />
        </Link>

        {/* Partner Profile Avatar */}
        <div className="relative w-10 h-10 rounded-full bg-neutral-800 border border-neutral-700 overflow-hidden shrink-0 flex items-center justify-center text-neutral-300 font-semibold shadow">
          {partner?.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={partner.photo} alt={partner.name} className="w-full h-full object-cover" />
          ) : (
            <IconUser size={20} className="text-neutral-400" />
          )}
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-neutral-900 shadow-sm" />
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-white truncate flex items-center gap-1.5">
            <span>{partner?.name || 'Match Chat'}</span>
          </h2>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-emerald-400 font-semibold tracking-wide uppercase">Active Now</span>
          </div>
        </div>

        {partner?.userId && (
          <Link
            href={`/profile`}
            className="p-2 text-neutral-400 hover:text-rose-400 rounded-xl hover:bg-neutral-800/60 transition-colors"
            title="View Match Profile"
          >
            <IconInfoCircle size={20} />
          </Link>
        )}
      </div>

      {/* Messages area */}
      {loading ? (
        <ChatSkeleton />
      ) : messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center overflow-y-auto">
          <div className="p-6 bg-gradient-to-b from-neutral-900/80 to-neutral-900/40 border border-neutral-800/80 rounded-3xl max-w-sm shadow-xl backdrop-blur-sm">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-500/20 to-amber-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-3">
              <IconSparkles size={28} />
            </div>
            <h4 className="text-base font-bold text-white">Matched with {partner?.name || 'your match'}!</h4>
            <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
              You both liked each other. Break the ice with a fun message or pick an icebreaker suggestion below!
            </p>

            <div className="mt-5 space-y-2 text-left">
              <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider block mb-1">
                Icebreakers
              </span>
              {ICEBREAKERS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(prompt)}
                  className="w-full text-left text-xs p-2.5 rounded-xl bg-neutral-800/60 border border-neutral-700/60 text-neutral-200 hover:border-rose-500/50 hover:bg-neutral-800 transition-all flex items-center justify-between group"
                >
                  <span className="truncate pr-2">{prompt}</span>
                  <IconSend size={12} className="text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-3.5">
          {/* Load older messages button if cursor pagination hasMore */}
          {hasMore && (
            <div className="text-center my-2">
              <button
                onClick={loadOlderMessages}
                disabled={loadingMore}
                className="px-3.5 py-1.5 bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-800 text-xs rounded-full shadow-sm transition-all disabled:opacity-50"
              >
                {loadingMore ? 'Loading older messages...' : 'Load older messages'}
              </button>
            </div>
          )}

          {/* Match Banner at top of chat */}
          <div className="text-center my-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-900/60 border border-neutral-800 text-neutral-400 text-[10px] rounded-full">
              <IconHeart size={11} className="text-rose-500 fill-rose-500" />
              Matched with {partner?.name || 'this user'}
            </span>
          </div>

          {messages.map((m, index) => {
            const isMe = currentUserId && m.senderId === currentUserId;
            const showAvatar =
              !isMe &&
              (index === messages.length - 1 || messages[index + 1]?.senderId !== m.senderId);

            return (
              <div
                key={m.id}
                className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'} items-end group`}
              >
                {!isMe && (
                  <div className="w-7 h-7 rounded-full bg-neutral-800 border border-neutral-700 overflow-hidden shrink-0 flex items-center justify-center text-neutral-400 text-xs font-semibold mb-1">
                    {showAvatar && partner?.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={partner.photo} alt={partner.name} className="w-full h-full object-cover" />
                    ) : showAvatar ? (
                      <IconUser size={14} />
                    ) : (
                      <div className="w-7 h-7" />
                    )}
                  </div>
                )}

                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[78%]`}>
                  <div
                    className={`px-4 py-2.5 text-xs sm:text-sm leading-relaxed shadow-md ${
                      isMe
                        ? 'bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 text-white rounded-2xl rounded-tr-xs font-medium'
                        : 'bg-neutral-900 border border-neutral-800 text-neutral-100 rounded-2xl rounded-tl-xs'
                    }`}
                  >
                    {m.content}
                  </div>
                  <div
                    className={`flex items-center gap-1 text-[10px] text-neutral-500 mt-1 px-1 font-medium ${
                      isMe ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <span>
                      {m.sentAt
                        ? new Date(m.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : ''}
                    </span>
                    {isMe && <IconChecks size={15} className="text-rose-400" />}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Quick Emoji Bar when picker open */}
      {showEmojiPicker && (
        <div className="absolute bottom-16 left-4 right-4 bg-neutral-900 border border-neutral-800 rounded-2xl p-3 shadow-2xl flex justify-around text-lg z-30 animate-in fade-in slide-in-from-bottom-2">
          {['❤️', '🔥', '😍', '👋', '😂', '✨', '☕', '🎉'].map((emoji) => (
            <button
              key={emoji}
              onClick={() => addEmoji(emoji)}
              className="hover:scale-125 transition-transform p-1"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Input controls */}
      <div className="border-t border-neutral-800/80 p-3 bg-neutral-900/60 backdrop-blur-md flex items-center gap-2">
        <button
          onClick={() => setShowEmojiPicker((prev) => !prev)}
          className="p-2 text-neutral-400 hover:text-amber-400 rounded-full hover:bg-neutral-800 transition-colors shrink-0"
          title="Add Emoji"
        >
          <IconMoodSmile size={20} />
        </button>

        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder={`Message ${partner?.name || ''}...`}
          className="flex-1 rounded-full bg-neutral-900/90 border border-neutral-800 px-4 py-2.5 text-xs sm:text-sm text-white outline-none focus:border-rose-500/60 transition-colors placeholder:text-neutral-500 shadow-inner"
        />
        <button
          onClick={() => sendMessage()}
          disabled={!text.trim()}
          className="flex items-center justify-center gap-1 rounded-full bg-gradient-to-r from-rose-500 to-amber-500 hover:opacity-95 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-500/20 disabled:opacity-30 transition-all cursor-pointer shrink-0"
        >
          <span className="hidden sm:inline">Send</span>
          <IconSend size={15} />
        </button>
      </div>
    </main>
  );
}

