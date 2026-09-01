'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  IconHeart,
  IconHeartFilled,
  IconMessageCircle,
  IconSparkles,
  IconUser,
  IconSquare,
  IconLayoutGrid,
  IconGridDots,
  IconList,
  IconChevronLeft,
  IconChevronRight,
  IconCompass,
  IconCircleCheckFilled,
  IconMapPin,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import MatchesSkeleton from '@/components/MatchesSkeleton';

type ViewMode = 'grid5' | 'grid3' | 'grid2' | 'grid1' | 'list';

const CITY_CACHE_STORAGE_KEY = 'ember_city_lookup_cache';

function getInitialCityCache(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(CITY_CACHE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

let cityLookupCache: Record<string, string> = getInitialCityCache();

function saveCityCache(key: string, label: string) {
  cityLookupCache[key] = label;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CITY_CACHE_STORAGE_KEY, JSON.stringify(cityLookupCache));
    } catch {}
  }
}

function parseCityFromBio(bio?: string): string {
  if (!bio) return '';
  const cityMatch = bio.match(/\[CITY:(.*?)\]/);
  if (cityMatch && cityMatch[1]) {
    return cityMatch[1].trim();
  }
  return '';
}

function preloadImages(urls: (string | undefined)[]) {
  if (typeof window === 'undefined') return;
  urls.forEach((url) => {
    if (!url) return;
    const img = new Image();
    img.src = url;
  });
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<any[]>([]);
  const [matchCities, setMatchCities] = useState<Record<string, string>>({});
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid5');
  const [cardPhotoIndexes, setCardPhotoIndexes] = useState<Record<string, number>>({});

  function getCachedCitiesSync(items: any[]): Record<string, string> {
    const resolved: Record<string, string> = {};
    for (const m of items) {
      const bioCity = parseCityFromBio(m.otherUser?.bio);
      if (bioCity) {
        resolved[m.id] = bioCity;
      } else if (m.otherUser?.latitude != null && m.otherUser?.longitude != null) {
        const key = `${m.otherUser.latitude.toFixed(3)},${m.otherUser.longitude.toFixed(3)}`;
        if (cityLookupCache[key]) {
          resolved[m.id] = cityLookupCache[key];
        }
      }
    }
    return resolved;
  }

  async function resolveCitiesForMatches(items: any[]) {
    const toLookup = items.filter((m) => {
      const bioCity = parseCityFromBio(m.otherUser?.bio);
      if (bioCity) return false;
      if (m.otherUser?.latitude == null || m.otherUser?.longitude == null) return false;
      const key = `${m.otherUser.latitude.toFixed(3)},${m.otherUser.longitude.toFixed(3)}`;
      return !cityLookupCache[key];
    });

    if (toLookup.length === 0) return;

    await Promise.all(
      toLookup.map(async (m) => {
        const key = `${m.otherUser.latitude.toFixed(3)},${m.otherUser.longitude.toFixed(3)}`;
        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${m.otherUser.latitude}&longitude=${m.otherUser.longitude}&localityLanguage=en`
          );
          if (res.ok) {
            const data = await res.json();
            const city = data.city || data.locality || data.principalSubdivision;
            const country = data.countryName || data.countryCode;
            const label = city ? (country ? `${city}, ${country}` : city) : '';
            if (label) {
              saveCityCache(key, label);
              setMatchCities((prev) => ({ ...prev, [m.id]: label }));
            }
          }
        } catch (err) {
          console.warn('Async match city lookup error:', err);
        }
      })
    );
  }

  useEffect(() => {
    fetchMatches();
  }, []);

  function fetchMatches() {
    setLoading(true);
    api
      .getMatches()
      .then((data) => {
        const items = Array.isArray(data) ? data : data.items || [];
        const initialCities = getCachedCitiesSync(items);
        setMatchCities((prev) => ({ ...prev, ...initialCities }));
        setMatches(items);
        setNextCursor(data.nextCursor || null);
        setHasMore(Boolean(data.hasMore));
        setLoading(false);

        const photoUrls = items.flatMap((m: any) => (m.otherUser?.photos || []).map((p: any) => p.url)).filter(Boolean);
        preloadImages(photoUrls);
        resolveCitiesForMatches(items);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }

  function cycleMatchPhoto(matchId: string, totalPhotos: number, direction: 'next' | 'prev', e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setCardPhotoIndexes((prev) => {
      const current = prev[matchId] || 0;
      const nextIdx =
        direction === 'next'
          ? (current + 1) % totalPhotos
          : (current - 1 + totalPhotos) % totalPhotos;
      return { ...prev, [matchId]: nextIdx };
    });
  }

  async function loadMoreMatches() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await api.getMatches(nextCursor);
      const items = Array.isArray(data) ? data : data.items || [];
      const initialCities = getCachedCitiesSync(items);
      setMatchCities((prev) => ({ ...prev, ...initialCities }));
      setMatches((prev) => [...prev, ...items]);
      setNextCursor(data.nextCursor || null);
      setHasMore(Boolean(data.hasMore));

      const photoUrls = items.flatMap((m: any) => (m.otherUser?.photos || []).map((p: any) => p.url)).filter(Boolean);
      preloadImages(photoUrls);
      resolveCitiesForMatches(items);
    } catch (err) {
      console.error('Failed to load more matches:', err);
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleUnmatch(matchId: string, otherUserId: string, otherName?: string) {
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
    <main className="w-full px-4 sm:px-8 py-6 min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Top Header & Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 text-white shadow-md shadow-rose-500/20">
              <IconHeart size={22} className="stroke-[2.2] fill-white/20" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Your Matches
            </h1>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            People who connected with you. Tap any match to jump straight into conversation.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* Matches Count Pill */}
          <span className="px-3.5 py-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold rounded-2xl">
            {matches.length} {matches.length === 1 ? 'Match' : 'Matches'}
          </span>

          {/* View Mode Switcher */}
          <div className="flex items-center p-1 bg-neutral-900/90 border border-neutral-800 rounded-2xl shrink-0">
            {/* Dense 5-Col Grid Option (Desktop only) */}
            <button
              type="button"
              onClick={() => setViewMode('grid5')}
              title="Expanded Grid (5 columns)"
              className={`hidden md:block p-1.5 rounded-xl transition-all ${
                viewMode === 'grid5' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <IconGridDots size={16} />
            </button>
            {/* Full Card View Option (Mobile only) */}
            <button
              type="button"
              onClick={() => setViewMode('grid1')}
              title="Full Card View"
              className={`md:hidden p-1.5 rounded-xl transition-all ${viewMode === 'grid1' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-200'
                }`}
            >
              <IconSquare size={16} />
            </button>
            {/* Standard Grid Option */}
            <button
              type="button"
              onClick={() => setViewMode('grid3')}
              title="Standard Grid"
              className={`p-1.5 rounded-xl transition-all ${viewMode === 'grid3' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-200'
                }`}
            >
              <IconLayoutGrid size={16} />
            </button>
            {/* List View Option */}
            <button
              type="button"
              onClick={() => setViewMode('list')}
              title="List View"
              className={`p-1.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-200'
                }`}
            >
              <IconList size={16} />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <MatchesSkeleton viewMode={viewMode} />
      ) : matches.length > 0 ? (
        <div
          className={
            viewMode === 'grid5'
              ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-5'
              : viewMode === 'grid3'
                ? 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6'
                : viewMode === 'grid2'
                  ? 'grid grid-cols-2 gap-3 max-w-3xl mx-auto w-full'
                  : viewMode === 'grid1'
                    ? 'flex flex-col items-center gap-6 max-w-md mx-auto w-full'
                    : 'flex flex-col gap-3 max-w-4xl mx-auto w-full'
          }
        >
          {matches.map((m) => {
            const targetUserId = m.otherUser?.userId || m.otherUser?.id || m.otherUserId;
            const photosList = m.otherUser?.photos && m.otherUser.photos.length > 0 ? m.otherUser.photos : [];
            const activePhotoIdx = cardPhotoIndexes[m.id] || 0;
            const currentPhotoUrl = photosList[activePhotoIdx]?.url || photosList[0]?.url;
            const matchLocation = matchCities[m.id] || parseCityFromBio(m.otherUser?.bio) || 'Nearby';

            return (
              <Link
                key={m.id}
                href={`/chat/${m.id}`}
                className={`group relative bg-neutral-900/90 border border-neutral-800/80 hover:border-neutral-700 hover:shadow-[0_12px_30px_-10px_rgba(0,0,0,0.8)] rounded-2xl sm:rounded-3xl overflow-hidden transition-all duration-300 ${
                  viewMode === 'list'
                    ? 'flex flex-row items-center p-2.5 sm:p-3 gap-3 sm:gap-4 w-full'
                    : 'w-full aspect-[3/4] flex flex-col'
                }`}
              >
                {/* Photo Container */}
                <div
                  className={`bg-neutral-950 overflow-hidden ${
                    viewMode === 'list'
                      ? 'relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex-shrink-0 ring-1 ring-neutral-800'
                      : 'relative w-full h-full absolute inset-0'
                  }`}
                >
                  {/* Photo Story Bars */}
                  {photosList.length > 1 && viewMode !== 'list' && (
                    <div className="absolute top-2.5 inset-x-3 flex gap-1 z-30 pointer-events-none">
                      {photosList.map((_: any, idx: number) => (
                        <div
                          key={idx}
                          className={`h-1 flex-1 rounded-full transition-all duration-300 ${idx === activePhotoIdx ? 'bg-white shadow' : 'bg-white/30'
                            }`}
                        />
                      ))}
                    </div>
                  )}

                  {currentPhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentPhotoUrl}
                      alt={m.otherUser?.name || 'Match'}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                    />
                  ) : (
                    <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-neutral-800 to-neutral-900 text-neutral-600">
                      <IconUser size={48} stroke={1.5} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />

                  {/* Left / Right Photo Arrows */}
                  {photosList.length > 1 && viewMode !== 'list' && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => cycleMatchPhoto(m.id, photosList.length, 'prev', e)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white/90 hover:text-white hover:bg-rose-500 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all z-20 cursor-pointer shadow-lg hover:scale-110"
                        title="Previous photo"
                      >
                        <IconChevronLeft size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => cycleMatchPhoto(m.id, photosList.length, 'next', e)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white/90 hover:text-white hover:bg-rose-500 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all z-20 cursor-pointer shadow-lg hover:scale-110"
                        title="Next photo"
                      >
                        <IconChevronRight size={16} />
                      </button>
                    </>
                  )}

                  {/* Clean Interactive Heart Icon for Unmatching */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleUnmatch(m.id, targetUserId, m.otherUser?.name);
                    }}
                    title="Click heart to unmatch"
                    aria-label={`Unmatch ${m.otherUser?.name || 'user'}`}
                    className={`absolute top-3.5 right-3.5 z-20 text-rose-500 opacity-90 hover:opacity-100 hover:scale-110 active:scale-90 transition-all cursor-pointer drop-shadow-[0_2px_12px_rgba(244,63,94,0.8)] ${viewMode === 'list' ? 'hidden' : ''
                      }`}
                  >
                    <IconHeartFilled size={26} className="hover:text-rose-400 transition-colors animate-pulse" />
                  </button>

                  {/* Information Overlay (Name & Location Only) */}
                  <div
                    className={
                      viewMode === 'list'
                        ? 'hidden'
                        : 'absolute bottom-0 inset-x-0 p-3 sm:p-4 text-white'
                    }
                  >
                    <div className="flex items-center gap-1 sm:gap-1.5">
                      <h3 className="text-sm sm:text-base font-bold tracking-tight truncate text-white">
                        {m.otherUser?.name || 'Match'}
                      </h3>
                      <IconCircleCheckFilled size={14} className="text-rose-400 shrink-0" />
                    </div>
                    <div className="flex items-center gap-1 text-[11px] sm:text-xs text-neutral-300/90 mt-0.5">
                      <IconMapPin size={12} className="text-rose-400 shrink-0" />
                      <span className="truncate font-medium">{matchLocation}</span>
                    </div>
                  </div>
                </div>

                {/* List View Content Section (Name & Location Only) */}
                {viewMode === 'list' ? (
                  <div className="flex-1 flex items-center justify-between min-w-0 pr-2">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm sm:text-base font-bold text-white truncate">
                          {m.otherUser?.name || 'Match'}
                        </h3>
                        <IconCircleCheckFilled size={15} className="text-rose-400 shrink-0" />
                      </div>
                      <div className="flex items-center gap-1 text-xs text-neutral-400">
                        <IconMapPin size={12} className="text-rose-400 shrink-0" />
                        <span className="truncate font-medium">{matchLocation}</span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs text-rose-400 font-medium pt-0.5">
                        <IconMessageCircle size={13} />
                        <span>Chat Now</span>
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
                      className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 hover:text-rose-400 transition-all hover:scale-105 ml-3 cursor-pointer"
                    >
                      <IconHeartFilled size={20} />
                    </button>
                  </div>
                ) : (
                  /* Action Bar for Grid Modes */
                  <div className="px-4 py-2.5 bg-neutral-900/60 border-t border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400 group-hover:text-rose-400 font-medium transition-colors">
                    <span className="flex items-center gap-1.5">
                      <IconMessageCircle size={14} className="text-rose-400" />
                      <span>Chat Now</span>
                    </span>
                    <span className="text-[11px] text-neutral-500 font-semibold group-hover:text-rose-300">
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
        <div className="flex-1 flex items-center justify-center py-12 min-h-[50vh]">
          <div className="text-center py-14 px-8 bg-neutral-900/60 border border-neutral-800/80 rounded-3xl max-w-sm w-full mx-auto shadow-2xl backdrop-blur-md">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-500/20 via-rose-500/10 to-amber-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-4 shadow-inner">
              <IconSparkles size={32} className="animate-pulse" />
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">No Matches Yet</h3>
            <p className="text-neutral-400 text-xs sm:text-sm mt-2 max-w-xs mx-auto mb-6 leading-relaxed">
              Head over to Discover, browse potential candidates, and hit the match heart icon!
            </p>
            <Link
              href="/discover"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-rose-500 via-rose-600 to-amber-500 font-bold text-xs sm:text-sm px-6 py-3.5 rounded-full text-white shadow-xl shadow-rose-500/25 hover:scale-105 active:scale-95 transition-all"
            >
              <IconCompass size={18} />
              <span>Discover Candidates</span>
            </Link>
          </div>
        </div>
      )}

      {hasMore && (
        <div className="mt-8 text-center">
          <button
            onClick={loadMoreMatches}
            disabled={loadingMore}
            className="px-6 py-2.5 bg-neutral-900 border border-neutral-800 hover:border-rose-500/50 text-neutral-200 hover:text-white font-semibold text-xs rounded-full shadow-lg transition-all disabled:opacity-50 cursor-pointer"
          >
            {loadingMore ? 'Loading matches...' : 'Load More Matches'}
          </button>
        </div>
      )}
    </main>
  );
}
