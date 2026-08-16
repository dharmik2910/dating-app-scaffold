'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { IconMessages, IconMessage, IconHeartFilled, IconSparkles, IconUser } from '@tabler/icons-react';

export default function ConversationsPage() {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMatches();
  }, []);

  function fetchMatches() {
    setLoading(true);
    api
      .getMatches()
      .then((data) => {
        setMatches(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <IconMessages className="text-rose-500" size={30} />
            <span>Conversations</span>
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Your active chats and recent messages
          </p>
        </div>
        <span className="px-3 py-1 bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs font-semibold rounded-full">
          {matches.length} {matches.length === 1 ? 'Conversation' : 'Conversations'}
        </span>
      </div>

      {loading ? (
        <div className="flex flex-col justify-center items-center py-20 gap-3">
          <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-neutral-400">Loading your conversations...</p>
        </div>
      ) : matches.length > 0 ? (
        <div className="space-y-3">
          {matches.map((m) => {
            const lastMsg = m.messages?.[0];
            return (
              <Link
                key={m.id}
                href={`/chat/${m.id}`}
                className="flex items-center gap-4 p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 hover:border-rose-500/40 hover:bg-neutral-900/90 transition-all group shadow-sm"
              >
                <div className="relative w-14 h-14 rounded-full bg-neutral-800 border border-neutral-700 overflow-hidden shrink-0 flex items-center justify-center text-neutral-400 font-medium">
                  {m.otherUser?.photos?.[0]?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.otherUser.photos[0].url}
                      alt={m.otherUser.name || 'Match'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <IconUser size={24} />
                  )}
                  <div className="absolute bottom-0 right-0 bg-rose-500 text-white p-1 rounded-full border border-neutral-900 shadow">
                    <IconHeartFilled size={8} />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className="font-bold text-white text-base group-hover:text-rose-400 transition-colors truncate">
                      {m.otherUser?.name || 'Match'}
                    </h3>
                    {lastMsg?.sentAt && (
                      <span className="text-[11px] text-neutral-500 font-medium shrink-0 ml-2">
                        {new Date(lastMsg.sentAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-400 truncate flex items-center gap-1.5 leading-relaxed">
                    <IconMessage size={13} className="text-neutral-500 shrink-0" />
                    <span>{lastMsg?.content ?? 'Start the conversation 👋'}</span>
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 px-4 bg-neutral-900/40 border border-neutral-800 rounded-3xl max-w-md mx-auto">
          <IconSparkles size={44} className="text-amber-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">No Active Chats</h3>
          <p className="text-neutral-400 text-xs mt-1 max-w-xs mx-auto mb-6 leading-relaxed">
            Match with people first or pick one of your existing matches to say hello!
          </p>
          <Link
            href="/matches"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-rose-500 to-amber-500 font-semibold text-xs px-5 py-3 rounded-full text-white shadow-lg shadow-rose-500/20 hover:opacity-95 transition-opacity"
          >
            View Your Matches
          </Link>
        </div>
      )}
    </main>
  );
}
