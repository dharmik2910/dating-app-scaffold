'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { IconHeart, IconHeartFilled, IconMessageCircle, IconSparkles, IconUser, IconLayoutGrid, IconGridDots, IconSquare, IconList } from '@tabler/icons-react';
import { toast } from 'sonner';
import MatchesSkeleton from '@/components/MatchesSkeleton';

type ViewMode = 'grid5' | 'grid3' | 'grid2' | 'grid1' | 'list';

export default function MatchesPage() {
  const [matches, setMatches] = useState<any[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid5');

  useEffect(() => {
    fetchMatches();
  }, []);

  function fetchMatches() {
    setLoading(true);
    api
      .getMatches()
      .then((data) => {
        const items = Array.isArray(data) ? data : data.items || [];
        setMatches(items);
        setNextCursor(data.nextCursor || null);
        setHasMore(Boolean(data.hasMore));
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }

  async function loadMoreMatches() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await api.getMatches(nextCursor);
      const items = Array.isArray(data) ? data : data.items || [];
      setMatches((prev) => [...prev, ...items]);
      setNextCursor(data.nextCursor || null);
      setHasMore(Boolean(data.hasMore));
    } catch (err) {
      console.error('Failed to load more matches:', err);
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleUnmatch(matchId: string, otherUserId: string, otherName?: string) {
    // Optimistically remove match card from UI
    setMatches((prev) => prev.filter((m) => m.id !== matchId));

    try {
      if (otherUserId) {
        await api.swipe(otherUserId, 'UNLIKE');
      }
      toast.info(`Unmatched with ${otherName || 'user'}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to unmatch. Please try again.');
      fetchMatches();
    }
  }

  return (
    <main className="w-full px-4 sm:px-8 py-8 min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex flex-row items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <IconHeart className="text-rose-500 fill-rose-500/20" size={30} />
            <span>Your Matches</span>
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1 hidden sm:block">
            People who matched with you. Click heart to unmatch or card to start a chat!
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-shrink-0">
          {/* View Switcher Dropdown Select */}
          <div className="relative flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl">
            <span className="text-xs font-semibold text-neutral-400 hidden xs:inline">View:</span>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
              className="bg-transparent text-xs font-semibold text-white outline-none cursor-pointer pr-1"
            >
              <option value="grid5" className="bg-neutral-900 text-white hidden xl:block">Expanded Grid</option>
              <option value="grid3" className="bg-neutral-900 text-white hidden md:block">Standard Grid</option>
              <option value="grid2" className="bg-neutral-900 text-white md:hidden">Compact Grid</option>
              <option value="grid1" className="bg-neutral-900 text-white">Full Card View</option>
              <option value="list" className="bg-neutral-900 text-white">List View</option>
            </select>
          </div>

          <span className="px-3 py-1.5 bg-rose-950/60 border border-rose-800/50 text-rose-300 text-xs font-semibold rounded-full hidden sm:inline-block">
            {matches.length} {matches.length === 1 ? 'Match' : 'Matches'}
          </span>
        </div>
      </div>



      {loading ? (
        <MatchesSkeleton viewMode={viewMode} />
      ) : matches.length > 0 ? (
        /* Dynamic Grid/List Matches Container */
        <div
          className={
            viewMode === 'grid5'
              ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5'
              : viewMode === 'grid3'
              ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6'
              : viewMode === 'grid2'
              ? 'grid grid-cols-2 gap-4 max-w-3xl mx-auto w-full'
              : viewMode === 'grid1'
              ? 'flex flex-col items-center gap-6 max-w-md mx-auto w-full'
              : 'flex flex-col gap-3 max-w-3xl mx-auto w-full'
          }
        >

          {matches.map((m) => {
            const targetUserId = m.otherUser?.userId || m.otherUser?.id || m.otherUserId;

            return (
              <Link
                key={m.id}
                href={`/chat/${m.id}`}
                className={`group relative bg-neutral-900 border border-neutral-800/90 hover:border-rose-500/50 rounded-3xl overflow-hidden shadow-lg hover:shadow-rose-950/30 transition-all duration-300 ${
                  viewMode === 'list'
                    ? 'flex flex-row items-center p-3 gap-4 w-full'
                    : 'flex flex-col w-full'
                }`}
              >
                {/* Photo */}
                <div
                  className={`relative bg-neutral-800 overflow-hidden ${
                    viewMode === 'list'
                      ? 'w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex-shrink-0'
                      : 'aspect-[3/4] w-full'
                  }`}
                >

                  {m.otherUser?.photos?.[0]?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.otherUser.photos[0].url}
                      alt={m.otherUser.name || 'Match'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-neutral-800 to-neutral-900 text-neutral-600">
                      <IconUser size={48} stroke={1.5} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/30 to-transparent pointer-events-none" />

                  {/* Interactive Heart Icon for Unmatching */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleUnmatch(m.id, targetUserId, m.otherUser?.name);
                    }}
                    title="Click heart to unmatch"
                    aria-label={`Unmatch ${m.otherUser?.name || 'user'}`}
                    className="absolute top-3.5 right-3.5 z-20 text-rose-500 opacity-90 hover:opacity-100 hover:scale-110 active:scale-95 transition-all cursor-pointer drop-shadow-[0_2px_10px_rgba(244,63,94,0.7)]"
                  >
                    <IconHeartFilled size={26} className="hover:text-rose-400 transition-colors" />
                  </button>

                  {/* Information Overlay */}
                  <div
                    className={
                      viewMode === 'list'
                        ? 'hidden'
                        : 'absolute bottom-0 inset-x-0 p-4 text-white'
                    }
                  >
                    <h3 className="text-lg font-bold truncate group-hover:text-rose-400 transition-colors">
                      {m.otherUser?.name || 'Match'}
                    </h3>
                    {m.otherUser?.bio && (
                      <p className="text-xs text-neutral-300/90 line-clamp-1 mt-0.5">
                        {m.otherUser.bio.replace(/\[INTERESTS:.*?\]/, '').trim()}
                      </p>
                    )}
                  </div>
                </div>

                {/* List View Content Section */}
                {viewMode === 'list' ? (
                  <div className="flex-1 flex items-center justify-between min-w-0 pr-2">
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-white truncate group-hover:text-rose-400 transition-colors">
                        {m.otherUser?.name || 'Match'}
                      </h3>
                      {m.otherUser?.bio && (
                        <p className="text-xs text-neutral-400 line-clamp-1 mt-0.5">
                          {m.otherUser.bio.replace(/\[INTERESTS:.*?\]/, '').trim()}
                        </p>
                      )}
                      <span className="inline-flex items-center gap-1 text-xs text-rose-400 font-medium mt-1">
                        <IconMessageCircle size={13} />
                        <span>Start Chat</span>
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleUnmatch(m.id, targetUserId, m.otherUser?.name);
                      }}
                      title="Click heart to unmatch"
                      className="p-2.5 text-rose-500 hover:text-rose-400 transition-transform hover:scale-110 ml-3 cursor-pointer"
                    >
                      <IconHeartFilled size={24} />
                    </button>
                  </div>
                ) : (
                  /* Action Bar for Grid Modes */
                  <div className="px-4 py-2.5 bg-neutral-950/80 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400 group-hover:text-rose-400 font-medium transition-colors">
                    <span className="flex items-center gap-1.5">
                      <IconMessageCircle size={14} />
                      <span>Start Chat</span>
                    </span>
                    <span className="text-[10px] text-neutral-500 font-semibold group-hover:text-rose-300">
                      →
                    </span>
                  </div>
                )}
              </Link>

            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="flex-1 flex items-center justify-center py-16">
          <div className="text-center py-12 px-6 bg-neutral-900/40 border border-neutral-800 rounded-3xl max-w-md mx-auto">
            <IconSparkles size={44} className="text-rose-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-white">No Matches Yet</h3>
            <p className="text-neutral-400 text-xs mt-1 max-w-xs mx-auto mb-6 leading-relaxed">
              Head over to Discover, browse potential candidates, and hit the match heart icon!
            </p>
            <Link
              href="/discover"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-rose-500 to-amber-500 font-semibold text-xs px-5 py-3 rounded-full text-white shadow-lg shadow-rose-500/20 hover:opacity-95 transition-opacity"
            >
              Discover Candidates
            </Link>
          </div>
        </div>
      )}

      {hasMore && (
        <div className="mt-8 text-center">
          <button
            onClick={loadMoreMatches}
            disabled={loadingMore}
            className="px-6 py-2.5 bg-neutral-900 border border-neutral-800 hover:border-rose-500/50 text-neutral-200 hover:text-white font-semibold text-xs rounded-full shadow-lg transition-all disabled:opacity-50"
          >
            {loadingMore ? 'Loading matches...' : 'Load More Matches'}
          </button>
        </div>
      )}
    </main>
  );
}
