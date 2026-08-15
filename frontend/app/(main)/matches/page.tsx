'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { IconMessages, IconSparkles, IconHeartFilled, IconMessage } from '@tabler/icons-react';

export default function MatchesPage() {
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <IconMessages className="text-rose-500" size={28} />
            <span>Matches & Conversations</span>
          </h1>
          <p className="text-sm text-neutral-400">Profiles you matched with by clicking the heart icon</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-16">
          <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : matches.length > 0 ? (
        <div className="space-y-6">
          {/* New Matches Row */}
          <div>
            <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
              Your Matches ({matches.length})
            </h2>
            <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-none">
              {matches.map((m) => (
                <Link
                  key={`avatar-${m.id}`}
                  href={`/chat/${m.id}`}
                  className="flex flex-col items-center gap-1.5 shrink-0 group"
                >
                  <div className="relative w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-rose-500 to-amber-500 group-hover:scale-105 transition-transform duration-200">
                    <div className="w-full h-full rounded-full bg-neutral-900 overflow-hidden flex items-center justify-center text-neutral-400 font-medium relative">
                      {m.otherUser?.photos?.[0]?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.otherUser.photos[0].url}
                          alt={m.otherUser.name || 'Match'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{(m.otherUser?.name || 'M')[0]}</span>
                      )}
                    </div>
                    {/* Heart Badge on Photo Corner */}
                    <div className="absolute -bottom-0.5 -right-0.5 bg-rose-500 text-white p-1 rounded-full border-2 border-neutral-950 shadow-md">
                      <IconHeartFilled size={10} />
                    </div>
                  </div>
                  <span className="text-xs font-medium text-neutral-300 max-w-[70px] truncate group-hover:text-white">
                    {m.otherUser?.name || 'Match'}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Conversations List */}
          <div>
            <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
              Messages
            </h2>
            <div className="space-y-3">
              {matches.map((m) => (
                <Link
                  key={m.id}
                  href={`/chat/${m.id}`}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 hover:border-rose-500/30 hover:bg-neutral-900/90 transition-all group"
                >
                  <div className="relative w-14 h-14 rounded-full bg-neutral-800 border border-neutral-700 overflow-hidden shrink-0 flex items-center justify-center text-neutral-500 font-medium">
                    {m.otherUser?.photos?.[0]?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.otherUser.photos[0].url}
                        alt={m.otherUser.name || 'Match'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{(m.otherUser?.name || 'M')[0]}</span>
                    )}
                    <div className="absolute bottom-0 right-0 bg-rose-500 text-white p-1 rounded-full border border-neutral-900 shadow">
                      <IconHeartFilled size={8} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h3 className="font-semibold text-white group-hover:text-rose-400 transition-colors flex items-center gap-1.5">
                        <span>{m.otherUser?.name || 'Match'}</span>
                      </h3>
                      <span className="text-xs text-neutral-500">
                        {m.messages?.[0]?.sentAt
                          ? new Date(m.messages[0].sentAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 truncate flex items-center gap-1">
                      <IconMessage size={12} className="text-neutral-500 shrink-0" />
                      <span>{m.messages?.[0]?.content ?? 'Say hello 👋'}</span>
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 px-4 bg-neutral-900/40 border border-neutral-800 rounded-3xl">
          <IconSparkles size={40} className="text-rose-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">No Matches Yet</h3>
          <p className="text-neutral-400 text-xs mt-1 max-w-xs mx-auto mb-6">
            Go to the Discover page, hover over a candidate photo, and click the match heart icon!
          </p>
          <Link
            href="/discover"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-rose-500 to-amber-500 font-medium text-xs px-5 py-2.5 rounded-full text-white shadow-lg shadow-rose-500/20 hover:opacity-95 transition-opacity"
          >
            Discover Candidates
          </Link>
        </div>
      )}
    </main>
  );
}


