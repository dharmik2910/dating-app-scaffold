import { create } from 'zustand';

export type ChatNotificationPayload = {
  matchId: string;
  messageId: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string | null;
  content: string;
  sentAt: string;
};

interface ChatState {
  unreadMatchIds: string[];
  latestNotification: ChatNotificationPayload | null;
  addUnreadMatch: (matchId: string, notification?: ChatNotificationPayload) => void;
  clearUnreadMatch: (matchId: string) => void;
  clearAllUnread: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  unreadMatchIds: [],
  latestNotification: null,
  addUnreadMatch: (matchId, notification) =>
    set((state) => ({
      unreadMatchIds: state.unreadMatchIds.includes(matchId)
        ? state.unreadMatchIds
        : [...state.unreadMatchIds, matchId],
      latestNotification: notification || state.latestNotification,
    })),
  clearUnreadMatch: (matchId) =>
    set((state) => ({
      unreadMatchIds: state.unreadMatchIds.filter((id) => id !== matchId),
    })),
  clearAllUnread: () => set({ unreadMatchIds: [] }),
}));
