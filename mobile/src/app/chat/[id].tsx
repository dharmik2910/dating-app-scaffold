import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { mobileApi } from '@/services/api';
import { getSocket } from '@/services/socket';

type BackendMessage = {
  id: string;
  senderId: string;
  content: string;
  sentAt: string;
  readAt?: string | null;
  matchId?: string;
};

type MatchPartner = {
  id: string;
  userId?: string;
  name: string;
  avatar: string;
  online: boolean;
  lastActiveAt?: string;
  bio?: string;
};

const ICEBREAKERS = [
  "Hey! What's your favorite weekend activity? ✨",
  "If you could travel anywhere tomorrow, where to? ✈️",
  "Coffee or tea for a first hang out? ☕",
  "What song are you playing on repeat lately? 🎵",
];

function formatTime(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'Just now';
  }
}

function formatRelativeActivity(lastActiveAt?: string, isOnline?: boolean) {
  if (isOnline) return 'Online now';
  if (!lastActiveAt) return 'Offline';

  const diffMs = Date.now() - new Date(lastActiveAt).getTime();
  if (isNaN(diffMs)) return 'Offline';
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'Active just now';
  if (diffMinutes < 60) return `Active ${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Active ${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Active yesterday';
  if (diffDays < 7) return `Active ${diffDays}d ago`;
  return `Active ${Math.floor(diffDays / 7)}w ago`;
}

export default function ChatDetailScreen() {
  const router = useRouter();
  const { id: matchId } = useLocalSearchParams<{ id: string }>();

  const [messages, setMessages] = useState<BackendMessage[]>([]);
  const [partner, setPartner] = useState<MatchPartner | null>(null);
  const [myUserId, setMyUserId] = useState<string>('');
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState<boolean>(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [showClearModal, setShowClearModal] = useState<boolean>(false);
  const [clearing, setClearing] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);

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
          (m) => m.id === matchId || m.user?.id === matchId || (m as any).userId === matchId
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
          };
          setPartner(partnerData);

          // Query live presence from server
          const socket = getSocket();
          if (found.user?.id) {
            socket.emit('queryPresence', [found.user.id], (response: any[]) => {
              if (Array.isArray(response) && response[0]) {
                setPartner((prev) =>
                  prev
                    ? {
                        ...prev,
                        online: Boolean(response[0].isOnline),
                        lastActiveAt: response[0].lastActiveAt || prev.lastActiveAt,
                      }
                    : null
                );
              }
            });
          }
        }
      })
      .catch((e) => console.warn('Fetch match partner error:', e));
  }, [matchId]);

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

    // Connect WebSocket
    const socket = getSocket();
    socket.emit('joinMatch', matchId);
    socket.emit('markAsRead', matchId);

    const handleNewMessage = (msg: BackendMessage) => {
      if (msg.matchId && msg.matchId !== matchId) return;
      setMessages((prev) => {
        // If message with same real ID already exists, ignore
        if (prev.some((m) => m.id === msg.id)) return prev;

        // If message from me, replace any pending temp optimistic message with matching content
        const isFromMe = msg.senderId === myUserId || msg.senderId === 'me';
        if (isFromMe) {
          const tempIdx = prev.findIndex(
            (m) => (m.id.startsWith('temp-') || m.id === 'optimistic') && m.content === msg.content
          );
          if (tempIdx !== -1) {
            const updated = [...prev];
            updated[tempIdx] = msg;
            return updated;
          }
        }

        return [...prev, msg];
      });
      // Auto-scroll to latest
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);

      // Auto mark read if we received from partner
      if (msg.senderId !== myUserId && msg.senderId !== 'me') {
        socket.emit('markAsRead', matchId);
      }
    };

    const handleMessagesRead = (data: { matchId: string; readerId: string; readAt: string }) => {
      if (data?.matchId === matchId) {
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
      if (data?.matchId === matchId) {
        setMessages([]);
      }
    };

    const handleUserStatusChanged = (data: {
      userId: string;
      isOnline: boolean;
      lastActiveAt?: string;
    }) => {
      setPartner((prev) => {
        if (prev && (prev.userId === data.userId || prev.id === data.userId)) {
          return {
            ...prev,
            online: data.isOnline,
            lastActiveAt: data.lastActiveAt || prev.lastActiveAt,
          };
        }
        return prev;
      });
    };

    socket.on('newMessage', handleNewMessage);
    socket.on('messagesRead', handleMessagesRead);
    socket.on('chatCleared', handleChatCleared);
    socket.on('userStatusChanged', handleUserStatusChanged);

    return () => {
      socket.emit('leaveMatch', matchId);
      socket.off('newMessage', handleNewMessage);
      socket.off('messagesRead', handleMessagesRead);
      socket.off('chatCleared', handleChatCleared);
      socket.off('userStatusChanged', handleUserStatusChanged);
    };
  }, [matchId, myUserId]);

  // 3. Send Message
  function handleSend() {
    const trimmed = inputText.trim();
    if (!trimmed || !matchId) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: BackendMessage = {
      id: tempId,
      senderId: myUserId || 'me',
      content: trimmed,
      sentAt: new Date().toISOString(),
      matchId,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText('');

    // Emit over WebSocket
    const socket = getSocket();
    socket.emit('sendMessage', { matchId, content: trimmed });

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }

  // 4. Load Older Messages
  async function loadOlderMessages() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await mobileApi.getChatHistory(matchId, nextCursor);
      const newItems = Array.isArray(res) ? res : res.items || [];
      setMessages((prev) => [...newItems, ...prev]);
      setNextCursor(res.nextCursor || null);
      setHasMore(Boolean(res.hasMore));
    } catch (e) {
      console.warn('Load older messages error:', e);
    } finally {
      setLoadingMore(false);
    }
  }

  // 5. Clear Chat
  async function handleClearChat() {
    try {
      setClearing(true);
      await mobileApi.clearChat(matchId);
      setMessages([]);
      setShowClearModal(false);
    } catch (e) {
      console.warn('Clear chat error:', e);
      Alert.alert('Error', 'Failed to clear chat history.');
    } finally {
      setClearing(false);
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

  function handleBack() {
    router.replace('/chats');
  }

  const partnerDisplayName = partner?.name || 'Match';
  const partnerAvatarUrl =
    partner?.avatar ||
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=600&auto=format&fit=crop';
  const partnerStatusText = formatRelativeActivity(partner?.lastActiveAt, partner?.online);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <Ionicons name="chevron-back" size={24} color="#ffffff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.partnerHeaderBtn}
          activeOpacity={0.8}
          onPress={() => setShowProfileModal(true)}
        >
          <View style={styles.headerAvatarContainer}>
            <Image source={{ uri: partnerAvatarUrl }} style={styles.headerAvatar} />
            {partner?.online && <View style={styles.headerOnlineDot} />}
          </View>

          <View style={styles.headerTextCol}>
            <View style={styles.headerNameRow}>
              <Text style={styles.headerName} numberOfLines={1}>
                {partnerDisplayName}
              </Text>
              <Ionicons name="checkmark-circle" size={14} color="#fb7185" style={{ marginLeft: 3 }} />
            </View>
            <Text
              style={[
                styles.headerStatusText,
                partner?.online ? styles.headerStatusOnline : styles.headerStatusOffline,
              ]}
              numberOfLines={1}
            >
              {partnerStatusText}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Right Header Menu (Clear Chat / Info) */}
        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setShowClearModal(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={20} color="#71717a" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setShowProfileModal(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="information-circle-outline" size={22} color="#ffffff" />
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
            <ActivityIndicator size="large" color="#f43f5e" />
            <Text style={styles.loadingText}>Loading conversation...</Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.messagesScrollContent}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
          >
            {/* Load Older Messages Button */}
            {hasMore && (
              <TouchableOpacity
                style={styles.loadOlderBtn}
                onPress={loadOlderMessages}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <ActivityIndicator size="small" color="#a1a1aa" />
                ) : (
                  <Text style={styles.loadOlderText}>Load older messages</Text>
                )}
              </TouchableOpacity>
            )}

            {/* Intro Hero Match Card - shown ONLY when conversation has no messages yet */}
            {messages.length === 0 && (
              <View style={styles.introCard}>
                <View style={styles.introAvatarRing}>
                  <Image source={{ uri: partnerAvatarUrl }} style={styles.introAvatar} />
                  <View style={styles.introHeartBadge}>
                    <Ionicons name="heart" size={13} color="#ffffff" />
                  </View>
                </View>
                <Text style={styles.introTitle}>You and {partnerDisplayName} matched! 🎉</Text>
                <Text style={styles.introSubtitle}>
                  Say hello or tap a conversation starter below:
                </Text>

                <View style={styles.icebreakersGrid}>
                  {ICEBREAKERS.map((ice, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.icebreakerChip}
                      activeOpacity={0.8}
                      onPress={() => {
                        setInputText(ice);
                      }}
                    >
                      <Text style={styles.icebreakerChipText}>{ice}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Message Bubbles */}
            {messages.map((msg) => {
              const isMe = msg.senderId === myUserId || msg.senderId === 'me';
              return (
                <View
                  key={msg.id}
                  style={[
                    styles.messageRow,
                    isMe ? styles.messageRowMe : styles.messageRowPartner,
                  ]}
                >
                  {!isMe && (
                    <Image source={{ uri: partnerAvatarUrl }} style={styles.bubbleAvatar} />
                  )}

                  <View
                    style={[
                      styles.bubbleBox,
                      isMe ? styles.bubbleMe : styles.bubblePartner,
                    ]}
                  >
                    <Text
                      style={[
                        styles.bubbleText,
                        isMe ? styles.bubbleTextMe : styles.bubbleTextPartner,
                      ]}
                    >
                      {msg.content}
                    </Text>

                    <View style={styles.bubbleFooter}>
                      <Text
                        style={[
                          styles.bubbleTime,
                          isMe ? styles.bubbleTimeMe : styles.bubbleTimePartner,
                        ]}
                      >
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
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* Bottom Input Area */}
        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={styles.inputActionBtn}
            onPress={() => setInputText((prev) => (prev ? `${prev} 👋` : 'Hey there! 👋'))}
            activeOpacity={0.7}
          >
            <Text style={styles.inputActionEmoji}>👋</Text>
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            placeholder={`Message ${partnerDisplayName.split(' ')[0]}...`}
            placeholderTextColor="#71717a"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />

          <TouchableOpacity
            style={[
              styles.sendBtn,
              !inputText.trim() && styles.sendBtnDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Ionicons name="send" size={16} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Clear Chat Confirmation Modal */}
      <Modal visible={showClearModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmCard}>
            <Ionicons name="trash-outline" size={40} color="#f43f5e" />
            <Text style={styles.confirmTitle}>Clear Chat History?</Text>
            <Text style={styles.confirmSub}>
              This will permanently remove all messages with {partnerDisplayName}.
            </Text>
            <View style={styles.confirmBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowClearModal(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteConfirmBtn}
                onPress={handleClearChat}
                disabled={clearing}
              >
                {clearing ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.deleteConfirmText}>Clear</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Partner Quick Profile Modal */}
      {partner && (
        <Modal visible={showProfileModal} animationType="slide" transparent={false}>
          <SafeAreaView style={styles.profileModalContainer}>
            <TouchableOpacity
              style={styles.profileModalCloseBtn}
              onPress={() => setShowProfileModal(false)}
            >
              <Ionicons name="close" size={24} color="#ffffff" />
            </TouchableOpacity>

            <ScrollView contentContainerStyle={styles.profileModalScroll}>
              <Image source={{ uri: partnerAvatarUrl }} style={styles.profileModalHero} />
              <View style={styles.profileModalBody}>
                <View style={styles.nameRow}>
                  <Text style={styles.profileModalName}>{partnerDisplayName}</Text>
                  <Ionicons name="checkmark-circle" size={20} color="#fb7185" style={{ marginLeft: 6 }} />
                </View>

                <View
                  style={[
                    styles.statusPill,
                    partner.online ? styles.statusPillOnline : styles.statusPillOffline,
                    { alignSelf: 'flex-start', marginTop: 10 },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      partner.online ? styles.statusDotOnline : styles.statusDotOffline,
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusPillText,
                      partner.online ? styles.statusPillTextOnline : styles.statusPillTextOffline,
                    ]}
                  >
                    {partnerStatusText}
                  </Text>
                </View>

                {partner.bio ? (
                  <>
                    <View style={styles.profileModalDivider} />
                    <Text style={styles.profileModalHeading}>About</Text>
                    <Text style={styles.profileModalBio}>{partner.bio}</Text>
                  </>
                ) : null}
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  flexArea: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  loadingText: {
    color: '#a1a1aa',
    fontSize: 13,
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#18181b',
  },
  backBtn: {
    padding: 6,
    marginRight: 4,
  },
  partnerHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  headerAvatarContainer: {
    position: 'relative',
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  headerOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#09090b',
  },
  headerTextCol: {
    justifyContent: 'center',
    flex: 1,
  },
  headerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerStatusText: {
    fontSize: 11,
    marginTop: 1,
  },
  headerStatusOnline: {
    color: '#34d399',
    fontWeight: '500',
  },
  headerStatusOffline: {
    color: '#71717a',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#18181b',
  },
  messagesScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  loadOlderBtn: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 8,
  },
  loadOlderText: {
    fontSize: 11,
    color: '#a1a1aa',
    fontWeight: '500',
  },
  introCard: {
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.2)',
    marginBottom: 10,
  },
  introAvatarRing: {
    position: 'relative',
    marginBottom: 12,
  },
  introAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#f43f5e',
  },
  introHeartBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#f43f5e',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#18181b',
  },
  introTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
  },
  introSubtitle: {
    fontSize: 12,
    color: '#a1a1aa',
    textAlign: 'center',
    marginTop: 4,
  },
  icebreakersGrid: {
    width: '100%',
    gap: 8,
    marginTop: 14,
  },
  icebreakerChip: {
    backgroundColor: 'rgba(244, 63, 94, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.25)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  icebreakerChipText: {
    fontSize: 12,
    color: '#fb7185',
    fontWeight: '600',
    textAlign: 'center',
  },
  inputActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#18181b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  inputActionEmoji: {
    fontSize: 18,
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
    marginBottom: 4,
  },
  bubbleBox: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleMe: {
    backgroundColor: '#f43f5e',
    borderBottomRightRadius: 4,
  },
  bubblePartner: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleTextMe: {
    color: '#ffffff',
    fontWeight: '500',
  },
  bubbleTextPartner: {
    color: '#e4e4e7',
    fontWeight: '400',
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
    color: 'rgba(255, 255, 255, 0.75)',
  },
  bubbleTimePartner: {
    color: '#71717a',
  },
  quickChipsBar: {
    borderTopWidth: 1,
    borderTopColor: '#18181b',
    paddingVertical: 8,
  },
  quickChipsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  quickChipBtn: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  quickChipText: {
    fontSize: 12,
    color: '#a1a1aa',
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#18181b',
    backgroundColor: '#09090b',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#18181b',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: '#ffffff',
    fontSize: 14,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f43f5e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#18181b',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 12,
  },
  confirmSub: {
    fontSize: 13,
    color: '#a1a1aa',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    marginBottom: 20,
  },
  confirmBtnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#27272a',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  deleteConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#f43f5e',
    alignItems: 'center',
  },
  deleteConfirmText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  profileModalContainer: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  profileModalCloseBtn: {
    position: 'absolute',
    top: 45,
    right: 20,
    zIndex: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileModalScroll: {
    paddingBottom: 40,
  },
  profileModalHero: {
    width: '100%',
    height: 380,
  },
  profileModalBody: {
    padding: 24,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileModalName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
  },
  profileModalDivider: {
    height: 1,
    backgroundColor: '#27272a',
    marginVertical: 16,
  },
  profileModalHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 6,
  },
  profileModalBio: {
    fontSize: 14,
    color: '#d4d4d8',
    lineHeight: 20,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPillOnline: {
    backgroundColor: 'rgba(9, 9, 11, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  statusPillOffline: {
    backgroundColor: 'rgba(9, 9, 11, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusDotOnline: {
    backgroundColor: '#34d399',
  },
  statusDotOffline: {
    backgroundColor: '#a1a1aa',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  statusPillTextOnline: {
    color: '#6ee7b7',
  },
  statusPillTextOffline: {
    color: '#d4d4d8',
  },
});
