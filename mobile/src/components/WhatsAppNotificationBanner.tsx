import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useNotification } from '@/context/NotificationContext';

export default function WhatsAppNotificationBanner() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeNotification, dismissNotification } = useNotification();
  const translateY = useRef(new Animated.Value(-150)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (activeNotification) {
      // Slide in from top
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 70,
          friction: 10,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Slide out to top
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -150,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [activeNotification, translateY, opacity]);

  if (!activeNotification) return null;

  const topOffset = Math.max(insets.top + (Platform.OS === 'web' ? 8 : 4), 12);

  const handlePress = () => {
    const matchId = activeNotification.matchId;
    dismissNotification();
    if (matchId) {
      router.push(`/chat/${matchId}` as any);
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: topOffset,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.92}
        style={styles.card}
        onPress={handlePress}
      >
        {/* Top App / Category Bar */}
        <View style={styles.topHeader}>
          <View style={styles.appNameRow}>
            <View style={styles.appIconCircle}>
              <Ionicons name="flame" size={13} color="#ffffff" />
            </View>
            <Text style={styles.appName}>EMBER</Text>
            <Text style={styles.dotSeparator}>•</Text>
            <Text style={styles.timeText}>now</Text>
          </View>

          <TouchableOpacity
            style={styles.closeBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={(e) => {
              e.stopPropagation();
              dismissNotification();
            }}
          >
            <Ionicons name="close" size={16} color="#a1a1aa" />
          </TouchableOpacity>
        </View>

        {/* Message Content Row */}
        <View style={styles.contentRow}>
          {/* Sender Avatar with Online Dot */}
          <View style={styles.avatarContainer}>
            {activeNotification.senderPhoto ? (
              <Image
                source={{ uri: activeNotification.senderPhoto }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Ionicons name="person" size={20} color="#f43f5e" />
              </View>
            )}
            <View style={styles.onlineDot} />
          </View>

          {/* Text Information */}
          <View style={styles.textColumn}>
            <Text style={styles.senderName} numberOfLines={1}>
              {activeNotification.senderName || 'Someone'}
            </Text>
            <Text style={styles.messagePreview} numberOfLines={2}>
              {activeNotification.content}
            </Text>
          </View>

          {/* Quick Action Icon */}
          <View style={styles.actionArrowCircle}>
            <Ionicons name="arrow-forward" size={14} color="#f43f5e" />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 999999,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: 'rgba(24, 24, 27, 0.96)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.45)',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 25,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  appNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  appIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#f43f5e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#f43f5e',
  },
  dotSeparator: {
    fontSize: 10,
    color: '#71717a',
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#a1a1aa',
  },
  closeBtn: {
    padding: 2,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    position: 'relative',
    width: 44,
    height: 44,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#3f3f46',
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#3f3f46',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#18181b',
  },
  textColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  senderName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 2,
  },
  messagePreview: {
    fontSize: 12.5,
    color: '#d4d4d8',
    lineHeight: 16,
  },
  actionArrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
