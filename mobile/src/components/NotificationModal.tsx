import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { mobileApi } from '../services/api';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: any;
  read: boolean;
  createdAt: string;
}

interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectNotification?: (item: NotificationItem) => void;
}

export function NotificationModal({
  visible,
  onClose,
  onSelectNotification,
}: NotificationModalProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const data = await mobileApi.getNotifications();
      if (Array.isArray(data)) {
        setNotifications(data);
      } else {
        // Fallback initial notifications
        setNotifications([
          {
            id: 'demo-1',
            type: 'NEW_MATCH',
            title: '🔥 New Mutual Match!',
            body: 'You and Sophia matched. Say hello before the spark fades!',
            read: false,
            createdAt: new Date().toISOString(),
          },
          {
            id: 'demo-2',
            type: 'SUPER_LIKE',
            title: '⭐ You received a Super Like!',
            body: 'Someone left a compliment on your photo: "Great smile!"',
            read: false,
            createdAt: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            id: 'demo-3',
            type: 'SAFE_DATE',
            title: '🛡️ Safe Date Check-in Reminder',
            body: 'Your scheduled date starts in 2 hours. Your emergency contact is ready.',
            read: true,
            createdAt: new Date(Date.now() - 7200000).toISOString(),
          },
        ]);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchNotifications();
    }
  }, [visible]);

  const handleMarkAllRead = async () => {
    try {
      await mobileApi.markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // update local
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'NEW_MATCH':
        return { name: 'heart' as const, color: '#FF4B72' };
      case 'SUPER_LIKE':
        return { name: 'star' as const, color: '#00D2FF' };
      case 'COMPLIMENT':
        return { name: 'chatbubble-ellipses' as const, color: '#A855F7' };
      case 'SAFE_DATE':
        return { name: 'shield-checkmark' as const, color: '#10B981' };
      default:
        return { name: 'notifications' as const, color: '#F59E0B' };
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.bellBadge}>
                <Ionicons name="notifications" size={20} color="#FF4B72" />
              </View>
              <Text style={styles.headerTitle}>Notifications</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity onPress={handleMarkAllRead} style={styles.markReadBtn}>
                <Text style={styles.markReadText}>Mark all read</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          </View>

          {/* List */}
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#FF4B72" />
            </View>
          ) : notifications.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="notifications-off-outline" size={44} color="#64748B" />
              <Text style={styles.emptyText}>All caught up!</Text>
              <Text style={styles.emptySubtext}>No new alerts at the moment.</Text>
            </View>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 24 }}
              renderItem={({ item }) => {
                const icon = getIcon(item.type);
                return (
                  <TouchableOpacity
                    style={[styles.notifCard, !item.read && styles.notifCardUnread]}
                    onPress={() => {
                      if (onSelectNotification) onSelectNotification(item);
                    }}
                  >
                    <View style={[styles.iconBox, { backgroundColor: `${icon.color}20` }]}>
                      <Ionicons name={icon.name} size={20} color={icon.color} />
                    </View>
                    <View style={styles.notifContent}>
                      <View style={styles.notifTitleRow}>
                        <Text style={styles.notifTitle}>{item.title}</Text>
                        {!item.read && <View style={styles.unreadDot} />}
                      </View>
                      <Text style={styles.notifBody}>{item.body}</Text>
                      <Text style={styles.notifTime}>
                        {new Date(item.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 20,
    paddingHorizontal: 16,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bellBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 75, 114, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  markReadBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  markReadText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  closeBtn: {
    padding: 4,
  },
  loadingBox: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyBox: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748B',
  },
  notifCard: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    gap: 12,
  },
  notifCardUnread: {
    backgroundColor: 'rgba(255, 75, 114, 0.08)',
    borderColor: 'rgba(255, 75, 114, 0.25)',
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifContent: {
    flex: 1,
  },
  notifTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  notifTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF4B72',
    marginLeft: 6,
  },
  notifBody: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: 6,
  },
  notifTime: {
    fontSize: 11,
    color: '#64748B',
  },
});
