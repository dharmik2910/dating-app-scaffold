import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform, Vibration } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { getSocket } from '@/services/socket';
import { useAuth } from '@/context/AuthContext';

export interface ChatNotification {
  matchId: string;
  messageId: string;
  senderId: string;
  senderName: string;
  senderPhoto: string | null;
  content: string;
  sentAt: string;
}

interface NotificationContextType {
  activeNotification: ChatNotification | null;
  unreadCount: number;
  unreadMatchIds: string[];
  dismissNotification: () => void;
  showNotification: (notification: ChatNotification) => void;
  clearUnreadMatch: (matchId: string) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [activeNotification, setActiveNotification] = useState<ChatNotification | null>(null);
  const [unreadMatchIds, setUnreadMatchIds] = useState<string[]>([]);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const segments = useSegments();
  const { user, isAuthenticated } = useAuth();

  const clearUnreadMatch = useCallback((matchId: string) => {
    setUnreadMatchIds((prev) => prev.filter((id) => id !== matchId));
  }, []);

  // Auto-clear unread match when user navigates into that chat
  useEffect(() => {
    if (segments[0] === 'chat') {
      const activeMatchId = (segments as any)[1] || (segments as any).id;
      if (activeMatchId) {
        clearUnreadMatch(activeMatchId);
      }
    }
  }, [segments, clearUnreadMatch]);

  const dismissNotification = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    setActiveNotification(null);
  }, []);

  const showNotification = useCallback(
    (notif: ChatNotification) => {
      // 1. Clear any existing timer
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }

      // 2. Set active notification and track unread
      setActiveNotification(notif);
      if (notif.matchId) {
        setUnreadMatchIds((prev) => (prev.includes(notif.matchId) ? prev : [...prev, notif.matchId]));
      }

      // 3. Trigger WhatsApp-style vibration pattern (wait 0ms, vibrate 80ms, pause 50ms, vibrate 80ms)
      if (Platform.OS !== 'web') {
        try {
          Vibration.vibrate([0, 80, 50, 80]);
        } catch {}
      }

      // 4. If on web browser, trigger native browser notification if permitted
      if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
        try {
          if (Notification.permission === 'granted') {
            const browserNotif = new Notification(notif.senderName || 'New message on Ember', {
              body: notif.content,
              icon: notif.senderPhoto || '/favicon.ico',
              badge: '/favicon.ico',
            });
            browserNotif.onclick = () => {
              window.focus();
              router.push(`/chat/${notif.matchId}` as any);
              browserNotif.close();
            };
          } else if (Notification.permission !== 'denied') {
            Notification.requestPermission();
          }
        } catch {}
      }

      // 5. Auto dismiss after 4.5 seconds
      dismissTimerRef.current = setTimeout(() => {
        setActiveNotification(null);
      }, 4500);
    },
    [router]
  );

  // Request web notification permissions on mount
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    }
  }, []);

  // Listen for real-time socket chat notifications
  useEffect(() => {
    if (!isAuthenticated) return;

    const socket = getSocket();

    const handleChatNotification = (data: ChatNotification) => {
      const currentUserId = user?.id || (user as any)?.userId;
      // Don't notify if the message is sent by current user
      if (currentUserId && data.senderId === currentUserId) return;

      // Check if user is currently inside the active chat screen with this match
      const isInCurrentChat =
        segments[0] === 'chat' && (segments[1] === data.matchId || (segments as any).id === data.matchId);

      if (!isInCurrentChat) {
        showNotification(data);
      }
    };

    socket.on('chatNotification', handleChatNotification);

    return () => {
      socket.off('chatNotification', handleChatNotification);
    };
  }, [isAuthenticated, user, segments, showNotification]);

  return (
    <NotificationContext.Provider
      value={{
        activeNotification,
        unreadCount: unreadMatchIds.length,
        unreadMatchIds,
        dismissNotification,
        showNotification,
        clearUnreadMatch,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
}
