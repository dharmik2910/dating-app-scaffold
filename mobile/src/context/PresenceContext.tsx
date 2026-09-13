import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { getSocket } from '@/services/socket';
import { useAuth } from '@/context/AuthContext';

export interface UserPresenceInfo {
  userId: string;
  isOnline: boolean;
  lastActiveAt?: string | null;
}

export interface ActivityStatus {
  isOnline: boolean;
  statusText: string;
  isRecent: boolean;
}

interface PresenceContextType {
  onlineUserIds: string[];
  lastActiveMap: Record<string, string>;
  setUserStatus: (userId: string, isOnline: boolean, lastActiveAt?: string | null) => void;
  setPresenceList: (list: UserPresenceInfo[]) => void;
  queryPresence: (userIds: string[]) => void;
  formatUserActivity: (
    userId?: string,
    fallbackTimestamp?: string | Date | null,
    fallbackOnline?: boolean
  ) => ActivityStatus;
}

const PresenceContext = createContext<PresenceContextType | null>(null);

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [lastActiveMap, setLastActiveMap] = useState<Record<string, string>>({});
  const trackedUserIdsRef = useRef<Set<string>>(new Set());
  const { isAuthenticated } = useAuth();
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setUserStatus = useCallback(
    (userId: string, isOnline: boolean, lastActiveAt?: string | null) => {
      if (!userId) return;
      setOnlineUserIds((prev) => {
        if (isOnline) {
          return prev.includes(userId) ? prev : [...prev, userId];
        } else {
          return prev.filter((id) => id !== userId);
        }
      });

      if (lastActiveAt) {
        setLastActiveMap((prev) => ({
          ...prev,
          [userId]: lastActiveAt,
        }));
      }
    },
    []
  );

  const setPresenceList = useCallback((list: UserPresenceInfo[]) => {
    if (!Array.isArray(list) || list.length === 0) return;

    setOnlineUserIds((prev) => {
      const onlineSet = new Set(prev);
      list.forEach((item) => {
        if (item?.userId) {
          if (item.isOnline) {
            onlineSet.add(item.userId);
          } else {
            onlineSet.delete(item.userId);
          }
        }
      });
      return Array.from(onlineSet);
    });

    setLastActiveMap((prev) => {
      const nextMap = { ...prev };
      let changed = false;
      list.forEach((item) => {
        if (item?.userId && item.lastActiveAt) {
          nextMap[item.userId] = item.lastActiveAt;
          changed = true;
        }
      });
      return changed ? nextMap : prev;
    });
  }, []);

  const queryPresence = useCallback(
    (userIds: string[]) => {
      const validIds = userIds.filter(Boolean);
      if (validIds.length === 0) return;

      validIds.forEach((id) => trackedUserIdsRef.current.add(id));

      try {
        const socket = getSocket();
        if (socket.connected) {
          socket.emit('queryPresence', validIds, (response: UserPresenceInfo[]) => {
            if (Array.isArray(response)) {
              setPresenceList(response);
            }
          });
        } else {
          // If socket not connected yet, queue re-query on next connect
          const onConnectOnce = () => {
            socket.emit('queryPresence', Array.from(trackedUserIdsRef.current), (res: UserPresenceInfo[]) => {
              if (Array.isArray(res)) {
                setPresenceList(res);
              }
            });
            socket.off('connect', onConnectOnce);
          };
          socket.on('connect', onConnectOnce);
        }
      } catch (err) {
        console.warn('Presence query error:', err);
      }
    },
    [setPresenceList]
  );

  const formatUserActivity = useCallback(
    (
      userId?: string,
      fallbackTimestamp?: string | Date | null,
      fallbackOnline?: boolean
    ): ActivityStatus => {
      if (!userId) {
        return { isOnline: false, statusText: 'Offline', isRecent: false };
      }

      // Check real-time online state
      const isOnline = onlineUserIds.includes(userId) || Boolean(fallbackOnline);
      if (isOnline) {
        return {
          isOnline: true,
          statusText: 'Online',
          isRecent: true,
        };
      }

      const rawTimestamp = lastActiveMap[userId] || fallbackTimestamp;
      if (!rawTimestamp) {
        return {
          isOnline: false,
          statusText: 'Offline',
          isRecent: false,
        };
      }

      const date = new Date(rawTimestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      if (isNaN(diffMs)) {
        return { isOnline: false, statusText: 'Offline', isRecent: false };
      }

      const diffMinutes = Math.floor(diffMs / (1000 * 60));

      if (diffMinutes < 1) {
        return { isOnline: true, statusText: 'Online', isRecent: true };
      }
      if (diffMinutes < 60) {
        return { isOnline: false, statusText: `Active ${diffMinutes}m ago`, isRecent: diffMinutes <= 15 };
      }
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) {
        return { isOnline: false, statusText: `Active ${diffHours}h ago`, isRecent: false };
      }
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) {
        return { isOnline: false, statusText: 'Active yesterday', isRecent: false };
      }
      if (diffDays < 7) {
        return { isOnline: false, statusText: `Active ${diffDays}d ago`, isRecent: false };
      }
      if (diffDays < 30) {
        const diffWeeks = Math.floor(diffDays / 7);
        return { isOnline: false, statusText: `Active ${diffWeeks}w ago`, isRecent: false };
      }
      const diffMonths = Math.floor(diffDays / 30);
      if (diffMonths < 12) {
        return { isOnline: false, statusText: `Active ${diffMonths}mo ago`, isRecent: false };
      }
      return { isOnline: false, statusText: 'Offline', isRecent: false };
    },
    [onlineUserIds, lastActiveMap]
  );

  // Setup Socket, Real-time status listeners, and Heartbeats
  useEffect(() => {
    if (!isAuthenticated) return;

    const socket = getSocket();

    const handleUserStatusChanged = (data: {
      userId: string;
      isOnline: boolean;
      lastActiveAt?: string;
    }) => {
      if (data?.userId) {
        setUserStatus(data.userId, data.isOnline, data.lastActiveAt);
      }
    };

    const handleConnect = () => {
      // Send initial heartbeat
      socket.emit('heartbeat');

      // Re-query tracked users presence if any
      const tracked = Array.from(trackedUserIdsRef.current);
      if (tracked.length > 0) {
        socket.emit('queryPresence', tracked, (res: UserPresenceInfo[]) => {
          if (Array.isArray(res)) {
            setPresenceList(res);
          }
        });
      }
    };

    socket.on('userStatusChanged', handleUserStatusChanged);
    socket.on('connect', handleConnect);

    // Periodic Heartbeat every 35 seconds to keep presence active while using mobile app
    heartbeatIntervalRef.current = setInterval(() => {
      if (socket.connected) {
        socket.emit('heartbeat');
      }
    }, 35000);

    // Initial heartbeat on mount if already connected
    if (socket.connected) {
      socket.emit('heartbeat');
    }

    return () => {
      socket.off('userStatusChanged', handleUserStatusChanged);
      socket.off('connect', handleConnect);
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [isAuthenticated, setUserStatus, setPresenceList]);

  // Handle App Lifecycle (Foreground vs Background)
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const socket = getSocket();
      if (nextAppState === 'active') {
        if (!socket.connected) {
          socket.connect();
        } else {
          socket.emit('heartbeat');
        }

        const tracked = Array.from(trackedUserIdsRef.current);
        if (tracked.length > 0) {
          socket.emit('queryPresence', tracked, (res: UserPresenceInfo[]) => {
            if (Array.isArray(res)) {
              setPresenceList(res);
            }
          });
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, setPresenceList]);

  return (
    <PresenceContext.Provider
      value={{
        onlineUserIds,
        lastActiveMap,
        setUserStatus,
        setPresenceList,
        queryPresence,
        formatUserActivity,
      }}
    >
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error('usePresence must be used within a PresenceProvider');
  }
  return context;
}
