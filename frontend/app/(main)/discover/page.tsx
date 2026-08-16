'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { IconMapPin, IconUser, IconSparkles, IconHeart, IconHeartFilled, IconLayoutGrid, IconGridDots, IconSquare, IconList } from '@tabler/icons-react';
import { toast } from 'sonner';
import DiscoverSkeleton from '@/components/DiscoverSkeleton';

type ViewMode = 'grid5' | 'grid3' | 'grid2' | 'grid1' | 'list';

type Candidate = {

  userId: string;
  name: string;
  bio?: string;
  distance_km: number;
  liked?: boolean;
  photos?: { id: string; url: string }[];
};

const INTEREST_LABELS: Record<string, string> = {
  coffee: '☕ Coffee',
  travel: '✈️ Travel',
  fitness: '🏋️‍♂️ Fitness',
  music: '🎧 Music',
  foodie: '🍕 Foodie',
  gaming: '🎮 Gaming',
  art: '🎨 Art',
  photography: '📸 Photography',
  reading: '📚 Reading',
  pets: '🐶 Pets',
  movies: '🎬 Movies',
  tech: '💻 Tech',
  hiking: '🧗‍♂️ Outdoor',
  wine: '🍷 Wine',
};

function parseBioContent(rawBio?: string) {
  if (!rawBio) return { cleanBio: '', interests: [] };
  const match = rawBio.match(/\[INTERESTS:(.*?)\]/);
  if (match && match[1]) {
    const interests = match[1].split(',').map((s) => s.trim()).filter(Boolean);
    const cleanBio = rawBio.replace(/\[INTERESTS:.*?\]/, '').trim();
    return { cleanBio, interests };
  }
  return { cleanBio: rawBio.trim(), interests: [] };
}

export default function DiscoverPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid5');

  useEffect(() => {
    fetchCandidates();
  }, []);

  function fetchCandidates() {
    setLoading(true);
    api
      .getDiscovery()
      .then((data) => {
        const items = Array.isArray(data) ? data : data.items || [];
        setCandidates(items);
        setNextCursor(data.nextCursor || null);
        setHasMore(Boolean(data.hasMore));
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }

  async function loadMoreCandidates() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await api.getDiscovery(nextCursor);
      const items = Array.isArray(data) ? data : data.items || [];
      setCandidates((prev) => [...prev, ...items]);
      setNextCursor(data.nextCursor || null);
      setHasMore(Boolean(data.hasMore));
    } catch (err) {
      console.error('Failed to load more candidates:', err);
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleToggleLike(candidate: Candidate) {
    const isCurrentlyLiked = !!candidate.liked;
    const nextLikedState = !isCurrentlyLiked;

    // Optimistically update UI
    setCandidates((prev) =>
      prev.map((c) => (c.userId === candidate.userId ? { ...c, liked: nextLikedState } : c))
    );

    try {
      if (nextLikedState) {
        await api.swipe(candidate.userId, 'LIKE');
        toast.success(`Matched with ${candidate.name}! ❤️`, {
          description: 'You can now chat in Matches',
          action: {
            label: 'View Matches',
            onClick: () => (window.location.href = '/matches'),
          },
        });
      } else {
        await api.swipe(candidate.userId, 'UNLIKE');
        toast.info(`Match removed for ${candidate.name}`);
      }
    } catch (err) {
      console.error(err);
      // Revert optimistic update on error
      setCandidates((prev) =>
        prev.map((c) => (c.userId === candidate.userId ? { ...c, liked: isCurrentlyLiked } : c))
      );
      toast.error('Failed to update match status. Please try again.');
    }
  }

  return (
    <main className="w-full px-4 sm:px-8 py-8 min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex flex-row items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Discover People</h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1 hidden sm:block">Hover over any photo and click the heart icon to match</p>
        </div>

        {/* View Switcher Dropdown Select */}
        <div className="relative flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl flex-shrink-0">
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
      </div>



      {loading ? (
        <DiscoverSkeleton viewMode={viewMode} />
      ) : candidates.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="text-center p-8 bg-neutral-900/60 border border-neutral-800 rounded-3xl max-w-sm">
            <IconSparkles size={40} className="text-amber-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-white">No Profiles Found</h3>
            <p className="text-neutral-400 text-xs mt-1">
              No profiles available right now. Check back later or refresh feed.
            </p>
            <button
              onClick={fetchCandidates}
              className="mt-4 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium rounded-xl transition-colors"
            >
              Refresh Feed
            </button>
          </div>
        </div>
      ) : (
        /* Dynamic Grid/List Container */
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

          {candidates.map((candidate) => {
            const { cleanBio, interests } = parseBioContent(candidate.bio);

            return (
              <div
                key={candidate.userId}
                className={`group relative bg-neutral-900 border border-neutral-800/80 hover:border-rose-500/40 rounded-3xl overflow-hidden shadow-xl transition-all duration-300 ${viewMode === 'list'
                    ? 'flex flex-row items-center p-3 gap-4 w-full'
                    : 'flex flex-col w-full'
                  }`}
              >
                {/* Photo & Cover */}
                <div
                  className={`relative bg-neutral-800 overflow-hidden ${viewMode === 'list'
                      ? 'w-24 h-24 sm:w-28 sm:h-28 rounded-2xl flex-shrink-0'
                      : 'aspect-[3/4] w-full'
                    }`}
                >

                  {candidate.photos?.[0]?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={candidate.photos[0].url}
                      alt={candidate.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-neutral-800 to-neutral-900 text-neutral-600">
                      <IconUser size={64} stroke={1.5} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/20 to-transparent opacity-90 pointer-events-none" />

                  {/* Match Heart Icon */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleLike(candidate);
                    }}
                    title={candidate.liked ? 'Matched! Click to unmatch' : 'Click heart to match'}
                    aria-label={`Match ${candidate.name}`}
                    className={`absolute top-3.5 right-3.5 z-20 transition-all duration-300 transform active:scale-90 cursor-pointer drop-shadow-md ${candidate.liked
                      ? 'text-rose-500 opacity-100 scale-100 drop-shadow-[0_2px_10px_rgba(244,63,94,0.7)]'
                      : 'text-white/80 hover:text-rose-500 opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 hover:drop-shadow-[0_2px_10px_rgba(244,63,94,0.5)]'
                      }`}
                  >
                    {candidate.liked ? (
                      <IconHeartFilled size={28} className="animate-pulse" />
                    ) : (
                      <IconHeart size={28} className="stroke-[2.2] hover:fill-rose-500 transition-colors" />
                    )}
                  </button>

                  {/* Candidate Information Overlay / List Section */}
                  <div
                    className={
                      viewMode === 'list'
                        ? 'hidden'
                        : 'absolute bottom-0 left-0 right-0 p-4 text-white pointer-events-none'
                    }
                  >
                    <h3 className="text-lg font-bold tracking-wide flex items-center gap-2">
                      <span>{candidate.name}</span>
                    </h3>
                    <div className="flex items-center gap-1 text-xs text-neutral-300 mt-0.5">
                      <IconMapPin size={13} className="text-ember" />
                      <span>
                        {candidate.distance_km != null && candidate.distance_km > 0
                          ? `${candidate.distance_km.toFixed(1)} km away`
                          : 'Nearby'}
                      </span>
                    </div>

                    {cleanBio && (
                      <p className="text-xs text-neutral-300/90 mt-1.5 line-clamp-2 leading-relaxed">
                        {cleanBio}
                      </p>
                    )}

                    {/* Interest Pills */}
                    {interests.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {interests.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded-full bg-white/15 border border-white/20 text-[10px] font-medium backdrop-blur-md text-white"
                          >
                            {INTEREST_LABELS[tag] || tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Dedicated List View Content Section */}
                {viewMode === 'list' && (
                  <div className="flex-1 flex items-center justify-between min-w-0 pr-2">
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-white truncate flex items-center gap-2">
                        <span>{candidate.name}</span>
                      </h3>
                      <div className="flex items-center gap-1 text-xs text-neutral-400 mt-0.5">
                        <IconMapPin size={12} className="text-ember" />
                        <span>
                          {candidate.distance_km != null && candidate.distance_km > 0
                            ? `${candidate.distance_km.toFixed(1)} km away`
                            : 'Nearby'}
                        </span>
                      </div>
                      {cleanBio && (
                        <p className="text-xs text-neutral-300 mt-1 line-clamp-1 truncate">
                          {cleanBio}
                        </p>
                      )}
                      {interests.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {interests.slice(0, 4).map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 rounded-md bg-neutral-800 border border-neutral-700 text-[10px] font-medium text-neutral-300"
                            >
                              {INTEREST_LABELS[tag] || tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleLike(candidate)}
                      title={candidate.liked ? 'Matched! Click to unmatch' : 'Click heart to match'}
                      className="p-2.5 rounded-full bg-neutral-800 hover:bg-neutral-700 transition-colors ml-3 cursor-pointer"
                    >
                      {candidate.liked ? (
                        <IconHeartFilled size={24} className="text-rose-500 animate-pulse" />
                      ) : (
                        <IconHeart size={24} className="text-neutral-400 hover:text-rose-500 transition-colors" />
                      )}
                    </button>
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

      {hasMore && (
        <div className="mt-8 text-center">
          <button
            onClick={loadMoreCandidates}
            disabled={loadingMore}
            className="px-6 py-2.5 bg-neutral-900 border border-neutral-800 hover:border-rose-500/50 text-neutral-200 hover:text-white font-semibold text-xs rounded-full shadow-lg transition-all disabled:opacity-50"
          >
            {loadingMore ? 'Loading profiles...' : 'Load More Profiles'}
          </button>
        </div>
      )}
    </main>
  );
}
