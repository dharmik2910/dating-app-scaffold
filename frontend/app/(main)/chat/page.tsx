'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuth } from '@/components/AuthContext';
import { useChatStore } from '@/lib/useChatStore';
import { usePresenceStore, formatUserActivity } from '@/lib/usePresenceStore';
import {
  IconMessages,
  IconMessage,
  IconSparkles,
  IconUser,
  IconSearch,
  IconFlame,
  IconPlus,
  IconSend,
  IconCheck,
  IconChecks,
  IconMoodSmile,
  IconHeart,
  IconChevronLeft,
  IconMessageCircle,
  IconTrash,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import ChatListSkeleton from '@/components/ChatListSkeleton';
import ChatSkeleton from '@/components/ChatSkeleton';
import StoryViewerModal from '@/components/stories/StoryViewerModal';
import { StoryUserGroup } from '@/components/stories/StoriesBar';

type Message = {
  id: string;
  senderId: string;
  content: string;
  sentAt: string;
  readAt?: string | null;
  matchId?: string;
};

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
  const router = useRouter();
  const { user } = useAuth();
  const unreadMatchIds = useChatStore((state) => state.unreadMatchIds);
  const clearUnreadMatch = useChatStore((state) => state.clearUnreadMatch);
  const onlineUserIds = usePresenceStore((state) => state.onlineUserIds);
  const lastActiveMap = usePresenceStore((state) => state.lastActiveMap);
  const setPresenceList = usePresenceStore((state) => state.setPresenceList);

  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Stories integration in chat
  const [storyGroups, setStoryGroups] = useState<StoryUserGroup[]>([]);
  const [activeStoryIdx, setActiveStoryIdx] = useState<number | null>(null);

  // Selected match for desktop inline chat view
  const [selectedMatch, setSelectedMatch] = useState<any | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const currentUserId = user?.id || user?.userId;

  useEffect(() => {
    fetchMatches();
    fetchStories();

    // Listen to real-time stories updates & incoming messages for other conversations
    const socket = getSocket();
    const handleStoryUpdate = () => {
      fetchStories();
    };

    const handleChatNotification = (data: {
      matchId: string;
      messageId: string;
      senderId: string;
      content: string;
      sentAt: string;
    }) => {
      if (!data?.matchId) return;
      const newMsg = {
        id: data.messageId,
        matchId: data.matchId,
        senderId: data.senderId,
        content: data.content,
        sentAt: data.sentAt,
      };
      setMatches((prevMatches) => {
        const matchIndex = prevMatches.findIndex((m) => m.id === data.matchId);
        if (matchIndex === -1) {
          fetchMatches();
          return prevMatches;
        }
        const targetMatch = {
          ...prevMatches[matchIndex],
          messages: [newMsg, ...(prevMatches[matchIndex].messages || []).filter((old: any) => old.id !== data.messageId)],
        };
        const rest = prevMatches.filter((_, idx) => idx !== matchIndex);
        return [targetMatch, ...rest];
      });
    };

    socket.on('storyCreated', handleStoryUpdate);
    socket.on('storyDeleted', handleStoryUpdate);
    socket.on('storyViewed', handleStoryUpdate);
    socket.on('chatNotification', handleChatNotification);

    return () => {
      socket.off('storyCreated', handleStoryUpdate);
      socket.off('storyDeleted', handleStoryUpdate);
      socket.off('storyViewed', handleStoryUpdate);
      socket.off('chatNotification', handleChatNotification);
    };
  }, []);

  function fetchStories() {
    api
      .getStoriesFeed()
      .then((data) => {
        setStoryGroups(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error('Failed to load stories feed in chat:', err);
      });
  }

  function fetchMatches() {
    setLoading(true);
    api
      .getConversations()
      .then((data) => {
        const matchesList = Array.isArray(data) ? data : data.items || [];
        setMatches(matchesList);
        if (matchesList.length > 0 && !selectedMatch) {
          selectMatchForChat(matchesList[0]);
        }
        setLoading(false);

        // Query initial live presence for all matches
        const otherUserIds = matchesList
          .map((m: any) => m.otherUser?.id)
          .filter(Boolean);
        if (otherUserIds.length > 0) {
          const socket = getSocket();
          socket.emit('queryPresence', otherUserIds, (response: any[]) => {
            if (Array.isArray(response)) {
              setPresenceList(response);
            }
          });
        }
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }

  function handleMatchClick(match: any) {
    clearUnreadMatch(match.id);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      router.push(`/chat/${match.id}`);
    } else {
      selectMatchForChat(match);
    }
  }

  function selectMatchForChat(match: any) {
    clearUnreadMatch(match.id);
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
  }

  useEffect(() => {
    if (!selectedMatch) return;
    const socket = getSocket();
    const currentMatchId = selectedMatch.id;

    socket.emit('joinMatch', currentMatchId);
    socket.emit('markAsRead', currentMatchId);

    const handleNewMsg = (msg: any) => {
      // Strictly verify that message belongs to this selected active conversation
      if (!msg?.matchId || msg.matchId === currentMatchId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        // Auto-mark incoming message as read if chat is actively open
        if (msg.senderId !== currentUserId) {
          socket.emit('markAsRead', currentMatchId);
        }
      }

      // Update recent preview in sidebar only for the match this message belongs to
      if (msg?.matchId) {
        setMatches((prevMatches) =>
          prevMatches.map((m) =>
            m.id === msg.matchId
              ? {
                ...m,
                messages: [msg, ...(m.messages || []).filter((old: any) => old.id !== msg.id)],
              }
              : m
          )
        );
      }
    };

    const handleMessagesRead = (data: { matchId: string; readerId: string; readAt: string }) => {
      if (data?.matchId === currentMatchId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.senderId !== data.readerId && !msg.readAt
              ? { ...msg, readAt: data.readAt }
              : msg
          )
        );
      }
    };

    const handleChatCleared = (data: { matchId: string }) => {
      if (data?.matchId === currentMatchId) {
        setMessages([]);
        setMatches((prev) =>
          prev.map((m) => (m.id === currentMatchId ? { ...m, messages: [] } : m))
        );
      }
    };

    socket.on('newMessage', handleNewMsg);
    socket.on('messagesRead', handleMessagesRead);
    socket.on('chatCleared', handleChatCleared);

    return () => {
      socket.emit('leaveMatch', currentMatchId);
      socket.off('newMessage', handleNewMsg);
      socket.off('messagesRead', handleMessagesRead);
      socket.off('chatCleared', handleChatCleared);
    };
  }, [selectedMatch, currentUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleClearChat() {
    if (!selectedMatch) return;
    try {
      setIsClearing(true);
      await api.clearChat(selectedMatch.id);
      setMessages([]);
      setMatches((prev) =>
        prev.map((m) => (m.id === selectedMatch.id ? { ...m, messages: [] } : m))
      );
      setShowClearConfirm(false);
      toast.success('Chat history cleared');
    } catch (err) {
      console.error('Failed to clear chat:', err);
      toast.error('Failed to clear chat');
    } finally {
      setIsClearing(false);
    }
  }

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

  const filteredMatches = matches
    .filter((m) => {
      const name = m.otherUser?.name || 'Match';
      const lastMsg = m.messages?.[0]?.content || '';
      return (
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lastMsg.toLowerCase().includes(searchQuery.toLowerCase())
      );
    })
    .sort((a, b) => {
      const aTime = a.messages?.[0]?.sentAt
        ? new Date(a.messages[0].sentAt).getTime()
        : new Date(a.matchedAt || 0).getTime();
      const bTime = b.messages?.[0]?.sentAt
        ? new Date(b.messages[0].sentAt).getTime()
        : new Date(b.matchedAt || 0).getTime();
      return bTime - aTime;
    });

  return (
    <main className="w-full px-4 sm:px-8 py-4 min-h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
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

          {/* LEFT SIDE: Conversations Sidebar (lg:col-span-5 or 4) */}
          <div className="lg:col-span-4 flex flex-col h-full bg-neutral-900/40 border border-neutral-800/80 rounded-3xl p-4 overflow-hidden max-w-full">
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
                  const isUnread = unreadMatchIds.includes(m.id);

                  return (
                    <div
                      key={m.id}
                      onClick={() => handleMatchClick(m)}
                      className={`group relative flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all duration-200 border ${
                        isSelected
                          ? 'bg-gradient-to-r from-neutral-900 via-neutral-900 to-rose-950/30 border-rose-500/70 shadow-lg shadow-rose-950/20'
                          : 'bg-neutral-950/40 border-neutral-800/60 hover:border-neutral-700 hover:bg-neutral-900/60'
                      }`}
                    >
                      {/* Avatar */}
                      <div className="relative w-11 h-11 rounded-full shrink-0 flex items-center justify-center">
                        <div className="w-full h-full rounded-full bg-neutral-900 border border-neutral-700/80 overflow-hidden flex items-center justify-center text-neutral-400">
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
                        </div>
                        {/* Status dot if online */}
                        {onlineUserIds.includes(m.otherUser?.id) && (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-neutral-950 shadow-sm" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <h3 className={`text-xs sm:text-sm truncate ${isUnread ? 'font-black text-white' : isSelected ? 'font-bold text-white' : 'font-medium text-neutral-200 group-hover:text-white'
                            }`}>
                            {m.otherUser?.name || 'Match'}
                          </h3>
                          {lastMsg?.sentAt && (
                            <span className={`text-[10px] shrink-0 ml-1 ${isUnread ? 'text-rose-500 font-bold' : 'text-neutral-500 font-normal'}`}>
                              {new Date(lastMsg.sentAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-[11px] truncate flex items-center gap-1 ${isUnread ? 'text-neutral-100 font-semibold' : 'text-neutral-400'
                            }`}>
                            <IconMessage size={12} className={isUnread ? 'text-rose-500 shrink-0' : 'text-neutral-500 shrink-0'} />
                            <span className="truncate">
                              {lastMsg?.content ?? 'Start the conversation 👋'}
                            </span>
                          </p>

                          {/* Clean unread indicator badge like WhatsApp */}
                          {isUnread && (
                            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 shadow-sm" />
                          )}
                        </div>
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
                {(() => {
                  const partnerPresence = formatUserActivity(
                    selectedMatch.otherUser?.id,
                    selectedMatch.otherUser?.updatedAt,
                    onlineUserIds,
                    lastActiveMap
                  );

                  return (
                    <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-neutral-800/80 bg-neutral-900/60 backdrop-blur-md">
                      <div className="flex items-center gap-3">
                        {(() => {
                          const partnerStoryIdx = storyGroups.findIndex(
                            (g) => g.userId === selectedMatch.otherUser?.id && g.stories?.length > 0
                          );
                          const partnerStoryGroup = partnerStoryIdx !== -1 ? storyGroups[partnerStoryIdx] : null;
                          const hasPartnerStory = !!partnerStoryGroup;
                          const hasUnseenPartnerStory = partnerStoryGroup?.hasUnseen;

                          return (
                            <div
                              onClick={() => {
                                if (hasPartnerStory) {
                                  setActiveStoryIdx(partnerStoryIdx);
                                }
                              }}
                              className={`relative w-10 h-10 rounded-full shrink-0 flex items-center justify-center p-0.5 transition-transform ${hasPartnerStory
                                ? hasUnseenPartnerStory
                                  ? 'bg-gradient-to-tr from-amber-500 via-rose-500 to-fuchsia-600 scale-105 hover:scale-110 shadow cursor-pointer'
                                  : 'bg-gradient-to-tr from-rose-500/80 to-purple-600/80 hover:scale-105 cursor-pointer'
                                : 'bg-neutral-800 border border-neutral-700'
                                }`}
                              title={hasPartnerStory ? `View ${selectedMatch.otherUser?.name}'s story` : ''}
                            >
                              <div className="w-full h-full rounded-full bg-neutral-900 overflow-hidden flex items-center justify-center text-neutral-400">
                                {selectedMatch.otherUser?.photos?.[0]?.url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={selectedMatch.otherUser.photos[0].url}
                                    alt={selectedMatch.otherUser.name || 'Match'}
                                    className="w-full h-full object-cover rounded-full"
                                  />
                                ) : (
                                  <IconUser size={20} className="text-neutral-400" />
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        <div>
                          <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                            <span>{selectedMatch.otherUser?.name || 'Match'}</span>
                          </h2>
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${partnerPresence.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-500'}`} />
                            <span className={`text-[10px] ${partnerPresence.textClass} tracking-wide uppercase`}>
                              {partnerPresence.statusText}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowClearConfirm(true)}
                          disabled={messages.length === 0}
                          className="p-2 text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-full transition-colors disabled:opacity-30 disabled:hover:text-neutral-400 disabled:hover:bg-transparent"
                          title="Clear Chat"
                        >
                          <IconTrash size={16} />
                        </button>

                        <Link
                          href={`/chat/${selectedMatch.id}`}
                          className="text-xs font-semibold text-rose-400 hover:text-rose-300 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded-full transition-colors flex items-center gap-1"
                        >
                          <span>Full Screen</span>
                          <IconMessageCircle size={14} />
                        </Link>
                      </div>
                    </div>
                  );
                })()}

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
                              className={`px-4 py-2.5 text-xs sm:text-sm leading-relaxed shadow-md ${isMe
                                ? 'bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 text-white rounded-2xl rounded-tr-xs font-medium'
                                : 'bg-neutral-900 border border-neutral-800 text-neutral-100 rounded-2xl rounded-tl-xs'
                                }`}
                            >
                              {m.content}
                            </div>
                            <div
                              className={`flex items-center gap-1 text-[10px] text-neutral-500 mt-1 px-1 font-medium ${isMe ? 'justify-end' : 'justify-start'
                                }`}
                            >
                              <span>
                                {m.sentAt
                                  ? new Date(m.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                  : ''}
                              </span>
                              {isMe && (() => {
                                const isPartnerOnline = Boolean(selectedMatch?.otherUser?.id && onlineUserIds.includes(selectedMatch.otherUser.id));
                                if (m.readAt) {
                                  // Read: Double check in vivid Red / Rose
                                  return (
                                    <span title="Read" className="inline-flex items-center text-rose-500 font-bold drop-shadow-sm ml-0.5">
                                      <IconChecks size={14} className="stroke-[2.5]" />
                                    </span>
                                  );
                                }
                                if (isPartnerOnline) {
                                  // Delivered / Recipient Online: Double check in gray
                                  return (
                                    <span title="Delivered" className="inline-flex items-center text-neutral-400 ml-0.5">
                                      <IconChecks size={14} className="stroke-[2]" />
                                    </span>
                                  );
                                }
                                // Sent / Recipient Offline: Single check in gray
                                return (
                                  <span title="Sent" className="inline-flex items-center text-neutral-400 ml-0.5">
                                    <IconCheck size={14} className="stroke-[2]" />
                                  </span>
                                );
                              })()}
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

      {/* Clear Chat Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <IconTrash size={24} />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white">Clear Chat History?</h3>
              <p className="text-xs text-neutral-400">
                Are you sure you want to clear all messages with{' '}
                <span className="text-white font-semibold">{selectedMatch?.otherUser?.name || 'this user'}</span>? This action cannot be undone.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                disabled={isClearing}
                className="w-full py-2.5 rounded-xl border border-neutral-700 bg-neutral-800 text-xs font-semibold text-neutral-300 hover:text-white hover:bg-neutral-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearChat}
                disabled={isClearing}
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-lg shadow-rose-600/30 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isClearing ? 'Clearing...' : 'Yes, Clear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Direct Story Viewer Modal from Chat */}
      {activeStoryIdx !== null && (
        <StoryViewerModal
          groups={storyGroups}
          initialUserIndex={activeStoryIdx}
          onClose={() => setActiveStoryIdx(null)}
          onStoryDeleted={() => fetchStories()}
        />
      )}
    </main>
  );
}



