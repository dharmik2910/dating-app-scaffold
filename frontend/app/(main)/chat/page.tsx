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
  IconCompass,
  IconCalendar,
  IconMapPin,
  IconClock,
  IconX,
  IconShieldCheck,
  IconMicrophone,
  IconPlayerPlay,
  IconPlayerPause,
  IconDotsVertical,
  IconBan,
  IconFlag,
  IconLock,
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
  type?: 'TEXT' | 'IMAGE' | 'VOICE_NOTE' | 'DATE_INVITE';
  mediaUrl?: string;
  duration?: number;
  dateDetails?: {
    title: string;
    location?: string;
    dateTime?: string;
    status?: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  };
};

const ICEBREAKERS = [
  "Hey! What's your favorite weekend activity? ✨",
  "If you could travel anywhere tomorrow, where to? ✈️",
  "Coffee or tea for a first hang out? ☕",
  "What song are you playing on repeat lately? 🎵",
];

const PRESET_DATES = [
  { title: '☕ Specialty Coffee & Walk', location: 'Local Artisanal Cafe' },
  { title: '🍷 Sunset Wine & Tapas', location: 'Rooftop Bar' },
  { title: '🎨 Art Gallery & Matcha', location: 'Modern Art Museum' },
  { title: '🍕 Woodfired Pizza & Gelato', location: 'Downtown Pizzeria' },
  { title: '🧗 Bouldering & Smoothies', location: 'Climbing Gym' },
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

  // AI Icebreakers
  const [aiLoading, setAiLoading] = useState(false);
  const [aiIcebreakers, setAiIcebreakers] = useState<string[]>([]);
  const [showAiModal, setShowAiModal] = useState(false);

  // Date Planner Modal
  const [showDateModal, setShowDateModal] = useState(false);
  const [dateTitle, setDateTitle] = useState('☕ Coffee & Casual Walk');
  const [dateLocation, setDateLocation] = useState('Artisanal Cafe');
  const [dateTime, setDateTime] = useState('This Saturday @ 4:00 PM');
  const [isSendingDate, setIsSendingDate] = useState(false);

  // Safe Date Modal
  const [showSafeDateModal, setShowSafeDateModal] = useState(false);
  const [safeEmergencyContact, setSafeEmergencyContact] = useState('');
  const [safeLocation, setSafeLocation] = useState('');
  const [safeEndTime, setSafeEndTime] = useState('');
  const [isSavingSafeDate, setIsSavingSafeDate] = useState(false);

  // Safety / Options Dropdown
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('INAPPROPRIATE_CONTENT');
  const [reportNotes, setReportNotes] = useState('');
  const [isReporting, setIsReporting] = useState(false);

  // Voice Note Simulation State
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const currentUserId = user?.id || user?.userId;

  useEffect(() => {
    fetchMatches();
    fetchStories();

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
      const newMsg: Message = {
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
    setShowAiModal(false);
    setShowOptionsMenu(false);

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
      if (!msg?.matchId || msg.matchId === currentMatchId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        if (msg.senderId !== currentUserId) {
          socket.emit('markAsRead', currentMatchId);
        }
      }

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

    const handleDateInviteUpdated = (data: { matchId: string; messageId: string; status: 'ACCEPTED' | 'DECLINED' }) => {
      if (data?.matchId === currentMatchId) {
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === data.messageId) {
              return {
                ...msg,
                dateDetails: {
                  ...(msg.dateDetails || { title: 'Date Invitation' }),
                  status: data.status,
                },
              };
            }
            return msg;
          })
        );
      }
    };

    socket.on('newMessage', handleNewMsg);
    socket.on('messagesRead', handleMessagesRead);
    socket.on('chatCleared', handleChatCleared);
    socket.on('dateInviteUpdated', handleDateInviteUpdated);

    return () => {
      socket.emit('leaveMatch', currentMatchId);
      socket.off('newMessage', handleNewMsg);
      socket.off('messagesRead', handleMessagesRead);
      socket.off('chatCleared', handleChatCleared);
      socket.off('dateInviteUpdated', handleDateInviteUpdated);
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

  // AI Icebreaker generator
  async function fetchAiIcebreakers() {
    if (!selectedMatch) return;
    setAiLoading(true);
    setShowAiModal(true);
    try {
      const res = await api.generateAiIcebreakers(selectedMatch.id);
      setAiIcebreakers(res.icebreakers || []);
    } catch (err) {
      console.error(err);
      toast.error('Could not generate AI icebreakers');
      setAiIcebreakers([
        `Hey ${selectedMatch.otherUser?.name || 'there'}! What's something that instantly made you smile today? ✨`,
        `If we could teleport to any spot right now for coffee or a drink, where are we going? 🗺️`,
        `I love your photos! What's the story behind your favorite one? 📸`,
      ]);
    } finally {
      setAiLoading(false);
    }
  }

  // Send Date Invitation
  async function handleSendDateInvite() {
    if (!selectedMatch || !dateTitle.trim()) return;
    setIsSendingDate(true);
    try {
      const res = await api.sendDateInvite(selectedMatch.id, {
        title: dateTitle,
        location: dateLocation,
        dateTime: dateTime,
      });

      // Socket emit or add locally
      if (res.message) {
        setMessages((prev) => [...prev, res.message]);
      }
      setShowDateModal(false);
      toast.success('Date invitation sent! 🎉');
    } catch (err) {
      console.error(err);
      toast.error('Failed to send date invitation');
    } finally {
      setIsSendingDate(false);
    }
  }

  // Respond to Date Invitation
  async function handleDateResponse(messageId: string, status: 'ACCEPTED' | 'DECLINED') {
    if (!selectedMatch) return;
    try {
      await api.respondDateInvite(selectedMatch.id, messageId, status);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, dateDetails: { ...(m.dateDetails || { title: 'Date' }), status } }
            : m
        )
      );
      toast.success(status === 'ACCEPTED' ? 'Date Accepted! Have fun! 🎉' : 'Date Declined');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update date invitation');
    }
  }

  // Send Voice Note simulation
  function handleSendVoiceNote() {
    if (!selectedMatch) return;
    setIsRecordingVoice(true);
    toast.info('Recording voice note... (3s)');
    setTimeout(() => {
      setIsRecordingVoice(false);
      const voiceMsg: Message = {
        id: `voice-${Date.now()}`,
        senderId: currentUserId || 'me',
        matchId: selectedMatch.id,
        content: '🎙️ Voice note (0:14)',
        type: 'VOICE_NOTE',
        duration: 14,
        mediaUrl: 'https://example.com/mock-audio.mp3',
        sentAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, voiceMsg]);
      getSocket().emit('sendMessage', {
        matchId: selectedMatch.id,
        content: '🎙️ Voice note (0:14)',
        type: 'VOICE_NOTE',
        duration: 14,
      });
      toast.success('Voice note sent! 🎵');
    }, 2500);
  }

  // Safe Date Submission
  async function handleCreateSafeDate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMatch) return;
    setIsSavingSafeDate(true);
    try {
      await api.createSafeDate({
        partnerId: selectedMatch.otherUser?.id,
        emergencyContact: safeEmergencyContact,
        location: safeLocation,
        expectedEndTime: safeEndTime,
      });
      toast.success('Safe Date registered! Check-in scheduled. 🛡️');
      setShowSafeDateModal(false);
      setSafeEmergencyContact('');
      setSafeLocation('');
      setSafeEndTime('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to register safe date');
    } finally {
      setIsSavingSafeDate(false);
    }
  }

  // Block & Report
  async function handleBlockUser() {
    if (!selectedMatch?.otherUser?.id) return;
    if (!confirm(`Are you sure you want to block ${selectedMatch.otherUser.name}? You will no longer see each other.`)) return;
    try {
      await api.blockUser(selectedMatch.otherUser.id);
      toast.success(`${selectedMatch.otherUser.name} has been blocked.`);
      setSelectedMatch(null);
      fetchMatches();
    } catch (err: any) {
      toast.error(err.message || 'Failed to block user');
    }
  }

  async function handleReportUser(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMatch?.otherUser?.id) return;
    setIsReporting(true);
    try {
      await api.reportUser({
        reportedUserId: selectedMatch.otherUser.id,
        reason: reportReason,
        notes: reportNotes,
      });
      toast.success('Report submitted to moderation. Thank you for keeping our community safe.');
      setShowReportModal(false);
      setReportNotes('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit report');
    } finally {
      setIsReporting(false);
    }
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
    <main className="w-full px-4 sm:px-8 py-4 min-h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)] flex flex-col justify-center">
      {loading ? (
        <ChatListSkeleton />
      ) : matches.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-12">
          <div className="text-center py-14 px-8 bg-neutral-900/60 border border-neutral-800/80 rounded-3xl max-w-sm w-full mx-auto shadow-2xl backdrop-blur-md">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-rose-500/10 to-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-4 shadow-inner">
              <IconSparkles size={32} className="animate-pulse" />
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">No Active Chats Yet</h3>
            <p className="text-neutral-400 text-xs sm:text-sm mt-2 max-w-xs mx-auto mb-6 leading-relaxed">
              Match with intriguing people in Discover to start chatting!
            </p>
            <Link
              href="/discover"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-rose-500 via-rose-600 to-amber-500 font-bold text-xs sm:text-sm px-6 py-3.5 rounded-full text-white shadow-xl shadow-rose-500/25 hover:scale-105 active:scale-95 transition-all"
            >
              <IconCompass size={18} />
              <span>Start Discovering</span>
            </Link>
          </div>
        </div>
      ) : (
        /* Split Dual-Pane View on Desktop / Laptop (lg+) */
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 overflow-hidden">
          {/* LEFT SIDE: Conversations Sidebar */}
          <div className="lg:col-span-4 flex flex-col h-full bg-neutral-900/40 border border-neutral-800/80 rounded-3xl p-4 overflow-hidden max-w-full">
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
                        {onlineUserIds.includes(m.otherUser?.id) && (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-neutral-950 shadow-sm" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <h3
                            className={`text-xs sm:text-sm truncate flex items-center gap-1 ${
                              isUnread ? 'font-black text-white' : isSelected ? 'font-bold text-white' : 'font-medium text-neutral-200 group-hover:text-white'
                            }`}
                          >
                            <span>{m.otherUser?.name || 'Match'}</span>
                            {m.otherUser?.isVerified && (
                              <span className="text-sky-400 text-xs" title="Verified Profile">✓</span>
                            )}
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
                          <p
                            className={`text-[11px] truncate flex items-center gap-1 ${
                              isUnread ? 'text-neutral-100 font-semibold' : 'text-neutral-400'
                            }`}
                          >
                            {lastMsg?.type === 'DATE_INVITE' ? (
                              <IconCalendar size={12} className="text-amber-400 shrink-0" />
                            ) : lastMsg?.type === 'VOICE_NOTE' ? (
                              <IconMicrophone size={12} className="text-purple-400 shrink-0" />
                            ) : (
                              <IconMessage size={12} className={isUnread ? 'text-rose-500 shrink-0' : 'text-neutral-500 shrink-0'} />
                            )}
                            <span className="truncate">
                              {lastMsg?.content ?? 'Start the conversation 👋'}
                            </span>
                          </p>

                          {isUnread && <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 shadow-sm" />}
                        </div>
                      </div>

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

          {/* RIGHT SIDE: Inline Live Chat Room for Desktop */}
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
                                if (hasPartnerStory) setActiveStoryIdx(partnerStoryIdx);
                              }}
                              className={`relative w-10 h-10 rounded-full shrink-0 flex items-center justify-center p-0.5 transition-transform ${
                                hasPartnerStory
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
                            {selectedMatch.otherUser?.isVerified && (
                              <span className="inline-flex items-center justify-center w-4 h-4 bg-sky-500 text-white rounded-full text-[10px] font-bold" title="Photo Verified">
                                ✓
                              </span>
                            )}
                          </h2>
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${partnerPresence.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-500'}`} />
                            <span className={`text-[10px] ${partnerPresence.textClass} tracking-wide uppercase`}>
                              {partnerPresence.statusText}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Header Actions */}
                      <div className="flex items-center gap-2 relative">
                        {/* Suggest a Date Button */}
                        <button
                          type="button"
                          onClick={() => setShowDateModal(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/25 hover:bg-amber-500/20 text-amber-300 rounded-full text-xs font-bold transition-all cursor-pointer shadow-sm"
                          title="Suggest a Date"
                        >
                          <IconCalendar size={14} />
                          <span>Plan Date</span>
                        </button>

                        {/* AI Icebreaker Trigger */}
                        <button
                          type="button"
                          onClick={fetchAiIcebreakers}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/25 hover:bg-rose-500/20 text-rose-300 rounded-full text-xs font-bold transition-all cursor-pointer shadow-sm"
                          title="Generate AI Icebreakers"
                        >
                          <IconSparkles size={14} className="text-amber-400" />
                          <span>AI Starters</span>
                        </button>

                        {/* Safe Date Trigger */}
                        <button
                          type="button"
                          onClick={() => setShowSafeDateModal(true)}
                          className="p-2 text-neutral-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-full transition-colors"
                          title="Register Safe Date Check-in"
                        >
                          <IconShieldCheck size={18} />
                        </button>

                        {/* More Menu Dropdown */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowOptionsMenu((prev) => !prev)}
                            className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-full transition-colors"
                          >
                            <IconDotsVertical size={16} />
                          </button>

                          {showOptionsMenu && (
                            <div className="absolute right-0 top-10 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl py-2 w-48 z-40 animate-in fade-in slide-in-from-top-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setShowClearConfirm(true);
                                  setShowOptionsMenu(false);
                                }}
                                disabled={messages.length === 0}
                                className="w-full text-left px-4 py-2 text-xs text-neutral-300 hover:bg-neutral-800 flex items-center gap-2 transition-colors disabled:opacity-40"
                              >
                                <IconTrash size={14} className="text-neutral-400" />
                                <span>Clear Chat History</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setShowReportModal(true);
                                  setShowOptionsMenu(false);
                                }}
                                className="w-full text-left px-4 py-2 text-xs text-amber-400 hover:bg-neutral-800 flex items-center gap-2 transition-colors"
                              >
                                <IconFlag size={14} />
                                <span>Report Profile</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setShowOptionsMenu(false);
                                  handleBlockUser();
                                }}
                                className="w-full text-left px-4 py-2 text-xs text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 transition-colors"
                              >
                                <IconBan size={14} />
                                <span>Block User</span>
                              </button>
                            </div>
                          )}
                        </div>
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
                        Send a message, an AI icebreaker, or suggest a first date!
                      </p>

                      <div className="mt-5 space-y-2 text-left">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider">
                            Popular Starters
                          </span>
                          <button
                            onClick={fetchAiIcebreakers}
                            className="text-[10px] text-amber-400 hover:underline flex items-center gap-1 font-bold"
                          >
                            <IconSparkles size={11} />
                            <span>AI Spark</span>
                          </button>
                        </div>
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

                      // Date Invite Message Card
                      if (m.type === 'DATE_INVITE' || m.dateDetails) {
                        const details = m.dateDetails || {
                          title: m.content.replace(/📅 Date Invitation: /g, '').split(' | ')[0] || 'Coffee Date',
                          location: m.content.split('📍 ')[1]?.split(' | ')[0] || 'Local Cafe',
                          dateTime: m.content.split('⏰ ')[1] || 'This weekend',
                          status: 'PENDING' as const,
                        };
                        const status = details.status || 'PENDING';

                        return (
                          <div key={m.id} className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'} items-end my-2`}>
                            <div className="w-full max-w-sm rounded-3xl bg-gradient-to-br from-neutral-900/90 to-neutral-950 border border-amber-500/40 p-5 shadow-2xl backdrop-blur-md relative overflow-hidden">
                              <div className="absolute top-0 right-0 w-28 h-28 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

                              <div className="flex items-center justify-between pb-3 border-b border-neutral-800/80 mb-3">
                                <div className="flex items-center gap-2">
                                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                    <IconCalendar size={18} />
                                  </div>
                                  <div>
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 block">
                                      Date Invitation
                                    </span>
                                    <h4 className="text-sm font-bold text-white">{details.title}</h4>
                                  </div>
                                </div>

                                <span
                                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                                    status === 'ACCEPTED'
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                      : status === 'DECLINED'
                                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                                  }`}
                                >
                                  {status}
                                </span>
                              </div>

                              <div className="space-y-1.5 text-xs text-neutral-300 mb-4">
                                {details.location && (
                                  <div className="flex items-center gap-2">
                                    <IconMapPin size={14} className="text-neutral-400 shrink-0" />
                                    <span>{details.location}</span>
                                  </div>
                                )}
                                {details.dateTime && (
                                  <div className="flex items-center gap-2">
                                    <IconClock size={14} className="text-neutral-400 shrink-0" />
                                    <span>{details.dateTime}</span>
                                  </div>
                                )}
                              </div>

                              {/* Actions if recipient and pending */}
                              {!isMe && status === 'PENDING' && (
                                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-800/80">
                                  <button
                                    type="button"
                                    onClick={() => handleDateResponse(m.id, 'DECLINED')}
                                    className="py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-300 transition-colors"
                                  >
                                    Decline
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDateResponse(m.id, 'ACCEPTED')}
                                    className="py-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:opacity-95 text-xs font-bold text-white shadow-lg shadow-amber-500/20 transition-all"
                                  >
                                    Accept Date 🎉
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }

                      // Voice Note Bubble
                      if (m.type === 'VOICE_NOTE') {
                        const isPlaying = playingVoiceId === m.id;
                        return (
                          <div key={m.id} className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'} items-end group`}>
                            <div
                              className={`p-3.5 rounded-2xl flex items-center gap-3 max-w-[75%] ${
                                isMe
                                  ? 'bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 text-white shadow-md'
                                  : 'bg-neutral-900 border border-neutral-800 text-white'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => setPlayingVoiceId(isPlaying ? null : m.id)}
                                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                              >
                                {isPlaying ? <IconPlayerPause size={16} /> : <IconPlayerPlay size={16} className="ml-0.5" />}
                              </button>

                              <div className="flex-1 min-w-[120px]">
                                <div className="flex items-center gap-1 h-6">
                                  {[40, 75, 55, 90, 60, 30, 85, 100, 65, 45, 80, 50, 70, 40].map((h, i) => (
                                    <div
                                      key={i}
                                      className={`flex-1 rounded-full transition-all duration-300 ${
                                        isPlaying ? 'bg-white animate-pulse' : 'bg-white/50'
                                      }`}
                                      style={{ height: `${h}%` }}
                                    />
                                  ))}
                                </div>
                                <div className="flex justify-between text-[10px] opacity-80 mt-1">
                                  <span>0:{m.duration || 14}</span>
                                  <span>Voice Note</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // Standard Text Message
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
                              {isMe && (() => {
                                const isPartnerOnline = Boolean(selectedMatch?.otherUser?.id && onlineUserIds.includes(selectedMatch.otherUser.id));
                                if (m.readAt) {
                                  return (
                                    <span title="Read" className="inline-flex items-center text-rose-500 font-bold drop-shadow-sm ml-0.5">
                                      <IconChecks size={14} className="stroke-[2.5]" />
                                    </span>
                                  );
                                }
                                if (isPartnerOnline) {
                                  return (
                                    <span title="Delivered" className="inline-flex items-center text-neutral-400 ml-0.5">
                                      <IconChecks size={14} className="stroke-[2]" />
                                    </span>
                                  );
                                }
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
                    {['❤️', '🔥', '😍', '👋', '😂', '✨', '☕', '🎉', '🥂'].map((emoji) => (
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

                  <button
                    onClick={() => setShowDateModal(true)}
                    className="p-2 text-neutral-400 hover:text-amber-400 rounded-full hover:bg-neutral-800 transition-colors shrink-0"
                    title="Suggest a Date"
                  >
                    <IconCalendar size={19} />
                  </button>

                  <button
                    onClick={handleSendVoiceNote}
                    disabled={isRecordingVoice}
                    className={`p-2 rounded-full transition-colors shrink-0 ${
                      isRecordingVoice
                        ? 'bg-rose-500 text-white animate-ping'
                        : 'text-neutral-400 hover:text-purple-400 hover:bg-neutral-800'
                    }`}
                    title="Send Voice Note"
                  >
                    <IconMicrophone size={19} />
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

      {/* AI Icebreakers Modal / Drawer */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-gradient-to-tr from-rose-500/20 to-amber-500/20 text-amber-400 border border-amber-500/30">
                  <IconSparkles size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">AI Spark Starters</h3>
                  <p className="text-xs text-neutral-400">Tailored openers for {selectedMatch?.otherUser?.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowAiModal(false)}
                className="p-1.5 text-neutral-400 hover:text-white rounded-full"
              >
                <IconX size={18} />
              </button>
            </div>

            {aiLoading ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-neutral-400">Analyzing mutual passions and generating spark openers...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {aiIcebreakers.map((starter, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 hover:border-rose-500/60 transition-all group relative"
                  >
                    <p className="text-xs text-neutral-200 leading-relaxed pr-16">{starter}</p>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setText(starter);
                          setShowAiModal(false);
                        }}
                        className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-[10px] font-bold text-neutral-300"
                        title="Copy into input bar"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          sendMessage(starter);
                          setShowAiModal(false);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-rose-500 to-amber-500 hover:opacity-90 text-[10px] font-bold text-white shadow"
                        title="Send now"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Date Planner Modal */}
      {showDateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <IconCalendar size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Suggest a Date</h3>
                  <p className="text-xs text-neutral-400">Plan a meetup with {selectedMatch?.otherUser?.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowDateModal(false)}
                className="p-1.5 text-neutral-400 hover:text-white rounded-full"
              >
                <IconX size={18} />
              </button>
            </div>

            {/* Presets */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
                Quick Date Ideas
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESET_DATES.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setDateTitle(preset.title);
                      setDateLocation(preset.location);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      dateTitle === preset.title
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {preset.title}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-neutral-400 mb-1">Activity / Title</label>
                <input
                  type="text"
                  value={dateTitle}
                  onChange={(e) => setDateTitle(e.target.value)}
                  placeholder="e.g. Sunset drinks & ramen"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-400 mb-1">Location</label>
                <input
                  type="text"
                  value={dateLocation}
                  onChange={(e) => setDateLocation(e.target.value)}
                  placeholder="e.g. Blue Bottle Coffee / Rooftop Lounge"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-400 mb-1">Date & Time</label>
                <input
                  type="text"
                  value={dateTime}
                  onChange={(e) => setDateTime(e.target.value)}
                  placeholder="e.g. This Saturday @ 7:00 PM"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDateModal(false)}
                className="w-full py-2.5 rounded-xl border border-neutral-700 bg-neutral-800 text-xs font-semibold text-neutral-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendDateInvite}
                disabled={isSendingDate || !dateTitle.trim()}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:opacity-95 text-xs font-bold text-white shadow-lg shadow-amber-500/30 disabled:opacity-40"
              >
                {isSendingDate ? 'Sending...' : 'Send Invitation ✨'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safe Date Modal */}
      {showSafeDateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <form onSubmit={handleCreateSafeDate} className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <IconShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Safe Date Hub</h3>
                  <p className="text-xs text-neutral-400">Emergency contact & automated check-in</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSafeDateModal(false)}
                className="p-1.5 text-neutral-400 hover:text-white rounded-full"
              >
                <IconX size={18} />
              </button>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              We care about your safety. Register your date location and emergency contact. If you don&apos;t check in by the expected time, we alert your emergency contact.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-neutral-400 mb-1">Emergency Contact (Phone or Name)</label>
                <input
                  type="text"
                  required
                  value={safeEmergencyContact}
                  onChange={(e) => setSafeEmergencyContact(e.target.value)}
                  placeholder="+1 (555) 019-2831 (Mom / Best Friend)"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-400 mb-1">Date Venue / Address</label>
                <input
                  type="text"
                  required
                  value={safeLocation}
                  onChange={(e) => setSafeLocation(e.target.value)}
                  placeholder="e.g. 124 Sunset Blvd, Sky Rooftop"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-400 mb-1">Expected End Time</label>
                <input
                  type="text"
                  required
                  value={safeEndTime}
                  onChange={(e) => setSafeEndTime(e.target.value)}
                  placeholder="e.g. 10:30 PM"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSafeDateModal(false)}
                className="w-full py-2.5 rounded-xl border border-neutral-700 bg-neutral-800 text-xs font-semibold text-neutral-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingSafeDate}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 disabled:opacity-50"
              >
                {isSavingSafeDate ? 'Activating...' : 'Activate Safe Date 🛡️'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <form onSubmit={handleReportUser} className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  <IconFlag size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Report User</h3>
                  <p className="text-xs text-neutral-400">Help maintain a safe community</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="p-1.5 text-neutral-400 hover:text-white rounded-full"
              >
                <IconX size={18} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-400 mb-1">Reason</label>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-rose-500"
              >
                <option value="INAPPROPRIATE_CONTENT">Inappropriate Content / Behavior</option>
                <option value="HARASSMENT">Harassment or Offensive Messages</option>
                <option value="FAKE_PROFILE">Fake Profile / Catfishing</option>
                <option value="SPAM">Spam or Commercial Solicitation</option>
                <option value="UNDERAGE">Underage User</option>
                <option value="OTHER">Other Issue</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-400 mb-1">Details / Notes</label>
              <textarea
                rows={3}
                value={reportNotes}
                onChange={(e) => setReportNotes(e.target.value)}
                placeholder="Describe what happened..."
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-rose-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="w-full py-2.5 rounded-xl border border-neutral-700 bg-neutral-800 text-xs font-semibold text-neutral-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isReporting}
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-lg shadow-rose-600/30 disabled:opacity-50"
              >
                {isReporting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
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
