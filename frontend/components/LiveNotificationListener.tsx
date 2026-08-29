'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { IconMessageCircle, IconUser, IconX, IconArrowRight } from '@tabler/icons-react';
import { getSocket } from '@/lib/socket';
import { playNotificationSound } from '@/lib/sound';
import { useChatStore, ChatNotificationPayload } from '@/lib/useChatStore';
import { usePresenceStore } from '@/lib/usePresenceStore';
import { useAuth } from '@/components/AuthContext';

export default function LiveNotificationListener() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const addUnreadMatch = useChatStore((state) => state.addUnreadMatch);
  const clearUnreadMatch = useChatStore((state) => state.clearUnreadMatch);
  const setUserStatus = usePresenceStore((state) => state.setUserStatus);

  // Clear unread badge if user is on the specific chat page
  useEffect(() => {
    if (pathname.startsWith('/chat/')) {
      const activeMatchId = pathname.replace('/chat/', '').split('/')[0];
      if (activeMatchId) {
        clearUnreadMatch(activeMatchId);
      }
    }
  }, [pathname, clearUnreadMatch]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const socket = getSocket();

    // 1. Listen for real-time presence/activity status changes
    const handleStatusChanged = (data: { userId: string; isOnline: boolean; lastActiveAt?: string }) => {
      if (data?.userId) {
        setUserStatus(data.userId, data.isOnline, data.lastActiveAt);
      }
    };
    socket.on('userStatusChanged', handleStatusChanged);

    // 2. Periodic heartbeat to keep presence and lastActiveAt alive
    const heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('heartbeat');
      }
    }, 40000);

    // 3. Listen for live incoming chat notifications
    const handleChatNotification = (data: ChatNotificationPayload) => {
      const currentUserId = user?.id || user?.userId;
      if (currentUserId && data.senderId === currentUserId) return;

      // Update sender presence
      setUserStatus(data.senderId, true, data.sentAt);

      // Check if user is already actively viewing this match chat
      const isCurrentlyInThisChat = pathname === `/chat/${data.matchId}`;

      // Update unread state if not currently viewing
      if (!isCurrentlyInThisChat) {
        addUnreadMatch(data.matchId, data);
        playNotificationSound();

        // Display interactive live toast notification
        toast.custom(
          (t) => (
            <div
              onClick={() => {
                toast.dismiss(t);
                router.push(`/chat/${data.matchId}`);
              }}
              className="w-full max-w-sm bg-neutral-900/95 border border-rose-500/40 hover:border-rose-500/80 shadow-[0_12px_40px_-10px_rgba(244,63,94,0.35)] rounded-2xl p-3.5 flex items-start gap-3 backdrop-blur-xl cursor-pointer transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.99] select-none group"
            >
              {/* Sender Avatar */}
              <div className="relative w-11 h-11 rounded-full overflow-hidden bg-neutral-800 border border-neutral-700 flex-shrink-0">
                {data.senderPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.senderPhoto}
                    alt={data.senderName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-rose-950 to-neutral-800 text-rose-400">
                    <IconUser size={22} />
                  </div>
                )}
                {/* Live green dot */}
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-neutral-900 rounded-full" />
              </div>

              {/* Message Content Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className="text-xs font-bold text-white truncate group-hover:text-rose-400 transition-colors">
                    {data.senderName}
                  </span>
                  <span className="text-[10px] text-rose-400 font-semibold bg-rose-950/60 border border-rose-800/40 px-1.5 py-0.5 rounded-full flex-shrink-0">
                    New message
                  </span>
                </div>
                <p className="text-xs text-neutral-300 line-clamp-1 break-words">
                  {data.content}
                </p>
                <div className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-rose-400 group-hover:translate-x-0.5 transition-transform">
                  <span>Reply now</span>
                  <IconArrowRight size={12} />
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toast.dismiss(t);
                }}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
                title="Dismiss"
              >
                <IconX size={16} />
              </button>
            </div>
          ),
          { duration: 5000 }
        );
      }
    };

    socket.on('chatNotification', handleChatNotification);

    return () => {
      clearInterval(heartbeatInterval);
      socket.off('userStatusChanged', handleStatusChanged);
      socket.off('chatNotification', handleChatNotification);
    };
  }, [isAuthenticated, pathname, router, user, addUnreadMatch, clearUnreadMatch, setUserStatus]);

  return null;
}
