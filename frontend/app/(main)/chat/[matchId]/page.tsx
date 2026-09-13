'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuth } from '@/components/AuthContext';
import { usePresenceStore, formatUserActivity } from '@/lib/usePresenceStore';
import {
  IconChevronLeft,
  IconSend,
  IconUser,
  IconSparkles,
  IconCheck,
  IconChecks,
  IconHeart,
  IconMoodSmile,
  IconTrash,
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
  IconFlame,
} from '@tabler/icons-react';
import { toast } from 'sonner';
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
  isEphemeral?: boolean;
  viewedAt?: string | null;
  dateDetails?: {
    title: string;
    location?: string;
    dateTime?: string;
    status?: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  };
};


type MatchPartner = {
  name: string;
  photo?: string;
  userId?: string;
  bio?: string;
  updatedAt?: string;
  isVerified?: boolean;
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

export default function MobileChatPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const onlineUserIds = usePresenceStore((state) => state.onlineUserIds);
  const lastActiveMap = usePresenceStore((state) => state.lastActiveMap);
  const setPresenceList = usePresenceStore((state) => state.setPresenceList);

  const [messages, setMessages] = useState<Message[]>([]);
  const [partner, setPartner] = useState<MatchPartner | null>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Stories
  const [storyGroups, setStoryGroups] = useState<StoryUserGroup[]>([]);
  const [activeStoryIdx, setActiveStoryIdx] = useState<number | null>(null);

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

  // Options Menu & Reporting
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('INAPPROPRIATE_CONTENT');
  const [reportNotes, setReportNotes] = useState('');
  const [isReporting, setIsReporting] = useState(false);

  // Voice Note
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  // Ephemeral View-Once State
  const [isEphemeralMode, setIsEphemeralMode] = useState(false);
  const [viewingEphemeral, setViewingEphemeral] = useState<Message | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const currentUserId = user?.id || user?.userId;

  useEffect(() => {
    fetchStories();
  }, []);

  function fetchStories() {
    api
      .getStoriesFeed()
      .then((data) => {
        setStoryGroups(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error('Failed to load stories feed:', err);
      });
  }

  useEffect(() => {
    if (!matchId) return;

    // Fetch match partner details
    api
      .getConversations()
      .then((data) => {
        const matchesList = Array.isArray(data) ? data : data.items || [];
        const currentMatch = matchesList.find((m: any) => m.id === matchId);
        if (currentMatch?.otherUser) {
          const partnerUserId = currentMatch.otherUser.userId || currentMatch.otherUser.id;
          setPartner({
            name: currentMatch.otherUser.name || 'Match',
            photo: currentMatch.otherUser.photos?.[0]?.url,
            userId: partnerUserId,
            bio: currentMatch.otherUser.bio,
            updatedAt: currentMatch.otherUser.updatedAt,
            isVerified: currentMatch.otherUser.isVerified,
          });

          if (partnerUserId) {
            const socket = getSocket();
            socket.emit('queryPresence', [partnerUserId], (res: any[]) => {
              if (Array.isArray(res)) {
                setPresenceList(res);
              }
            });
          }
        }
      })
      .catch((err) => console.error('Failed to fetch match details:', err));

    // Fetch chat history
    api
      .getChatHistory(matchId)
      .then((res) => {
        const items = Array.isArray(res) ? res : res.items || [];
        setMessages(items);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });

    const socket = getSocket();
    socket.emit('joinMatch', matchId);
    socket.emit('markAsRead', matchId);

    const handleNewMsg = (msg: Message) => {
      if ((msg as any).matchId && (msg as any).matchId !== matchId) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      if (msg.senderId !== currentUserId) {
        socket.emit('markAsRead', matchId);
      }
    };

    const handleMessagesRead = (data: { matchId: string; readerId: string; readAt: string }) => {
      if (data?.matchId === matchId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.senderId !== data.readerId && !msg.readAt ? { ...msg, readAt: data.readAt } : msg
          )
        );
      }
    };

    const handleChatCleared = (data: { matchId: string }) => {
      if (data?.matchId === matchId) {
        setMessages([]);
      }
    };

    const handleEphemeralViewed = (data: { matchId: string; messageId: string; viewedAt: string }) => {
      if (data?.matchId === matchId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === data.messageId ? { ...msg, viewedAt: data.viewedAt } : msg
          )
        );
      }
    };

    const handleDateInviteUpdated = (data: { matchId: string; messageId: string; status: 'ACCEPTED' | 'DECLINED' }) => {
      if (data?.matchId === matchId) {
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
    socket.on('ephemeralViewed', handleEphemeralViewed);

    return () => {
      socket.emit('leaveMatch', matchId);
      socket.off('newMessage', handleNewMsg);
      socket.off('messagesRead', handleMessagesRead);
      socket.off('chatCleared', handleChatCleared);
      socket.off('dateInviteUpdated', handleDateInviteUpdated);
      socket.off('ephemeralViewed', handleEphemeralViewed);
    };
  }, [matchId, currentUserId]);


  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleClearChat() {
    if (!matchId) return;
    try {
      setIsClearing(true);
      await api.clearChat(matchId);
      setMessages([]);
      setShowClearConfirm(false);
      toast.success('Chat history cleared');
    } catch (err) {
      console.error(err);
      toast.error('Failed to clear chat');
    } finally {
      setIsClearing(false);
    }
  }

  function sendMessage(contentToSend?: string) {
    if (!matchId) return;
    const finalMsg = contentToSend || text;
    if (!finalMsg.trim()) return;
    getSocket().emit('sendMessage', {
      matchId,
      content: finalMsg,
      isEphemeral: isEphemeralMode,
    });
    if (!contentToSend) {
      setText('');
      setIsEphemeralMode(false);
    }
  }


  async function fetchAiIcebreakers() {
    if (!matchId) return;
    setAiLoading(true);
    setShowAiModal(true);
    try {
      const res = await api.generateAiIcebreakers(matchId);
      setAiIcebreakers(res.icebreakers || []);
    } catch (err) {
      console.error(err);
      setAiIcebreakers([
        `Hey ${partner?.name || 'there'}! What made your week awesome? ✨`,
        `If we could grab coffee or drinks anywhere today, where to? ☕`,
        `I love your vibe! What's your favorite spot in town? 🌆`,
      ]);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSendDateInvite() {
    if (!matchId || !dateTitle.trim()) return;
    setIsSendingDate(true);
    try {
      const res = await api.sendDateInvite(matchId, {
        title: dateTitle,
        location: dateLocation,
        dateTime: dateTime,
      });
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

  async function handleDateResponse(messageId: string, status: 'ACCEPTED' | 'DECLINED') {
    if (!matchId) return;
    try {
      await api.respondDateInvite(matchId, messageId, status);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, dateDetails: { ...(m.dateDetails || { title: 'Date' }), status } }
            : m
        )
      );
      toast.success(status === 'ACCEPTED' ? 'Date Accepted! 🎉' : 'Date Declined');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update date invitation');
    }
  }

  function handleSendVoiceNote() {
    if (!matchId) return;
    setIsRecordingVoice(true);
    toast.info('Recording voice note... (3s)');
    setTimeout(() => {
      setIsRecordingVoice(false);
      const voiceMsg: Message = {
        id: `voice-${Date.now()}`,
        senderId: currentUserId || 'me',
        matchId,
        content: '🎙️ Voice note (0:12)',
        type: 'VOICE_NOTE',
        duration: 12,
        mediaUrl: 'https://example.com/mock-audio.mp3',
        sentAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, voiceMsg]);
      getSocket().emit('sendMessage', {
        matchId,
        content: '🎙️ Voice note (0:12)',
        type: 'VOICE_NOTE',
        duration: 12,
      });
      toast.success('Voice note sent! 🎵');
    }, 2500);
  }

  async function handleCreateSafeDate(e: React.FormEvent) {
    e.preventDefault();
    if (!partner?.userId) return;
    setIsSavingSafeDate(true);
    try {
      await api.createSafeDate({
        partnerId: partner.userId,
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

  async function handleBlockUser() {
    if (!partner?.userId) return;
    if (!confirm(`Are you sure you want to block ${partner.name}?`)) return;
    try {
      await api.blockUser(partner.userId);
      toast.success(`${partner.name} has been blocked.`);
      router.replace('/chat');
    } catch (err: any) {
      toast.error(err.message || 'Failed to block user');
    }
  }

  async function handleReportUser(e: React.FormEvent) {
    e.preventDefault();
    if (!partner?.userId) return;
    setIsReporting(true);
    try {
      await api.reportUser({
        reportedUserId: partner.userId,
        reason: reportReason,
        notes: reportNotes,
      });
      toast.success('Report submitted to moderation.');
      setShowReportModal(false);
      setReportNotes('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit report');
    } finally {
      setIsReporting(false);
    }
  }

  const partnerPresence = formatUserActivity(
    partner?.userId,
    partner?.updatedAt,
    onlineUserIds,
    lastActiveMap
  );

  return (
    <main className="flex flex-col h-[calc(100vh-4rem)] bg-neutral-950 max-w-4xl mx-auto border-x border-neutral-800/80 relative">
      {/* Chat Top Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-800/80 bg-neutral-900/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link
            href="/chat"
            className="p-1.5 -ml-1 text-neutral-400 hover:text-white rounded-full hover:bg-neutral-800 transition-colors"
          >
            <IconChevronLeft size={22} />
          </Link>

          <div className="relative w-9 h-9 rounded-full bg-neutral-800 border border-neutral-700 overflow-hidden flex items-center justify-center text-neutral-400 shrink-0">
            {partner?.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={partner.photo} alt={partner.name} className="w-full h-full object-cover" />
            ) : (
              <IconUser size={18} />
            )}
          </div>

          <div>
            <h1 className="text-sm font-bold text-white flex items-center gap-1">
              <span>{partner?.name || 'Chat'}</span>
              {partner?.isVerified && (
                <span className="text-sky-400 text-xs font-black" title="Verified Profile">✓</span>
              )}
            </h1>
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${partnerPresence.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-500'}`} />
              <span className={`text-[10px] ${partnerPresence.textClass} uppercase tracking-wider`}>
                {partnerPresence.statusText}
              </span>
            </div>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowDateModal(true)}
            className="p-2 text-amber-400 hover:bg-amber-500/10 rounded-full transition-colors"
            title="Plan a Date"
          >
            <IconCalendar size={18} />
          </button>

          <button
            type="button"
            onClick={fetchAiIcebreakers}
            className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-full transition-colors"
            title="AI Starters"
          >
            <IconSparkles size={18} />
          </button>

          <button
            type="button"
            onClick={() => setShowSafeDateModal(true)}
            className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-full transition-colors"
            title="Safe Date Hub"
          >
            <IconShieldCheck size={18} />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowOptionsMenu((prev) => !prev)}
              className="p-2 text-neutral-400 hover:text-white rounded-full"
            >
              <IconDotsVertical size={18} />
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
                  <IconTrash size={14} />
                  <span>Clear Chat</span>
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
      </header>

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
              Send a message, an AI icebreaker, or suggest a first date!
            </p>

            <div className="mt-5 space-y-2 text-left">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider">
                  Icebreakers
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
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          <div className="text-center my-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-900/60 border border-neutral-800 text-neutral-400 text-[10px] rounded-full">
              <IconHeart size={11} className="text-rose-500 fill-rose-500" />
              Matched with {partner?.name || 'this user'}
            </span>
          </div>

          {messages.map((m, index) => {
            const isMe = currentUserId && m.senderId === currentUserId;

            // Date Invite Card
            if (m.type === 'DATE_INVITE' || m.dateDetails) {
              const details = m.dateDetails || {
                title: m.content.replace(/📅 Date Invitation: /g, '').split(' | ')[0] || 'Coffee Date',
                location: m.content.split('📍 ')[1]?.split(' | ')[0] || 'Local Cafe',
                dateTime: m.content.split('⏰ ')[1] || 'This weekend',
                status: 'PENDING' as const,
              };
              const status = details.status || 'PENDING';

              return (
                <div key={m.id} className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'} my-2`}>
                  <div className="w-full max-w-xs rounded-3xl bg-neutral-900 border border-amber-500/40 p-4 shadow-xl">
                    <div className="flex items-center justify-between pb-2 border-b border-neutral-800 mb-2">
                      <div className="flex items-center gap-1.5">
                        <IconCalendar size={16} className="text-amber-400" />
                        <span className="text-[10px] uppercase font-bold text-amber-400">Date Plan</span>
                      </div>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase bg-amber-500/20 text-amber-300">
                        {status}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-white mb-2">{details.title}</h4>
                    <div className="space-y-1 text-[11px] text-neutral-300 mb-3">
                      {details.location && <p>📍 {details.location}</p>}
                      {details.dateTime && <p>⏰ {details.dateTime}</p>}
                    </div>
                    {!isMe && status === 'PENDING' && (
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-800">
                        <button
                          type="button"
                          onClick={() => handleDateResponse(m.id, 'DECLINED')}
                          className="py-1.5 rounded-lg bg-neutral-800 text-[10px] font-semibold text-neutral-300"
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDateResponse(m.id, 'ACCEPTED')}
                          className="py-1.5 rounded-lg bg-amber-500 text-[10px] font-bold text-white shadow"
                        >
                          Accept 🎉
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
                <div key={m.id} className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'} items-end`}>
                  <div
                    className={`p-3 rounded-2xl flex items-center gap-3 ${
                      isMe ? 'bg-rose-600 text-white' : 'bg-neutral-900 border border-neutral-800 text-white'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setPlayingVoiceId(isPlaying ? null : m.id)}
                      className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center"
                    >
                      {isPlaying ? <IconPlayerPause size={14} /> : <IconPlayerPlay size={14} className="ml-0.5" />}
                    </button>
                    <div className="text-xs">
                      <span>🎙️ Voice Note (0:{m.duration || 12})</span>
                    </div>
                  </div>
                </div>
              );
            }

            // Ephemeral View-Once Bubble
            if (m.isEphemeral) {
              const isViewed = Boolean(m.viewedAt);
              return (
                <div key={m.id} className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'} items-end my-1`}>
                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[80%]`}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isMe && !isViewed) {
                          setViewingEphemeral(m);
                          api.viewEphemeralMedia(matchId, m.id).catch(() => {});
                          setMessages((prev) =>
                            prev.map((msg) =>
                              msg.id === m.id ? { ...msg, viewedAt: new Date().toISOString() } : msg
                            )
                          );
                        } else if (isMe && !isViewed) {
                          setViewingEphemeral(m);
                        }
                      }}
                      disabled={isViewed}
                      className={`px-4 py-3 rounded-2xl flex items-center gap-2.5 transition-all text-xs font-bold ${
                        isViewed
                          ? 'bg-neutral-900/60 border border-neutral-800 text-neutral-500 cursor-not-allowed opacity-75'
                          : isMe
                          ? 'bg-gradient-to-r from-amber-600 to-rose-600 text-white shadow-lg cursor-pointer hover:opacity-95'
                          : 'bg-rose-950/70 border border-rose-700/80 text-rose-200 hover:bg-rose-900 shadow-md cursor-pointer animate-pulse'
                      }`}
                    >
                      <IconFlame size={16} className={isViewed ? 'text-neutral-500' : 'text-amber-300'} />
                      <span>
                        {isViewed
                          ? '🔥 Secret Disappeared'
                          : isMe
                          ? '🔥 View-Once Secret (Sent)'
                          : '🔥 Tap to View Secret (View Once)'}
                      </span>
                    </button>
                    <div className="flex items-center gap-1 text-[10px] text-neutral-500 mt-1 px-1">
                      <span>
                        {m.sentAt
                          ? new Date(m.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : ''}
                      </span>
                      {isMe && (m.viewedAt ? (
                        <span className="text-amber-400 font-bold ml-1">Opened 🔥</span>
                      ) : (
                        <IconCheck size={13} className="text-neutral-400" />
                      ))}
                    </div>
                  </div>
                </div>
              );
            }

            // Standard message
            return (
              <div key={m.id} className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'} items-end`}>
                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[80%]`}>
                  <div
                    className={`px-4 py-2.5 text-xs sm:text-sm leading-relaxed ${
                      isMe
                        ? 'bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 text-white rounded-2xl rounded-tr-xs font-medium shadow-md'
                        : 'bg-neutral-900 border border-neutral-800 text-neutral-100 rounded-2xl rounded-tl-xs'
                    }`}
                  >
                    {m.content}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-neutral-500 mt-1 px-1">
                    <span>
                      {m.sentAt
                        ? new Date(m.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : ''}
                    </span>
                    {isMe && (m.readAt ? (
                      <IconChecks size={13} className="text-rose-500 stroke-[2.5]" />
                    ) : (
                      <IconCheck size={13} className="text-neutral-400" />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Emoji picker */}
      {showEmojiPicker && (
        <div className="absolute bottom-16 left-4 right-4 bg-neutral-900 border border-neutral-800 rounded-2xl p-2.5 shadow-2xl flex justify-around text-lg z-30">
          {['❤️', '🔥', '😍', '👋', '😂', '✨', '☕', '🎉', '🥂'].map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                setText((prev) => prev + emoji);
                setShowEmojiPicker(false);
              }}
              className="p-1 hover:scale-125 transition-transform"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div className="border-t border-neutral-800/80 p-3 bg-neutral-900/80 backdrop-blur-md flex items-center gap-2">
        <button
          onClick={() => setShowEmojiPicker((prev) => !prev)}
          className="p-2 text-neutral-400 hover:text-amber-400 rounded-full hover:bg-neutral-800 shrink-0"
        >
          <IconMoodSmile size={20} />
        </button>

        <button
          onClick={() => setShowDateModal(true)}
          className="p-2 text-neutral-400 hover:text-amber-400 rounded-full hover:bg-neutral-800 shrink-0"
        >
          <IconCalendar size={19} />
        </button>

        <button
          onClick={() => setIsEphemeralMode((prev) => !prev)}
          title="Toggle View-Once Ephemeral Mode"
          className={`p-2 rounded-full shrink-0 transition-colors ${
            isEphemeralMode
              ? 'bg-rose-500 text-white shadow-md shadow-rose-500/40'
              : 'text-neutral-400 hover:text-rose-400'
          }`}
        >
          <IconFlame size={19} />
        </button>

        <button
          onClick={handleSendVoiceNote}
          disabled={isRecordingVoice}
          className={`p-2 rounded-full shrink-0 ${
            isRecordingVoice ? 'bg-rose-500 text-white animate-ping' : 'text-neutral-400 hover:text-purple-400'
          }`}
        >
          <IconMicrophone size={19} />
        </button>

        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder={isEphemeralMode ? 'Send a View-Once Secret 🔥...' : `Message ${partner?.name || ''}...`}
          className={`flex-1 rounded-full bg-neutral-900 border px-4 py-2 text-xs sm:text-sm text-white outline-none transition-colors ${
            isEphemeralMode ? 'border-rose-500/80 placeholder-rose-400/60' : 'border-neutral-800 focus:border-rose-500/60'
          }`}
        />

        <button
          onClick={() => sendMessage()}
          disabled={!text.trim()}
          className="p-2.5 rounded-full bg-gradient-to-r from-rose-500 to-amber-500 text-white disabled:opacity-30 shrink-0 shadow-md"
        >
          <IconSend size={15} />
        </button>
      </div>


      {/* AI Icebreakers Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 max-w-sm w-full space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold text-sm">
                <IconSparkles size={16} />
                <span>AI Spark Starters</span>
              </div>
              <button onClick={() => setShowAiModal(false)} className="text-neutral-400 hover:text-white">
                <IconX size={18} />
              </button>
            </div>

            {aiLoading ? (
              <div className="py-6 text-center space-y-2">
                <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-neutral-400">Generating sparks...</p>
              </div>
            ) : (
              <div className="space-y-2">
                {aiIcebreakers.map((starter, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                    <p className="text-xs text-neutral-200">{starter}</p>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setText(starter);
                          setShowAiModal(false);
                        }}
                        className="px-2 py-1 rounded-lg bg-neutral-800 text-[10px] font-bold text-neutral-300"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          sendMessage(starter);
                          setShowAiModal(false);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-rose-500 text-[10px] font-bold text-white shadow"
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

      {/* Date Modal */}
      {showDateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 max-w-sm w-full space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <IconCalendar size={16} className="text-amber-400" />
                <span>Suggest a Date</span>
              </h3>
              <button onClick={() => setShowDateModal(false)} className="text-neutral-400 hover:text-white">
                <IconX size={18} />
              </button>
            </div>

            <div className="space-y-2">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Activity</label>
                <input
                  type="text"
                  value={dateTitle}
                  onChange={(e) => setDateTitle(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Location</label>
                <input
                  type="text"
                  value={dateLocation}
                  onChange={(e) => setDateLocation(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Date & Time</label>
                <input
                  type="text"
                  value={dateTime}
                  onChange={(e) => setDateTime(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDateModal(false)}
                className="py-2 rounded-xl bg-neutral-800 text-xs font-semibold text-neutral-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendDateInvite}
                disabled={isSendingDate || !dateTitle.trim()}
                className="py-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 text-xs font-bold text-white shadow"
              >
                {isSendingDate ? 'Sending...' : 'Send Plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safe Date Modal */}
      {showSafeDateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <form onSubmit={handleCreateSafeDate} className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 max-w-sm w-full space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <IconShieldCheck size={16} className="text-emerald-400" />
                <span>Safe Date Hub</span>
              </h3>
              <button type="button" onClick={() => setShowSafeDateModal(false)} className="text-neutral-400 hover:text-white">
                <IconX size={18} />
              </button>
            </div>

            <div className="space-y-2">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Emergency Contact</label>
                <input
                  type="text"
                  required
                  value={safeEmergencyContact}
                  onChange={(e) => setSafeEmergencyContact(e.target.value)}
                  placeholder="+1 (555) 019-2831"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Location</label>
                <input
                  type="text"
                  required
                  value={safeLocation}
                  onChange={(e) => setSafeLocation(e.target.value)}
                  placeholder="Sky Rooftop Lounge"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Expected End Time</label>
                <input
                  type="text"
                  required
                  value={safeEndTime}
                  onChange={(e) => setSafeEndTime(e.target.value)}
                  placeholder="10:30 PM"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSafeDateModal(false)}
                className="py-2 rounded-xl bg-neutral-800 text-xs font-semibold text-neutral-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingSafeDate}
                className="py-2 rounded-xl bg-emerald-600 text-xs font-bold text-white shadow"
              >
                {isSavingSafeDate ? 'Activating...' : 'Activate'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Clear Chat Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 max-w-xs w-full space-y-3">
            <h3 className="text-sm font-bold text-white text-center">Clear Chat History?</h3>
            <p className="text-xs text-neutral-400 text-center">This will delete all messages in this chat.</p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="py-2 rounded-xl bg-neutral-800 text-xs font-semibold text-neutral-300"
              >
                Cancel
              </button>
              <button
                onClick={handleClearChat}
                disabled={isClearing}
                className="py-2 rounded-xl bg-rose-600 text-xs font-bold text-white"
              >
                {isClearing ? 'Clearing...' : 'Clear'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Ephemeral View-Once Reveal Modal */}
      {viewingEphemeral && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-rose-500/50 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-center relative">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto text-2xl border border-rose-500/40 animate-pulse">
              🔥
            </div>
            <div>
              <h3 className="text-base font-bold text-white">View-Once Secret Message</h3>
              <p className="text-xs text-rose-400 font-semibold mt-0.5">
                This message will disappear once you close this window!
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 text-left">
              <p className="text-sm font-medium text-white leading-relaxed">
                {viewingEphemeral.content}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setViewingEphemeral(null)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:opacity-95 font-bold text-xs text-white shadow-lg transition-all"
            >
              Close & Disappear
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

