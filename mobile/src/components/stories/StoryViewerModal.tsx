import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  Modal,
  Dimensions,
  StatusBar,
  TouchableWithoutFeedback,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { mobileApi } from '@/services/api';
import { getSocket } from '@/services/socket';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STORY_DURATION_MS = 5000;

export interface StoryItem {
  id: string;
  mediaUrl: string;
  mediaType: string;
  caption?: string;
  createdAt: string;
  isViewed?: boolean;
}

export interface StoryUserGroup {
  userId: string;
  userName: string;
  userPhoto?: string;
  isOwnStory?: boolean;
  isSelf?: boolean;
  hasUnviewed?: boolean;
  hasUnseen?: boolean;
  stories: StoryItem[];
}

export interface ViewerItem {
  viewerId: string;
  viewedAt: string;
  name: string;
  photoUrl: string | null;
  bio: string | null;
  age: number | null;
}

interface StoryViewerModalProps {
  groups: StoryUserGroup[];
  initialUserIndex: number;
  onClose: () => void;
  onStoryDeleted?: () => void;
}

const QUICK_REACTIONS = ['❤️', '🔥', '😍', '👏', '😂'];

export default function StoryViewerModal({
  groups,
  initialUserIndex,
  onClose,
  onStoryDeleted,
}: StoryViewerModalProps) {
  const [currentUserIdx, setCurrentUserIdx] = useState<number>(initialUserIndex);
  const [currentStoryIdx, setCurrentStoryIdx] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [replyText, setReplyText] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Viewers state (Instagram style)
  const [showViewers, setShowViewers] = useState<boolean>(false);
  const [viewersList, setViewersList] = useState<ViewerItem[]>([]);
  const [loadingViewers, setLoadingViewers] = useState<boolean>(false);

  const currentGroup = groups[currentUserIdx];
  const currentStory = currentGroup?.stories?.[currentStoryIdx];
  const isSelf = Boolean(currentGroup?.isOwnStory || currentGroup?.isSelf);

  const timerRef = useRef<any>(null);

  // Mark current story as viewed
  useEffect(() => {
    if (currentStory?.id && !isSelf) {
      mobileApi.markStoryViewed(currentStory.id).catch(() => {});
    }
  }, [currentStory?.id, isSelf]);

  // Load viewers for own story
  useEffect(() => {
    if (isSelf && currentStory?.id) {
      loadViewers(currentStory.id);
    }
  }, [isSelf, currentStory?.id]);

  function loadViewers(storyId: string) {
    setLoadingViewers(true);
    mobileApi
      .getStoryViewers(storyId)
      .then((res: any) => {
        setViewersList(Array.isArray(res) ? res : []);
      })
      .catch(() => setViewersList([]))
      .finally(() => setLoadingViewers(false));
  }

  // Auto-progress timer (strictly 5s per story, paused if interactive)
  useEffect(() => {
    if (isPaused || !currentStory || showViewers) return;

    timerRef.current = setTimeout(() => {
      handleNext();
    }, STORY_DURATION_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentUserIdx, currentStoryIdx, isPaused, currentStory, showViewers]);

  function handleNext() {
    if (!currentGroup) return;
    setShowViewers(false);

    if (currentStoryIdx < currentGroup.stories.length - 1) {
      setCurrentStoryIdx((prev) => prev + 1);
    } else if (currentUserIdx < groups.length - 1) {
      setCurrentUserIdx((prev) => prev + 1);
      setCurrentStoryIdx(0);
    } else {
      onClose();
    }
  }

  function handlePrev() {
    setShowViewers(false);
    if (currentStoryIdx > 0) {
      setCurrentStoryIdx((prev) => prev - 1);
    } else if (currentUserIdx > 0) {
      setCurrentUserIdx((prev) => prev - 1);
      const prevGroup = groups[currentUserIdx - 1];
      setCurrentStoryIdx(prevGroup ? prevGroup.stories.length - 1 : 0);
    }
  }

  async function handleDeleteStory() {
    if (!currentStory?.id) return;
    setIsDeleting(true);
    try {
      await mobileApi.deleteStory(currentStory.id);
      if (onStoryDeleted) onStoryDeleted();
      handleNext();
    } catch (e) {
      console.warn('Failed to delete story:', e);
      Alert.alert('Error', 'Failed to delete story.');
    } finally {
      setIsDeleting(false);
    }
  }

  function handleSendReaction(emoji: string) {
    if (!currentGroup?.userId) return;
    const socket = getSocket();
    socket.emit('sendMessage', {
      matchId: currentGroup.userId,
      content: `Replied to your story: ${emoji}`,
    });
    Alert.alert('Sent!', `Reacted with ${emoji}`);
  }

  function handleSendReply() {
    if (!replyText.trim() || !currentGroup?.userId) return;
    const socket = getSocket();
    socket.emit('sendMessage', {
      matchId: currentGroup.userId,
      content: `Replied to your story: "${replyText.trim()}"`,
    });
    setReplyText('');
    Alert.alert('Sent!', 'Your reply was sent.');
  }

  if (!currentGroup || !currentStory) {
    return null;
  }

  return (
    <Modal visible={true} transparent={false} animationType="fade">
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        {/* Fullscreen Story Image */}
        <Image
          source={{ uri: currentStory.mediaUrl }}
          style={styles.storyImage}
          resizeMode="cover"
        />

        {/* Tap areas for Prev / Next navigation */}
        <View style={styles.touchAreaRow}>
          <TouchableWithoutFeedback
            onPress={handlePrev}
            onPressIn={() => setIsPaused(true)}
            onPressOut={() => {
              if (!showViewers) setIsPaused(false);
            }}
          >
            <View style={styles.touchLeft} />
          </TouchableWithoutFeedback>

          <TouchableWithoutFeedback
            onPress={handleNext}
            onPressIn={() => setIsPaused(true)}
            onPressOut={() => {
              if (!showViewers) setIsPaused(false);
            }}
          >
            <View style={styles.touchRight} />
          </TouchableWithoutFeedback>
        </View>

        {/* Top Header Overlay */}
        <View style={styles.topHeader}>
          {/* Progress Segments */}
          <View style={styles.progressSegmentsRow}>
            {currentGroup.stories.map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.segmentBar,
                  idx === currentStoryIdx
                    ? styles.segmentActive
                    : idx < currentStoryIdx
                    ? styles.segmentCompleted
                    : styles.segmentInactive,
                ]}
              />
            ))}
          </View>

          {/* User Info Row */}
          <View style={styles.userInfoRow}>
            <View style={styles.userProfileCol}>
              <Image
                source={{
                  uri:
                    currentGroup.userPhoto ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop',
                }}
                style={styles.userAvatar}
              />
              <Text style={styles.userNameText}>
                {isSelf ? 'Your Story' : currentGroup.userName}
              </Text>
              <Ionicons name="checkmark-circle" size={14} color="#fb7185" />
            </View>

            <View style={styles.headerActionRow}>
              {isSelf && (
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={handleDeleteStory}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Ionicons name="trash-outline" size={20} color="#ffffff" />
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.iconBtn} onPress={onClose}>
                <Ionicons name="close" size={26} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Caption Overlay */}
        {currentStory.caption ? (
          <View style={styles.captionOverlay}>
            <Text style={styles.captionText}>{currentStory.caption}</Text>
          </View>
        ) : null}

        {/* Bottom Reaction & Reply Bar (For other users) */}
        {!isSelf && (
          <View style={styles.bottomBar}>
            {/* Quick Emoji Reactions */}
            <View style={styles.quickReactionsRow}>
              {QUICK_REACTIONS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.reactionBtn}
                  onPress={() => handleSendReaction(emoji)}
                >
                  <Text style={styles.reactionText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Direct Message Input */}
            <View style={styles.replyInputRow}>
              <TextInput
                style={styles.replyInput}
                placeholder={`Reply to ${currentGroup.userName}...`}
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                value={replyText}
                onChangeText={setReplyText}
                onFocus={() => setIsPaused(true)}
                onBlur={() => setIsPaused(false)}
              />
              {replyText.trim().length > 0 && (
                <TouchableOpacity style={styles.sendReplyBtn} onPress={handleSendReply}>
                  <Ionicons name="send" size={16} color="#ffffff" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Bottom Bar: "Seen by N" button for own story */}
        {isSelf && (
          <View style={styles.selfBottomBar}>
            <TouchableOpacity
              style={styles.seenByBtn}
              activeOpacity={0.85}
              onPress={() => {
                setIsPaused(true);
                setShowViewers(true);
              }}
            >
              <Ionicons name="eye-outline" size={17} color="#ffffff" />
              <Text style={styles.seenByText}>
                Seen by {viewersList.length}
              </Text>
              <Ionicons name="chevron-up" size={15} color="rgba(255, 255, 255, 0.7)" />
            </TouchableOpacity>
          </View>
        )}

        {/* Story Viewers Bottom Sheet Overlay */}
        {showViewers && (
          <View style={styles.viewersSheetOverlay}>
            <View style={styles.viewersSheetCard}>
              <View style={styles.sheetHandle} />

              <View style={styles.sheetHeaderRow}>
                <View style={styles.sheetHeaderTitleCol}>
                  <Ionicons name="eye" size={20} color="#f43f5e" />
                  <Text style={styles.sheetHeaderTitle}>Story Viewers</Text>
                  <View style={styles.viewersCountBadge}>
                    <Text style={styles.viewersCountText}>{viewersList.length}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.sheetCloseBtn}
                  onPress={() => {
                    setShowViewers(false);
                    setIsPaused(false);
                  }}
                >
                  <Ionicons name="close" size={22} color="#ffffff" />
                </TouchableOpacity>
              </View>

              {/* Viewers List Scroll */}
              <ScrollView style={styles.viewersScroll} contentContainerStyle={{ paddingVertical: 10 }}>
                {loadingViewers ? (
                  <View style={styles.viewersCenter}>
                    <ActivityIndicator size="small" color="#f43f5e" />
                    <Text style={styles.viewersLoadingText}>Loading viewers...</Text>
                  </View>
                ) : viewersList.length === 0 ? (
                  <View style={styles.viewersEmptyBox}>
                    <Ionicons name="eye-off-outline" size={40} color="#52525b" />
                    <Text style={styles.viewersEmptyTitle}>No viewers yet</Text>
                    <Text style={styles.viewersEmptySub}>
                      When someone views your story, they will appear here.
                    </Text>
                  </View>
                ) : (
                  viewersList.map((viewer) => (
                    <View key={viewer.viewerId} style={styles.viewerItemRow}>
                      <View style={styles.viewerAvatarBox}>
                        {viewer.photoUrl ? (
                          <Image source={{ uri: viewer.photoUrl }} style={styles.viewerAvatarImg} />
                        ) : (
                          <View style={styles.viewerAvatarFallback}>
                            <Ionicons name="person" size={18} color="#71717a" />
                          </View>
                        )}
                      </View>

                      <View style={styles.viewerInfoCol}>
                        <Text style={styles.viewerNameText}>
                          {viewer.name}
                          {viewer.age ? `, ${viewer.age}` : ''}
                        </Text>
                        <Text style={styles.viewedTimeText}>
                          Viewed {new Date(viewer.viewedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    position: 'relative',
  },
  storyImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  touchAreaRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    zIndex: 10,
  },
  touchLeft: {
    flex: 1,
    height: '100%',
  },
  touchRight: {
    flex: 2,
    height: '100%',
  },
  topHeader: {
    position: 'absolute',
    top: 20,
    left: 16,
    right: 16,
    zIndex: 20,
    gap: 12,
  },
  progressSegmentsRow: {
    flexDirection: 'row',
    gap: 4,
    width: '100%',
  },
  segmentBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  segmentActive: {
    backgroundColor: '#ffffff',
  },
  segmentCompleted: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  segmentInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userProfileCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  userNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  headerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBtn: {
    padding: 6,
  },
  captionOverlay: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    zIndex: 20,
  },
  captionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    zIndex: 20,
    gap: 10,
  },
  quickReactionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
  },
  reactionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  reactionText: {
    fontSize: 20,
  },
  replyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  replyInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
    paddingVertical: 6,
  },
  sendReplyBtn: {
    padding: 6,
  },
  selfBottomBar: {
    position: 'absolute',
    bottom: 28,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  seenByBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  seenByText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  viewersSheetOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
    zIndex: 40,
  },
  viewersSheetCard: {
    backgroundColor: '#18181b',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderTopColor: '#27272a',
    maxHeight: '65%',
    padding: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#52525b',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  sheetHeaderTitleCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  viewersCountBadge: {
    backgroundColor: '#27272a',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  viewersCountText: {
    color: '#fb7185',
    fontSize: 11,
    fontWeight: '700',
  },
  sheetCloseBtn: {
    padding: 4,
    borderRadius: 16,
    backgroundColor: '#27272a',
  },
  viewersScroll: {
    marginTop: 8,
  },
  viewersCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  viewersLoadingText: {
    color: '#a1a1aa',
    fontSize: 12,
    marginTop: 8,
  },
  viewersEmptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  viewersEmptyTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
  },
  viewersEmptySub: {
    color: '#71717a',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  viewerItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  viewerAvatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#27272a',
  },
  viewerAvatarImg: {
    width: '100%',
    height: '100%',
  },
  viewerAvatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerInfoCol: {
    marginLeft: 12,
    flex: 1,
  },
  viewerNameText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  viewedTimeText: {
    color: '#a1a1aa',
    fontSize: 11,
    marginTop: 2,
  },
});
