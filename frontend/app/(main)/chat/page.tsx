'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuth } from '@/components/AuthContext';
import {
  IconMessages,
  IconMessage,
  IconHeartFilled,
  IconSparkles,
  IconUser,
  IconSearch,
  IconFlame,
  IconPlus,
  IconSend,
  IconChecks,
  IconMoodSmile,
  IconHeart,
  IconChevronLeft,
  IconMessageCircle,
} from '@tabler/icons-react';
import ChatListSkeleton from '@/components/ChatListSkeleton';
import ChatSkeleton from '@/components/ChatSkeleton';

type Message = { id: string; senderId: string; content: string; sentAt: string };

type MatchPartner = {
  id: string;
  name: string;
  photo?: string;
  userId?: string;
};

const ICEBREAKERS = [
  "Hey! What's your favorite weekend activity? ✨",
  "If you could travel anywhere tomorrow, where to? ✈️",
  "Coffee or tea for a first hang out? ☕",
  "What song are you playing on repeat lately? 🎵",
];

export default function ConversationsPage() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected match for desktop inline chat view
  const [selectedMatch, setSelectedMatch] = useState<any | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const currentUserId = user?.id || user?.userId;

  useEffect(() => {
    fetchMatches();
  }, []);

  function fetchMatches() {
    setLoading(true);
    api
      .getMatches()
      .then((data) => {
        const matchesList = Array.isArray(data) ? data : data.items || [];
        setMatches(matchesList);
        if (matchesList.length > 0 && !selectedMatch) {
          selectMatchForChat(matchesList[0]);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }

  function selectMatchForChat(match: any) {
    setSelectedMatch(match);
    setChatLoading(true);
    setMessages([]);

    api
      .getChatHistory(match.id)
      .then((data) => {
        const history = Array.isArray(data) ? data : data.items || [];
        setMessages(history);
        setChatLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setChatLoading(false);
      });

    const socket = getSocket();
    socket.emit('joinMatch', match.id);
  }

  useEffect(() => {
    if (!selectedMatch) return;
    const socket = getSocket();
    const handleNewMsg = (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
      // Update last message in matches list
      setMatches((prevMatches) =>
        prevMatches.map((m) =>
          m.id === selectedMatch.id
            ? { ...m, messages: [msg, ...(m.messages || [])] }
            : m
        )
      );
    };

    socket.on('newMessage', handleNewMsg);
    return () => {
      socket.off('newMessage', handleNewMsg);
    };
  }, [selectedMatch]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function sendMessage(contentToSend?: string) {
    if (!selectedMatch) return;
    const finalMsg = contentToSend || text;
    if (!finalMsg.trim()) return;
    getSocket().emit('sendMessage', { matchId: selectedMatch.id, content: finalMsg });
    if (!contentToSend) setText('');
  }

  const addEmoji = (emoji: string) => {
    setText((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  const filteredMatches = matches.filter((m) => {
    const name = m.otherUser?.name || 'Match';
    const lastMsg = m.messages?.[0]?.content || '';
    return (
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lastMsg.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 lg:h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
      {/* Header section */}
      <div className="flex flex-row items-center justify-between pb-3 mb-4 border-b border-neutral-800/80 shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <IconMessages className="text-rose-500 shrink-0" size={26} />
            <span>Messages & Matches</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Connect and chat with your matches in real-time
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="px-3 py-1 bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs font-semibold rounded-full flex items-center gap-1.5 shadow-sm">
            <IconFlame size={14} className="text-rose-500 animate-pulse" />
            {matches.length} {matches.length === 1 ? 'Match' : 'Matches'}
          </span>
        </div>
      </div>

      {loading ? (
        <ChatListSkeleton />
      ) : matches.length === 0 ? (
        <div className="text-center py-20 px-4 bg-neutral-900/40 border border-neutral-800/80 rounded-3xl max-w-md mx-auto shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
            <IconSparkles size={32} />
          </div>
          <h3 className="text-lg font-bold text-white">No Active Chats Yet</h3>
          <p className="text-neutral-400 text-xs mt-1.5 max-w-xs mx-auto mb-6 leading-relaxed">
            Match with intriguing people in Discover to start chatting!
          </p>
          <Link
            href="/discover"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-rose-500 via-rose-600 to-amber-500 font-semibold text-xs px-6 py-3 rounded-full text-white shadow-lg shadow-rose-500/25 hover:scale-[1.02] active:scale-95 transition-all"
          >
            Start Discovering
          </Link>
        </div>
      ) : (
        /* Split Dual-Pane View on Desktop / Laptop (lg+) */
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 overflow-hidden">
          
          {/* LEFT SIDE: Conversations Sidebar & New Matches Stories (lg:col-span-5 or 4) */}
          <div className="lg:col-span-4 flex flex-col h-full bg-neutral-900/40 border border-neutral-800/80 rounded-3xl p-4 overflow-hidden max-w-full">
            
            {/* New Matches Story Row */}
            <div className="space-y-2 mb-4 shrink-0 max-w-full overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                  <IconSparkles size={13} className="text-amber-400" />
                  New Matches
                </span>
                <Link href="/discover" className="text-[10px] font-semibold text-rose-400 hover:text-rose-300">
                  Discover &rarr;
                </Link>
              </div>

              <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar pt-1">
                <Link href="/discover" className="flex flex-col items-center gap-1 shrink-0 group">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-rose-500/20 to-amber-500/20 border-2 border-dashed border-rose-500/50 flex items-center justify-center text-rose-400 group-hover:scale-105 transition-transform">
                    <IconPlus size={18} />
                  </div>
                  <span className="text-[10px] font-medium text-neutral-400">Explore</span>
                </Link>

                {matches.map((m) => (
                  <button
                    key={`story-${m.id}`}
                    onClick={() => selectMatchForChat(m)}
                    className="flex flex-col items-center gap-1 shrink-0 group text-left"
                  >
                    <div className={`relative w-12 h-12 rounded-full p-0.5 transition-all ${
                      selectedMatch?.id === m.id
                        ? 'bg-gradient-to-tr from-rose-500 via-amber-500 to-rose-600 scale-105 shadow-md shadow-rose-950/40'
                        : 'bg-neutral-800 border border-neutral-700 hover:border-rose-500/60'
                    }`}>
                      <div className="w-full h-full rounded-full bg-neutral-900 overflow-hidden flex items-center justify-center">
                        {m.otherUser?.photos?.[0]?.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.otherUser.photos[0].url}
                            alt={m.otherUser.name || 'Match'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <IconUser size={20} className="text-neutral-400" />
                        )}
                      </div>
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-neutral-950" />
                    </div>
                    <span className="text-[10px] font-semibold text-neutral-300 truncate max-w-[56px]">
                      {m.otherUser?.name?.split(' ')[0] || 'Match'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Search Input */}
            <div className="relative mb-3 shrink-0">
              <IconSearch size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500/50 transition-all shadow-inner"
              />
            </div>

            {/* Recent Conversations Scroll List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                Recent Conversations
              </span>

              {filteredMatches.length > 0 ? (
                filteredMatches.map((m) => {
                  const lastMsg = m.messages?.[0];
                  const isSelected = selectedMatch?.id === m.id;

                  return (
                    <div
                      key={m.id}
                      onClick={() => selectMatchForChat(m)}
                      className={`group relative flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all duration-200 border ${
                        isSelected
                          ? 'bg-gradient-to-r from-neutral-900 via-neutral-900 to-rose-950/40 border-rose-500/60 shadow-lg shadow-rose-950/20'
                          : 'bg-neutral-950/40 border-neutral-800/60 hover:border-neutral-700 hover:bg-neutral-900/60'
                      }`}
                    >
                      {/* Avatar */}
                      <div className="relative w-11 h-11 rounded-full bg-neutral-800 border border-neutral-700 overflow-hidden shrink-0 flex items-center justify-center text-neutral-400">
                        {m.otherUser?.photos?.[0]?.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.otherUser.photos[0].url}
                            alt={m.otherUser.name || 'Match'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <IconUser size={20} />
                        )}
                        <div className="absolute bottom-0 right-0 p-0.5 bg-gradient-to-tr from-rose-600 to-amber-500 text-white rounded-full border border-neutral-950">
                          <IconHeartFilled size={7} />
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <h3 className={`font-bold text-xs sm:text-sm truncate ${isSelected ? 'text-rose-400' : 'text-white group-hover:text-rose-300'}`}>
                            {m.otherUser?.name || 'Match'}
                          </h3>
                          {lastMsg?.sentAt && (
                            <span className="text-[10px] text-neutral-500 font-medium shrink-0 ml-1">
                              {new Date(lastMsg.sentAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-400 truncate flex items-center gap-1">
                          <IconMessage size={12} className="text-neutral-500 shrink-0" />
                          <span className={lastMsg?.content ? 'text-neutral-300' : 'text-rose-400/90 italic'}>
                            {lastMsg?.content ?? 'Start the conversation 👋'}
                          </span>
                        </p>
                      </div>

                      {/* Mobile tap navigation link */}
                      <Link
                        href={`/chat/${m.id}`}
                        className="lg:hidden p-1.5 text-neutral-400 hover:text-white"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <IconChevronLeft size={18} className="rotate-180" />
                      </Link>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-neutral-500 text-center py-6">No matching chats</p>
              )}
            </div>
          </div>

          {/* RIGHT SIDE: Inline Live Chat Room for Desktop (lg:col-span-8) */}
          <div className="hidden lg:flex lg:col-span-8 flex-col h-full bg-neutral-950 border border-neutral-800/90 rounded-3xl overflow-hidden shadow-2xl relative">
            {selectedMatch ? (
              <>
                {/* Chat Top Partner Header */}
                <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-neutral-800/80 bg-neutral-900/60 backdrop-blur-md">
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-full bg-neutral-800 border border-neutral-700 overflow-hidden shrink-0 flex items-center justify-center text-neutral-300 font-semibold shadow">
                      {selectedMatch.otherUser?.photos?.[0]?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={selectedMatch.otherUser.photos[0].url}
                          alt={selectedMatch.otherUser.name || 'Match'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <IconUser size={20} className="text-neutral-400" />
                      )}
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-neutral-950" />
                    </div>

                    <div>
                      <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <span>{selectedMatch.otherUser?.name || 'Match'}</span>
                      </h2>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[10px] text-emerald-400 font-semibold tracking-wide uppercase">Active Now</span>
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`/chat/${selectedMatch.id}`}
                    className="text-xs font-semibold text-rose-400 hover:text-rose-300 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded-full transition-colors flex items-center gap-1"
                  >
                    <span>Full Screen</span>
                    <IconMessageCircle size={14} />
                  </Link>
                </div>

                {/* Messages Body */}
                {chatLoading ? (
                  <ChatSkeleton />
                ) : messages.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center overflow-y-auto">
                    <div className="p-6 bg-gradient-to-b from-neutral-900/80 to-neutral-900/40 border border-neutral-800/80 rounded-3xl max-w-sm shadow-xl backdrop-blur-sm">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-500/20 to-amber-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-3">
                        <IconSparkles size={28} />
                      </div>
                      <h4 className="text-base font-bold text-white">Matched with {selectedMatch.otherUser?.name || 'your match'}!</h4>
                      <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
                        Send a message or pick an icebreaker below!
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
                  <div className="flex-1 overflow-y-auto px-5 py-6 space-y-3">
                    <div className="text-center my-1">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-900/60 border border-neutral-800 text-neutral-400 text-[10px] rounded-full">
                        <IconHeart size={11} className="text-rose-500 fill-rose-500" />
                        Matched with {selectedMatch.otherUser?.name || 'this user'}
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
                              {showAvatar && selectedMatch.otherUser?.photos?.[0]?.url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={selectedMatch.otherUser.photos[0].url} alt={selectedMatch.otherUser.name} className="w-full h-full object-cover" />
                              ) : showAvatar ? (
                                <IconUser size={14} />
                              ) : (
                                <div className="w-7 h-7" />
                              )}
                            </div>
                          )}

                          <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[75%]`}>
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
                              {isMe && <IconChecks size={14} className="text-rose-400" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>
                )}

                {/* Quick Emoji Bar */}
                {showEmojiPicker && (
                  <div className="absolute bottom-16 left-4 right-4 bg-neutral-900 border border-neutral-800 rounded-2xl p-2.5 shadow-2xl flex justify-around text-lg z-30 animate-in fade-in slide-in-from-bottom-2">
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

                {/* Input Bar */}
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
                    placeholder={`Message ${selectedMatch.otherUser?.name || ''}...`}
                    className="flex-1 rounded-full bg-neutral-900/90 border border-neutral-800 px-4 py-2 text-xs sm:text-sm text-white outline-none focus:border-rose-500/60 transition-colors placeholder:text-neutral-500 shadow-inner"
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={!text.trim()}
                    className="flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-rose-500 to-amber-500 hover:opacity-95 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-rose-500/20 disabled:opacity-30 transition-all cursor-pointer shrink-0"
                  >
                    <span>Send</span>
                    <IconSend size={14} />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center p-8 text-neutral-500">
                <p className="text-sm">Select a match to start chatting</p>
              </div>
            )}
          </div>

        </div>
      )}
    </main>
  );
}



