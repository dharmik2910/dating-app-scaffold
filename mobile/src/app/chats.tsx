import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { Match } from '@/constants/mockData';
import { mobileApi } from '@/services/api';
import { getSocket } from '@/services/socket';

export default function ChatsScreen() {
  const router = useRouter();
  const { handleScroll } = useTabBarVisibility();
  const [searchQuery, setSearchQuery] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useFocusEffect(
    useCallback(() => {
      fetchConversations();
    }, [])
  );

  function fetchConversations() {
    mobileApi
      .getMatches(undefined, 50, 'conversations')
      .then((remoteMatches) => {
        if (remoteMatches) {
          setMatches(remoteMatches);
        }
      })
      .catch((err) => console.warn('Fetch matches error in chats:', err))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const socket = getSocket();

    const handleNewMessage = (msg: any) => {
      setMatches((prev) =>
        prev.map((m) => {
          if (m.id === msg.matchId) {
            return {
              ...m,
              lastMessage: {
                text: msg.content,
                createdAt: new Date(msg.sentAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
                senderId: msg.senderId,
                unread: true,
              },
            };
          }
          return m;
        })
      );
    };

    socket.on('newMessage', handleNewMessage);
    return () => {
      socket.off('newMessage', handleNewMessage);
    };
  }, []);

  const filteredMatches = matches.filter((m) =>
    (m.user?.name || 'Match').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#09090b" translucent={true} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/')}>
          <Ionicons name="sparkles-outline" size={20} color="#f43f5e" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color="#71717a" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor="#71717a"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color="#71717a" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#f43f5e" />
          <Text style={styles.loadingText}>Loading conversations...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {filteredMatches.length > 0 ? (
            <View style={styles.chatList}>
              {filteredMatches.map((match) => (
                <TouchableOpacity
                  key={match.id}
                  style={styles.chatItem}
                  activeOpacity={0.85}
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
                        <Ionicons
                          name="checkmark-circle"
                          size={14}
                          color="#fb7185"
                          style={{ marginLeft: 4 }}
                        />
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

                      {match.lastMessage.unread && (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadText}>1</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubble-ellipses-outline" size={48} color="#3f3f46" />
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySub}>
                Start discovering on Discover to match and chat!
              </Text>
              <TouchableOpacity style={styles.discoverBtn} onPress={() => router.push('/')}>
                <Text style={styles.discoverBtnText}>Explore Profiles</Text>
              </TouchableOpacity>
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
    backgroundColor: '#09090b',
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#18181b',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#18181b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderRadius: 20,
    paddingHorizontal: 14,
    height: 40,
    borderWidth: 1,
    borderColor: '#27272a',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#ffffff',
  },
  scrollContent: {
    paddingBottom: 30,
    paddingTop: 6,
  },
  chatList: {
    paddingHorizontal: 16,
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  unreadBadge: {
    backgroundColor: '#f43f5e',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 36,
    marginTop: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 12,
  },
  emptySub: {
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
});
