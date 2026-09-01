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
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { Candidate, INTEREST_LABELS } from '@/constants/mockData';
import { mobileApi } from '@/services/api';
import StoryUploadModal from '@/components/stories/StoryUploadModal';
import StoryViewerModal, { StoryUserGroup } from '@/components/stories/StoryViewerModal';

type ViewMode = 'grid2' | 'grid1' | 'list';
type StatusFilter = 'all' | 'online';

const PAGE_SIZE = 15;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

function formatUserActivity(lastActiveAt?: string | Date | null, isOnline?: boolean) {
  if (isOnline) {
    return {
      isOnline: true,
      statusText: 'Online',
    };
  }

  if (!lastActiveAt) {
    return {
      isOnline: false,
      statusText: 'Offline',
    };
  }

  const date = new Date(lastActiveAt);
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

  if (diffMinutes < 1) {
    return { isOnline: true, statusText: 'Online' };
  }
  if (diffMinutes < 60) {
    return { isOnline: false, statusText: `Active ${diffMinutes}m ago` };
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return { isOnline: false, statusText: `Active ${diffHours}h ago` };
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) {
    return { isOnline: false, statusText: 'Active yesterday' };
  }
  if (diffDays < 7) {
    return { isOnline: false, statusText: `Active ${diffDays}d ago` };
  }
  if (diffDays < 30) {
    const diffWeeks = Math.floor(diffDays / 7);
    return { isOnline: false, statusText: `Active ${diffWeeks}w ago` };
  }
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return { isOnline: false, statusText: `Active ${diffMonths}mo ago` };
  }
  return { isOnline: false, statusText: 'Offline' };
}

const CITY_CACHE_STORAGE_KEY = 'ember_city_lookup_cache';

function getInitialCityCache(): Record<string, string> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const stored = window.localStorage.getItem(CITY_CACHE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

let cityLookupCache: Record<string, string> = getInitialCityCache();

function saveCityCache(key: string, label: string) {
  cityLookupCache[key] = label;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(CITY_CACHE_STORAGE_KEY, JSON.stringify(cityLookupCache));
    } catch {}
  }
}

function parseBioContent(bioStr?: string) {
  if (!bioStr) return { cleanBio: '', interests: [] as string[], city: '' };

  const cityMatch = bioStr.match(/\[CITY:(.*?)\]/i);
  const city = cityMatch && cityMatch[1] ? cityMatch[1].trim() : '';

  const interestsMatch = bioStr.match(/\[INTERESTS:(.*?)\]/i);
  let interests: string[] = [];
  if (interestsMatch && interestsMatch[1]) {
    interests = interestsMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
  }

  const cleanBio = bioStr
    .replace(/\[CITY:.*?\]/gi, '')
    .replace(/\[INTERESTS:.*?\]/gi, '')
    .trim();

  return { cleanBio, interests, city };
}

export default function DiscoverScreen() {
  const router = useRouter();
  const { logout, user } = useAuth();
  const { handleScroll: handleTabBarScroll, headerTranslateY } = useTabBarVisibility();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidateCities, setCandidateCities] = useState<Record<string, string>>({});
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  function getCachedCitiesSync(items: Candidate[]): Record<string, string> {
    const resolved: Record<string, string> = {};
    for (const c of items) {
      const { city: bioCity } = parseBioContent(c.bio);
      if (bioCity) {
        resolved[c.userId] = bioCity;
      } else if (c.latitude != null && c.longitude != null) {
        const latNum = Number(c.latitude);
        const lngNum = Number(c.longitude);
        if (!isNaN(latNum) && !isNaN(lngNum)) {
          const key = `${latNum.toFixed(3)},${lngNum.toFixed(3)}`;
          if (cityLookupCache[key]) {
            resolved[c.userId] = cityLookupCache[key];
          }
        }
      }
    }
    return resolved;
  }

  async function resolveCitiesForCandidates(items: Candidate[]) {
    const toLookup = items.filter((c) => {
      const { city: bioCity } = parseBioContent(c.bio);
      if (bioCity) return false;
      if (c.latitude == null || c.longitude == null) return false;
      const latNum = Number(c.latitude);
      const lngNum = Number(c.longitude);
      if (isNaN(latNum) || isNaN(lngNum)) return false;
      const key = `${latNum.toFixed(3)},${lngNum.toFixed(3)}`;
      return !cityLookupCache[key];
    });

    if (toLookup.length === 0) return;

    await Promise.all(
      toLookup.map(async (c) => {
        const latNum = Number(c.latitude);
        const lngNum = Number(c.longitude);
        const key = `${latNum.toFixed(3)},${lngNum.toFixed(3)}`;
        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latNum}&longitude=${lngNum}&localityLanguage=en`
          );
          if (res.ok) {
            const data = await res.json();
            const city = data.city || data.locality || data.principalSubdivision;
            const country = data.countryName || data.countryCode;
            const label = city ? (country ? `${city}, ${country}` : city) : '';
            if (label) {
              saveCityCache(key, label);
              setCandidateCities((prev) => ({ ...prev, [c.userId]: label }));
            }
          }
        } catch (err) {
          console.warn('Async city lookup error:', err);
        }
      })
    );
  }

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid2');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [modalPhotoIdx, setModalPhotoIdx] = useState<number>(0);
  const [matchModalCandidate, setMatchModalCandidate] = useState<Candidate | null>(null);

  // Stories State
  const [storyGroups, setStoryGroups] = useState<StoryUserGroup[]>([]);
  const [activeStoryIdx, setActiveStoryIdx] = useState<number | null>(null);
  const [isUploadStoryOpen, setIsUploadStoryOpen] = useState<boolean>(false);

  function openCandidateModal(candidate: Candidate) {
    setModalPhotoIdx(0);
    setSelectedCandidate(candidate);
  }

  const syncLikesWithBackend = useCallback(async () => {
    try {
      const remoteMatches = await mobileApi.getMatches();
      if (Array.isArray(remoteMatches)) {
        const activeMatchUserIds = new Set(
          remoteMatches.map((m) => m.user?.id || m.id).filter(Boolean)
        );
        setCandidates((prev) =>
          prev.map((c) => ({
            ...c,
            liked: activeMatchUserIds.has(c.userId),
          }))
        );
        setSelectedCandidate((prev) =>
          prev ? { ...prev, liked: activeMatchUserIds.has(prev.userId) } : null
        );
      }
    } catch (e) {
      console.warn('Sync discovery likes error:', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Re-sync likes whenever screen comes into focus
      syncLikesWithBackend();
      fetchStories();
    }, [syncLikesWithBackend])
  );

  useEffect(() => {
    fetchCandidates();
    fetchStories();
  }, []);

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
    mobileApi
      .getDiscovery(undefined, PAGE_SIZE)
      .then((data) => {
        if (data && Array.isArray(data.items)) {
          setCandidates(data.items);
          setNextCursor(data.nextCursor);
          setHasMore(Boolean(data.hasMore));
          try {
            const initialCities = getCachedCitiesSync(data.items);
            setCandidateCities((prev) => ({ ...prev, ...initialCities }));
            resolveCitiesForCandidates(data.items);
          } catch (e) {
            console.warn('City lookup error:', e);
          }
        }
      })
      .catch((err) => console.warn('Fetch discovery error:', err))
      .finally(() => setLoading(false));
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        mobileApi.getDiscovery(undefined, PAGE_SIZE).then((data) => {
          if (data && Array.isArray(data.items)) {
            setCandidates(data.items);
            setNextCursor(data.nextCursor);
            setHasMore(Boolean(data.hasMore));
            try {
              const initialCities = getCachedCitiesSync(data.items);
              setCandidateCities((prev) => ({ ...prev, ...initialCities }));
              resolveCitiesForCandidates(data.items);
            } catch (e) {
              console.warn('City lookup error:', e);
            }
          }
        }),
        mobileApi.getStoriesFeed().then((data: any) => {
          setStoryGroups(Array.isArray(data) ? data : []);
        }),
      ]);
    } catch (err) {
      console.warn('Refresh discovery error:', err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  async function loadMoreCandidates() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await mobileApi.getDiscovery(nextCursor, PAGE_SIZE);
      if (data && Array.isArray(data.items)) {
        setCandidates((prev) => [...prev, ...data.items]);
        setNextCursor(data.nextCursor);
        setHasMore(Boolean(data.hasMore));
        try {
          const initialCities = getCachedCitiesSync(data.items);
          setCandidateCities((prev) => ({ ...prev, ...initialCities }));
          resolveCitiesForCandidates(data.items);
        } catch (e) {
          console.warn('City lookup error on load more:', e);
        }
      }
    } catch (err) {
      console.warn('Load more discovery error:', err);
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleToggleLike(candidate: Candidate) {
    const isLiked = Boolean(candidate.liked);
    const nextAction = isLiked ? 'UNLIKE' : 'LIKE';

    // Optimistic UI Update
    setCandidates((prev) =>
      prev.map((c) => (c.userId === candidate.userId ? { ...c, liked: !isLiked } : c))
    );
    if (selectedCandidate && selectedCandidate.userId === candidate.userId) {
      setSelectedCandidate({ ...selectedCandidate, liked: !isLiked });
    }

    try {
      const res = await mobileApi.swipe(candidate.userId, nextAction);
      if (!isLiked && res?.matched) {
        setMatchModalCandidate(candidate);
      }
    } catch (e) {
      console.warn('Swipe API error:', e);
      // Revert optimistic update
      setCandidates((prev) =>
        prev.map((c) => (c.userId === candidate.userId ? { ...c, liked: isLiked } : c))
      );
    }
  }

  const [startingChat, setStartingChat] = useState(false);

  async function handleStartChat(candidate: Candidate) {
    try {
      setStartingChat(true);
      setSelectedCandidate(null);

      // If not liked yet, record like quietly in backend without popping up celebration modal
      if (!candidate.liked) {
        setCandidates((prev) =>
          prev.map((c) => (c.userId === candidate.userId ? { ...c, liked: true } : c))
        );
        try {
          await mobileApi.swipe(candidate.userId, 'LIKE');
        } catch (err) {
          console.warn('Silent swipe for chat now error:', err);
        }
      }

      const remoteMatches = await mobileApi.getMatches();
      const existingMatch = (remoteMatches || []).find(
        (m) => m.user?.id === candidate.userId || m.id === candidate.userId
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

  const handleScroll = (event: any) => {
    handleTabBarScroll(event);
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - 180;
    if (isCloseToBottom && hasMore && !loadingMore && !loading) {
      loadMoreCandidates();
    }
  };

  const filteredCandidates = useMemo(() => {
    if (!Array.isArray(candidates)) return [];
    return candidates.filter((c) => {
      if (!c) return false;
      const activity = formatUserActivity(c.lastActiveAt, c.isOnline);
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
  }, [candidates, statusFilter, searchQuery]);

  const onlineCount = useMemo(() => {
    if (!Array.isArray(candidates)) return 0;
    return candidates.filter((c) => c && formatUserActivity(c.lastActiveAt, c.isOnline).isOnline).length;
  }, [candidates]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Top Search & Filter Bar */}
      <Animated.View
        style={[
          styles.topControlBar,
          {
            transform: [{ translateY: headerTranslateY }],
          },
        ]}
      >
        {/* Search Input Box */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#71717a" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search..."
            placeholderTextColor="#71717a"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color="#71717a" />
            </TouchableOpacity>
          )}
        </View>

        {/* All / Online Toggle Pill */}
        <View style={styles.filterPillGroup}>
          <TouchableOpacity
            style={[styles.filterBtn, statusFilter === 'all' && styles.filterBtnActive]}
            onPress={() => setStatusFilter('all')}
          >
            <Text style={[styles.filterBtnText, statusFilter === 'all' && styles.filterBtnTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterBtn, statusFilter === 'online' && styles.filterBtnActive]}
            onPress={() => setStatusFilter('online')}
          >
            <View style={styles.onlineDotIndicator} />
            <Text style={[styles.filterBtnText, statusFilter === 'online' && styles.filterBtnTextActive]}>
              {onlineCount}
            </Text>
          </TouchableOpacity>
        </View>

        {/* View Mode Toggle Buttons */}
        <View style={styles.viewToggleGroup}>
          <TouchableOpacity
            style={[styles.viewIconBtn, viewMode === 'grid1' && styles.viewIconBtnActive]}
            onPress={() => setViewMode('grid1')}
          >
            <Ionicons name="square-outline" size={16} color={viewMode === 'grid1' ? '#ffffff' : '#71717a'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.viewIconBtn, viewMode === 'grid2' && styles.viewIconBtnActive]}
            onPress={() => setViewMode('grid2')}
          >
            <Ionicons name="grid-outline" size={16} color={viewMode === 'grid2' ? '#ffffff' : '#71717a'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.viewIconBtn, viewMode === 'list' && styles.viewIconBtnActive]}
            onPress={() => setViewMode('list')}
          >
            <Ionicons name="list-outline" size={16} color={viewMode === 'list' ? '#ffffff' : '#71717a'} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Main Feed Scroll Container */}
      <ScrollView
        contentContainerStyle={styles.feedScrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#f43f5e"
            colors={['#f43f5e']}
          />
        }
      >
        {/* Stories Reel Bar */}
        {(() => {
          const selfStoryGroup = storyGroups.find(
            (g) => g.isOwnStory || g.isSelf || (user?.id && g.userId === user.id)
          );
          const otherStoryGroups = storyGroups.filter(
            (g) => !(g.isOwnStory || g.isSelf || (user?.id && g.userId === user.id))
          );

          return (
            <View style={styles.storiesSection}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.storiesScroll}
              >
                {/* 1. Self Story / Add Story Item */}
                {selfStoryGroup && selfStoryGroup.stories && selfStoryGroup.stories.length > 0 ? (
                  <TouchableOpacity
                    style={styles.storyItem}
                    activeOpacity={0.85}
                    onPress={() => {
                      const idx = storyGroups.findIndex((g) => g.userId === selfStoryGroup.userId);
                      setActiveStoryIdx(idx !== -1 ? idx : 0);
                    }}
                  >
                    <View style={[styles.storyAvatarRing, styles.storyAvatarRingOnline]}>
                      {selfStoryGroup.userPhoto || selfStoryGroup.stories[0]?.mediaUrl ? (
                        <Image
                          source={{
                            uri: selfStoryGroup.userPhoto || selfStoryGroup.stories[0]?.mediaUrl,
                          }}
                          style={styles.storyAvatarImg}
                        />
                      ) : (
                        <View style={styles.storyAvatarFallback}>
                          <Ionicons name="person" size={22} color="#f43f5e" />
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.selfStoryAddBadge}
                        onPress={(e) => {
                          e.stopPropagation();
                          setIsUploadStoryOpen(true);
                        }}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons name="add" size={13} color="#ffffff" />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.storyNameText}>Your Story</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.storyItem}
                    activeOpacity={0.8}
                    onPress={() => setIsUploadStoryOpen(true)}
                  >
                    <View style={styles.addStoryCircle}>
                      <Ionicons name="person" size={26} color="#71717a" />
                      <View style={styles.addStoryPlusBadge}>
                        <Ionicons name="add" size={14} color="#ffffff" />
                      </View>
                    </View>
                    <Text style={styles.storyNameText}>Add Story</Text>
                  </TouchableOpacity>
                )}

                {/* 2. Other Users' Live Stories Feed */}
                {otherStoryGroups.map((group) => {
                  const photo = group.userPhoto || group.stories?.[0]?.mediaUrl;
                  const globalIdx = storyGroups.findIndex((g) => g.userId === group.userId);
                  return (
                    <TouchableOpacity
                      key={group.userId}
                      style={styles.storyItem}
                      activeOpacity={0.8}
                      onPress={() => setActiveStoryIdx(globalIdx !== -1 ? globalIdx : 0)}
                    >
                      <View
                        style={[
                          styles.storyAvatarRing,
                          (group.hasUnviewed || group.hasUnseen) && styles.storyAvatarRingOnline,
                        ]}
                      >
                        {photo ? (
                          <Image source={{ uri: photo }} style={styles.storyAvatarImg} />
                        ) : (
                          <View style={styles.storyAvatarFallback}>
                            <Ionicons name="person" size={22} color="#71717a" />
                          </View>
                        )}
                      </View>
                      <Text style={styles.storyNameText} numberOfLines={1}>
                        {group.userName.split(' ')[0]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          );
        })()}

        {/* Loading Spinner */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#f43f5e" />
            <Text style={styles.loadingText}>Loading profiles...</Text>
          </View>
        ) : filteredCandidates.length === 0 ? (
          <View style={styles.emptyFeedBox}>
            <Ionicons name="sparkles" size={44} color="#fbbf24" />
            <Text style={styles.emptyTitle}>No Profiles Found</Text>
            <Text style={styles.emptySub}>
              No profiles available matching your filter. Check back later or refresh.
            </Text>
            <TouchableOpacity style={styles.refreshBtn} onPress={fetchCandidates}>
              <Text style={styles.refreshBtnText}>Refresh Feed</Text>
            </TouchableOpacity>
          </View>
        ) : viewMode === 'grid2' ? (
          /* 2-COLUMN GRID (DEFAULT) */
          <View style={styles.grid2Container}>
            {filteredCandidates.map((candidate) => {
              const { cleanBio, city } = parseBioContent(candidate.bio);
              const photoUrl = candidate.photos && candidate.photos[0]?.url;
              const activity = formatUserActivity(candidate.lastActiveAt, candidate.isOnline);

              return (
                <TouchableOpacity
                  key={candidate.userId}
                  activeOpacity={0.88}
                  style={styles.grid2Card}
                  onPress={() => openCandidateModal(candidate)}
                >
                  {/* Photo or Fallback */}
                  {photoUrl ? (
                    <Image source={{ uri: photoUrl }} style={styles.grid2Photo} resizeMode="cover" />
                  ) : (
                    <View style={styles.grid2FallbackPhoto}>
                      <Ionicons name="person" size={44} color="#52525b" />
                    </View>
                  )}

                  {/* Card Top Action & Status Bar */}
                  <View style={styles.cardTopHeader}>
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
                          activity.isOnline ? styles.statusPillTextOnline : styles.statusPillTextOffline,
                        ]}
                        numberOfLines={1}
                      >
                        {activity.statusText}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.heartFloatBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleToggleLike(candidate);
                      }}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons
                        name={candidate.liked ? 'heart' : 'heart-outline'}
                        size={17}
                        color={candidate.liked ? '#f43f5e' : '#ffffff'}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Bottom Scrim & Info Overlay */}
                  <View style={styles.cardBottomOverlay}>
                    <View style={styles.nameRow}>
                      <Text style={styles.grid2Name} numberOfLines={1}>
                        {candidate.name}
                      </Text>
                      <Ionicons name="checkmark-circle" size={14} color="#fb7185" style={{ marginLeft: 3 }} />
                    </View>

                    <View style={styles.grid2LocationRow}>
                      <Ionicons name="location-sharp" size={11} color="#f43f5e" />
                      <Text style={styles.grid2LocationText} numberOfLines={1}>
                        {candidateCities[candidate.userId] ||
                          city ||
                          (candidate.distance_km != null && candidate.distance_km > 0
                            ? `${candidate.distance_km.toFixed(1)} km away`
                            : 'Nearby')}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : viewMode === 'grid1' ? (
          /* 1-COLUMN EXPANDED VIEW */
          <View style={styles.grid1Container}>
            {filteredCandidates.map((candidate) => {
              const { city } = parseBioContent(candidate.bio);
              const photoUrl = candidate.photos && candidate.photos[0]?.url;
              const activity = formatUserActivity(candidate.lastActiveAt, candidate.isOnline);

              return (
                <TouchableOpacity
                  key={candidate.userId}
                  activeOpacity={0.9}
                  style={styles.grid1Card}
                  onPress={() => openCandidateModal(candidate)}
                >
                  <View style={styles.grid1PhotoContainer}>
                    {photoUrl ? (
                      <Image source={{ uri: photoUrl }} style={styles.grid1Photo} resizeMode="cover" />
                    ) : (
                      <View style={styles.grid1FallbackPhoto}>
                        <Ionicons name="person" size={54} color="#52525b" />
                      </View>
                    )}

                    {/* Card Top Action & Status Bar */}
                    <View style={styles.cardTopHeader}>
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
                            activity.isOnline ? styles.statusPillTextOnline : styles.statusPillTextOffline,
                          ]}
                          numberOfLines={1}
                        >
                          {activity.statusText}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={styles.heartFloatBtn}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleToggleLike(candidate);
                        }}
                      >
                        <Ionicons
                          name={candidate.liked ? 'heart' : 'heart-outline'}
                          size={20}
                          color={candidate.liked ? '#f43f5e' : '#ffffff'}
                        />
                      </TouchableOpacity>
                    </View>

                    {/* Card Overlay Info */}
                    <View style={styles.cardBottomOverlay}>
                      <View style={styles.nameRow}>
                        <Text style={styles.grid1Name}>{candidate.name}</Text>
                        <Ionicons name="checkmark-circle" size={16} color="#fb7185" style={{ marginLeft: 4 }} />
                      </View>

                      <View style={styles.grid2LocationRow}>
                        <Ionicons name="location-sharp" size={12} color="#f43f5e" />
                        <Text style={styles.grid2LocationText}>
                          {candidateCities[candidate.userId] ||
                            city ||
                            (candidate.distance_km != null && candidate.distance_km > 0
                              ? `${candidate.distance_km.toFixed(1)} km away`
                              : 'Nearby')}
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          /* LIST VIEW */
          <View style={styles.listContainer}>
            {filteredCandidates.map((candidate) => {
              const { city } = parseBioContent(candidate.bio);
              const photoUrl = candidate.photos && candidate.photos[0]?.url;
              const activity = formatUserActivity(candidate.lastActiveAt, candidate.isOnline);

              return (
                <TouchableOpacity
                  key={candidate.userId}
                  activeOpacity={0.85}
                  style={styles.listItemCard}
                  onPress={() => openCandidateModal(candidate)}
                >
                  <Image source={{ uri: photoUrl }} style={styles.listThumbImg} />
                  <View style={styles.listTextCol}>
                    <View style={styles.listHeaderRow}>
                      <View style={styles.nameRow}>
                        <Text style={styles.listNameText}>{candidate.name}</Text>
                        <Ionicons name="checkmark-circle" size={14} color="#fb7185" style={{ marginLeft: 3 }} />
                      </View>
                      <View
                        style={[
                          styles.statusPillSmall,
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
                            styles.statusPillTextSmall,
                            activity.isOnline ? styles.statusPillTextOnline : styles.statusPillTextOffline,
                          ]}
                        >
                          {activity.statusText}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.locationBadgeRow}>
                      <Ionicons name="location-sharp" size={12} color="#f43f5e" />
                      <Text style={styles.locationBadgeText}>
                        {candidateCities[candidate.userId] ||
                          city ||
                          (candidate.distance_km != null && candidate.distance_km > 0
                            ? `${candidate.distance_km.toFixed(1)} km away`
                            : 'Nearby')}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.listHeartBtn}
                    onPress={() => handleToggleLike(candidate)}
                  >
                    <Ionicons
                      name={candidate.liked ? 'heart' : 'heart-outline'}
                      size={22}
                      color={candidate.liked ? '#f43f5e' : '#a1a1aa'}
                    />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Load More Pagination - ONLY when candidate cards are displayed and more exist */}
        {filteredCandidates.length > 0 && hasMore && (
          <TouchableOpacity
            style={styles.loadMoreBtn}
            onPress={loadMoreCandidates}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.loadMoreText}>Load More Profiles</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Profile Detail Modal */}
      {selectedCandidate && (() => {
        const modalActivity = formatUserActivity(selectedCandidate.lastActiveAt, selectedCandidate.isOnline);
        const photosList = selectedCandidate.photos && selectedCandidate.photos.length > 0
          ? selectedCandidate.photos
          : [];
        const hasMultiplePhotos = photosList.length > 1;

        return (
          <Modal animationType="slide" transparent={false} visible={true}>
            <SafeAreaView style={styles.modalContainer}>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setSelectedCandidate(null)}
              >
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>

              <ScrollView contentContainerStyle={styles.modalScroll}>
                {/* Horizontal Swipeable/Scrollable Hero Photos Carousel */}
                <View style={styles.modalPhotoCarouselContainer}>
                  <ScrollView
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={(e) => {
                      const offset = e.nativeEvent.contentOffset.x;
                      const idx = Math.round(offset / SCREEN_WIDTH);
                      if (idx >= 0 && idx < photosList.length) {
                        setModalPhotoIdx(idx);
                      }
                    }}
                    style={styles.modalPhotoScrollView}
                  >
                    {photosList.length > 0 ? (
                      photosList.map((p, idx) => (
                        <Image
                          key={p.id || idx}
                          source={{ uri: p.url }}
                          style={styles.modalHeroPhoto}
                          resizeMode="cover"
                        />
                      ))
                    ) : (
                      <View style={styles.modalHeroFallback}>
                        <Ionicons name="person" size={72} color="#52525b" />
                      </View>
                    )}
                  </ScrollView>

                  {/* Story-style top indicator segments */}
                  {hasMultiplePhotos && (
                    <View style={styles.modalPhotoSegmentsRow}>
                      {photosList.map((_, idx) => (
                        <View
                          key={idx}
                          style={[
                            styles.modalPhotoSegment,
                            idx === modalPhotoIdx
                              ? styles.modalPhotoSegmentActive
                              : styles.modalPhotoSegmentInactive,
                          ]}
                        />
                      ))}
                    </View>
                  )}

                  {/* Photo Counter Badge */}
                  {hasMultiplePhotos && (
                    <View style={styles.modalPhotoCountBadge}>
                      <Ionicons name="images" size={11} color="#ffffff" style={{ marginRight: 4 }} />
                      <Text style={styles.modalPhotoCountText}>
                        {modalPhotoIdx + 1} / {photosList.length}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.modalDetailsBody}>
                  <View style={styles.modalTitleRow}>
                    <Text style={styles.modalName}>
                      {selectedCandidate.name}
                      {selectedCandidate.age ? `, ${selectedCandidate.age}` : ''}
                    </Text>
                    <TouchableOpacity
                      style={styles.modalHeartBtn}
                      onPress={() => handleToggleLike(selectedCandidate)}
                    >
                      <Ionicons
                        name={selectedCandidate.liked ? 'heart' : 'heart-outline'}
                        size={26}
                        color={selectedCandidate.liked ? '#f43f5e' : '#ffffff'}
                      />
                    </TouchableOpacity>
                  </View>

                  <View
                    style={[
                      styles.statusPill,
                      modalActivity.isOnline ? styles.statusPillOnline : styles.statusPillOffline,
                      { alignSelf: 'flex-start', marginTop: 8 },
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        modalActivity.isOnline ? styles.statusDotOnline : styles.statusDotOffline,
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusPillText,
                        modalActivity.isOnline ? styles.statusPillTextOnline : styles.statusPillTextOffline,
                      ]}
                    >
                      {modalActivity.statusText}
                    </Text>
                  </View>

                  {selectedCandidate.jobTitle ? (
                    <Text style={styles.modalJobText}>
                      {selectedCandidate.jobTitle}{' '}
                      {selectedCandidate.company ? `@ ${selectedCandidate.company}` : ''}
                    </Text>
                  ) : null}

                  <Text style={styles.modalLocationText}>
                    📍 {candidateCities[selectedCandidate.userId] ||
                      parseBioContent(selectedCandidate.bio).city ||
                      selectedCandidate.location ||
                      'Nearby'}
                  </Text>

                  <View style={styles.modalDivider} />

                  <Text style={styles.modalSectionHeading}>About</Text>
                  <Text style={styles.modalBioText}>
                    {parseBioContent(selectedCandidate.bio).cleanBio ||
                      'No bio details provided yet.'}
                  </Text>

                  <Text style={styles.modalSectionHeading}>Passions & Hobbies</Text>
                  <View style={styles.interestsRow}>
                    {(
                      parseBioContent(selectedCandidate.bio).interests.length > 0
                        ? parseBioContent(selectedCandidate.bio).interests
                        : selectedCandidate.interests || []
                    ).map((tag) => {
                      const item = INTEREST_LABELS[tag];
                      return (
                        <View key={tag} style={styles.interestPill}>
                          <Text style={styles.interestText}>
                            {item ? `${item.icon} ${item.label}` : tag}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </ScrollView>

              {/* Sticky Bottom Action Footer with Matched & Chat Now Buttons */}
              <View style={styles.modalActionFooter}>
                {/* Match / Matched Button */}
                <TouchableOpacity
                  style={[
                    styles.modalMatchBtn,
                    selectedCandidate.liked ? styles.modalMatchedBtn : styles.modalUnmatchedBtn,
                  ]}
                  onPress={() => handleToggleLike(selectedCandidate)}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={selectedCandidate.liked ? 'heart' : 'heart-outline'}
                    size={18}
                    color={selectedCandidate.liked ? '#f43f5e' : '#ffffff'}
                  />
                  <Text
                    style={[
                      styles.modalMatchBtnText,
                      selectedCandidate.liked
                        ? styles.modalMatchedBtnText
                        : styles.modalUnmatchedBtnText,
                    ]}
                  >
                    {selectedCandidate.liked ? 'Matched' : 'Match'}
                  </Text>
                </TouchableOpacity>

                {/* Chat Now Button */}
                <TouchableOpacity
                  style={styles.modalChatNowBtn}
                  onPress={() => handleStartChat(selectedCandidate)}
                  disabled={startingChat}
                  activeOpacity={0.85}
                >
                  {startingChat ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="chatbubbles" size={18} color="#f43f5e" />
                      <Text style={styles.modalChatNowBtnText}>Chat Now</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </Modal>
        );
      })()}

      {/* Match Toast Celebration Modal */}
      {matchModalCandidate && (
        <Modal animationType="fade" transparent={true} visible={true}>
          <View style={styles.matchPopupOverlay}>
            <View style={styles.matchPopupCard}>
              <Ionicons name="heart-circle" size={68} color="#f43f5e" />
              <Text style={styles.matchPopupTitle}>It's a Match! ❤️</Text>
              <Text style={styles.matchPopupSub}>
                You and {matchModalCandidate.name} liked each other!
              </Text>

              <Image
                source={{ uri: matchModalCandidate.photos[0]?.url }}
                style={styles.matchPopupAvatar}
              />

              <TouchableOpacity
                style={styles.matchChatActionBtn}
                onPress={() => {
                  setMatchModalCandidate(null);
                  router.push('/matches');
                }}
              >
                <Text style={styles.matchChatActionText}>Send Message</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.matchCloseLink}
                onPress={() => setMatchModalCandidate(null)}
              >
                <Text style={styles.matchCloseText}>Keep Browsing</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

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
    backgroundColor: '#09090b',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#a1a1aa',
    fontSize: 14,
    marginTop: 12,
  },
  topControlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#18181b',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 38,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
    padding: 0,
  },
  filterPillGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderRadius: 20,
    padding: 2,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    gap: 4,
  },
  filterBtnActive: {
    backgroundColor: '#27272a',
  },
  filterBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#71717a',
  },
  filterBtnTextActive: {
    color: '#ffffff',
  },
  onlineDotIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34d399',
  },
  viewToggleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 2,
    borderWidth: 1,
    borderColor: '#27272a',
    gap: 2,
  },
  viewIconBtn: {
    padding: 6,
    borderRadius: 8,
  },
  viewIconBtnActive: {
    backgroundColor: '#27272a',
  },
  storiesSection: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#18181b',
    marginBottom: 8,
  },
  storiesScroll: {
    paddingHorizontal: 16,
    gap: 16,
    alignItems: 'center',
  },
  storyItem: {
    alignItems: 'center',
    width: 64,
  },
  addStoryCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#18181b',
    borderWidth: 2,
    borderColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  addStoryPlusBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#f43f5e',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#09090b',
  },
  selfStoryAddBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#f43f5e',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#09090b',
  },
  storyAvatarRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    padding: 2,
    borderWidth: 2,
    borderColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyAvatarRingOnline: {
    borderColor: '#f43f5e',
  },
  storyAvatarImg: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  storyAvatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#18181b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyNameText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#d4d4d8',
    marginTop: 6,
    textAlign: 'center',
  },
  emptyFeedBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    color: '#a1a1aa',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  refreshBtn: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  refreshBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  feedScrollContent: {
    paddingBottom: 40,
  },
  grid2Container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    rowGap: 12,
  },
  grid2Card: {
    width: (SCREEN_WIDTH - 44) / 2,
    aspectRatio: 3 / 4,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#18181b',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  grid2Photo: {
    width: '100%',
    height: '100%',
  },
  grid2FallbackPhoto: {
    width: '100%',
    height: '100%',
    backgroundColor: '#18181b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: 'transparent',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  grid2Name: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  grid2LocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
  },
  grid2LocationText: {
    fontSize: 11,
    color: '#e4e4e7',
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  grid1Container: {
    paddingHorizontal: 16,
    gap: 16,
  },
  grid1Card: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  grid1PhotoContainer: {
    width: '100%',
    aspectRatio: 3 / 4,
    position: 'relative',
  },
  grid1Photo: {
    width: '100%',
    height: '100%',
  },
  grid1FallbackPhoto: {
    width: '100%',
    height: '100%',
    backgroundColor: '#18181b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid1Name: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
  },
  grid1BioText: {
    fontSize: 13,
    color: '#d4d4d8',
    marginTop: 6,
    lineHeight: 18,
  },
  listContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  listItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 16,
    padding: 12,
    gap: 12,
  },
  listThumbImg: {
    width: 72,
    height: 72,
    borderRadius: 12,
  },
  listTextCol: {
    flex: 1,
  },
  listNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  listBioText: {
    fontSize: 12,
    color: '#a1a1aa',
    marginTop: 4,
  },
  listHeartBtn: {
    padding: 10,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTopHeader: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 12,
    flexShrink: 1,
    marginRight: 6,
  },
  statusPillSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
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
    fontSize: 9.5,
    fontWeight: '600',
  },
  statusPillTextSmall: {
    fontSize: 9.5,
    fontWeight: '600',
  },
  statusPillTextOnline: {
    color: '#6ee7b7',
  },
  statusPillTextOffline: {
    color: '#d4d4d8',
  },
  heartFloatBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'rgba(9, 9, 11, 0.85)',
  },
  candidateName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
  },
  locationBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  locationBadgeText: {
    fontSize: 12,
    color: '#d4d4d8',
    fontWeight: '500',
  },
  cardBioText: {
    fontSize: 13,
    color: '#d4d4d8',
    marginTop: 6,
    lineHeight: 18,
  },
  interestsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  interestPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  interestText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  loadMoreBtn: {
    alignSelf: 'center',
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 12,
  },
  loadMoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 45,
    right: 20,
    zIndex: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    paddingBottom: 40,
  },
  modalHeroPhoto: {
    width: SCREEN_WIDTH,
    height: 380,
  },
  modalPhotoCarouselContainer: {
    width: '100%',
    height: 380,
    position: 'relative',
    backgroundColor: '#18181b',
  },
  modalPhotoScrollView: {
    width: '100%',
    height: 380,
  },
  modalHeroFallback: {
    width: SCREEN_WIDTH,
    height: 380,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18181b',
  },
  modalPhotoSegmentsRow: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 54,
    flexDirection: 'row',
    gap: 4,
    zIndex: 15,
  },
  modalPhotoSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  modalPhotoSegmentActive: {
    backgroundColor: '#ffffff',
  },
  modalPhotoSegmentInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  modalPhotoCountBadge: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    zIndex: 15,
  },
  modalPhotoCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalDetailsBody: {
    padding: 24,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
  },
  modalHeartBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#18181b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalJobText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f43f5e',
    marginTop: 4,
  },
  modalLocationText: {
    fontSize: 13,
    color: '#a1a1aa',
    marginTop: 6,
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#27272a',
    marginVertical: 18,
  },
  modalSectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    marginTop: 12,
  },
  modalBioText: {
    fontSize: 14,
    color: '#d4d4d8',
    lineHeight: 22,
  },
  modalActionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#09090b',
    borderTopWidth: 1,
    borderTopColor: '#27272a',
  },
  modalMatchBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 20,
  },
  modalUnmatchedBtn: {
    backgroundColor: '#f43f5e',
  },
  modalMatchedBtn: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.5)',
  },
  modalMatchBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalUnmatchedBtnText: {
    color: '#ffffff',
  },
  modalMatchedBtnText: {
    color: '#f43f5e',
  },
  modalChatNowBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  modalChatNowBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  matchPopupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  matchPopupCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#18181b',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
  },
  matchPopupTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 10,
  },
  matchPopupSub: {
    fontSize: 13,
    color: '#a1a1aa',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  matchPopupAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: '#f43f5e',
    marginBottom: 20,
  },
  matchChatActionBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: '#f43f5e',
    alignItems: 'center',
    marginBottom: 8,
  },
  matchChatActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  matchCloseLink: {
    paddingVertical: 8,
  },
  matchCloseText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#a1a1aa',
  },
});
