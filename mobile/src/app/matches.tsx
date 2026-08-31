import React, { useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  TextInput,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Dimensions,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Match, Candidate } from '@/constants/mockData';
import { mobileApi } from '@/services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type MatchesViewMode = 'grid2' | 'grid1' | 'list';

export default function MatchesScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<MatchesViewMode>('grid2');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online'>('all');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [modalPhotoIdx, setModalPhotoIdx] = useState<number>(0);

  useFocusEffect(
    useCallback(() => {
      fetchMatches();
    }, [])
  );

  function fetchMatches() {
    if (matches.length === 0) {
      setLoading(true);
    }
    mobileApi
      .getMatches()
      .then((remoteMatches) => {
        if (remoteMatches) {
          setMatches(remoteMatches);
        }
      })
      .catch((err) => console.warn('Fetch matches error:', err))
      .finally(() => setLoading(false));
  }

  async function handleUnmatch(matchId: string, otherUserId?: string) {
    setMatches((prev) => prev.filter((m) => m.id !== matchId));
    if (selectedMatch && selectedMatch.id === matchId) {
      setSelectedMatch(null);
    }
    try {
      if (otherUserId) {
        await mobileApi.swipe(otherUserId, 'UNLIKE');
      }
    } catch (e) {
      console.warn('Unmatch error:', e);
      fetchMatches();
    }
  }

  function openMatchProfile(match: Match) {
    setModalPhotoIdx(0);
    setSelectedMatch(match);
  }

  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      if (statusFilter === 'online' && !m.user.online) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = m.user.name.toLowerCase().includes(q);
        const matchesMsg = m.lastMessage?.text?.toLowerCase().includes(q);
        return matchesName || matchesMsg;
      }
      return true;
    });
  }, [matches, statusFilter, searchQuery]);

  const onlineCount = useMemo(() => {
    return matches.filter((m) => m.user.online).length;
  }, [matches]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Top Search & Filter Bar */}
      <View style={styles.topControlBar}>
        {/* Search Input Box */}
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

        {/* View Mode Toggle */}
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
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#f43f5e" />
          <Text style={styles.loadingText}>Loading matches...</Text>
        </View>
      ) : matches.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="heart-dislike-outline" size={48} color="#f43f5e" />
          <Text style={styles.emptyTitle}>No Matches Yet</Text>
          <Text style={styles.emptyText}>
            Keep discovering profiles! When someone likes you back, they will appear here.
          </Text>
          <TouchableOpacity style={styles.discoverBtn} onPress={() => router.push('/')}>
            <Text style={styles.discoverBtnText}>Explore Profiles</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {viewMode === 'grid2' ? (
            /* 2-COLUMN MATCHES GRID */
            <View style={styles.grid2Container}>
              {filteredMatches.map((match) => (
                <TouchableOpacity
                  key={match.id}
                  activeOpacity={0.88}
                  style={styles.grid2Card}
                  onPress={() => openMatchProfile(match)}
                >
                  <Image source={{ uri: match.user.avatar }} style={styles.grid2Photo} resizeMode="cover" />

                  {/* Card Top Action & Status Bar */}
                  <View style={styles.cardTopHeader}>
                    <View
                      style={[
                        styles.statusPill,
                        match.user.online ? styles.statusPillOnline : styles.statusPillOffline,
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          match.user.online ? styles.statusDotOnline : styles.statusDotOffline,
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusPillText,
                          match.user.online ? styles.statusPillTextOnline : styles.statusPillTextOffline,
                        ]}
                        numberOfLines={1}
                      >
                        {match.user.online ? 'Online' : 'Offline'}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.heartFloatBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleUnmatch(match.id, match.user.id);
                      }}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="heart" size={17} color="#f43f5e" />
                    </TouchableOpacity>
                  </View>

                  {/* Bottom Overlay */}
                  <View style={styles.cardBottomOverlay}>
                    <View style={styles.nameRow}>
                      <Text style={styles.grid2Name} numberOfLines={1}>
                        {match.user.name}
                      </Text>
                      <Ionicons name="checkmark-circle" size={14} color="#fb7185" style={{ marginLeft: 3 }} />
                    </View>

                    <Text style={styles.grid2MsgText} numberOfLines={1}>
                      {match.lastMessage?.text || 'Say hello! 👋'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : viewMode === 'grid1' ? (
            /* 1-COLUMN BIG CARDS */
            <View style={styles.grid1Container}>
              {filteredMatches.map((match) => (
                <TouchableOpacity
                  key={match.id}
                  activeOpacity={0.9}
                  style={styles.grid1Card}
                  onPress={() => openMatchProfile(match)}
                >
                  <View style={styles.grid1PhotoContainer}>
                    <Image source={{ uri: match.user.avatar }} style={styles.grid1Photo} resizeMode="cover" />

                    <View style={styles.cardTopHeader}>
                      <View
                        style={[
                          styles.statusPill,
                          match.user.online ? styles.statusPillOnline : styles.statusPillOffline,
                        ]}
                      >
                        <View
                          style={[
                            styles.statusDot,
                            match.user.online ? styles.statusDotOnline : styles.statusDotOffline,
                          ]}
                        />
                        <Text
                          style={[
                            styles.statusPillText,
                            match.user.online ? styles.statusPillTextOnline : styles.statusPillTextOffline,
                          ]}
                          numberOfLines={1}
                        >
                          {match.user.online ? 'Online' : 'Offline'}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={styles.heartFloatBtn}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleUnmatch(match.id, match.user.id);
                        }}
                      >
                        <Ionicons name="heart" size={20} color="#f43f5e" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.cardBottomOverlay}>
                      <View style={styles.nameRow}>
                        <Text style={styles.grid1Name}>{match.user.name}</Text>
                        <Ionicons name="checkmark-circle" size={16} color="#fb7185" style={{ marginLeft: 4 }} />
                      </View>
                      <Text style={styles.grid2MsgText} numberOfLines={1}>
                        {match.lastMessage?.text || 'Say hello! 👋'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            /* LIST / MESSAGES VIEW */
            <View style={styles.chatList}>
              {filteredMatches.map((match) => (
                <TouchableOpacity
                  key={match.id}
                  style={styles.chatItem}
                  onPress={() => router.push(`/chat/${match.id}` as any)}
                >
                  <View style={styles.avatarContainer}>
                    <Image source={{ uri: match.user.avatar }} style={styles.chatAvatar} />
                    {match.user.online && <View style={styles.onlineDotChat} />}
                  </View>

                  <View style={styles.chatInfo}>
                    <View style={styles.chatTopRow}>
                      <View style={styles.nameRow}>
                        <Text style={styles.chatName}>{match.user.name}</Text>
                        <Ionicons name="checkmark-circle" size={14} color="#fb7185" style={{ marginLeft: 3 }} />
                      </View>
                      <Text
                        style={[
                          styles.chatTime,
                          match.lastMessage.unread && styles.chatTimeUnread,
                        ]}
                      >
                        {match.lastMessage.createdAt}
                      </Text>
                    </View>

                    <View style={styles.chatBottomRow}>
                      <Text
                        style={[
                          styles.chatMessage,
                          match.lastMessage.unread && styles.chatMessageUnread,
                        ]}
                        numberOfLines={1}
                      >
                        {match.lastMessage.senderId === 'me' ? 'You: ' : ''}
                        {match.lastMessage.text}
                      </Text>

                      <TouchableOpacity
                        style={styles.unmatchBtn}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleUnmatch(match.id, match.user.id);
                        }}
                      >
                        <Ionicons name="heart" size={18} color="#f43f5e" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Match Profile Detail Modal */}
      {selectedMatch && (
        <Modal animationType="slide" transparent={false} visible={true}>
          <SafeAreaView style={styles.modalContainer}>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setSelectedMatch(null)}
            >
              <Ionicons name="close" size={24} color="#ffffff" />
            </TouchableOpacity>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <View style={styles.modalPhotoCarouselContainer}>
                <Image
                  source={{ uri: selectedMatch.user.avatar }}
                  style={styles.modalHeroPhoto}
                  resizeMode="cover"
                />
              </View>

              <View style={styles.modalDetailsBody}>
                <View style={styles.modalTitleRow}>
                  <Text style={styles.modalName}>{selectedMatch.user.name}</Text>
                  <TouchableOpacity
                    style={styles.modalHeartBtn}
                    onPress={() => handleUnmatch(selectedMatch.id, selectedMatch.user.id)}
                  >
                    <Ionicons name="heart" size={26} color="#f43f5e" />
                  </TouchableOpacity>
                </View>

                <View
                  style={[
                    styles.statusPill,
                    selectedMatch.user.online ? styles.statusPillOnline : styles.statusPillOffline,
                    { alignSelf: 'flex-start', marginTop: 8 },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      selectedMatch.user.online ? styles.statusDotOnline : styles.statusDotOffline,
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusPillText,
                      selectedMatch.user.online ? styles.statusPillTextOnline : styles.statusPillTextOffline,
                    ]}
                  >
                    {selectedMatch.user.online ? 'Online' : 'Offline'}
                  </Text>
                </View>

                {selectedMatch.user.bio ? (
                  <View style={styles.modalSection}>
                    <Text style={styles.sectionTitle}>About</Text>
                    <Text style={styles.bioContentText}>{selectedMatch.user.bio}</Text>
                  </View>
                ) : null}
              </View>
            </ScrollView>

            {/* Sticky Action Footer */}
            <View style={styles.modalActionFooter}>
              <TouchableOpacity
                style={styles.modalMatchedBtn}
                onPress={() => handleUnmatch(selectedMatch.id, selectedMatch.user.id)}
                activeOpacity={0.85}
              >
                <Ionicons name="heart" size={18} color="#f43f5e" />
                <Text style={styles.modalMatchedBtnText}>Matched</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalChatNowBtn}
                onPress={() => {
                  const mId = selectedMatch.id;
                  setSelectedMatch(null);
                  router.push(`/chat/${mId}` as any);
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="chatbubble-ellipses" size={18} color="#ffffff" />
                <Text style={styles.modalChatNowBtnText}>Chat Now</Text>
              </TouchableOpacity>
            </View>
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
  },
  filterPillGroup: {
    flexDirection: 'row',
    backgroundColor: '#18181b',
    borderRadius: 20,
    padding: 3,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
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
    backgroundColor: '#10b981',
  },
  viewToggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#18181b',
    borderRadius: 20,
    padding: 3,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  viewIconBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
  },
  viewIconBtnActive: {
    backgroundColor: '#27272a',
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 30,
  },
  grid2Container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  grid2Card: {
    width: (SCREEN_WIDTH - 34) / 2,
    height: 240,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#18181b',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  grid2Photo: {
    width: '100%',
    height: '100%',
  },
  grid1Container: {
    gap: 16,
  },
  grid1Card: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  grid1PhotoContainer: {
    width: '100%',
    height: 380,
    position: 'relative',
  },
  grid1Photo: {
    width: '100%',
    height: '100%',
  },
  grid1Name: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  cardTopHeader: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 14,
    borderWidth: 1,
    flexShrink: 1,
  },
  statusPillOnline: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderColor: '#10b981',
  },
  statusPillOffline: {
    backgroundColor: 'rgba(39, 39, 42, 0.85)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 4,
  },
  statusDotOnline: {
    backgroundColor: '#10b981',
  },
  statusDotOffline: {
    backgroundColor: '#a1a1aa',
  },
  statusPillText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  statusPillTextOnline: {
    color: '#ffffff',
  },
  statusPillTextOffline: {
    color: '#d4d4d8',
  },
  heartFloatBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    flexShrink: 0,
  },
  cardBottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: 'transparent',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  grid2Name: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  grid2MsgText: {
    fontSize: 11,
    color: '#d4d4d8',
    marginTop: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  chatList: {
    gap: 10,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 18,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  avatarContainer: {
    position: 'relative',
  },
  chatAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  onlineDotChat: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#18181b',
  },
  chatInfo: {
    flex: 1,
    marginLeft: 12,
  },
  chatTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chatName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  chatTime: {
    fontSize: 11,
    color: '#71717a',
  },
  chatTimeUnread: {
    color: '#f43f5e',
    fontWeight: '600',
  },
  chatBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  chatMessage: {
    fontSize: 12,
    color: '#a1a1aa',
    flex: 1,
    marginRight: 8,
  },
  chatMessageUnread: {
    color: '#ffffff',
    fontWeight: '600',
  },
  unmatchBtn: {
    padding: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    marginTop: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 12,
  },
  emptyText: {
    fontSize: 13,
    color: '#a1a1aa',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    marginBottom: 20,
  },
  discoverBtn: {
    backgroundColor: '#f43f5e',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  discoverBtnText: {
    fontSize: 13,
    fontWeight: '700',
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
    paddingBottom: 90,
  },
  modalPhotoCarouselContainer: {
    width: '100%',
    height: 380,
    backgroundColor: '#18181b',
  },
  modalHeroPhoto: {
    width: SCREEN_WIDTH,
    height: 380,
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
    borderWidth: 1,
    borderColor: '#27272a',
  },
  modalSection: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#71717a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  bioContentText: {
    fontSize: 14,
    color: '#d4d4d8',
    lineHeight: 20,
  },
  modalActionFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: 'rgba(9, 9, 11, 0.95)',
    borderTopWidth: 1,
    borderTopColor: '#18181b',
  },
  modalMatchedBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.4)',
    paddingVertical: 14,
    borderRadius: 20,
  },
  modalMatchedBtnText: {
    color: '#f43f5e',
    fontSize: 14,
    fontWeight: '800',
  },
  modalChatNowBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: '#3f3f46',
    paddingVertical: 14,
    borderRadius: 20,
  },
  modalChatNowBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
