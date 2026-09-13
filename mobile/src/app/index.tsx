import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  StatusBar,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { usePresence } from '@/context/PresenceContext';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { Candidate, INTEREST_LABELS } from '@/constants/mockData';
import { mobileApi } from '@/services/api';
import StoryUploadModal from '@/components/stories/StoryUploadModal';
import StoryViewerModal, { StoryUserGroup } from '@/components/stories/StoryViewerModal';
import { NotificationModal } from '@/components/NotificationModal';

type ViewMode = 'grid2' | 'grid1' | 'list';
type StatusFilter = 'all' | 'online';
type DiscoveryMode = 'all' | 'top_picks' | 'blind_date';

const PAGE_SIZE = 15;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

function parseBioContent(bioStr?: string) {
  if (!bioStr) return { cleanBio: '', interests: [] as string[], city: '', intent: '' };

  const cityMatch = bioStr.match(/\[CITY:(.*?)\]/i);
  const city = cityMatch && cityMatch[1] ? cityMatch[1].trim() : '';

  const intentMatch = bioStr.match(/\[INTENT:(.*?)\]/i);
  const intent = intentMatch && intentMatch[1] ? intentMatch[1].trim() : '';

  const interestsMatch = bioStr.match(/\[INTERESTS:(.*?)\]/i);
  let interests: string[] = [];
  if (interestsMatch && interestsMatch[1]) {
    interests = interestsMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
  }

  const cleanBio = bioStr
    .replace(/\[CITY:.*?\]/gi, '')
    .replace(/\[INTENT:.*?\]/gi, '')
    .replace(/\[INTERESTS:.*?\]/gi, '')
    .replace(/\[[A-Za-z0-9_-]+:.*?\]/gi, '')
    .trim();

  return { cleanBio, interests, city, intent };
}

export default function DiscoverScreen() {
  const router = useRouter();
  const { logout, user, isAuthenticated } = useAuth();
  const { formatUserActivity, queryPresence } = usePresence();
  const { handleScroll: handleTabBarScroll } = useTabBarVisibility();

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidateCities, setCandidateCities] = useState<Record<string, string>>({});
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [discoveryMode, setDiscoveryMode] = useState<DiscoveryMode>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid2');

  // Candidate detail modal
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [modalPhotoIdx, setModalPhotoIdx] = useState<number>(0);
  const [matchModalCandidate, setMatchModalCandidate] = useState<Candidate | null>(null);

  // VIP & Swipes Actions
  const [isBoosted, setIsBoosted] = useState(false);
  const [boostCountdown, setBoostCountdown] = useState<number>(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(2);
  const [swipeQuota, setSwipeQuota] = useState<{ remaining: number; isUnlimited: boolean; totalAllowed: number }>({
    remaining: 10,
    isUnlimited: false,
    totalAllowed: 10,
  });

  // Voice Bio Playback
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  function handlePlayCandidateVoice(url: string, id: string) {
    if (typeof window !== 'undefined' && (window as any).Audio) {
      try {
        if (playingVoiceId === id) {
          setPlayingVoiceId(null);
          return;
        }
        const audio = new (window as any).Audio(url);
        setPlayingVoiceId(id);
        audio.play();
        audio.onended = () => setPlayingVoiceId(null);
        audio.onerror = () => setPlayingVoiceId(null);
      } catch {
        setPlayingVoiceId(null);
      }
    } else {
      Alert.alert('🎙️ Voice Intro', 'Playing candidate voice intro');
    }
  }

  const fetchQuota = useCallback(async () => {
    try {
      const q = await mobileApi.getSwipeQuota();
      if (q) setSwipeQuota(q);
    } catch (e) {
      console.warn('Quota fetch error:', e);
    }
  }, []);

  // Compliment Modal
  const [showComplimentModal, setShowComplimentModal] = useState(false);
  const [complimentText, setComplimentText] = useState('');
  const [sendingCompliment, setSendingCompliment] = useState(false);

  // Interactive Two Truths & Lie
  const [guessedLieIndex, setGuessedLieIndex] = useState<number | null>(null);

  // Report User State & Handler
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('harassment');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  const handleReportSubmit = async () => {
    if (!selectedCandidate) return;
    setSubmittingReport(true);
    try {
      await mobileApi.reportUser(selectedCandidate.userId, reportReason, reportDetails);
      setShowReportModal(false);
      const reportedUserId = selectedCandidate.userId;
      const reportedName = selectedCandidate.name;
      setSelectedCandidate(null);
      setCandidates((prev) => prev.filter((c) => c.userId !== reportedUserId));
      setReportDetails('');
      Alert.alert(
        'Report Submitted',
        `Thank you for helping keep our community safe. Your report regarding ${reportedName} has been sent to our moderation queue.`,
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to submit report');
    } finally {
      setSubmittingReport(false);
    }
  };

  // Stories State
  const [storyGroups, setStoryGroups] = useState<StoryUserGroup[]>([]);
  const [activeStoryIdx, setActiveStoryIdx] = useState<number | null>(null);
  const [isUploadStoryOpen, setIsUploadStoryOpen] = useState<boolean>(false);

  function openCandidateModal(candidate: Candidate) {
    if (swipeQuota && !swipeQuota.isUnlimited && swipeQuota.remaining <= 0) {
      Alert.alert(
        '🔒 Daily Swipes Finished',
        'You have finished all 10 free swipes for today! Cards are locked until tomorrow. Come back tomorrow or upgrade to VIP for unlimited access.',
      );
      return;
    }
    setModalPhotoIdx(0);
    setGuessedLieIndex(null);
    setSelectedCandidate(candidate);
  }

  const syncLikesWithBackend = useCallback(async () => {
    try {
      const remoteMatches = await mobileApi.getMatches();
      if (Array.isArray(remoteMatches)) {
        const activeMatchUserIds = new Set(
          remoteMatches.map((m) => m.user?.id || m.id).filter(Boolean),
        );
        setCandidates((prev) =>
          prev.map((c) => ({
            ...c,
            liked: activeMatchUserIds.has(c.userId),
          })),
        );
        setSelectedCandidate((prev) =>
          prev ? { ...prev, liked: activeMatchUserIds.has(prev.userId) } : null,
        );
      }
    } catch (e) {
      console.warn('Sync discovery likes error:', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCandidates();
      syncLikesWithBackend();
      fetchStories();
      fetchQuota();
    }, [syncLikesWithBackend, fetchQuota]),
  );

  useEffect(() => {
    if (isAuthenticated) {
      fetchCandidates();
      fetchStories();
    }
  }, [isAuthenticated]);

  function fetchStories() {
    mobileApi
      .getStoriesFeed()
      .then((data: any) => {
        setStoryGroups(Array.isArray(data) ? data : []);
      })
      .catch((err) => console.warn('Fetch stories error:', err));
  }

  function fetchCandidates() {
    setLoading(true);
    let fetchPromise: Promise<any>;

    if (discoveryMode === 'top_picks') {
      fetchPromise = mobileApi.getTopPicks().then((res: any) => ({
        items: Array.isArray(res) ? res : res.items || [],
      }));
    } else if (discoveryMode === 'blind_date') {
      fetchPromise = mobileApi.getBlindDateQueue().then((res: any) => ({
        items: Array.isArray(res) ? res : res.items || [],
      }));
    } else {
      fetchPromise = mobileApi.getDiscovery(undefined, PAGE_SIZE);
    }

    fetchPromise
      .then((data) => {
        if (data && Array.isArray(data.items)) {
          setCandidates(data.items);
          queryPresence(data.items.map((c: Candidate) => c.userId));
          setNextCursor(data.nextCursor);
          setHasMore(Boolean(data.hasMore));
        }
      })
      .catch((err) => console.warn('Fetch discovery error:', err))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchCandidates();
  }, [discoveryMode]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchCandidates(), fetchStories()]);
    } catch (err) {
      console.warn('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  }, [queryPresence, discoveryMode]);


  // Boost Profile (Spotlight)
  async function handleBoost() {
    try {
      await mobileApi.boostProfile(30);
      setIsBoosted(true);
      setBoostCountdown(30);
      Alert.alert('🚀 Profile Boosted!', 'Your profile is now in Spotlight at the top of local discovery decks for 30 minutes.');
    } catch (e: any) {
      Alert.alert('Boost', e.message || 'Could not activate boost');
    }
  }

  // Send Compliment
  async function handleSendCompliment() {
    if (!complimentText.trim() || !selectedCandidate) return;
    setSendingCompliment(true);
    const candidateName = selectedCandidate.name;
    const candidateId = selectedCandidate.userId;

    const nextRemaining = swipeQuota.isUnlimited ? 9999 : Math.max(0, swipeQuota.remaining - 1);
    setSwipeQuota((prev) => ({
      ...prev,
      remaining: nextRemaining,
    }));

    // Keep candidate card in list, mark as liked
    setCandidates((prev) =>
      prev.map((c) => (c.userId === candidateId ? { ...c, liked: true } : c)),
    );
    if (nextRemaining <= 0 && !swipeQuota.isUnlimited) {
      setSelectedCandidate(null);
    } else {
      setSelectedCandidate((prev) => (prev ? { ...prev, liked: true } : null));
    }

    try {
      const res = await mobileApi.sendCompliment(
        candidateId,
        complimentText.trim(),
        'profile',
      );
      setShowComplimentModal(false);
      setComplimentText('');
      if (res?.quota) {
        setSwipeQuota(res.quota);
      } else {
        fetchQuota();
      }
      if (nextRemaining <= 0 && !swipeQuota.isUnlimited) {
        Alert.alert(
          '🔒 Daily Swipes Finished',
          `Your compliment was sent to ${candidateName}! You have used all 10 free swipes for today. Cards are now locked until tomorrow.`,
        );
      } else {
        Alert.alert(
          '💌 Compliment Sent!',
          `Your note was sent with a Super Like to ${candidateName}. (${nextRemaining}/10 swipes left)`,
        );
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not send compliment');
      fetchQuota();
    } finally {
      setSendingCompliment(false);
    }
  }

  // Pass Candidate
  async function handlePass(candidate: Candidate) {
    if (swipeQuota && !swipeQuota.isUnlimited && swipeQuota.remaining <= 0) {
      Alert.alert('Daily Limit Reached', 'You have used all 10 free swipes for today.');
      return;
    }

    const nextRemaining = swipeQuota.isUnlimited ? 9999 : Math.max(0, swipeQuota.remaining - 1);
    setSwipeQuota((prev) => ({
      ...prev,
      remaining: nextRemaining,
    }));

    if (selectedCandidate && selectedCandidate.userId === candidate.userId) {
      setSelectedCandidate(null);
    }
    try {
      const res = await mobileApi.swipe(candidate.userId, 'PASS');
      if (res?.quota) {
        setSwipeQuota(res.quota);
      } else {
        fetchQuota();
      }
    } catch (e: any) {
      console.warn('Pass error:', e);
      fetchQuota();
    }
  }

  async function handleToggleLike(candidate: Candidate) {
    const isCurrentlyLiked = Boolean(candidate.liked);

    if (!isCurrentlyLiked) {
      if (swipeQuota && !swipeQuota.isUnlimited && swipeQuota.remaining <= 0) {
        Alert.alert('Daily Limit Reached', 'You have used all 10 free swipes for today.');
        return;
      }

      const nextRemaining = swipeQuota.isUnlimited
        ? 9999
        : Math.max(0, swipeQuota.remaining - 1);

      setSwipeQuota((prev) => ({
        ...prev,
        remaining: nextRemaining,
      }));

      // Keep candidate card in list, mark as liked
      setCandidates((prev) =>
        prev.map((c) => (c.userId === candidate.userId ? { ...c, liked: true } : c)),
      );

      if (selectedCandidate && selectedCandidate.userId === candidate.userId) {
        setSelectedCandidate((prev) => (prev ? { ...prev, liked: true } : null));
      }

      try {
        const res = await mobileApi.swipe(candidate.userId, 'LIKE');
        if (res?.quota) {
          setSwipeQuota(res.quota);
        } else {
          fetchQuota();
        }
        if (res?.matched) {
          setMatchModalCandidate(candidate);
        } else if (nextRemaining <= 0 && !swipeQuota.isUnlimited) {
          setSelectedCandidate(null);
          Alert.alert(
            '🔒 Daily Swipes Finished',
            `You liked ${candidate.name}! You have used all 10 free swipes for today. Cards are now locked until tomorrow.`,
          );
        }
      } catch (e: any) {
        console.warn('Swipe API error:', e);
        Alert.alert('Swipe Notice', e.message || 'Could not record swipe.');
        fetchQuota();
      }
    } else {
      // UNLIKE action
      setCandidates((prev) =>
        prev.map((c) => (c.userId === candidate.userId ? { ...c, liked: false } : c)),
      );

      if (selectedCandidate && selectedCandidate.userId === candidate.userId) {
        setSelectedCandidate((prev) => (prev ? { ...prev, liked: false } : null));
      }

      try {
        const res = await mobileApi.swipe(candidate.userId, 'UNLIKE');
        if (res?.quota) {
          setSwipeQuota(res.quota);
        } else {
          fetchQuota();
        }
      } catch (e: any) {
        console.warn('Unlike API error:', e);
        fetchQuota();
      }
    }
  }

  const [startingChat, setStartingChat] = useState(false);

  async function handleStartChat(candidate: Candidate) {
    try {
      setStartingChat(true);
      setSelectedCandidate(null);

      if (!candidate.liked) {
        setCandidates((prev) =>
          prev.map((c) => (c.userId === candidate.userId ? { ...c, liked: true } : c)),
        );
        try {
          await mobileApi.swipe(candidate.userId, 'LIKE');
        } catch (err) {
          console.warn('Silent swipe error:', err);
        }
      }

      const remoteMatches = await mobileApi.getMatches();
      const existingMatch = (remoteMatches || []).find(
        (m) => m.user?.id === candidate.userId || m.id === candidate.userId,
      );

      if (existingMatch) {
        router.push(`/chat/${existingMatch.id}` as any);
      } else {
        router.push(`/chat/${candidate.userId}` as any);
      }
    } catch (e) {
      console.warn('Start chat error:', e);
      setSelectedCandidate(null);
      router.push('/matches');
    } finally {
      setStartingChat(false);
    }
  }

  const filteredCandidates = useMemo(() => {
    if (!Array.isArray(candidates)) return [];
    return candidates.filter((c) => {
      if (!c) return false;
      const activity = formatUserActivity(c.userId, c.lastActiveAt, c.isOnline);
      if (statusFilter === 'online' && !activity.isOnline) {
        return false;
      }
      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = c.name ? c.name.toLowerCase().includes(q) : false;
        const matchesBio = c.bio ? c.bio.toLowerCase().includes(q) : false;
        return matchesName || matchesBio;
      }
      return true;
    });
  }, [candidates, statusFilter, searchQuery, formatUserActivity]);

  const onlineCount = useMemo(() => {
    if (!Array.isArray(candidates)) return 0;
    return candidates.filter(
      (c) => c && formatUserActivity(c.userId, c.lastActiveAt, c.isOnline).isOnline,
    ).length;
  }, [candidates, formatUserActivity]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" />

      {/* VIP Quick Action Top Bar (Boost Spotlight, Notifications) */}
      <View style={styles.vipTopBar}>
        <View style={styles.brandTitleRow}>
          <Text style={styles.brandTitle}>EMBER</Text>
          <View style={styles.sparkleDot} />
        </View>

        <View style={styles.vipActionGroup}>
          {/* Daily Swipe Quota Badge */}
          <View
            style={[
              styles.quotaBadge,
              swipeQuota.remaining <= 3 && !swipeQuota.isUnlimited && styles.quotaBadgeLow,
            ]}
          >
            <Ionicons
              name="flame"
              size={13}
              color={swipeQuota.remaining <= 3 && !swipeQuota.isUnlimited ? '#EF4444' : '#FF4B72'}
            />
            <Text
              style={[
                styles.quotaBadgeText,
                swipeQuota.remaining <= 3 && !swipeQuota.isUnlimited && styles.quotaBadgeTextLow,
              ]}
            >
              {swipeQuota.isUnlimited ? '∞ VIP' : `${swipeQuota.remaining}/${swipeQuota.totalAllowed}`}
            </Text>
          </View>


          {/* Boost Button */}
          <TouchableOpacity
            style={[styles.vipActionBtn, isBoosted && styles.boostBtnActive]}
            onPress={handleBoost}
          >
            <Ionicons name="flash" size={18} color="#A855F7" />
          </TouchableOpacity>

          {/* Notifications Bell */}
          <TouchableOpacity
            style={styles.vipActionBtn}
            onPress={() => {
              setShowNotifications(true);
              setUnreadNotifCount(0);
            }}
          >
            <Ionicons name="notifications-outline" size={19} color="#FFFFFF" />
            {unreadNotifCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadNotifCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Discovery Mode Switcher Pills */}
      <View style={styles.modeSwitcherBar}>
        <TouchableOpacity
          style={[styles.modePill, discoveryMode === 'all' && styles.modePillActive]}
          onPress={() => setDiscoveryMode('all')}
        >
          <Text
            style={[styles.modePillText, discoveryMode === 'all' && styles.modePillTextActive]}
          >
            Explore Deck
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modePill, discoveryMode === 'top_picks' && styles.modePillActiveGold]}
          onPress={() => setDiscoveryMode('top_picks')}
        >
          <Ionicons
            name="star"
            size={13}
            color={discoveryMode === 'top_picks' ? '#F59E0B' : '#71717A'}
          />
          <Text
            style={[
              styles.modePillText,
              discoveryMode === 'top_picks' && styles.modePillTextActiveGold,
            ]}
          >
            Top Picks
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modePill, discoveryMode === 'blind_date' && styles.modePillActivePurple]}
          onPress={() => setDiscoveryMode('blind_date')}
        >
          <Ionicons
            name="eye-off"
            size={13}
            color={discoveryMode === 'blind_date' ? '#A855F7' : '#71717A'}
          />
          <Text
            style={[
              styles.modePillText,
              discoveryMode === 'blind_date' && styles.modePillTextActivePurple,
            ]}
          >
            Blind Date
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search & Presence Filter Bar */}
      <View style={styles.topControlBar}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#71717a" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search vibes..."
            placeholderTextColor="#71717a"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color="#71717a" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filterPillGroup}>
          <TouchableOpacity
            style={[styles.filterBtn, statusFilter === 'all' && styles.filterBtnActive]}
            onPress={() => setStatusFilter('all')}
          >
            <Text
              style={[styles.filterBtnText, statusFilter === 'all' && styles.filterBtnTextActive]}
            >
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterBtn, statusFilter === 'online' && styles.filterBtnActive]}
            onPress={() => setStatusFilter('online')}
          >
            <View style={styles.onlineDotIndicator} />
            <Text
              style={[
                styles.filterBtnText,
                statusFilter === 'online' && styles.filterBtnTextActive,
              ]}
            >
              {onlineCount}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.viewToggleGroup}>
          <TouchableOpacity
            style={[styles.viewIconBtn, viewMode === 'grid2' && styles.viewIconBtnActive]}
            onPress={() => setViewMode('grid2')}
          >
            <Ionicons
              name="grid-outline"
              size={16}
              color={viewMode === 'grid2' ? '#ffffff' : '#71717a'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewIconBtn, viewMode === 'list' && styles.viewIconBtnActive]}
            onPress={() => setViewMode('list')}
          >
            <Ionicons
              name="list-outline"
              size={16}
              color={viewMode === 'list' ? '#ffffff' : '#71717a'}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Live Daily Swipe Counter Strip */}
      <View style={styles.liveSwipeStrip}>
        <View style={styles.liveSwipeLeft}>
          <Ionicons name="flame" size={14} color="#FF4B72" />
          <Text style={styles.liveSwipeTitle}>Daily Swipes Left:</Text>
        </View>
        <View
          style={[
            styles.liveSwipePill,
            swipeQuota.remaining <= 3 && !swipeQuota.isUnlimited && styles.liveSwipePillLow,
          ]}
        >
          <Text
            style={[
              styles.liveSwipePillText,
              swipeQuota.remaining <= 3 && !swipeQuota.isUnlimited && styles.liveSwipePillTextLow,
            ]}
          >
            {swipeQuota.isUnlimited ? 'Unlimited VIP ✨' : `${swipeQuota.remaining} / ${swipeQuota.totalAllowed}`}
          </Text>
        </View>
      </View>

      {/* Main Feed Scroll Container */}
      <ScrollView
        contentContainerStyle={styles.feedScrollContent}
        onScroll={handleTabBarScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FF4B72"
            colors={['#FF4B72']}
          />
        }
      >
        {/* Stories Reel Bar */}
        {storyGroups.length > 0 && (
          <View style={styles.storiesSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesScroll}>
              {storyGroups.map((group, idx) => (
                <TouchableOpacity
                  key={group.userId}
                  style={styles.storyItem}
                  onPress={() => setActiveStoryIdx(idx)}
                >
                  <View style={[styles.storyAvatarRing, group.hasUnviewed && styles.storyAvatarRingOnline]}>
                    <Image
                      source={{ uri: group.userPhoto || group.stories?.[0]?.mediaUrl }}
                      style={styles.storyAvatarImg}
                    />
                  </View>
                  <Text style={styles.storyNameText} numberOfLines={1}>
                    {group.userName.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Loading State */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#FF4B72" />
            <Text style={styles.loadingText}>Curating your matches...</Text>
          </View>
        ) : filteredCandidates.length === 0 ? (
          <View style={styles.emptyFeedBox}>
            <Ionicons name="sparkles" size={44} color="#F59E0B" />
            <Text style={styles.emptyTitle}>No Profiles in this deck</Text>
            <Text style={styles.emptySub}>
              Try switching filters, updating your passport city, or exploring all candidates.
            </Text>
            <TouchableOpacity style={styles.refreshBtn} onPress={fetchCandidates}>
              <Text style={styles.refreshBtnText}>Refresh Feed</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.grid2Container}>
            {filteredCandidates.map((candidate) => {
              const { city } = parseBioContent(candidate.bio);
              const photoUrl = candidate.photos && candidate.photos[0]?.url;
              const activity = formatUserActivity(
                candidate.userId,
                candidate.lastActiveAt,
                candidate.isOnline,
              );
              const isBlind = discoveryMode === 'blind_date';

              return (
                <TouchableOpacity
                  key={candidate.userId}
                  activeOpacity={0.88}
                  style={[styles.grid2Card, candidate.isBoosted && styles.grid2CardBoosted]}
                  onPress={() => openCandidateModal(candidate)}
                >
                  {photoUrl ? (
                    <Image
                      source={{ uri: photoUrl }}
                      style={[styles.grid2Photo, isBlind && styles.blindBlurPhoto]}
                      resizeMode="cover"
                      blurRadius={isBlind ? 25 : 0}
                    />
                  ) : (
                    <View style={styles.grid2FallbackPhoto}>
                      <Ionicons name="person" size={44} color="#52525b" />
                    </View>
                  )}

                  {/* Top Header Tags */}
                  <View style={styles.cardTopHeader}>
                    {candidate.isBoosted ? (
                      <View style={styles.spotlightTag}>
                        <Ionicons name="flash" size={10} color="#FFFFFF" />
                        <Text style={styles.spotlightText}>Spotlight</Text>
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.statusPill,
                          activity.isOnline ? styles.statusPillOnline : styles.statusPillOffline,
                        ]}
                      >
                        <View
                          style={[
                            styles.statusDot,
                            activity.isOnline ? styles.statusDotOnline : styles.statusDotOffline,
                          ]}
                        />
                        <Text
                          style={[
                            styles.statusPillText,
                            activity.isOnline
                              ? styles.statusPillTextOnline
                              : styles.statusPillTextOffline,
                          ]}
                        >
                          {activity.statusText}
                        </Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={styles.heartFloatBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleToggleLike(candidate);
                      }}
                    >
                      <Ionicons
                        name={candidate.liked ? 'heart' : 'heart-outline'}
                        size={17}
                        color={candidate.liked ? '#FF4B72' : '#FFFFFF'}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Bottom Overlay */}
                  <View style={styles.cardBottomOverlay}>
                    <View style={styles.nameRow}>
                      <Text style={styles.grid2Name} numberOfLines={1}>
                        {isBlind ? 'Mystery Match' : candidate.name}
                      </Text>
                      {(candidate.isVerified || candidate.verified) && !isBlind && (
                        <Ionicons name="shield-checkmark" size={14} color="#38BDF8" />
                      )}
                    </View>

                    {candidate.topPickReason ? (
                      <Text style={styles.topPickTag}>{candidate.topPickReason}</Text>
                    ) : (
                      <View style={styles.grid2LocationRow}>
                        <Ionicons name="location-sharp" size={11} color="#FF4B72" />
                        <Text style={styles.grid2LocationText} numberOfLines={1}>
                          {city ||
                            (candidate.distance_km != null && candidate.distance_km > 0
                              ? `${candidate.distance_km.toFixed(1)} km away`
                              : 'Nearby')}
                        </Text>
                      </View>
                    )}

                    {/* Voice Bio Playback Pill on Card */}
                    {(candidate.voiceBioUrl || (candidate as any).voiceBio) && !isBlind && (
                      <TouchableOpacity
                        style={styles.cardVoicePill}
                        onPress={(e) => {
                          e.stopPropagation();
                          handlePlayCandidateVoice(
                            candidate.voiceBioUrl || (candidate as any).voiceBio!,
                            candidate.userId,
                          );
                        }}
                      >
                        <Ionicons
                          name={playingVoiceId === candidate.userId ? 'pause' : 'mic'}
                          size={11}
                          color="#FFFFFF"
                        />
                        <Text style={styles.cardVoicePillText}>
                          {playingVoiceId === candidate.userId ? 'Playing' : 'Voice Intro'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Candidate Detail Modal */}
      {selectedCandidate && (
        <Modal visible={true} animationType="slide" onRequestClose={() => setSelectedCandidate(null)}>
          <SafeAreaView style={styles.candidateModalContainer} edges={['top', 'left', 'right']}>
            <ScrollView contentContainerStyle={styles.candidateModalScroll}>
              {/* Photo View / Carousel */}
              <View style={styles.modalPhotoBox}>
                <Image
                  source={{
                    uri:
                      selectedCandidate.photos[modalPhotoIdx]?.url ||
                      selectedCandidate.photos[0]?.url ||
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600',
                  }}
                  style={styles.modalMainPhoto}
                />
                <TouchableOpacity
                  style={styles.modalCloseIconBtn}
                  onPress={() => setSelectedCandidate(null)}
                >
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {/* Profile Details Content */}
              <View style={styles.modalInfoContent}>
                <View style={styles.modalHeaderRow}>
                  <View>
                    <View style={styles.nameRow}>
                      <Text style={styles.modalName}>{selectedCandidate.name}</Text>
                      {(selectedCandidate.isVerified || selectedCandidate.verified) && (
                        <Ionicons name="shield-checkmark" size={20} color="#38BDF8" style={{ marginLeft: 6 }} />
                      )}
                    </View>
                    <Text style={styles.modalLocation}>
                      📍 {parseBioContent(selectedCandidate.bio).city || 'Nearby'}
                    </Text>
                  </View>

                  {/* Compatibility Chemistry Badge */}
                  <View style={styles.chemistryBadge}>
                    <Ionicons name="sparkles" size={14} color="#A855F7" />
                    <Text style={styles.chemistryText}>94% Vibe Match</Text>
                  </View>
                </View>

                {/* Voice Intro Player in Detail Modal */}
                {(selectedCandidate.voiceBioUrl || (selectedCandidate as any).voiceBio) && (
                  <View style={styles.modalVoiceSection}>
                    <Text style={styles.modalSectionHeading}>Voice Intro (15s) 🎙️</Text>
                    <TouchableOpacity
                      style={styles.modalVoiceBtn}
                      onPress={() =>
                        handlePlayCandidateVoice(
                          selectedCandidate.voiceBioUrl || (selectedCandidate as any).voiceBio,
                          selectedCandidate.userId,
                        )
                      }
                    >
                      <Ionicons
                        name={playingVoiceId === selectedCandidate.userId ? 'pause' : 'play'}
                        size={18}
                        color="#FFFFFF"
                      />
                      <Text style={styles.modalVoiceBtnText}>
                        {playingVoiceId === selectedCandidate.userId
                          ? 'Playing Voice Intro...'
                          : 'Listen to Voice Intro'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* About Bio */}
                <Text style={styles.modalSectionHeading}>About</Text>
                <Text style={styles.modalBioText}>
                  {parseBioContent(selectedCandidate.bio).cleanBio || selectedCandidate.bio || 'Exploring new places and great coffee.'}
                </Text>

                {/* Passions & Tags */}
                <Text style={styles.modalSectionHeading}>Passions</Text>
                <View style={styles.interestsWrap}>
                  {(
                    parseBioContent(selectedCandidate.bio).interests.length > 0
                      ? parseBioContent(selectedCandidate.bio).interests
                      : selectedCandidate.interests || ['coffee', 'travel', 'music']
                  ).map((tag) => {
                    const item = INTEREST_LABELS[tag];
                    return (
                      <View key={tag} style={styles.interestTagPill}>
                        <Text style={styles.interestTagText}>
                          {item ? `${item.icon} ${item.label}` : tag}
                        </Text>
                      </View>
                    );
                  })}
                </View>



                {/* Interactive Two Truths & A Lie Game */}
                {selectedCandidate.twoTruths && (
                  <View style={styles.twoTruthsBox}>
                    <Text style={styles.twoTruthsHeading}>🎭 Two Truths & A Lie — Guess the lie!</Text>
                    {selectedCandidate.twoTruths.statements.map((stmt, idx) => {
                      const isLie = idx === selectedCandidate.twoTruths?.lieIndex;
                      const hasGuessed = guessedLieIndex !== null;
                      const wasSelected = guessedLieIndex === idx;

                      return (
                        <TouchableOpacity
                          key={idx}
                          style={[
                            styles.twoTruthsOption,
                            hasGuessed && isLie && styles.twoTruthsLieCorrect,
                            hasGuessed && wasSelected && !isLie && styles.twoTruthsLieWrong,
                          ]}
                          onPress={() => setGuessedLieIndex(idx)}
                        >
                          <Text style={styles.twoTruthsOptionText}>{stmt}</Text>
                          {hasGuessed && (
                            <Text style={styles.resultTagText}>
                              {isLie ? '❌ That is the Lie!' : '✅ True!'}
                            </Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* Leave a Direct Compliment */}
                <TouchableOpacity
                  style={styles.complimentActionBtn}
                  onPress={() => setShowComplimentModal(true)}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color="#A855F7" />
                  <Text style={styles.complimentActionText}>Send a Compliment (Message before Match)</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* Bottom Actions Footer */}
            <View style={styles.modalActionFooter}>
              <TouchableOpacity
                style={styles.modalPassBtn}
                onPress={() => handlePass(selectedCandidate)}
              >
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalMatchBtn,
                  selectedCandidate.liked ? styles.modalMatchedBtn : styles.modalUnmatchedBtn,
                ]}
                onPress={() => handleToggleLike(selectedCandidate)}
              >
                <Ionicons
                  name={selectedCandidate.liked ? 'heart' : 'heart-outline'}
                  size={18}
                  color="#FFFFFF"
                />
                <Text style={styles.modalMatchBtnText}>
                  {selectedCandidate.liked
                    ? 'Liked ❤️'
                    : `Like (${swipeQuota.isUnlimited ? '∞' : `${swipeQuota.remaining}/${swipeQuota.totalAllowed}`})`}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalChatNowBtn}
                onPress={() => handleStartChat(selectedCandidate)}
                disabled={startingChat}
              >
                <Ionicons name="chatbubbles" size={18} color="#FF4B72" />
                <Text style={styles.modalChatNowBtnText}>Chat</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalReportBtn}
                onPress={() => setShowReportModal(true)}
              >
                <Ionicons name="flag-outline" size={18} color="#F59E0B" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>
      )}

      {/* Compliment Modal */}
      <Modal visible={showComplimentModal} animationType="slide" transparent>
        <View style={styles.complimentModalOverlay}>
          <View style={styles.complimentCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.complimentTitle}>💌 Send Compliment</Text>
              <TouchableOpacity onPress={() => setShowComplimentModal(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <Text style={styles.complimentSubtitle}>
              Leave a note on {selectedCandidate?.name}&apos;s profile to stand out from regular swipes:
            </Text>
            <TextInput
              style={styles.complimentInput}
              placeholder="e.g. Love your travel photos! Where was that taken?"
              placeholderTextColor="#64748B"
              value={complimentText}
              onChangeText={setComplimentText}
              maxLength={140}
              multiline
            />
            <TouchableOpacity
              style={styles.sendComplimentBtn}
              onPress={handleSendCompliment}
              disabled={sendingCompliment}
            >
              {sendingCompliment ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.sendComplimentText}>Send with Super Like ⭐</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Report Modal */}
      <Modal visible={showReportModal} animationType="slide" transparent>
        <View style={styles.complimentModalOverlay}>
          <View style={styles.complimentCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.complimentTitle}>⚠️ Report {selectedCandidate?.name}</Text>
              <TouchableOpacity onPress={() => setShowReportModal(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <Text style={styles.complimentSubtitle}>
              Select a reason for reporting this user to moderation:
            </Text>
            <View style={{ gap: 6, marginVertical: 4 }}>
              {[
                { id: 'harassment', label: 'Harassment or Inappropriate behavior' },
                { id: 'fake_profile', label: 'Fake Profile / Catfish' },
                { id: 'inappropriate_photos', label: 'Inappropriate Photos' },
                { id: 'spam', label: 'Spam or Commercial Promotion' },
              ].map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[
                    styles.reportReasonOption,
                    reportReason === r.id && styles.reportReasonOptionActive,
                  ]}
                  onPress={() => setReportReason(r.id)}
                >
                  <Text
                    style={[
                      styles.reportReasonText,
                      reportReason === r.id && styles.reportReasonTextActive,
                    ]}
                  >
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[styles.complimentInput, { height: 65 }]}
              placeholder="Additional details (optional)..."
              placeholderTextColor="#64748B"
              value={reportDetails}
              onChangeText={setReportDetails}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendComplimentBtn, { backgroundColor: '#EF4444' }]}
              onPress={handleReportSubmit}
              disabled={submittingReport}
            >
              {submittingReport ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.sendComplimentText}>Submit Report to Moderation</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Notification Modal Center */}
      <NotificationModal
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
      />

      {/* Story Viewer Modal */}
      {activeStoryIdx !== null && storyGroups[activeStoryIdx] && (
        <StoryViewerModal
          groups={storyGroups}
          initialUserIndex={activeStoryIdx}
          onClose={() => setActiveStoryIdx(null)}
          onStoryDeleted={() => fetchStories()}
        />
      )}

      {/* Story Upload Modal */}
      {isUploadStoryOpen && (
        <StoryUploadModal
          onClose={() => setIsUploadStoryOpen(false)}
          onStoryUploaded={() => fetchStories()}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  vipTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FF4B72',
    letterSpacing: 1.5,
  },
  sparkleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
  },
  vipActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vipActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  boostBtnActive: {
    backgroundColor: 'rgba(168, 85, 247, 0.3)',
    borderWidth: 1.5,
    borderColor: '#A855F7',
  },
  notifBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FF4B72',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  modeSwitcherBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  modePillActive: {
    backgroundColor: '#FF4B72',
  },
  modePillActiveGold: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  modePillActivePurple: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    borderWidth: 1,
    borderColor: '#A855F7',
  },
  modePillText: {
    fontSize: 12,
    color: '#71717A',
    fontWeight: '600',
  },
  modePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modePillTextActiveGold: {
    color: '#F59E0B',
    fontWeight: '700',
  },
  modePillTextActivePurple: {
    color: '#C084FC',
    fontWeight: '700',
  },
  topControlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    paddingHorizontal: 10,
    height: 36,
    gap: 6,
  },
  searchIcon: {
    marginRight: 2,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
  },
  filterPillGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    padding: 2,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  filterBtnActive: {
    backgroundColor: '#FF4B72',
  },
  filterBtnText: {
    fontSize: 11,
    color: '#71717A',
    fontWeight: '600',
  },
  filterBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  onlineDotIndicator: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10B981',
  },
  viewToggleGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    padding: 2,
  },
  viewIconBtn: {
    padding: 5,
    borderRadius: 8,
  },
  viewIconBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  feedScrollContent: {
    paddingBottom: 40,
  },
  storiesSection: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 8,
  },
  storiesScroll: {
    paddingHorizontal: 16,
    gap: 14,
  },
  storyItem: {
    alignItems: 'center',
    width: 60,
  },
  storyAvatarRing: {
    width: 54,
    height: 54,
    borderRadius: 27,
    padding: 2,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyAvatarRingOnline: {
    borderColor: '#FF4B72',
  },
  storyAvatarImg: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  storyNameText: {
    fontSize: 10,
    color: '#CBD5E1',
    marginTop: 4,
  },
  centerContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  emptyFeedBox: {
    paddingVertical: 60,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptySub: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
  },
  refreshBtn: {
    backgroundColor: '#FF4B72',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 8,
  },
  refreshBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  grid2Container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  grid2Card: {
    width: (SCREEN_WIDTH - 44) / 2,
    height: 230,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    position: 'relative',
  },
  grid2CardBoosted: {
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  grid2Photo: {
    width: '100%',
    height: '100%',
  },
  blindBlurPhoto: {
    opacity: 0.85,
  },
  grid2FallbackPhoto: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
  },
  cardTopHeader: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  spotlightTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  spotlightText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  statusPillOnline: {
    borderColor: '#10B981',
    borderWidth: 1,
  },
  statusPillOffline: {
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusDotOnline: {
    backgroundColor: '#10B981',
  },
  statusDotOffline: {
    backgroundColor: '#94A3B8',
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statusPillTextOnline: {
    color: '#10B981',
  },
  statusPillTextOffline: {
    color: '#94A3B8',
  },
  heartFloatBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: 'rgba(9, 13, 22, 0.88)',
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  grid2Name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  topPickTag: {
    fontSize: 10,
    color: '#F59E0B',
    fontWeight: '700',
    marginTop: 2,
  },
  grid2LocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  grid2LocationText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  // Candidate Modal Detail Styles
  candidateModalContainer: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  candidateModalScroll: {
    paddingBottom: 80,
  },
  modalPhotoBox: {
    width: '100%',
    height: 400,
    position: 'relative',
  },
  modalMainPhoto: {
    width: '100%',
    height: '100%',
  },
  modalCloseIconBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalInfoContent: {
    padding: 20,
    gap: 14,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalLocation: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  chemistryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  chemistryText: {
    color: '#C084FC',
    fontSize: 12,
    fontWeight: '700',
  },
  modalSectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E2E8F0',
    marginTop: 4,
  },
  modalBioText: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
  },
  interestsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestTagPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  interestTagText: {
    color: '#E2E8F0',
    fontSize: 12,
  },
  promptDisplayCard: {
    backgroundColor: 'rgba(168, 85, 247, 0.08)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.25)',
    gap: 4,
  },
  promptQText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#C084FC',
  },
  promptAText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontStyle: 'italic',
  },
  twoTruthsBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    gap: 8,
    marginTop: 6,
  },
  twoTruthsHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10B981',
    marginBottom: 4,
  },
  twoTruthsOption: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 4,
  },
  twoTruthsLieCorrect: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#EF4444',
  },
  twoTruthsLieWrong: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
  },
  twoTruthsOptionText: {
    fontSize: 13,
    color: '#FFFFFF',
  },
  resultTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
  },
  complimentActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderRadius: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  complimentActionText: {
    color: '#C084FC',
    fontWeight: '700',
    fontSize: 13,
  },
  modalActionFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    gap: 12,
  },
  modalPassBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  modalMatchBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 6,
  },
  modalUnmatchedBtn: {
    backgroundColor: '#FF4B72',
  },
  modalMatchedBtn: {
    backgroundColor: '#10B981',
  },
  modalMatchBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  modalChatNowBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 75, 114, 0.15)',
    borderWidth: 1.5,
    borderColor: '#FF4B72',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 6,
  },
  modalChatNowBtnText: {
    color: '#FF4B72',
    fontWeight: '700',
    fontSize: 15,
  },
  // Compliment Modal Styles
  complimentModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  complimentCard: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  complimentTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  complimentSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
  },
  complimentInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 14,
    height: 90,
  },
  sendComplimentBtn: {
    backgroundColor: '#A855F7',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  sendComplimentText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  // Swipe Quota Badge & Voice Bio Styles
  quotaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 75, 114, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 114, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
  },
  quotaBadgeLow: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#EF4444',
  },
  quotaBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FF4B72',
  },
  quotaBadgeTextLow: {
    color: '#EF4444',
  },
  liveSwipeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 7,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  liveSwipeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveSwipeTitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  liveSwipePill: {
    backgroundColor: 'rgba(255, 75, 114, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 114, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  liveSwipePillLow: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: 'rgba(239, 68, 68, 0.5)',
  },
  liveSwipePillText: {
    color: '#FF4B72',
    fontSize: 11,
    fontWeight: '800',
  },
  liveSwipePillTextLow: {
    color: '#EF4444',
  },
  cardVoicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FF4B72',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  cardVoicePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalVoiceSection: {
    marginTop: 6,
    gap: 6,
  },
  modalVoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FF4B72',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  modalVoiceBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  modalReportBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportReasonOption: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  reportReasonOptionActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#EF4444',
  },
  reportReasonText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  reportReasonTextActive: {
    color: '#EF4444',
    fontWeight: '700',
  },
});
