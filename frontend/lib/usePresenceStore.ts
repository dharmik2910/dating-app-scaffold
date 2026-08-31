import { create } from 'zustand';

export type UserPresenceInfo = {
  userId: string;
  isOnline: boolean;
  lastActiveAt?: string | null;
};

interface PresenceState {
  onlineUserIds: string[];
  lastActiveMap: Record<string, string>;
  setUserStatus: (userId: string, isOnline: boolean, lastActiveAt?: string | null) => void;
  setPresenceList: (list: UserPresenceInfo[]) => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  onlineUserIds: [],
  lastActiveMap: {},
  setUserStatus: (userId, isOnline, lastActiveAt) =>
    set((state) => {
      const nextOnline = isOnline
        ? state.onlineUserIds.includes(userId)
          ? state.onlineUserIds
          : [...state.onlineUserIds, userId]
        : state.onlineUserIds.filter((id) => id !== userId);

      const nextMap = lastActiveAt
        ? { ...state.lastActiveMap, [userId]: lastActiveAt }
        : state.lastActiveMap;

      return { onlineUserIds: nextOnline, lastActiveMap: nextMap };
    }),
  setPresenceList: (list) =>
    set((state) => {
      const onlineSet = new Set(state.onlineUserIds);
      const nextMap = { ...state.lastActiveMap };

      list.forEach((item) => {
        if (item.isOnline) {
          onlineSet.add(item.userId);
        } else {
          onlineSet.delete(item.userId);
        }
        if (item.lastActiveAt) {
          nextMap[item.userId] = item.lastActiveAt;
        }
      });

      return {
        onlineUserIds: Array.from(onlineSet),
        lastActiveMap: nextMap,
      };
    }),
}));

/**
 * Calculates a friendly human-readable activity status and status styling
 */
export function formatUserActivity(
  userId?: string,
  fallbackTimestamp?: string | Date | null,
  onlineUserIds: string[] = [],
  lastActiveMap: Record<string, string> = {}
) {
  if (!userId) {
    return {
      isOnline: false,
      statusText: 'Offline',
      dotClass: 'bg-neutral-600',
      textClass: 'text-neutral-400',
    };
  }

  const isOnline = onlineUserIds.includes(userId);
  if (isOnline) {
    return {
      isOnline: true,
      statusText: 'Online now',
      dotClass: 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.85)] animate-pulse',
      textClass: 'text-emerald-400 font-semibold',
    };
  }

  const rawTimestamp = lastActiveMap[userId] || fallbackTimestamp;
  if (!rawTimestamp) {
    return {
      isOnline: false,
      statusText: 'Offline',
      dotClass: 'bg-neutral-600',
      textClass: 'text-neutral-400',
    };
  }

  const date = new Date(rawTimestamp);
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

  if (diffMinutes < 1) {
    return {
      isOnline: true,
      statusText: 'Active just now',
      dotClass: 'bg-emerald-500',
      textClass: 'text-emerald-400',
    };
  }
  if (diffMinutes < 60) {
    return {
      isOnline: false,
      statusText: `Active ${diffMinutes}m ago`,
      dotClass: 'bg-neutral-500',
      textClass: 'text-neutral-400',
    };
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return {
      isOnline: false,
      statusText: `Active ${diffHours}h ago`,
      dotClass: 'bg-neutral-600',
      textClass: 'text-neutral-400',
    };
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) {
    return {
      isOnline: false,
      statusText: 'Active yesterday',
      dotClass: 'bg-neutral-600',
      textClass: 'text-neutral-400',
    };
  }
  if (diffDays < 7) {
    return {
      isOnline: false,
      statusText: `Active ${diffDays}d ago`,
      dotClass: 'bg-neutral-600',
      textClass: 'text-neutral-400',
    };
  }
  if (diffDays < 30) {
    const diffWeeks = Math.floor(diffDays / 7);
    return {
      isOnline: false,
      statusText: `Active ${diffWeeks}w ago`,
      dotClass: 'bg-neutral-600',
      textClass: 'text-neutral-400',
    };
  }
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return {
      isOnline: false,
      statusText: `Active ${diffMonths}mo ago`,
      dotClass: 'bg-neutral-600',
      textClass: 'text-neutral-400',
    };
  }

  return {
    isOnline: false,
    statusText: 'Offline',
    dotClass: 'bg-neutral-600',
    textClass: 'text-neutral-400',
  };
}
