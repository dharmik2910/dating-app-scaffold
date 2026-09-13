import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Alert,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePresence } from '@/context/PresenceContext';
import { mobileApi } from '@/services/api';
import { getSocket } from '@/services/socket';

type BackendMessage = {
  id: string;
  senderId: string;
  content: string;
  sentAt: string;
  readAt?: string | null;
  matchId?: string;
  mediaUrl?: string;
  mediaType?: string;
  isEphemeral?: boolean;
  viewedAt?: string | null;
  metadata?: any;
};

type MatchPartner = {
  id: string;
  userId?: string;
  name: string;
  avatar: string;
  online: boolean;
  lastActiveAt?: string;
  bio?: string;
  isVerified?: boolean;
};

function formatTime(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'Just now';
  }
}

export default function ChatDetailScreen() {
  const router = useRouter();
  const { id: matchId } = useLocalSearchParams<{ id: string }>();
  const { formatUserActivity, queryPresence } = usePresence();

  const [messages, setMessages] = useState<BackendMessage[]>([]);
  const [partner, setPartner] = useState<MatchPartner | null>(null);
  const [myUserId, setMyUserId] = useState<string>('');
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState<boolean>(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  // Modals state
  const [showClearModal, setShowClearModal] = useState<boolean>(false);
  const [showSafetyMenu, setShowSafetyMenu] = useState<boolean>(false);
  const [showDateModal, setShowDateModal] = useState<boolean>(false);
  const [showAiModal, setShowAiModal] = useState<boolean>(false);
  const [showSafeDateModal, setShowSafeDateModal] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);

  // Date Planner Form
  const [dateVenue, setDateVenue] = useState('');
  const [dateTimeStr, setDateTimeStr] = useState('Tomorrow at 7:00 PM');
  const [dateAddress, setDateAddress] = useState('');
  const [sendingDate, setSendingDate] = useState(false);

  // Safe Date Form
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [safeDateLocation, setSafeDateLocation] = useState('');
  const [creatingSafeDate, setCreatingSafeDate] = useState(false);

  // AI Icebreakers
  const [aiStarters, setAiStarters] = useState<any[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);

  // Report Form
  const [reportReason, setReportReason] = useState('harassment');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  // Voice Note State
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  // Ephemeral Secret View-Once
  const [isEphemeral, setIsEphemeral] = useState(false);
  const [revealingMsg, setRevealingMsg] = useState<BackendMessage | null>(null);
  const [revealCountdown, setRevealCountdown] = useState(8);

  const scrollViewRef = useRef<ScrollView>(null);

  // 1. Fetch current user and match partner details
  useEffect(() => {
    mobileApi.getMe().then((me) => {
      if (me) {
        setMyUserId(me.id || me.userId || '');
      }
    });

    mobileApi
      .getMatches(undefined, 50, 'all')
      .then((matches) => {
        const found = matches.find(
          (m) => m.id === matchId || m.user?.id === matchId || (m as any).userId === matchId,
        );
        if (found) {
          const partnerData: MatchPartner = {
            id: found.id,
            userId: found.user.id,
            name: found.user.name || 'Match',
            avatar:
              found.user.avatar ||
              'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=600&auto=format&fit=crop',
            online: found.user.online || false,
            lastActiveAt: (found.user as any).lastActiveAt,
            bio: found.user.bio,
            isVerified: (found.user as any).isVerified,
          };
          setPartner(partnerData);
          if (found.user?.id) {
            queryPresence([found.user.id]);
          }
        }
      })
      .catch((e) => console.warn('Fetch match partner error:', e));
  }, [matchId, queryPresence]);

  // 2. Fetch Chat History and Set Up Real-Time Socket Connection
  useEffect(() => {
    if (!matchId) return;

    setLoading(true);
    mobileApi
      .getChatHistory(matchId)
      .then((res: any) => {
        const items = Array.isArray(res) ? res : res.items || [];
        setMessages(items);
        setNextCursor(res.nextCursor || null);
        setHasMore(Boolean(res.hasMore));
      })
      .catch((err) => console.warn('Chat history fetch error:', err))
      .finally(() => setLoading(false));

    const socket = getSocket();
    socket.emit('joinMatch', matchId);
    socket.emit('markAsRead', matchId);

    const handleNewMessage = (msg: BackendMessage) => {
      if (msg.matchId && msg.matchId !== matchId) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        const isFromMe = msg.senderId === myUserId || msg.senderId === 'me';
        if (isFromMe) {
          const tempIdx = prev.findIndex(
            (m) => (m.id.startsWith('temp-') || m.id === 'optimistic') && m.content === msg.content,
          );
          if (tempIdx !== -1) {
            const updated = [...prev];
            updated[tempIdx] = msg;
            return updated;
          }
        }
        return [...prev, msg];
      });
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);

      if (msg.senderId !== myUserId && msg.senderId !== 'me') {
        socket.emit('markAsRead', matchId);
      }
    };

    const handleMessagesRead = (data: { matchId: string; readerId: string; readAt: string }) => {
      if (data?.matchId === matchId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.senderId !== data.readerId && !msg.readAt ? { ...msg, readAt: data.readAt } : msg,
          ),
        );
      }
    };

    const handleDateInviteUpdated = (updatedMsg: BackendMessage) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === updatedMsg.id ? { ...m, metadata: updatedMsg.metadata } : m)),
      );
    };

    const handleEphemeralViewed = (data: { messageId: string; viewedAt: string }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === data.messageId ? { ...m, viewedAt: data.viewedAt } : m)),
      );
    };

    const handleChatCleared = (data: { matchId: string }) => {
      if (data?.matchId === matchId) {
        setMessages([]);
      }
    };

    socket.on('newMessage', handleNewMessage);
    socket.on('messagesRead', handleMessagesRead);
    socket.on('dateInviteUpdated', handleDateInviteUpdated);
    socket.on('ephemeralViewed', handleEphemeralViewed);
    socket.on('chatCleared', handleChatCleared);

    return () => {
      socket.emit('leaveMatch', matchId);
      socket.off('newMessage', handleNewMessage);
      socket.off('messagesRead', handleMessagesRead);
      socket.off('dateInviteUpdated', handleDateInviteUpdated);
      socket.off('ephemeralViewed', handleEphemeralViewed);
      socket.off('chatCleared', handleChatCleared);
    };
  }, [matchId, myUserId]);

  async function handleOpenEphemeral(msg: BackendMessage) {
    if (msg.viewedAt) return;
    setRevealingMsg(msg);
    setRevealCountdown(8);
    try {
      await mobileApi.viewEphemeralMedia(matchId!, msg.id);
    } catch (e) {
      console.warn('View ephemeral error:', e);
    }
  }

  useEffect(() => {
    if (!revealingMsg) return;
    const timer = setInterval(() => {
      setRevealCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setRevealingMsg(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [revealingMsg]);

  function handleSend(
    customText?: string,
    mediaUrl?: string,
    mediaType = 'text',
    metadata?: any,
  ) {
    const textToSend = (customText !== undefined ? customText : inputText).trim();
    if (!textToSend && !mediaUrl && !metadata) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: BackendMessage = {
      id: tempId,
      senderId: myUserId || 'me',
      content: textToSend || (mediaType === 'audio' ? '🎤 Voice message' : '📅 Date invitation'),
      sentAt: new Date().toISOString(),
      matchId,
      mediaUrl,
      mediaType,
      isEphemeral,
      metadata,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    if (customText === undefined) setInputText('');

    const socket = getSocket();
    socket.emit('sendMessage', {
      matchId,
      content: optimisticMsg.content,
      mediaUrl,
      mediaType,
      isEphemeral,
      metadata,
    });
    setIsEphemeral(false);

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 50);
  }

  // Voice Note Simulation
  function handleSendVoiceNote() {
    setIsRecordingVoice(false);
    handleSend('🎤 Voice Note (0:14)', undefined, 'audio');
  }

  // Send Date Invitation
  async function handleSendDateInvite() {
    if (!dateVenue.trim()) {
      Alert.alert('Venue required', 'Please enter a coffee shop, bar, or restaurant.');
      return;
    }
    setSendingDate(true);
    try {
      await mobileApi.sendDateInvite(matchId, {
        venueName: dateVenue.trim(),
        address: dateAddress.trim(),
        dateTime: dateTimeStr,
      });
      setShowDateModal(false);
      setDateVenue('');
      setDateAddress('');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to send date invite');
    } finally {
      setSendingDate(false);
    }
  }

  // Respond to Date Invitation
  async function handleRespondDateInvite(messageId: string, response: 'accepted' | 'declined') {
    try {
      await mobileApi.respondDateInvite(matchId, messageId, response);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                metadata: {
                  ...m.metadata,
                  status: response,
                  respondedBy: myUserId,
                },
              }
            : m,
        ),
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update invitation');
    }
  }

  // AI Icebreakers
  async function handleOpenAiStarters() {
    setShowAiModal(true);
    if (!partner?.userId) return;
    setLoadingAi(true);
    try {
      const res = await mobileApi.getAiIcebreakers(partner.userId);
      if (res?.starters) {
        setAiStarters(res.starters);
      }
    } catch (e) {
      console.warn('AI icebreakers error:', e);
    } finally {
      setLoadingAi(false);
    }
  }

  // Safe Date Check-in
  async function handleCreateSafeDate() {
    if (!contactName.trim() || !contactPhone.trim() || !safeDateLocation.trim()) {
      Alert.alert('Required fields', 'Please fill in contact name, phone, and date location.');
      return;
    }
    setCreatingSafeDate(true);
    try {
      await mobileApi.createSafeDate({
        matchId,
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        locationName: safeDateLocation.trim(),
        scheduledTime: new Date(Date.now() + 2 * 3600000).toISOString(),
        notes: `Meeting ${partner?.name || 'Match'}`,
      });
      setShowSafeDateModal(false);
      Alert.alert('🛡️ Safe Date Registered', 'Your emergency contact and timer are set!');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not register safe date');
    } finally {
      setCreatingSafeDate(false);
    }
  }

  // Block & Report
  async function handleBlockPartner() {
    if (!partner?.userId) return;
    Alert.alert(
      'Block User',
      `Are you sure you want to block ${partner.name}? They will be removed from your matches and discovery.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await mobileApi.blockUser(partner.userId!);
              router.replace('/matches');
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to block user');
            }
          },
        },
      ],
    );
  }

  async function handleReportSubmit() {
    const targetId = partner?.userId || partner?.id || matchId;
    if (!targetId) {
      Alert.alert('Error', 'Unable to determine user to report.');
      return;
    }
    setSubmittingReport(true);
    try {
      await mobileApi.reportUser(targetId, reportReason, reportDetails);
      setShowReportModal(false);
      setReportDetails('');
      Alert.alert(
        'Report Submitted',
        `Thank you for keeping our community safe. Your report regarding ${partner?.name || 'this user'} has been submitted to moderation.`,
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to submit report');
    } finally {
      setSubmittingReport(false);
    }
  }

  useEffect(() => {
    const onBackPress = () => {
      router.replace('/chats');
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, []);

  const partnerDisplayName = partner?.name || 'Match';
  const partnerAvatarUrl =
    partner?.avatar ||
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=600&auto=format&fit=crop';
  const partnerActivity = formatUserActivity(
    partner?.userId || partner?.id,
    partner?.lastActiveAt,
    partner?.online,
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/chats')}>
          <Ionicons name="chevron-back" size={24} color="#ffffff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.partnerHeaderBtn}
          activeOpacity={0.8}
          onPress={() => setShowSafetyMenu(true)}
        >
          <View style={styles.headerAvatarContainer}>
            <Image source={{ uri: partnerAvatarUrl }} style={styles.headerAvatar} />
            {partnerActivity.isOnline && <View style={styles.headerOnlineDot} />}
          </View>

          <View style={styles.headerTextCol}>
            <View style={styles.headerNameRow}>
              <Text style={styles.headerName} numberOfLines={1}>
                {partnerDisplayName}
              </Text>
              {partner?.isVerified && (
                <Ionicons name="shield-checkmark" size={14} color="#38BDF8" style={{ marginLeft: 4 }} />
              )}
            </View>
            <Text
              style={[
                styles.headerStatusText,
                partnerActivity.isOnline ? styles.headerStatusOnline : styles.headerStatusOffline,
              ]}
              numberOfLines={1}
            >
              {partnerActivity.isOnline ? 'Online now' : partnerActivity.statusText}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Action Buttons in Header */}
        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.aiSparkleBtn}
            onPress={handleOpenAiStarters}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="sparkles" size={18} color="#A855F7" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setShowDateModal(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="calendar-outline" size={20} color="#FF4B72" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setShowSafetyMenu(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="ellipsis-vertical" size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Chat Body */}
      <KeyboardAvoidingView
        style={styles.flexArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#FF4B72" />
            <Text style={styles.loadingText}>Loading conversation...</Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.messagesScrollContent}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
          >
            {messages.map((msg) => {
              const isMe = msg.senderId === myUserId || msg.senderId === 'me';
              const isDateInvite = msg.mediaType === 'date_invite';
              const isAudio = msg.mediaType === 'audio';

              return (
                <View
                  key={msg.id}
                  style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowPartner]}
                >
                  {!isMe && <Image source={{ uri: partnerAvatarUrl }} style={styles.bubbleAvatar} />}

                  {/* Ephemeral Secret Message */}
                  {msg.isEphemeral ? (
                    <View style={[styles.bubbleBox, isMe ? styles.bubbleMe : styles.bubblePartner, styles.ephemeralBubble]}>
                      {msg.viewedAt ? (
                        <View style={styles.ephemeralBurnedRow}>
                          <Ionicons name="flame" size={16} color="#94A3B8" />
                          <Text style={styles.ephemeralBurnedText}>Secret self-destructed 🔥</Text>
                        </View>
                      ) : isMe ? (
                        <View style={styles.ephemeralPendingRow}>
                          <Ionicons name="eye-off" size={16} color="#FF4B72" />
                          <Text style={styles.ephemeralPendingText}>View-Once Secret Sent 🔒</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.ephemeralRevealBtn}
                          onPress={() => handleOpenEphemeral(msg)}
                        >
                          <Ionicons name="sparkles" size={16} color="#FFFFFF" />
                          <Text style={styles.ephemeralRevealText}>Tap to Reveal Secret ⏳ (8s)</Text>
                        </TouchableOpacity>
                      )}
                      <View style={styles.bubbleFooter}>
                        <Text style={[styles.bubbleTime, isMe ? styles.bubbleTimeMe : styles.bubbleTimePartner]}>
                          {formatTime(msg.sentAt)}
                        </Text>
                      </View>
                    </View>
                  ) : isDateInvite ? (
                    <View style={[styles.dateInviteCard, isMe && styles.dateInviteCardMe]}>
                      <View style={styles.dateCardHeader}>
                        <Ionicons name="calendar" size={18} color="#FF4B72" />
                        <Text style={styles.dateCardTitle}>Date Invitation</Text>
                      </View>
                      <Text style={styles.venueNameText}>{msg.metadata?.venueName || 'Coffee / Drink'}</Text>
                      {msg.metadata?.address ? (
                        <Text style={styles.venueAddressText}>{msg.metadata?.address}</Text>
                      ) : null}
                      <Text style={styles.venueTimeText}>⏰ {msg.metadata?.dateTime || 'TBD'}</Text>

                      {/* Status / Actions */}
                      {msg.metadata?.status === 'accepted' ? (
                        <View style={styles.acceptedBadge}>
                          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                          <Text style={styles.acceptedText}>Date Accepted! 🎉</Text>
                        </View>
                      ) : msg.metadata?.status === 'declined' ? (
                        <View style={styles.declinedBadge}>
                          <Ionicons name="close-circle" size={16} color="#EF4444" />
                          <Text style={styles.declinedText}>Declined</Text>
                        </View>
                      ) : !isMe ? (
                        <View style={styles.dateActionRow}>
                          <TouchableOpacity
                            style={styles.acceptDateBtn}
                            onPress={() => handleRespondDateInvite(msg.id, 'accepted')}
                          >
                            <Text style={styles.acceptDateText}>Accept Date 🥂</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.declineDateBtn}
                            onPress={() => handleRespondDateInvite(msg.id, 'declined')}
                          >
                            <Text style={styles.declineDateText}>Decline</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <Text style={styles.pendingInviteText}>Waiting for response...</Text>
                      )}
                    </View>
                  ) : isAudio ? (
                    /* Audio Voice Note Bubble */
                    <View style={[styles.bubbleBox, isMe ? styles.bubbleMe : styles.bubblePartner]}>
                      <View style={styles.audioRow}>
                        <TouchableOpacity
                          style={styles.playAudioBtn}
                          onPress={() =>
                            setPlayingVoiceId(playingVoiceId === msg.id ? null : msg.id)
                          }
                        >
                          <Ionicons
                            name={playingVoiceId === msg.id ? 'pause' : 'play'}
                            size={18}
                            color="#FFFFFF"
                          />
                        </TouchableOpacity>
                        <View style={styles.waveformContainer}>
                          {[6, 14, 22, 10, 18, 24, 12, 8, 20, 15, 7].map((h, idx) => (
                            <View
                              key={idx}
                              style={[
                                styles.waveBar,
                                {
                                  height: h,
                                  backgroundColor:
                                    playingVoiceId === msg.id && idx < 6
                                      ? '#38BDF8'
                                      : 'rgba(255, 255, 255, 0.7)',
                                },
                              ]}
                            />
                          ))}
                        </View>
                        <Text style={styles.audioDurationText}>0:14</Text>
                      </View>
                      <View style={styles.bubbleFooter}>
                        <Text style={[styles.bubbleTime, isMe ? styles.bubbleTimeMe : styles.bubbleTimePartner]}>
                          {formatTime(msg.sentAt)}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    /* Normal Text Bubble */
                    <View style={[styles.bubbleBox, isMe ? styles.bubbleMe : styles.bubblePartner]}>
                      <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextPartner]}>
                        {msg.content}
                      </Text>
                      <View style={styles.bubbleFooter}>
                        <Text style={[styles.bubbleTime, isMe ? styles.bubbleTimeMe : styles.bubbleTimePartner]}>
                          {formatTime(msg.sentAt)}
                        </Text>
                        {isMe && (
                          <Ionicons
                            name={msg.readAt ? 'checkmark-done' : 'checkmark'}
                            size={14}
                            color={msg.readAt ? '#6ee7b7' : 'rgba(255, 255, 255, 0.6)'}
                            style={{ marginLeft: 3 }}
                          />
                        )}
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* Bottom Input Bar */}
        <View style={styles.inputContainer}>
          {/* Ephemeral View-Once Toggle */}
          <TouchableOpacity
            style={[styles.ephemeralToggleBtn, isEphemeral && styles.ephemeralToggleBtnActive]}
            onPress={() => setIsEphemeral((prev) => !prev)}
          >
            <Ionicons
              name={isEphemeral ? 'flame' : 'flame-outline'}
              size={20}
              color={isEphemeral ? '#FF4B72' : '#94A3B8'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.micBtn, isRecordingVoice && styles.micBtnActive]}
            onPressIn={() => setIsRecordingVoice(true)}
            onPressOut={handleSendVoiceNote}
          >
            <Ionicons
              name={isRecordingVoice ? 'radio' : 'mic'}
              size={20}
              color={isRecordingVoice ? '#EF4444' : '#94A3B8'}
            />
          </TouchableOpacity>

          <TextInput
            style={[styles.textInput, isEphemeral && styles.textInputEphemeral]}
            placeholder={
              isRecordingVoice
                ? 'Recording voice note...'
                : isEphemeral
                ? 'Type View-Once secret message...'
                : 'Type a message...'
            }
            placeholderTextColor="#71717A"
            value={inputText}
            onChangeText={setInputText}
            multiline
          />

          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            onPress={() => handleSend()}
            disabled={!inputText.trim()}
          >
            <Ionicons name="send" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Ephemeral Secret Reveal Modal */}
      <Modal visible={Boolean(revealingMsg)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.ephemeralCard]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="flame" size={22} color="#FF4B72" />
                <Text style={styles.modalTitle}>Self-Destructing Secret</Text>
              </View>
              <View style={styles.countdownBadge}>
                <Text style={styles.countdownText}>{revealCountdown}s</Text>
              </View>
            </View>

            <View style={styles.secretMessageBox}>
              <Text style={styles.secretMessageText}>
                {revealingMsg?.content}
              </Text>
            </View>

            <Text style={styles.ephemeralNotice}>
              ⚠️ This secret will disappear permanently once the timer ends.
            </Text>

            <TouchableOpacity
              style={styles.primaryModalBtn}
              onPress={() => setRevealingMsg(null)}
            >
              <Text style={styles.primaryBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Suggest a Date Modal */}
      <Modal visible={showDateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📅 Suggest a Date</Text>
              <TouchableOpacity onPress={() => setShowDateModal(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <Text style={styles.inputLabel}>Where should you meet?</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Blue Bottle Coffee, Central Park"
              placeholderTextColor="#64748B"
              value={dateVenue}
              onChangeText={setDateVenue}
            />
            <Text style={styles.inputLabel}>Address or Neighborhood (optional)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 54 5th Avenue / Soho"
              placeholderTextColor="#64748B"
              value={dateAddress}
              onChangeText={setDateAddress}
            />
            <Text style={styles.inputLabel}>When?</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Saturday @ 6:30 PM"
              placeholderTextColor="#64748B"
              value={dateTimeStr}
              onChangeText={setDateTimeStr}
            />
            <TouchableOpacity
              style={styles.primaryModalBtn}
              onPress={handleSendDateInvite}
              disabled={sendingDate}
            >
              {sendingDate ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>Send Date Invitation 🥂</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* AI Icebreakers Modal */}
      <Modal visible={showAiModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="sparkles" size={20} color="#A855F7" />
                <Text style={styles.modalTitle}>Smart AI Starters</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAiModal(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Tailored opening lines based on {partner?.name}&apos;s bio and shared passions:
            </Text>
            {loadingAi ? (
              <ActivityIndicator size="large" color="#A855F7" style={{ paddingVertical: 40 }} />
            ) : (
              <View style={{ gap: 10, marginVertical: 12 }}>
                {aiStarters.map((s, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.aiStarterCard}
                    onPress={() => {
                      setInputText(s.text);
                      setShowAiModal(false);
                    }}
                  >
                    <View style={styles.aiTagRow}>
                      <Text style={styles.aiEmoji}>{s.emoji}</Text>
                      <Text style={styles.aiTagText}>{s.category}</Text>
                    </View>
                    <Text style={styles.aiStarterText}>&ldquo;{s.text}&rdquo;</Text>
                    <Text style={styles.tapToUseText}>Tap to use ✍️</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Safety Menu Modal */}
      <Modal visible={showSafetyMenu} animationType="fade" transparent>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSafetyMenu(false)}
        >
          <View style={styles.safetyMenuCard}>
            <TouchableOpacity
              style={styles.safetyMenuItem}
              onPress={() => {
                setShowSafetyMenu(false);
                setShowSafeDateModal(true);
              }}
            >
              <Ionicons name="shield-checkmark" size={20} color="#10B981" />
              <Text style={styles.safetyMenuText}>🛡️ Register Safe Date Check-in</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.safetyMenuItem}
              onPress={() => {
                setShowSafetyMenu(false);
                setShowReportModal(true);
              }}
            >
              <Ionicons name="flag-outline" size={20} color="#F59E0B" />
              <Text style={styles.safetyMenuText}>⚠️ Report Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.safetyMenuItem}
              onPress={() => {
                setShowSafetyMenu(false);
                handleBlockPartner();
              }}
            >
              <Ionicons name="ban-outline" size={20} color="#EF4444" />
              <Text style={[styles.safetyMenuText, { color: '#EF4444' }]}>🚫 Block User</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Safe Date Registration Modal */}
      <Modal visible={showSafeDateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🛡️ Safe Date Hub</Text>
              <TouchableOpacity onPress={() => setShowSafeDateModal(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Share date details with a trusted friend and enable emergency check-in timer.
            </Text>
            <Text style={styles.inputLabel}>Emergency Contact Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Best Friend, Sister"
              placeholderTextColor="#64748B"
              value={contactName}
              onChangeText={setContactName}
            />
            <Text style={styles.inputLabel}>Contact Phone Number</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="+1 (555) 000-0000"
              placeholderTextColor="#64748B"
              value={contactPhone}
              onChangeText={setContactPhone}
              keyboardType="phone-pad"
            />
            <Text style={styles.inputLabel}>Meeting Place</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Starbucks on 5th Ave"
              placeholderTextColor="#64748B"
              value={safeDateLocation}
              onChangeText={setSafeDateLocation}
            />
            <TouchableOpacity
              style={[styles.primaryModalBtn, { backgroundColor: '#10B981' }]}
              onPress={handleCreateSafeDate}
              disabled={creatingSafeDate}
            >
              {creatingSafeDate ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>Activate Safe Date Plan 🛡️</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Report User Modal */}
      <Modal visible={showReportModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report {partner?.name}</Text>
              <TouchableOpacity onPress={() => setShowReportModal(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <Text style={styles.inputLabel}>Select Reason</Text>
            <View style={styles.reasonsList}>
              {[
                { id: 'harassment', label: 'Harassment or Inappropriate behavior' },
                { id: 'fake_profile', label: 'Fake Profile / Catfish' },
                { id: 'inappropriate_photos', label: 'Inappropriate Photos' },
                { id: 'spam', label: 'Spam or Commercial promotion' },
              ].map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.reasonOption, reportReason === r.id && styles.reasonOptionActive]}
                  onPress={() => setReportReason(r.id)}
                >
                  <Text style={[styles.reasonText, reportReason === r.id && styles.reasonTextActive]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.inputLabel}>Details (Optional)</Text>
            <TextInput
              style={[styles.modalInput, { height: 70 }]}
              placeholder="Provide any additional context..."
              placeholderTextColor="#64748B"
              value={reportDetails}
              onChangeText={setReportDetails}
              multiline
            />
            <TouchableOpacity
              style={[styles.primaryModalBtn, { backgroundColor: '#EF4444' }]}
              onPress={handleReportSubmit}
              disabled={submittingReport}
            >
              {submittingReport ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>Submit Report</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  backBtn: {
    padding: 6,
    marginRight: 4,
  },
  partnerHeaderBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerAvatarContainer: {
    position: 'relative',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#090D16',
  },
  headerTextCol: {
    flex: 1,
  },
  headerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerStatusText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  headerStatusOnline: {
    color: '#10B981',
  },
  headerStatusOffline: {
    color: '#64748B',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  aiSparkleBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
  },
  headerIconBtn: {
    padding: 6,
  },
  flexArea: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  messagesScrollContent: {
    padding: 16,
    paddingBottom: 24,
    gap: 12,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  messageRowPartner: {
    justifyContent: 'flex-start',
  },
  bubbleAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginBottom: 2,
  },
  bubbleBox: {
    maxWidth: '75%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMe: {
    backgroundColor: '#FF4B72',
    borderBottomRightRadius: 4,
  },
  bubblePartner: {
    backgroundColor: '#1E293B',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 20,
  },
  bubbleTextMe: {
    color: '#FFFFFF',
  },
  bubbleTextPartner: {
    color: '#F1F5F9',
  },
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  bubbleTime: {
    fontSize: 10,
  },
  bubbleTimeMe: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  bubbleTimePartner: {
    color: '#64748B',
  },
  // Date Invitation Card Styles
  dateInviteCard: {
    width: '85%',
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 114, 0.3)',
    gap: 6,
  },
  dateInviteCardMe: {
    backgroundColor: '#271E3B',
    borderColor: 'rgba(168, 85, 247, 0.4)',
  },
  dateCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  dateCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF4B72',
    textTransform: 'uppercase',
  },
  venueNameText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  venueAddressText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  venueTimeText: {
    fontSize: 13,
    color: '#38BDF8',
    fontWeight: '600',
    marginTop: 2,
  },
  dateActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  acceptDateBtn: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
  },
  acceptDateText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  declineDateBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    alignItems: 'center',
  },
  declineDateText: {
    color: '#EF4444',
    fontWeight: '600',
    fontSize: 13,
  },
  acceptedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginTop: 6,
  },
  acceptedText: {
    color: '#10B981',
    fontWeight: '700',
    fontSize: 13,
  },
  declinedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginTop: 6,
  },
  declinedText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
  pendingInviteText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginTop: 6,
  },
  // Audio Player Styles
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  playAudioBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
  },
  audioDurationText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginLeft: 4,
  },
  // Input Bar Styles
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    gap: 8,
  },
  micBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  micBtnActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  textInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: '#FFFFFF',
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FF4B72',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  // Modal Overlays
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#CBD5E1',
    marginTop: 4,
  },
  modalInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  primaryModalBtn: {
    backgroundColor: '#FF4B72',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  // AI Starters Card Styles
  aiStarterCard: {
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
    gap: 4,
  },
  aiTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  aiEmoji: {
    fontSize: 14,
  },
  aiTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C084FC',
    textTransform: 'uppercase',
  },
  aiStarterText: {
    fontSize: 14,
    color: '#F3E8FF',
    lineHeight: 18,
  },
  tapToUseText: {
    fontSize: 11,
    color: '#A855F7',
    fontWeight: '600',
    marginTop: 2,
  },
  // Safety Menu Styles
  safetyMenuCard: {
    position: 'absolute',
    top: 70,
    right: 16,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 4,
  },
  safetyMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  safetyMenuText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  // Reasons List
  reasonsList: {
    gap: 8,
  },
  reasonOption: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  reasonOptionActive: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  reasonText: {
    fontSize: 13,
    color: '#CBD5E1',
  },
  reasonTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  // Ephemeral Secret Message Styles
  ephemeralBubble: {
    backgroundColor: 'rgba(255, 75, 114, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 114, 0.3)',
    borderStyle: 'dashed',
  },
  ephemeralBurnedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  ephemeralBurnedText: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  ephemeralPendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  ephemeralPendingText: {
    fontSize: 13,
    color: '#FF4B72',
    fontWeight: '700',
  },
  ephemeralRevealBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FF4B72',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  ephemeralRevealText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  ephemeralToggleBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  ephemeralToggleBtnActive: {
    backgroundColor: 'rgba(255, 75, 114, 0.2)',
    borderColor: '#FF4B72',
    borderWidth: 1,
  },
  textInputEphemeral: {
    borderColor: '#FF4B72',
    borderWidth: 1,
  },
  ephemeralCard: {
    backgroundColor: '#0F172A',
  },
  countdownBadge: {
    backgroundColor: 'rgba(255, 75, 114, 0.2)',
    borderColor: '#FF4B72',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countdownText: {
    color: '#FF4B72',
    fontWeight: '800',
    fontSize: 13,
  },
  secretMessageBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  secretMessageText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
  },
  ephemeralNotice: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
  },
});
