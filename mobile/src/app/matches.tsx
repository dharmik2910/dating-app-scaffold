import React, { useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StatusBar,
  ActivityIndicator,
  Dimensions,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { usePresence } from '@/context/PresenceContext';
import { Match } from '@/constants/mockData';
import { mobileApi } from '@/services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type MatchesViewMode = 'grid2' | 'grid1' | 'list';
type MainTab = 'matches' | 'likes_you';

export default function MatchesScreen() {
  const router = useRouter();
  const { handleScroll } = useTabBarVisibility();
  const { formatUserActivity, queryPresence } = usePresence();

  const [activeTab, setActiveTab] = useState<MainTab>('matches');
  const [searchQuery, setSearchQuery] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [likesYou, setLikesYou] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<MatchesViewMode>('grid2');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online'>('all');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, []),
  );

  async function fetchData() {
    setLoading(true);
    try {
      const [remoteMatches, inboundLikes] = await Promise.all([
        mobileApi.getMatches(undefined, 50, 'matches'),
        mobileApi.getWhoLikedMe().catch(() => []),
      ]);

      if (remoteMatches) {
        setMatches(remoteMatches);
        queryPresence(remoteMatches.map((m) => m.user?.id).filter(Boolean));
      }

      if (Array.isArray(inboundLikes)) {
        setLikesYou(inboundLikes);
      }
    } catch (err) {
      console.warn('Fetch matches & likes error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUnmatch(matchId: string, otherUserId?: string) {
    setMatches((prev) => prev.filter((m) => m.id !== matchId));
    if (selectedMatch && selectedMatch.id === matchId) {
      setSelectedMatch(null);
    }
    try {
      if (otherUserId) {
        await mobileApi.blockUser(otherUserId);
      }
    } catch (e) {
      console.warn('Unmatch error:', e);
    }
  }

  async function handleInstantMatch(admirer: any) {
    try {
      await mobileApi.swipe(admirer.user.id, 'LIKE');
      setLikesYou((prev) => prev.filter((l) => l.swiperId !== admirer.swiperId));
      fetchData();
      router.push(`/chat/${admirer.user.id}` as any);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not match with admirer');
    }
  }

  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      const activity = formatUserActivity(m.user?.id, m.user?.lastActiveAt, m.user?.online);
      if (statusFilter === 'online' && !activity.isOnline) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = m.user.name.toLowerCase().includes(q);
        const matchesBio = m.user.bio ? m.user.bio.toLowerCase().includes(q) : false;
        return matchesName || matchesBio;
      }
      return true;
    });
  }, [matches, statusFilter, searchQuery, formatUserActivity]);

  const onlineCount = useMemo(() => {
    return matches.filter(
      (m) => formatUserActivity(m.user?.id, m.user?.lastActiveAt, m.user?.online).isOnline,
    ).length;
  }, [matches, formatUserActivity]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" />

      {/* Main Tab Switcher */}
      <View style={styles.tabSwitcher}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'matches' && styles.tabBtnActive]}
          onPress={() => setActiveTab('matches')}
        >
          <Ionicons
            name="heart"
            size={16}
            color={activeTab === 'matches' ? '#FF4B72' : '#71717A'}
          />
          <Text style={[styles.tabBtnText, activeTab === 'matches' && styles.tabBtnTextActive]}>
            Mutual Matches ({matches.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'likes_you' && styles.tabBtnActiveGold]}
          onPress={() => setActiveTab('likes_you')}
        >
          <Ionicons
            name="star"
            size={16}
            color={activeTab === 'likes_you' ? '#F59E0B' : '#71717A'}
          />
          <Text
            style={[styles.tabBtnText, activeTab === 'likes_you' && styles.tabBtnTextActiveGold]}
          >
            Likes You ({likesYou.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab 1: Mutual Matches */}
      {activeTab === 'matches' && (
        <>
          {/* Top Search & Filter Bar */}
          <View style={styles.topControlBar}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color="#71717a" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search matches..."
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
                  style={[
                    styles.filterBtnText,
                    statusFilter === 'all' && styles.filterBtnTextActive,
                  ]}
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

          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#FF4B72" />
              <Text style={styles.loadingText}>Loading matches...</Text>
            </View>
          ) : matches.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="heart-dislike-outline" size={48} color="#FF4B72" />
              <Text style={styles.emptyTitle}>No Matches Yet</Text>
              <Text style={styles.emptyText}>
                Keep discovering profiles! When someone likes you back, they will appear here.
              </Text>
              <TouchableOpacity style={styles.discoverBtn} onPress={() => router.push('/')}>
                <Text style={styles.discoverBtnText}>Explore Profiles</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
              <View style={styles.grid2Container}>
                {filteredMatches.map((match) => {
                  const activity = formatUserActivity(
                    match.user.id,
                    match.user.lastActiveAt,
                    match.user.online,
                  );
                  return (
                    <TouchableOpacity
                      key={match.id}
                      activeOpacity={0.88}
                      style={styles.grid2Card}
                      onPress={() => router.push(`/chat/${match.id}` as any)}
                    >
                      <Image
                        source={{ uri: match.user.avatar }}
                        style={styles.grid2Photo}
                        resizeMode="cover"
                      />

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
                              activity.isOnline
                                ? styles.statusPillTextOnline
                                : styles.statusPillTextOffline,
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
                            handleUnmatch(match.id, match.user.id);
                          }}
                        >
                          <Ionicons name="heart" size={17} color="#FF4B72" />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.cardBottomOverlay}>
                        <View style={styles.nameRow}>
                          <Text style={styles.grid2Name} numberOfLines={1}>
                            {match.user.name}
                          </Text>
                          {match.user.isVerified && (
                            <Ionicons
                              name="shield-checkmark"
                              size={14}
                              color="#38BDF8"
                              style={{ marginLeft: 3 }}
                            />
                          )}
                        </View>
                        <Text style={styles.matchedDateText}>Matched {match.matchedAt}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </>
      )}

      {/* Tab 2: Likes You (VIP Gold Grid) */}
      {activeTab === 'likes_you' && (
        <ScrollView contentContainerStyle={styles.likesYouScroll}>
          <View style={styles.vipBanner}>
            <View style={styles.goldBadgeIcon}>
              <Ionicons name="star" size={18} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.vipTitle}>Gold Spotlight Admirers</Text>
              <Text style={styles.vipSubtitle}>
                People who liked your profile. Tap Match to unlock immediate chat!
              </Text>
            </View>
          </View>

          {likesYou.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="sparkles-outline" size={48} color="#F59E0B" />
              <Text style={styles.emptyTitle}>No New Likes Yet</Text>
              <Text style={styles.emptyText}>
                Use Profile Boost or update your photos and prompts to get more likes!
              </Text>
            </View>
          ) : (
            <View style={styles.grid2Container}>
              {likesYou.map((admirer) => {
                const photoUrl =
                  admirer.user?.photos?.[0]?.url ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600';
                return (
                  <View key={admirer.swipeId} style={styles.goldCard}>
                    <Image source={{ uri: photoUrl }} style={styles.goldPhoto} />
                    <View style={styles.goldOverlay}>
                      <View style={styles.nameRow}>
                        <Text style={styles.goldName}>{admirer.user.name}</Text>
                        {admirer.user.isVerified && (
                          <Ionicons name="shield-checkmark" size={14} color="#38BDF8" />
                        )}
                      </View>

                      {admirer.comment ? (
                        <View style={styles.complimentPill}>
                          <Text style={styles.complimentText}>💬 &ldquo;{admirer.comment}&rdquo;</Text>
                        </View>
                      ) : (
                        <Text style={styles.goldBio} numberOfLines={1}>
                          {admirer.user.bio || 'Liked your profile'}
                        </Text>
                      )}

                      <TouchableOpacity
                        style={styles.instantMatchBtn}
                        onPress={() => handleInstantMatch(admirer)}
                      >
                        <Ionicons name="heart" size={16} color="#FFFFFF" />
                        <Text style={styles.instantMatchText}>Match & Chat</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  tabSwitcher: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  tabBtnActive: {
    backgroundColor: 'rgba(255, 75, 114, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 114, 0.4)',
  },
  tabBtnActiveGold: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#71717A',
  },
  tabBtnTextActive: {
    color: '#FF4B72',
    fontWeight: '700',
  },
  tabBtnTextActiveGold: {
    color: '#F59E0B',
    fontWeight: '700',
  },
  topControlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 38,
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 4,
  },
  filterBtnActive: {
    backgroundColor: '#FF4B72',
  },
  filterBtnText: {
    fontSize: 12,
    color: '#71717A',
    fontWeight: '600',
  },
  filterBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  onlineDotIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  viewToggleGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    padding: 2,
  },
  viewIconBtn: {
    padding: 6,
    borderRadius: 10,
  },
  viewIconBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  emptyContainer: {
    paddingVertical: 60,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
  discoverBtn: {
    backgroundColor: '#FF4B72',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 8,
  },
  discoverBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  grid2Container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  grid2Card: {
    width: (SCREEN_WIDTH - 44) / 2,
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    position: 'relative',
  },
  grid2Photo: {
    width: '100%',
    height: '100%',
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
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
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
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotOnline: {
    backgroundColor: '#10B981',
  },
  statusDotOffline: {
    backgroundColor: '#94A3B8',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  statusPillTextOnline: {
    color: '#10B981',
  },
  statusPillTextOffline: {
    color: '#94A3B8',
  },
  heartFloatBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
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
    backgroundColor: 'rgba(9, 13, 22, 0.85)',
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
  matchedDateText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  // Likes You VIP styles
  likesYouScroll: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  vipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    gap: 12,
  },
  goldBadgeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vipTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F59E0B',
  },
  vipSubtitle: {
    fontSize: 12,
    color: '#CBD5E1',
    marginTop: 2,
    lineHeight: 16,
  },
  goldCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    height: 240,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    position: 'relative',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  goldPhoto: {
    width: '100%',
    height: '100%',
  },
  goldOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: 'rgba(9, 13, 22, 0.9)',
    gap: 4,
  },
  goldName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  goldBio: {
    fontSize: 11,
    color: '#94A3B8',
  },
  complimentPill: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 2,
  },
  complimentText: {
    fontSize: 10,
    color: '#E9D5FF',
    fontStyle: 'italic',
  },
  instantMatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#F59E0B',
    paddingVertical: 7,
    borderRadius: 10,
    marginTop: 6,
  },
  instantMatchText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
});
