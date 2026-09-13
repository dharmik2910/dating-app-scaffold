'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';

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
  isOpen: boolean;
  onClose: () => void;
  onSelect?: (item: NotificationItem) => void;
}

export default function NotificationModal({
  isOpen,
  onClose,
  onSelect,
}: NotificationModalProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifs = async () => {
    setLoading(true);
    try {
      const data = await api.getNotifications();
      if (Array.isArray(data)) {
        setNotifications(data);
      } else {
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
            body: 'Someone left a compliment on your photo: "Love your vibe!"',
            read: false,
            createdAt: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            id: 'demo-3',
            type: 'SAFE_DATE',
            title: '🛡️ Safe Date Check-in Reminder',
            body: 'Your scheduled date starts in 2 hours. Your emergency contact is notified.',
            read: true,
            createdAt: new Date(Date.now() - 7200000).toISOString(),
          },
        ]);
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifs();
    }
  }, [isOpen]);

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold">
              🔔
            </div>
            <h3 className="font-bold text-white text-lg">Notifications</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded-md bg-zinc-800/80 transition-colors"
            >
              Mark all read
            </button>
            <button
              onClick={onClose}
              className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* List */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-zinc-500 text-sm">Loading alerts...</div>
          ) : notifications.length === 0 ? (
            <div className="py-12 text-center text-zinc-500">
              <p className="text-2xl mb-1">🎉</p>
              <p className="font-semibold text-zinc-300">All caught up!</p>
              <p className="text-xs text-zinc-500">No new notifications</p>
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelect?.(item)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  !item.read
                    ? 'bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/15'
                    : 'bg-zinc-800/40 border-zinc-800 hover:bg-zinc-800/80'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-semibold text-sm text-white flex items-center gap-1.5">
                    {item.title}
                  </h4>
                  {!item.read && <span className="w-2 h-2 rounded-full bg-rose-500" />}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed mb-1.5">{item.body}</p>
                <span className="text-[10px] text-zinc-500">
                  {new Date(item.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
